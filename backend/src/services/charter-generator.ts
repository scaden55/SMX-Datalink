import { getDb } from '../db/index.js';
import { haversineNm, boundingBox } from '../lib/geo.js';
import { logger } from '../lib/logger.js';

// ── DB row types ──────────────────────────────────────────────

interface FleetTypeRow {
  icao_type: string;
  range_nm: number;
  cruise_speed: number;
  is_cargo: number;
  cat: string | null;
  count: number;
}

interface AirportRow {
  icao: string;
  lat: number;
  lon: number;
}

interface OaAirportRow {
  ident: string;
  latitude_deg: number;
  longitude_deg: number;
  type: string;
  iso_country: string;
}

interface FleetPositionRow {
  id: number;
  icao_type: string;
  range_nm: number;
  cruise_speed: number;
  is_cargo: number;
  cat: string | null;
  location: string;
}

interface GenerationLogRow {
  month: string;
  generated_at: string;
  charter_count: number;
  event_count: number;
}

/** SQL fragment to exclude military airports from charter generation. */
const EXCLUDE_MILITARY_SQL = `
  AND a.name NOT LIKE '%Air Force Base%'
  AND a.name NOT LIKE '% AFB%'
  AND a.name NOT LIKE '%Naval Air Station%'
  AND a.name NOT LIKE '%NAS %'
  AND a.name NOT LIKE '%Marine Corps Air Station%'
  AND a.name NOT LIKE '% MCAS %'
  AND a.name NOT LIKE '%Army Airfield%'
  AND a.name NOT LIKE '% AAF%'
  AND a.name NOT LIKE '%Air National Guard%'
  AND a.name NOT LIKE '%Air Reserve Base%'
  AND a.name NOT LIKE '%Military Air%'
  AND a.name NOT LIKE '%Joint Base%'
  AND a.name NOT LIKE '%Joint Reserve%'
`;

// ── Service ───────────────────────────────────────────────────

export class CharterGeneratorService {

  /** Returns true if the given month (YYYY-MM) has not yet been generated. */
  needsGeneration(month: string): boolean {
    const row = getDb()
      .prepare('SELECT month FROM charter_generation_log WHERE month = ?')
      .get(month) as { month: string } | undefined;
    return !row;
  }

  /**
   * Force-clear existing generated charters for the month and reset the log,
   * allowing a fresh generation run from the admin panel.
   */
  forceReset(month?: string): void {
    const targetMonth = month ?? currentMonth();
    const db = getDb();

    // Delete generated charters for this month that have no active bids
    db.prepare(`
      DELETE FROM scheduled_flights
      WHERE charter_type = 'generated'
        AND expires_at LIKE ?
        AND id NOT IN (SELECT schedule_id FROM active_bids)
    `).run(`${targetMonth}%`);

    // Remove the generation log entry so needsGeneration returns true
    db.prepare('DELETE FROM charter_generation_log WHERE month = ?').run(targetMonth);

    logger.info('CharterGen', `Force-reset generation for ${targetMonth}`);
  }

  /** Generate 50–100 random charters for the given month. */
  generateMonthlyCharters(month?: string, force = false): { charterCount: number; eventCount: number } {
    const targetMonth = month ?? currentMonth();

    if (force) {
      this.forceReset(targetMonth);
    }

    if (!this.needsGeneration(targetMonth)) {
      logger.info('CharterGen', `Month ${targetMonth} already generated — skipping`);
      return { charterCount: 0, eventCount: 0 };
    }

    const db = getDb();

    // Clean up previous expired generated charters without active bids
    this.cleanupExpired();

    // Query distinct fleet types with counts (weighted selection)
    const fleetTypes = db.prepare(`
      SELECT icao_type, range_nm, cruise_speed, is_cargo, cat, COUNT(*) as count
      FROM fleet WHERE is_active = 1
      GROUP BY icao_type
    `).all() as FleetTypeRow[];

    if (fleetTypes.length === 0) {
      logger.warn('CharterGen', 'No active fleet found — skipping generation');
      return { charterCount: 0, eventCount: 0 };
    }

    // Load 26 US hub airports (legacy airports table)
    const usHubs = db.prepare('SELECT icao, lat, lon FROM airports').all() as AirportRow[];

    if (usHubs.length === 0) {
      logger.warn('CharterGen', 'No hub airports found — skipping generation');
      return { charterCount: 0, eventCount: 0 };
    }

    // Target count: random between 50–100
    const targetCount = 50 + Math.floor(Math.random() * 51);
    const expiresAt = lastDayOfMonth(targetMonth);

    const insertStmt = db.prepare(`
      INSERT INTO scheduled_flights
        (flight_number, dep_icao, arr_icao, aircraft_type, dep_time, arr_time, distance_nm, flight_time_min, days_of_week, is_active, charter_type, expires_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, '1234567', 1, 'generated', ?)
    `);

    // Build weighted aircraft selection
    const totalWeight = fleetTypes.reduce((s, f) => s + f.count, 0);

    let charterCount = 0;
    let attempts = 0;
    const maxAttempts = targetCount * 5; // Prevent infinite loops

    const txn = db.transaction(() => {
      while (charterCount < targetCount && attempts < maxAttempts) {
        attempts++;

        // Pick random aircraft type (weighted by fleet count)
        const aircraft = pickWeighted(fleetTypes, totalWeight);
        // 10% fuel reserve; fall back to 2000 NM if range is zero/unset
        const maxRange = Math.floor((aircraft.range_nm || 2000) * 0.9);

        // Roll route type: 70% domestic, 20% international, 10% global
        const roll = Math.random();
        let origin: AirportRow | null = null;
        let destination: OaAirportRow | null = null;

        const minRunway = minRunwayForCategory(aircraft.cat);

        if (roll < 0.70) {
          // Domestic: US hub → US hub (via oa_airports for more variety)
          origin = randomPick(usHubs);
          destination = this.findRandomDestination(db, origin, maxRange, 'US', minRunway);
        } else if (roll < 0.90) {
          // International: US hub → foreign or foreign → US hub
          origin = randomPick(usHubs);
          destination = this.findRandomDestination(db, origin, maxRange, null, minRunway);
        } else {
          // Global: any large airport → any within range
          const globalOrigin = this.findRandomLargeAirport(db, minRunway);
          if (!globalOrigin) continue;
          origin = { icao: globalOrigin.ident, lat: globalOrigin.latitude_deg, lon: globalOrigin.longitude_deg };
          destination = this.findRandomDestination(db, origin, maxRange, null, minRunway);
        }

        if (!origin || !destination) continue;
        if (origin.icao === destination.ident) continue;

        const distanceNm = haversineNm(origin.lat, origin.lon, destination.latitude_deg, destination.longitude_deg);
        if (distanceNm < 50) continue; // Skip trivially short routes

        const flightTimeMin = Math.round((distanceNm / aircraft.cruise_speed) * 60);

        // Random departure time 06:00–22:00 UTC
        const depHour = 6 + Math.floor(Math.random() * 17); // 6–22
        const depMin = Math.floor(Math.random() * 4) * 15; // 0, 15, 30, 45
        const depTime = `${String(depHour).padStart(2, '0')}:${String(depMin).padStart(2, '0')}`;

        const arrTotalMin = depHour * 60 + depMin + flightTimeMin;
        const arrH = Math.floor(arrTotalMin / 60) % 24;
        const arrM = arrTotalMin % 60;
        const arrTime = `${String(arrH).padStart(2, '0')}:${String(arrM).padStart(2, '0')}`;

        const flightNumber = randomFlightNumber(db);

        insertStmt.run(
          flightNumber, origin.icao, destination.ident, aircraft.icao_type,
          depTime, arrTime, distanceNm, flightTimeMin, expiresAt,
        );
        charterCount++;
      }

      // ── Location-aware pass: ~20-30% of target, matched to fleet positions ──
      const locationTarget = Math.floor(targetCount * (0.20 + Math.random() * 0.10));
      let locationCount = 0;

      const fleetPositions = db.prepare(`
        SELECT id, icao_type, range_nm, cruise_speed, is_cargo, cat,
               COALESCE(location_icao, base_icao) AS location
        FROM fleet
        WHERE status = 'active' AND COALESCE(location_icao, base_icao) IS NOT NULL
      `).all() as FleetPositionRow[];

      // Cargo-first sort (SMA Virtual identity)
      fleetPositions.sort((a, b) => b.is_cargo - a.is_cargo);

      for (const ac of fleetPositions) {
        if (locationCount >= locationTarget) break;

        const locCoords = lookupCoords(db, ac.location);
        if (!locCoords) continue;

        const origin: AirportRow = { icao: ac.location, lat: locCoords.lat, lon: locCoords.lon };
        const maxRange = Math.floor((ac.range_nm || 2000) * 0.9);
        const minRwy = minRunwayForCategory(ac.cat);

        // Generate 1-2 charters from this aircraft's location
        const chartersForAc = 1 + Math.floor(Math.random() * 2);
        for (let j = 0; j < chartersForAc && locationCount < locationTarget; j++) {
          const dest = this.findRandomDestination(db, origin, maxRange, null, minRwy);
          if (!dest || origin.icao === dest.ident) continue;

          const distNm = haversineNm(origin.lat, origin.lon, dest.latitude_deg, dest.longitude_deg);
          if (distNm < 50) continue;

          const ftMin = Math.round((distNm / ac.cruise_speed) * 60);
          const dH = 6 + Math.floor(Math.random() * 17);
          const dM = Math.floor(Math.random() * 4) * 15;
          const dTime = `${String(dH).padStart(2, '0')}:${String(dM).padStart(2, '0')}`;
          const aTotalMin = dH * 60 + dM + ftMin;
          const aH = Math.floor(aTotalMin / 60) % 24;
          const aM = aTotalMin % 60;
          const aTime = `${String(aH).padStart(2, '0')}:${String(aM).padStart(2, '0')}`;

          const fn = randomFlightNumber(db);
          insertStmt.run(fn, origin.icao, dest.ident, ac.icao_type, dTime, aTime, distNm, ftMin, expiresAt);
          charterCount++;
          locationCount++;
        }
      }

      logger.info('CharterGen', `Location-aware pass: ${locationCount} of ${locationTarget} target`);

      // Log generation
      db.prepare(`
        INSERT INTO charter_generation_log (month, charter_count, event_count)
        VALUES (?, ?, 0)
      `).run(targetMonth, charterCount);
    });

    txn();
    logger.info('CharterGen', `Generated ${charterCount} charters for ${targetMonth} (${attempts} attempts)`);
    return { charterCount, eventCount: 0 };
  }

  /** Remove expired generated/event charters that have no active bids. */
  cleanupExpired(): number {
    const result = getDb().prepare(`
      DELETE FROM scheduled_flights
      WHERE charter_type IN ('generated', 'event')
        AND expires_at IS NOT NULL
        AND expires_at < datetime('now')
        AND id NOT IN (SELECT schedule_id FROM active_bids)
    `).run();

    if (result.changes > 0) {
      logger.info('CharterGen', `Cleaned up ${result.changes} expired charters`);
    }
    return result.changes;
  }

  // ── Private helpers ─────────────────────────────────────────

  private findRandomDestination(
    db: ReturnType<typeof getDb>,
    origin: AirportRow,
    maxRangeNm: number,
    countryFilter: string | null,
    minRunwayFt: number,
  ): OaAirportRow | null {
    const bbox = boundingBox(origin.lat, origin.lon, maxRangeNm);

    let sql = `
      SELECT a.ident, a.latitude_deg, a.longitude_deg, a.type, a.iso_country
      FROM oa_airports a
      WHERE a.type IN ('large_airport', 'medium_airport')
        AND a.latitude_deg BETWEEN ? AND ?
        AND a.longitude_deg BETWEEN ? AND ?
        AND a.ident != ?
        AND EXISTS (
          SELECT 1 FROM oa_runways rw
          WHERE rw.airport_ident = a.ident
            AND rw.length_ft >= ?
            AND rw.closed = 0
            AND rw.surface IN ('ASP','CON','ASPH','PEM','BIT','ASPH-G','CONC','Asphalt','Concrete')
        )
        ${EXCLUDE_MILITARY_SQL}
    `;
    const params: unknown[] = [bbox.minLat, bbox.maxLat, bbox.minLon, bbox.maxLon, origin.icao, minRunwayFt];

    if (countryFilter) {
      sql += ' AND a.iso_country = ?';
      params.push(countryFilter);
    }

    // Bias towards large airports: large_airport gets 4× higher selection probability
    // ABS() required because SQLite RANDOM() returns signed integers — dividing
    // a negative value by 4 makes it LESS negative (higher), reversing the bias.
    sql += ' ORDER BY (ABS(RANDOM()) / (CASE WHEN a.type = \'large_airport\' THEN 4.0 ELSE 1.0 END)) LIMIT 20';

    const candidates = db.prepare(sql).all(...params) as OaAirportRow[];

    // Filter by exact haversine distance
    for (const c of candidates) {
      const dist = haversineNm(origin.lat, origin.lon, c.latitude_deg, c.longitude_deg);
      if (dist <= maxRangeNm && dist >= 50) return c;
    }

    return null;
  }

  private findRandomLargeAirport(db: ReturnType<typeof getDb>, minRunwayFt: number): OaAirportRow | null {
    const row = db.prepare(`
      SELECT a.ident, a.latitude_deg, a.longitude_deg, a.type, a.iso_country
      FROM oa_airports a
      WHERE a.type = 'large_airport'
        AND EXISTS (
          SELECT 1 FROM oa_runways rw
          WHERE rw.airport_ident = a.ident
            AND rw.length_ft >= ?
            AND rw.closed = 0
            AND rw.surface IN ('ASP','CON','ASPH','PEM','BIT','ASPH-G','CONC','Asphalt','Concrete')
        )
        ${EXCLUDE_MILITARY_SQL}
      ORDER BY RANDOM()
      LIMIT 1
    `).get(minRunwayFt) as OaAirportRow | undefined;
    return row ?? null;
  }
}

// ── Utility functions ─────────────────────────────────────────

export function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function lastDayOfMonth(month: string): string {
  const [year, mon] = month.split('-').map(Number);
  // Day 0 of next month = last day of current month
  const lastDay = new Date(year, mon, 0).getDate();
  return `${month}-${String(lastDay).padStart(2, '0')} 23:59:59`;
}

/** Map ICAO wake turbulence category to minimum runway length in feet. */
export function minRunwayForCategory(cat: string | null): number {
  switch (cat?.toUpperCase()) {
    case 'H': return 8000;  // Heavy (MD-11F, 747, 777, etc.)
    case 'M': return 5500;  // Medium (737, A320, etc.)
    case 'L': return 3500;  // Light (turboprops, light jets)
    default:  return 6000;  // Unknown — conservative default
  }
}

function randomPick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** Generate a unique random SMX- flight number (100–9999). */
export function randomFlightNumber(db: ReturnType<typeof getDb>): string {
  const existing = new Set(
    (db.prepare("SELECT flight_number FROM scheduled_flights WHERE flight_number LIKE 'SMX-%'").all() as { flight_number: string }[])
      .map(r => r.flight_number),
  );
  for (let i = 0; i < 500; i++) {
    const num = 100 + Math.floor(Math.random() * 9900); // 100–9999
    const fn = `SMX-${num}`;
    if (!existing.has(fn)) return fn;
  }
  // Fallback: find first unused number sequentially
  for (let n = 100; n <= 9999; n++) {
    const fn = `SMX-${n}`;
    if (!existing.has(fn)) return fn;
  }
  throw new Error('No available SMX- flight numbers');
}

/** Look up airport coordinates from legacy hubs or oa_airports. */
function lookupCoords(db: ReturnType<typeof getDb>, icao: string): { lat: number; lon: number } | null {
  const legacy = db.prepare('SELECT lat, lon FROM airports WHERE icao = ?').get(icao) as { lat: number; lon: number } | undefined;
  if (legacy) return legacy;
  const oa = db.prepare('SELECT latitude_deg AS lat, longitude_deg AS lon FROM oa_airports WHERE ident = ? AND latitude_deg IS NOT NULL').get(icao) as { lat: number; lon: number } | undefined;
  return oa ?? null;
}

function pickWeighted(types: FleetTypeRow[], totalWeight: number): FleetTypeRow {
  let r = Math.random() * totalWeight;
  for (const t of types) {
    r -= t.count;
    if (r <= 0) return t;
  }
  return types[types.length - 1];
}
