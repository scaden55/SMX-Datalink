/**
 * import-schedules.ts
 *
 * Standalone script to parse the SMA schedule CSV and import routes
 * into the scheduled_flights table. Also seeds the airports table
 * from oa_airports for all unique airports found in the CSV.
 *
 * Usage:  npm run import:schedules -w backend
 *    or:  tsx scripts/import-schedules.ts [path/to/schedule.csv]
 */

import Database from 'better-sqlite3';
import { parse } from 'csv-parse/sync';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Great-circle distance in nautical miles */
function haversineNm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3440.065; // Earth radius in NM
  const toRad = (d: number) => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

/** Map day-of-week names to digits (Mon=1 ... Sun=7) */
const DAY_MAP: Record<string, string> = {
  MONDAY: '1',
  TUESDAY: '2',
  WEDNESDAY: '3',
  THURSDAY: '4',
  FRIDAY: '5',
  SATURDAY: '6',
  SUNDAY: '7',
};

/**
 * Parse the DAYS/DATES & CONDITIONS field into a days_of_week string.
 *   - Empty / date ranges / unrecognised → "1234567" (daily)
 *   - "WEEKDAYS" or "WEEKDAYS ONLY PPR"  → "12345"
 *   - Specific day names (slash-separated) → mapped digits
 */
function parseDaysOfWeek(raw: string): string {
  const val = raw.trim().toUpperCase();
  if (!val) return '1234567';

  // Explicit shorthands
  if (val === 'DAILY') return '1234567';
  if (val === 'M-F') return '12345';

  // Weekdays variants
  if (val.startsWith('WEEKDAYS')) return '12345';

  // Check for individual day names
  const found: string[] = [];
  for (const [name, digit] of Object.entries(DAY_MAP)) {
    if (val.includes(name)) found.push(digit);
  }
  if (found.length > 0) {
    return found.sort().join('');
  }

  // Date range or anything else → daily
  return '1234567';
}

/**
 * Flatten a multi-line handler address to a single line.
 * Newlines become " | ", excess whitespace is trimmed.
 */
function flattenHandler(raw: string | undefined): string | null {
  if (!raw || !raw.trim()) return null;
  return raw
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(Boolean)
    .join(' | ');
}

/** Derive country ISO-2 from ICAO prefix */
function countryFromIcao(icao: string): string {
  if (icao.startsWith('K') || icao.startsWith('PH') || icao.startsWith('PA') || icao.startsWith('PF') || icao.startsWith('TJ')) return 'US';
  if (icao.startsWith('CY')) return 'CA';
  if (icao.startsWith('ED')) return 'DE';
  if (icao.startsWith('HK')) return 'KE';
  if (icao.startsWith('SB')) return 'BR';
  if (icao.startsWith('SP')) return 'PE';
  if (icao.startsWith('SK')) return 'CO';
  if (icao.startsWith('SM')) return 'SR';
  if (icao.startsWith('MM')) return 'MX';
  if (icao.startsWith('MD')) return 'DO';
  if (icao.startsWith('MK')) return 'JM';
  if (icao.startsWith('MT')) return 'HT';
  if (icao.startsWith('MU')) return 'CU';
  if (icao.startsWith('MY')) return 'BS';
  if (icao.startsWith('RJ')) return 'JP';
  return 'XX';
}

/** Derive timezone from ICAO prefix (rough approximation) */
function timezoneFromIcao(icao: string): string {
  if (icao.startsWith('PA') || icao.startsWith('PF')) return 'America/Anchorage';
  if (icao.startsWith('PH')) return 'Pacific/Honolulu';
  if (icao.startsWith('CY')) return 'America/Toronto';
  if (icao.startsWith('ED')) return 'Europe/Berlin';
  if (icao.startsWith('HK')) return 'Africa/Nairobi';
  if (icao.startsWith('SB')) return 'America/Sao_Paulo';
  if (icao.startsWith('SP')) return 'America/Lima';
  if (icao.startsWith('SK')) return 'America/Bogota';
  if (icao.startsWith('SM')) return 'America/Paramaribo';
  if (icao.startsWith('MM')) return 'America/Mexico_City';
  if (icao.startsWith('MD')) return 'America/Santo_Domingo';
  if (icao.startsWith('MK')) return 'America/Jamaica';
  if (icao.startsWith('MT')) return 'America/Port-au-Prince';
  if (icao.startsWith('MU')) return 'America/Havana';
  if (icao.startsWith('MY')) return 'America/Nassau';
  if (icao.startsWith('RJ')) return 'Asia/Tokyo';
  if (icao.startsWith('TJ')) return 'America/Puerto_Rico';
  return 'America/New_York'; // default for K-prefixed US airports
}

// ---------------------------------------------------------------------------
// ICAO alias map — old/non-standard codes → current oa_airports ident
// ---------------------------------------------------------------------------
const ICAO_ALIASES: Record<string, string> = {
  'SPJC': 'SPIM', // Lima Jorge Chávez — ICAO changed from SPJC to SPIM in 2017
};

/** Resolve an ICAO code through the alias map, or return as-is. */
function resolveIcao(icao: string): string {
  return ICAO_ALIASES[icao] ?? icao;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  const start = Date.now();
  console.log('=== SMA Schedule Import ===\n');

  // 1. Resolve CSV path (CLI arg or default)
  const csvArg = process.argv[2];
  const csvPath = csvArg
    ? resolve(csvArg)
    : resolve(__dirname, '..', '..', 'schedule.csv');
  console.log(`CSV file: ${csvPath}`);

  const csvData = readFileSync(csvPath, 'utf-8');

  // 2. Open database (same path as import-airports.ts)
  const dbPath = resolve(__dirname, '..', 'data', 'acars.db');
  console.log(`Database: ${dbPath}\n`);
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // 3. Parse CSV — columns: true uses the header row
  const records: Record<string, string>[] = parse(csvData, {
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
    trim: false, // we handle trimming ourselves to preserve handler addresses
  });

  console.log(`Parsed ${records.length} CSV rows\n`);

  // 4. Collect unique airports
  const uniqueIcaos = new Set<string>();
  for (const row of records) {
    const origin = row['ORIGIN']?.trim();
    const dest = row['DESTINATION']?.trim();
    if (origin) uniqueIcaos.add(origin);
    if (dest) uniqueIcaos.add(dest);
  }
  console.log(`Unique airports: ${uniqueIcaos.size}`);

  // 5. Look up coordinates from oa_airports
  const lookupOa = db.prepare(`
    SELECT ident, name, municipality, iso_region, latitude_deg, longitude_deg, elevation_ft
    FROM oa_airports WHERE ident = ? AND latitude_deg IS NOT NULL
  `);

  type OaRow = {
    ident: string;
    name: string;
    municipality: string | null;
    iso_region: string | null;
    latitude_deg: number;
    longitude_deg: number;
    elevation_ft: number | null;
  };

  const airportCoords = new Map<string, { lat: number; lon: number }>();
  const airportData = new Map<string, OaRow>();
  const missingAirports: string[] = [];

  for (const icao of uniqueIcaos) {
    const resolved = resolveIcao(icao);
    const oa = lookupOa.get(resolved) as OaRow | undefined;
    if (oa) {
      // Store under the original CSV code so route lookups work
      airportCoords.set(icao, { lat: oa.latitude_deg, lon: oa.longitude_deg });
      airportData.set(icao, { ...oa, ident: resolved });
    } else {
      missingAirports.push(icao);
    }
  }

  if (missingAirports.length > 0) {
    console.log(`\nWARNING: ${missingAirports.length} airports NOT found in oa_airports:`);
    console.log(`  ${missingAirports.sort().join(', ')}`);
    console.log('  (Routes to/from these airports will be skipped)\n');
  }

  // 6. Seed airports table from oa_airports data
  console.log('Seeding airports table...');
  const insertAirport = db.prepare(`
    INSERT OR IGNORE INTO airports (icao, name, city, state, country, lat, lon, elevation, timezone)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const seedAirportsTxn = db.transaction(() => {
    let seeded = 0;
    for (const [icao, oa] of airportData.entries()) {
      const state = oa.iso_region?.split('-')[1] ?? '';
      const country = countryFromIcao(icao);
      const timezone = timezoneFromIcao(icao);

      insertAirport.run(
        icao, oa.name, oa.municipality ?? '', state, country,
        oa.latitude_deg, oa.longitude_deg, oa.elevation_ft ?? 0, timezone
      );
      seeded++;
    }
    return seeded;
  });

  const airportSeeded = seedAirportsTxn();
  console.log(`  ${airportSeeded} airports upserted\n`);

  // 7. Delete existing SVA- flights for re-runnability
  const deleted = db.prepare(`DELETE FROM scheduled_flights WHERE flight_number LIKE 'SVA-%'`).run();
  if (deleted.changes > 0) {
    console.log(`Deleted ${deleted.changes} existing SVA- flights`);
  }

  // 8. Insert routes
  const insertFlight = db.prepare(`
    INSERT INTO scheduled_flights (
      flight_number, dep_icao, arr_icao, aircraft_type, dep_time, arr_time,
      distance_nm, flight_time_min, days_of_week, is_active,
      origin_handler, dest_handler, fare_code, cargo_remarks, group_class
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?)
  `);

  const DEFAULT_CRUISE_KTS = 450;

  let imported = 0;
  let skipped = 0;

  const importTxn = db.transaction(() => {
    for (const row of records) {
      const mission = row['MISSION']?.trim();
      const origin = row['ORIGIN']?.trim();
      const dest = row['DESTINATION']?.trim();

      if (!mission || !origin || !dest) {
        skipped++;
        continue;
      }

      // Look up coordinates
      const depCoord = airportCoords.get(origin);
      const arrCoord = airportCoords.get(dest);
      if (!depCoord || !arrCoord) {
        skipped++;
        continue;
      }

      // Calculate distance and flight time
      const distNm = haversineNm(depCoord.lat, depCoord.lon, arrCoord.lat, arrCoord.lon);
      const flightTimeMin = distNm > 0
        ? Math.round((distNm / DEFAULT_CRUISE_KTS) * 60)
        : 0;

      // Flight number
      const flightNumber = `SVA-${mission}`;

      // Days of week
      const daysRaw = row['DAYS/DATES & CONDITIONS'] ?? '';
      const daysOfWeek = parseDaysOfWeek(daysRaw);

      // Departure/arrival times — spread using mission number
      const missionNum = parseInt(mission, 10) || 0;
      const depHour = (missionNum % 16) + 6; // 6-21
      const depMin = (missionNum % 4) * 15;  // 0, 15, 30, 45
      const depTime = `${String(depHour).padStart(2, '0')}:${String(depMin).padStart(2, '0')}`;

      // Arrival = departure + flight time
      const totalDepMin = depHour * 60 + depMin;
      const totalArrMin = totalDepMin + flightTimeMin;
      const arrHour = Math.floor(totalArrMin / 60) % 24;
      const arrMin = totalArrMin % 60;
      const arrTime = `${String(arrHour).padStart(2, '0')}:${String(arrMin).padStart(2, '0')}`;

      // Handler data
      const originHandler = flattenHandler(row['ORIGIN FACILITY / FORWARDER']);
      const destHandler = flattenHandler(row['DESTINATION FACILITY / FORWARDER']);
      const fareCode = row['FARE']?.trim() || null;
      const cargoRemarks = row['CARGO REMARKS']?.trim() || null;
      const groupClass = row['GROUP/CLASS']?.trim() || null;

      // aircraft_type is NOT NULL in schema, use empty string
      insertFlight.run(
        flightNumber, origin, dest, '', depTime, arrTime,
        distNm, flightTimeMin, daysOfWeek,
        originHandler, destHandler, fareCode, cargoRemarks, groupClass
      );
      imported++;
    }
  });

  importTxn();

  // 9. Summary
  db.close();
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);

  console.log('\n=== Import Complete ===');
  console.log(`  Routes imported:  ${imported}`);
  console.log(`  Routes skipped:   ${skipped}`);
  console.log(`  Airports seeded:  ${airportSeeded}`);
  console.log(`  Missing airports: ${missingAirports.length}`);
  console.log(`  Elapsed:          ${elapsed}s`);
}

main();
