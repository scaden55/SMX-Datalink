/**
 * Auto-import OurAirports data on first startup (when oa_airports is empty).
 * Downloads airports and runways CSVs, parses, and bulk-inserts into SQLite.
 */

import { parse } from 'csv-parse/sync';
import { getDb } from '../db/index.js';
import { logger } from '../lib/logger.js';

const BASE_URL = 'https://davidmegginson.github.io/ourairports-data';
const VALID_TYPES = new Set(['large_airport', 'medium_airport', 'small_airport']);

// ── Helpers ──────────────────────────────────────────────────

function intOrNull(v: string | undefined): number | null {
  if (!v || v.trim() === '') return null;
  const n = parseInt(v, 10);
  return Number.isNaN(n) ? null : n;
}

function floatOrNull(v: string | undefined): number | null {
  if (!v || v.trim() === '') return null;
  const n = parseFloat(v);
  return Number.isNaN(n) ? null : n;
}

function strOrNull(v: string | undefined): string | null {
  if (!v || v.trim() === '') return null;
  return v.trim();
}

async function downloadCsv(name: string): Promise<string> {
  const res = await fetch(`${BASE_URL}/${name}`);
  if (!res.ok) throw new Error(`Failed to fetch ${name}: ${res.status}`);
  return res.text();
}

// ── Public API ───────────────────────────────────────────────

/** Returns true if oa_airports is empty and needs to be populated. */
export function needsAirportData(): boolean {
  const row = getDb().prepare('SELECT COUNT(*) as count FROM oa_airports').get() as { count: number };
  return row.count === 0;
}

/**
 * Download OurAirports CSVs and populate oa_airports, oa_runways, oa_frequencies.
 * Only call when needsAirportData() returns true.
 */
export async function importAirportData(): Promise<{ airports: number; runways: number; frequencies: number }> {
  logger.info('AirportData', 'Downloading OurAirports data (first-time setup)...');

  const [airportsCsv, runwaysCsv, freqCsv] = await Promise.all([
    downloadCsv('airports.csv'),
    downloadCsv('runways.csv'),
    downloadCsv('airport-frequencies.csv'),
  ]);

  const db = getDb();
  const importedIdents = new Set<string>();

  // ── Airports ─────────────────────────────────────────────
  const airportRows: Record<string, string>[] = parse(airportsCsv, { columns: true, skip_empty_lines: true });
  const insertAirport = db.prepare(`
    INSERT INTO oa_airports (
      id, ident, type, name, latitude_deg, longitude_deg, elevation_ft,
      continent, iso_country, iso_region, municipality, scheduled_service,
      gps_code, iata_code, local_code, home_link, wikipedia_link, keywords
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `);

  const airportCount = db.transaction(() => {
    let count = 0;
    for (const r of airportRows) {
      if (!VALID_TYPES.has(r.type)) continue;
      const ident = r.ident?.trim();
      if (!ident) continue;
      insertAirport.run(
        intOrNull(r.id), ident, r.type, r.name ?? '',
        floatOrNull(r.latitude_deg), floatOrNull(r.longitude_deg), intOrNull(r.elevation_ft),
        strOrNull(r.continent), strOrNull(r.iso_country), strOrNull(r.iso_region),
        strOrNull(r.municipality), strOrNull(r.scheduled_service),
        strOrNull(r.gps_code), strOrNull(r.iata_code), strOrNull(r.local_code),
        strOrNull(r.home_link), strOrNull(r.wikipedia_link), strOrNull(r.keywords),
      );
      importedIdents.add(ident);
      count++;
    }
    return count;
  })();

  // ── Runways ──────────────────────────────────────────────
  const runwayRows: Record<string, string>[] = parse(runwaysCsv, { columns: true, skip_empty_lines: true });
  const insertRunway = db.prepare(`
    INSERT INTO oa_runways (
      id, airport_ref, airport_ident, length_ft, width_ft, surface,
      lighted, closed,
      le_ident, le_latitude_deg, le_longitude_deg, le_elevation_ft,
      le_heading_degT, le_displaced_threshold_ft,
      he_ident, he_latitude_deg, he_longitude_deg, he_elevation_ft,
      he_heading_degT, he_displaced_threshold_ft
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `);

  const runwayCount = db.transaction(() => {
    let count = 0;
    for (const r of runwayRows) {
      const ident = r.airport_ident?.trim();
      if (!ident || !importedIdents.has(ident)) continue;
      insertRunway.run(
        intOrNull(r.id), intOrNull(r.airport_ref), ident,
        intOrNull(r.length_ft), intOrNull(r.width_ft), strOrNull(r.surface),
        intOrNull(r.lighted), intOrNull(r.closed),
        strOrNull(r.le_ident), floatOrNull(r.le_latitude_deg), floatOrNull(r.le_longitude_deg),
        floatOrNull(r.le_elevation_ft), floatOrNull(r.le_heading_degT), floatOrNull(r.le_displaced_threshold_ft),
        strOrNull(r.he_ident), floatOrNull(r.he_latitude_deg), floatOrNull(r.he_longitude_deg),
        floatOrNull(r.he_elevation_ft), floatOrNull(r.he_heading_degT), floatOrNull(r.he_displaced_threshold_ft),
      );
      count++;
    }
    return count;
  })();

  // ── Frequencies ──────────────────────────────────────────
  const freqRows: Record<string, string>[] = parse(freqCsv, { columns: true, skip_empty_lines: true });
  const insertFreq = db.prepare(`
    INSERT INTO oa_frequencies (id, airport_ref, airport_ident, type, description, frequency_mhz)
    VALUES (?,?,?,?,?,?)
  `);

  const freqCount = db.transaction(() => {
    let count = 0;
    for (const r of freqRows) {
      const ident = r.airport_ident?.trim();
      if (!ident || !importedIdents.has(ident)) continue;
      insertFreq.run(
        intOrNull(r.id), intOrNull(r.airport_ref), ident,
        strOrNull(r.type), strOrNull(r.description), floatOrNull(r.frequency_mhz),
      );
      count++;
    }
    return count;
  })();

  logger.info('AirportData', `Imported ${airportCount} airports, ${runwayCount} runways, ${freqCount} frequencies`);
  return { airports: airportCount, runways: runwayCount, frequencies: freqCount };
}
