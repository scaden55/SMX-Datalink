/**
 * import-airports.ts
 *
 * One-time script to download and import OurAirports data into the local SQLite DB.
 * Creates/populates three tables: oa_airports, oa_runways, oa_frequencies.
 *
 * Usage:  npm run import:airports -w backend
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

function parseIntOrNull(val: string | undefined): number | null {
  if (!val || val.trim() === '') return null;
  const n = parseInt(val, 10);
  return Number.isNaN(n) ? null : n;
}

function parseFloatOrNull(val: string | undefined): number | null {
  if (!val || val.trim() === '') return null;
  const n = parseFloat(val);
  return Number.isNaN(n) ? null : n;
}

function strOrNull(val: string | undefined): string | null {
  if (!val || val.trim() === '') return null;
  return val.trim();
}

async function downloadCsv(url: string, label: string): Promise<string> {
  console.log(`  Downloading ${label}...`);
  const start = Date.now();
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`);
  const text = await res.text();
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`  ${label}: ${(text.length / 1024 / 1024).toFixed(1)} MB in ${elapsed}s`);
  return text;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const BASE_URL = 'https://davidmegginson.github.io/ourairports-data';
const VALID_TYPES = new Set(['large_airport', 'medium_airport', 'small_airport']);
const BATCH_SIZE = 500;

async function main() {
  const totalStart = Date.now();
  console.log('=== OurAirports Import ===\n');

  // 1. Open DB
  const dbPath = resolve(__dirname, '..', 'data', 'acars.db');
  console.log(`Database: ${dbPath}`);
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // 2. Run migration to ensure tables exist
  const migrationPath = resolve(__dirname, '..', 'src', 'db', 'migrations', '013-ourairports.sql');
  const migrationSql = readFileSync(migrationPath, 'utf-8');
  db.exec(migrationSql);
  console.log('Migration applied.\n');

  // 3. Download CSVs
  console.log('Downloading CSVs...');
  const [airportsCsv, runwaysCsv, frequenciesCsv] = await Promise.all([
    downloadCsv(`${BASE_URL}/airports.csv`, 'airports.csv'),
    downloadCsv(`${BASE_URL}/runways.csv`, 'runways.csv'),
    downloadCsv(`${BASE_URL}/airport-frequencies.csv`, 'airport-frequencies.csv'),
  ]);
  console.log();

  // ---------------------------------------------------------------------------
  // 4. Import airports
  // ---------------------------------------------------------------------------
  console.log('Importing airports...');
  const airportRows: Record<string, string>[] = parse(airportsCsv, {
    columns: true,
    skip_empty_lines: true,
  });

  const importedIdents = new Set<string>();
  const insertAirport = db.prepare(`
    INSERT INTO oa_airports (
      id, ident, type, name, latitude_deg, longitude_deg, elevation_ft,
      continent, iso_country, iso_region, municipality, scheduled_service,
      gps_code, iata_code, local_code, home_link, wikipedia_link, keywords
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?
    )
  `);

  const airportTx = db.transaction(() => {
    db.exec('DELETE FROM oa_airports');
    let count = 0;
    for (const row of airportRows) {
      if (!VALID_TYPES.has(row.type)) continue;
      const ident = row.ident?.trim();
      if (!ident) continue;

      insertAirport.run(
        parseIntOrNull(row.id),
        ident,
        row.type,
        row.name ?? '',
        parseFloatOrNull(row.latitude_deg),
        parseFloatOrNull(row.longitude_deg),
        parseIntOrNull(row.elevation_ft),
        strOrNull(row.continent),
        strOrNull(row.iso_country),
        strOrNull(row.iso_region),
        strOrNull(row.municipality),
        strOrNull(row.scheduled_service),
        strOrNull(row.gps_code),
        strOrNull(row.iata_code),
        strOrNull(row.local_code),
        strOrNull(row.home_link),
        strOrNull(row.wikipedia_link),
        strOrNull(row.keywords),
      );
      importedIdents.add(ident);
      count++;
      if (count % 1000 === 0) console.log(`  airports: ${count} rows...`);
    }
    return count;
  });

  const airportCount = airportTx();
  console.log(`  airports: ${airportCount} total\n`);

  // ---------------------------------------------------------------------------
  // 5. Import runways (only for imported airports)
  // ---------------------------------------------------------------------------
  console.log('Importing runways...');
  const runwayRows: Record<string, string>[] = parse(runwaysCsv, {
    columns: true,
    skip_empty_lines: true,
  });

  const insertRunway = db.prepare(`
    INSERT INTO oa_runways (
      id, airport_ref, airport_ident, length_ft, width_ft, surface,
      lighted, closed,
      le_ident, le_latitude_deg, le_longitude_deg, le_elevation_ft,
      le_heading_degT, le_displaced_threshold_ft,
      he_ident, he_latitude_deg, he_longitude_deg, he_elevation_ft,
      he_heading_degT, he_displaced_threshold_ft
    ) VALUES (
      ?, ?, ?, ?, ?, ?,
      ?, ?,
      ?, ?, ?, ?,
      ?, ?,
      ?, ?, ?, ?,
      ?, ?
    )
  `);

  const runwayTx = db.transaction(() => {
    db.exec('DELETE FROM oa_runways');
    let count = 0;
    for (const row of runwayRows) {
      const ident = row.airport_ident?.trim();
      if (!ident || !importedIdents.has(ident)) continue;

      insertRunway.run(
        parseIntOrNull(row.id),
        parseIntOrNull(row.airport_ref),
        ident,
        parseIntOrNull(row.length_ft),
        parseIntOrNull(row.width_ft),
        strOrNull(row.surface),
        parseIntOrNull(row.lighted),
        parseIntOrNull(row.closed),
        strOrNull(row.le_ident),
        parseFloatOrNull(row.le_latitude_deg),
        parseFloatOrNull(row.le_longitude_deg),
        parseFloatOrNull(row.le_elevation_ft),
        parseFloatOrNull(row.le_heading_degT),
        parseFloatOrNull(row.le_displaced_threshold_ft),
        strOrNull(row.he_ident),
        parseFloatOrNull(row.he_latitude_deg),
        parseFloatOrNull(row.he_longitude_deg),
        parseFloatOrNull(row.he_elevation_ft),
        parseFloatOrNull(row.he_heading_degT),
        parseFloatOrNull(row.he_displaced_threshold_ft),
      );
      count++;
      if (count % 1000 === 0) console.log(`  runways: ${count} rows...`);
    }
    return count;
  });

  const runwayCount = runwayTx();
  console.log(`  runways: ${runwayCount} total\n`);

  // ---------------------------------------------------------------------------
  // 6. Import frequencies (only for imported airports)
  // ---------------------------------------------------------------------------
  console.log('Importing frequencies...');
  const frequencyRows: Record<string, string>[] = parse(frequenciesCsv, {
    columns: true,
    skip_empty_lines: true,
  });

  const insertFreq = db.prepare(`
    INSERT INTO oa_frequencies (
      id, airport_ref, airport_ident, type, description, frequency_mhz
    ) VALUES (?, ?, ?, ?, ?, ?)
  `);

  const freqTx = db.transaction(() => {
    db.exec('DELETE FROM oa_frequencies');
    let count = 0;
    for (const row of frequencyRows) {
      const ident = row.airport_ident?.trim();
      if (!ident || !importedIdents.has(ident)) continue;

      insertFreq.run(
        parseIntOrNull(row.id),
        parseIntOrNull(row.airport_ref),
        ident,
        strOrNull(row.type),
        strOrNull(row.description),
        parseFloatOrNull(row.frequency_mhz),
      );
      count++;
      if (count % 1000 === 0) console.log(`  frequencies: ${count} rows...`);
    }
    return count;
  });

  const freqCount = freqTx();
  console.log(`  frequencies: ${freqCount} total\n`);

  // ---------------------------------------------------------------------------
  // Done
  // ---------------------------------------------------------------------------
  db.close();
  const elapsed = ((Date.now() - totalStart) / 1000).toFixed(1);
  console.log('=== Import Complete ===');
  console.log(`  Airports:    ${airportCount.toLocaleString()}`);
  console.log(`  Runways:     ${runwayCount.toLocaleString()}`);
  console.log(`  Frequencies: ${freqCount.toLocaleString()}`);
  console.log(`  Elapsed:     ${elapsed}s`);
}

main().catch((err) => {
  console.error('Import failed:', err);
  process.exit(1);
});
