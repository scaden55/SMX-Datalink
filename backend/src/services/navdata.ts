import { getDb } from '../db/index.js';
import type { NavdataSearchResult, RouteFixResult, NavaidMapItem } from '@acars/shared';

// ── DB row types ────────────────────────────────────────────

interface WaypointRow {
  ident: string;
  lat: number;
  lon: number;
}

interface NavaidRow {
  ident: string;
  type: string;
  lat: number;
  lon: number;
  frequency: number | null;
  name: string | null;
}

interface AirwayRow {
  ident: string;
}

interface AirwaySegmentRow {
  fix_ident: string;
  fix_lat: number;
  fix_lon: number;
  next_fix_ident: string;
  next_fix_lat: number;
  next_fix_lon: number;
}

// ── Default types for autocomplete ──────────────────────────

const DEFAULT_SEARCH_TYPES = ['fix', 'VOR', 'NDB', 'airway'];

// ── Service ─────────────────────────────────────────────────

export class NavdataService {
  /**
   * Search waypoints, navaids, and airways by ident prefix.
   * Returns deduped, sorted results with exact matches first.
   */
  search(query: string, types?: string[], limit = 20): NavdataSearchResult[] {
    const db = getDb();
    const q = query.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (q.length < 1 || q.length > 20) return [];

    const allowed = types?.length ? types : DEFAULT_SEARCH_TYPES;
    const results: NavdataSearchResult[] = [];

    // Waypoints (fixes)
    if (allowed.includes('fix')) {
      const rows = db.prepare(
        `SELECT ident, lat, lon FROM waypoints WHERE ident LIKE ? LIMIT 50`
      ).all(`${q}%`) as WaypointRow[];

      // Deduplicate — same ident may exist in multiple regions; keep first
      const seen = new Set<string>();
      for (const r of rows) {
        if (seen.has(r.ident)) continue;
        seen.add(r.ident);
        results.push({
          ident: r.ident,
          type: 'fix',
          lat: r.lat,
          lon: r.lon,
          frequency: null,
          name: null,
        });
      }
    }

    // Navaids (VOR, NDB, DME, TACAN, etc.)
    const navTypes = allowed.filter((t) => t !== 'fix' && t !== 'airway');
    if (navTypes.length > 0) {
      const placeholders = navTypes.map(() => '?').join(',');
      const rows = db.prepare(
        `SELECT ident, type, lat, lon, frequency, name
         FROM navaids
         WHERE ident LIKE ? AND type IN (${placeholders})
         LIMIT 50`
      ).all(`${q}%`, ...navTypes) as NavaidRow[];

      // Deduplicate by ident+type
      const seen = new Set<string>();
      for (const r of rows) {
        const key = `${r.ident}:${r.type}`;
        if (seen.has(key)) continue;
        seen.add(key);
        results.push({
          ident: r.ident,
          type: r.type as NavdataSearchResult['type'],
          lat: r.lat,
          lon: r.lon,
          frequency: r.frequency,
          name: r.name,
        });
      }
    }

    // Airways (deduplicated — same airway has hundreds of segments)
    if (allowed.includes('airway')) {
      const rows = db.prepare(
        `SELECT DISTINCT ident FROM airways WHERE ident LIKE ? LIMIT 20`
      ).all(`${q}%`) as AirwayRow[];

      for (const r of rows) {
        results.push({
          ident: r.ident,
          type: 'airway',
          lat: null,
          lon: null,
          frequency: null,
          name: null,
        });
      }
    }

    // Sort: exact matches first, then alphabetical
    results.sort((a, b) => {
      const aExact = a.ident === q ? 0 : 1;
      const bExact = b.ident === q ? 0 : 1;
      if (aExact !== bExact) return aExact - bExact;
      return a.ident.localeCompare(b.ident);
    });

    return results.slice(0, limit);
  }

  /**
   * Resolve a route string (array of tokens) into ordered waypoints.
   * Handles direct fixes, navaids, airports, DCT, and airway expansion via BFS.
   */
  resolveRoute(tokens: string[]): RouteFixResult[] {
    const db = getDb();
    const results: RouteFixResult[] = [];

    const lookupFix = (ident: string, nearLat?: number, nearLon?: number): RouteFixResult | null => {
      // Check airports first (4-letter ICAO) — try legacy hubs then global oa_airports
      if (ident.length === 4) {
        const apt = db.prepare(
          `SELECT icao, lat, lon FROM airports WHERE icao = ?`
        ).get(ident) as { icao: string; lat: number; lon: number } | undefined;
        if (apt) return { ident: apt.icao, lat: apt.lat, lon: apt.lon, type: 'airport' };

        const oaApt = db.prepare(
          `SELECT ident, latitude_deg AS lat, longitude_deg AS lon FROM oa_airports WHERE ident = ? AND latitude_deg IS NOT NULL`
        ).get(ident) as { ident: string; lat: number; lon: number } | undefined;
        if (oaApt) return { ident: oaApt.ident, lat: oaApt.lat, lon: oaApt.lon, type: 'airport' };
      }

      // Check navaids (VOR/NDB preferred over fixes for route resolution)
      const navaids = db.prepare(
        `SELECT ident, type, lat, lon FROM navaids WHERE ident = ? AND type IN ('VOR','NDB') LIMIT 10`
      ).all(ident) as NavaidRow[];

      if (navaids.length > 0) {
        const best = nearLat != null && nearLon != null
          ? pickClosest(navaids, nearLat, nearLon)
          : navaids[0];
        return {
          ident: best.ident,
          lat: best.lat,
          lon: best.lon,
          type: best.type === 'VOR' ? 'vor' : 'ndb',
        };
      }

      // Check waypoints (fixes)
      const fixes = db.prepare(
        `SELECT ident, lat, lon FROM waypoints WHERE ident = ? LIMIT 10`
      ).all(ident) as WaypointRow[];

      if (fixes.length > 0) {
        const best = nearLat != null && nearLon != null
          ? pickClosest(fixes, nearLat, nearLon)
          : fixes[0];
        return { ident: best.ident, lat: best.lat, lon: best.lon, type: 'fix' };
      }

      return null;
    };

    const isAirway = (ident: string): boolean => {
      const row = db.prepare(`SELECT 1 FROM airways WHERE ident = ? LIMIT 1`).get(ident);
      return row != null;
    };

    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i].toUpperCase().replace(/[^A-Z0-9]/g, '');
      if (!token || token === 'DCT' || token === 'SID' || token === 'STAR') continue;

      const prev = results[results.length - 1];

      if (isAirway(token)) {
        // Airway expansion: need previous fix and next token as exit fix
        const exitIdent = tokens[i + 1]?.toUpperCase().replace(/[^A-Z0-9]/g, '');
        if (!prev || !exitIdent) continue;

        const expanded = this.expandAirway(db, token, prev.ident, exitIdent, prev.lat, prev.lon);
        if (expanded.length > 0) {
          // Push intermediate fixes (skip entry — already in results)
          for (const fix of expanded) {
            results.push(fix);
          }
          i++; // skip exit token — it was added by expandAirway
        } else {
          // BFS failed — just add exit fix directly
          const exitFix = lookupFix(exitIdent, prev.lat, prev.lon);
          if (exitFix) results.push(exitFix);
          i++;
        }
      } else {
        const fix = lookupFix(token, prev?.lat, prev?.lon);
        if (fix) results.push(fix);
      }
    }

    return results;
  }

  /**
   * Get navaids within a geographic bounding box, filtered by zoom level.
   */
  getNavaidsInBounds(
    latN: number,
    lonW: number,
    latS: number,
    lonE: number,
    types: string[] | undefined,
    zoom: number,
  ): NavaidMapItem[] {
    const db = getDb();

    // Zoom-based type filtering to reduce payload at low zoom
    let allowedTypes: string[];
    if (zoom < 6) {
      allowedTypes = ['VOR'];
    } else if (zoom < 8) {
      allowedTypes = ['VOR', 'NDB'];
    } else {
      allowedTypes = types?.length ? types : ['VOR', 'NDB', 'DME', 'DME_STANDALONE', 'TACAN'];
    }

    // Exclude marker/glideslope types (type_code 5,6,7,8)
    const placeholders = allowedTypes.map(() => '?').join(',');
    const rows = db.prepare(
      `SELECT ident, type, lat, lon, frequency, name
       FROM navaids
       WHERE lat BETWEEN ? AND ?
         AND lon BETWEEN ? AND ?
         AND type IN (${placeholders})
         AND type_code NOT IN (5, 6, 7, 8)
       LIMIT 500`
    ).all(latS, latN, lonW, lonE, ...allowedTypes) as NavaidRow[];

    return rows.map((r) => ({
      ident: r.ident,
      type: r.type,
      lat: r.lat,
      lon: r.lon,
      frequency: r.frequency,
      name: r.name,
    }));
  }

  // ── Private: Airway BFS expansion ──────────────────────────

  private expandAirway(
    db: ReturnType<typeof getDb>,
    airwayIdent: string,
    entryIdent: string,
    exitIdent: string,
    entryLat: number,
    entryLon: number,
  ): RouteFixResult[] {
    // Load all segments for this airway
    const segments = db.prepare(
      `SELECT fix_ident, fix_lat, fix_lon, next_fix_ident, next_fix_lat, next_fix_lon
       FROM airways WHERE ident = ?`
    ).all(airwayIdent) as AirwaySegmentRow[];

    if (segments.length === 0) return [];

    // Build undirected adjacency graph: fixIdent → [{ ident, lat, lon }]
    const graph = new Map<string, { ident: string; lat: number; lon: number }[]>();

    const addEdge = (from: string, to: string, toLat: number, toLon: number) => {
      let neighbors = graph.get(from);
      if (!neighbors) {
        neighbors = [];
        graph.set(from, neighbors);
      }
      if (!neighbors.some((n) => n.ident === to)) {
        neighbors.push({ ident: to, lat: toLat, lon: toLon });
      }
    };

    // Also store coordinates for each fix
    const coords = new Map<string, { lat: number; lon: number }>();

    for (const seg of segments) {
      addEdge(seg.fix_ident, seg.next_fix_ident, seg.next_fix_lat, seg.next_fix_lon);
      addEdge(seg.next_fix_ident, seg.fix_ident, seg.fix_lat, seg.fix_lon);
      coords.set(seg.fix_ident, { lat: seg.fix_lat, lon: seg.fix_lon });
      coords.set(seg.next_fix_ident, { lat: seg.next_fix_lat, lon: seg.next_fix_lon });
    }

    // Find entry fix on the airway (closest match to provided position)
    let entryOnAirway = entryIdent;
    if (!graph.has(entryIdent)) {
      // Entry fix name might not exactly match — find closest fix on airway
      let minDist = Infinity;
      for (const [fixId, c] of coords) {
        const d = haversineApprox(entryLat, entryLon, c.lat, c.lon);
        if (d < minDist) {
          minDist = d;
          entryOnAirway = fixId;
        }
      }
      if (!graph.has(entryOnAirway)) return [];
    }

    if (!graph.has(exitIdent)) return [];

    // BFS from entry to exit
    const visited = new Set<string>();
    const parent = new Map<string, string>();
    const queue: string[] = [entryOnAirway];
    visited.add(entryOnAirway);

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (current === exitIdent) break;

      for (const neighbor of graph.get(current) ?? []) {
        if (!visited.has(neighbor.ident)) {
          visited.add(neighbor.ident);
          parent.set(neighbor.ident, current);
          queue.push(neighbor.ident);
        }
      }
    }

    if (!visited.has(exitIdent)) return [];

    // Reconstruct path (excluding entry — already in results)
    const path: string[] = [];
    let curr = exitIdent;
    while (curr !== entryOnAirway) {
      path.unshift(curr);
      const p = parent.get(curr);
      if (!p) return [];
      curr = p;
    }

    return path.map((ident) => {
      const c = coords.get(ident)!;
      return {
        ident,
        lat: c.lat,
        lon: c.lon,
        type: ident === exitIdent ? 'fix' as const : 'airway-fix' as const,
        airway: airwayIdent,
      };
    });
  }
}

// ── Helpers ─────────────────────────────────────────────────

function pickClosest<T extends { lat: number; lon: number }>(items: T[], lat: number, lon: number): T {
  let best = items[0];
  let bestDist = haversineApprox(lat, lon, best.lat, best.lon);
  for (let i = 1; i < items.length; i++) {
    const d = haversineApprox(lat, lon, items[i].lat, items[i].lon);
    if (d < bestDist) {
      bestDist = d;
      best = items[i];
    }
  }
  return best;
}

/** Quick squared-distance approximation (fine for "nearest" comparisons at aviation scale) */
function haversineApprox(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLat = lat2 - lat1;
  const dLon = (lon2 - lon1) * Math.cos(((lat1 + lat2) / 2) * (Math.PI / 180));
  return dLat * dLat + dLon * dLon;
}
