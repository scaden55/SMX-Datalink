/**
 * import-navdata.ts
 *
 * One-time script to download and import X-Plane navigation data into SQLite.
 * Creates/populates three tables: waypoints, navaids, airways.
 *
 * Usage:  npm run import:navdata -w backend
 */

import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BASE_URL = 'https://github.com/mcantsin/x-plane-navdata/raw/master';
const BATCH_SIZE = 1000;

const NAVAID_TYPE_MAP: Record<number, string> = {
  2: 'NDB',
  3: 'VOR',
  4: 'ILS_LOC',
  5: 'ILS_GS',
  6: 'OM',
  7: 'MM',
  8: 'IM',
  9: 'DME',
  12: 'DME_STANDALONE',
  13: 'TACAN',
};

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

async function downloadFile(filename: string): Promise<string> {
  const url = `${BASE_URL}/${filename}`;
  console.log(`Downloading ${filename}...`);
  const start = Date.now();
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`);
  const text = await res.text();
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`  ${filename}: ${(text.length / 1024 / 1024).toFixed(1)} MB in ${elapsed}s`);
  return text;
}

/**
 * Split a .dat file into data lines, skipping header/footer rows.
 * X-Plane .dat files always start with:
 *   Line 0: "I" (or "A")
 *   Line 1: "<number> Version - data cycle ..." (version/copyright)
 *   Line 2: (often empty)
 * and end with "99".
 */
function getDataLines(text: string): string[] {
  const lines = text.split('\n');
  const dataLines: string[] = [];
  let headerLines = 0;
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (line === '99') continue;
    // Skip first two non-empty lines (header marker + version info)
    if (headerLines < 2) {
      headerLines++;
      continue;
    }
    dataLines.push(line);
  }
  return dataLines;
}

// ---------------------------------------------------------------------------
// Parsers
// ---------------------------------------------------------------------------

interface WaypointRow {
  ident: string;
  lat: number;
  lon: number;
  region: string | null;
  airport_icao: string | null;
}

function parseFixes(text: string): WaypointRow[] {
  const lines = getDataLines(text);
  const rows: WaypointRow[] = [];

  for (const line of lines) {
    // Format: lat lon ident region airport_icao
    const parts = line.split(/\s+/);
    if (parts.length < 3) continue;

    const lat = parseFloat(parts[0]);
    const lon = parseFloat(parts[1]);
    if (Number.isNaN(lat) || Number.isNaN(lon)) continue;

    rows.push({
      lat,
      lon,
      ident: parts[2],
      region: strOrNull(parts[3]),
      airport_icao: strOrNull(parts[4]),
    });
  }

  return rows;
}

interface NavaidRow {
  type_code: number;
  type: string;
  lat: number;
  lon: number;
  elevation_ft: number | null;
  frequency: number | null;
  range_nm: number | null;
  bearing: number | null;
  ident: string;
  airport_icao: string | null;
  region: string | null;
  name: string | null;
}

function parseNavaids(text: string): NavaidRow[] {
  const lines = getDataLines(text);
  const rows: NavaidRow[] = [];

  for (const line of lines) {
    const parts = line.split(/\s+/);
    if (parts.length < 8) continue;

    const type_code = parseInt(parts[0], 10);
    if (Number.isNaN(type_code)) continue;

    const typeName = NAVAID_TYPE_MAP[type_code];
    if (!typeName) continue; // Skip unknown navaid types

    const lat = parseFloat(parts[1]);
    const lon = parseFloat(parts[2]);
    if (Number.isNaN(lat) || Number.isNaN(lon)) continue;

    // NDB (2) and VOR (3): type lat lon elev freq range bearing ident name...
    // ILS/DME/markers/TACAN (4+): type lat lon elev freq range course ident airport_icao runway name...
    const isStandalone = type_code === 2 || type_code === 3;

    let ident: string;
    let airport_icao: string | null;
    let name: string | null;

    if (isStandalone) {
      ident = parts[7];
      airport_icao = null;
      name = parts.length > 8 ? strOrNull(parts.slice(8).join(' ')) : null;
    } else {
      ident = parts[7];
      airport_icao = strOrNull(parts[8]);
      name = parts.length > 10 ? strOrNull(parts.slice(10).join(' ')) : null;
    }

    rows.push({
      type_code,
      type: typeName,
      lat,
      lon,
      elevation_ft: parseIntOrNull(parts[3]),
      frequency: parseFloatOrNull(parts[4]),
      range_nm: parseIntOrNull(parts[5]),
      bearing: parseFloatOrNull(parts[6]),
      ident,
      airport_icao,
      region: isStandalone ? null : strOrNull(parts[9]),
      name,
    });
  }

  return rows;
}

interface AirwayRow {
  fix_ident: string;
  fix_lat: number | null;
  fix_lon: number | null;
  next_fix_ident: string;
  next_fix_lat: number | null;
  next_fix_lon: number | null;
  direction: number | null;
  base_alt: number | null;
  top_alt: number | null;
  ident: string;
}

function parseAirways(text: string): AirwayRow[] {
  const lines = getDataLines(text);
  const rows: AirwayRow[] = [];

  for (const line of lines) {
    // Format: fix_ident fix_lat fix_lon next_fix_ident next_fix_lat next_fix_lon direction base_alt top_alt ident
    const parts = line.split(/\s+/);
    if (parts.length < 10) continue;

    rows.push({
      fix_ident: parts[0],
      fix_lat: parseFloatOrNull(parts[1]),
      fix_lon: parseFloatOrNull(parts[2]),
      next_fix_ident: parts[3],
      next_fix_lat: parseFloatOrNull(parts[4]),
      next_fix_lon: parseFloatOrNull(parts[5]),
      direction: parseIntOrNull(parts[6]),
      base_alt: parseIntOrNull(parts[7]),
      top_alt: parseIntOrNull(parts[8]),
      ident: parts[9],
    });
  }

  return rows;
}

// ---------------------------------------------------------------------------
// Batch insert helper
// ---------------------------------------------------------------------------

function batchInsert<T>(
  db: InstanceType<typeof Database>,
  rows: T[],
  stmt: ReturnType<InstanceType<typeof Database>['prepare']>,
  bindFn: (row: T) => unknown[],
  label: string,
) {
  const tx = db.transaction((batch: T[]) => {
    for (const row of batch) {
      stmt.run(...bindFn(row));
    }
  });

  let inserted = 0;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    tx(batch);
    inserted += batch.length;
    if (inserted % 5000 < BATCH_SIZE) {
      console.log(`  ${inserted.toLocaleString()} ${label}...`);
    }
  }

  return inserted;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const totalStart = Date.now();
  console.log('=== X-Plane Navdata Import ===\n');

  // 1. Open DB
  const dbPath = resolve(__dirname, '..', 'data', 'acars.db');
  console.log(`Database: ${dbPath}`);
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // 2. Run migration to ensure tables exist
  const migrationPath = resolve(__dirname, '..', 'src', 'db', 'migrations', '016-navdata.sql');
  const migrationSql = readFileSync(migrationPath, 'utf-8');
  db.exec(migrationSql);
  console.log('Migration applied.\n');

  // 3. Download data files
  console.log('Downloading navdata files...');
  const [fixText, navText, awyText] = await Promise.all([
    downloadFile('earth_fix.dat'),
    downloadFile('earth_nav.dat'),
    downloadFile('earth_awy.dat'),
  ]);
  console.log();

  // ---------------------------------------------------------------------------
  // 4. Import waypoints (fixes)
  // ---------------------------------------------------------------------------
  console.log('Parsing earth_fix.dat...');
  const fixes = parseFixes(fixText);
  console.log(`  Parsed ${fixes.length.toLocaleString()} fixes`);

  db.exec('DELETE FROM waypoints');
  const insertWaypoint = db.prepare(`
    INSERT INTO waypoints (ident, lat, lon, region, airport_icao, type)
    VALUES (?, ?, ?, ?, ?, 'fix')
  `);

  const waypointCount = batchInsert(db, fixes, insertWaypoint, (r) => [
    r.ident, r.lat, r.lon, r.region, r.airport_icao,
  ], 'fixes');
  console.log(`  Inserted ${waypointCount.toLocaleString()} waypoints\n`);

  // ---------------------------------------------------------------------------
  // 5. Import navaids
  // ---------------------------------------------------------------------------
  console.log('Parsing earth_nav.dat...');
  const navaids = parseNavaids(navText);
  console.log(`  Parsed ${navaids.length.toLocaleString()} navaids`);

  db.exec('DELETE FROM navaids');
  const insertNavaid = db.prepare(`
    INSERT INTO navaids (ident, type, type_code, lat, lon, elevation_ft, frequency, range_nm, bearing, airport_icao, region, name)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const navaidCount = batchInsert(db, navaids, insertNavaid, (r) => [
    r.ident, r.type, r.type_code, r.lat, r.lon, r.elevation_ft,
    r.frequency, r.range_nm, r.bearing, r.airport_icao, r.region, r.name,
  ], 'navaids');
  console.log(`  Inserted ${navaidCount.toLocaleString()} navaids\n`);

  // ---------------------------------------------------------------------------
  // 6. Import airways
  // ---------------------------------------------------------------------------
  console.log('Parsing earth_awy.dat...');
  const airways = parseAirways(awyText);
  console.log(`  Parsed ${airways.length.toLocaleString()} airway segments`);

  db.exec('DELETE FROM airways');
  const insertAirway = db.prepare(`
    INSERT INTO airways (ident, fix_ident, fix_lat, fix_lon, next_fix_ident, next_fix_lat, next_fix_lon, direction, base_alt, top_alt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const airwayCount = batchInsert(db, airways, insertAirway, (r) => [
    r.ident, r.fix_ident, r.fix_lat, r.fix_lon,
    r.next_fix_ident, r.next_fix_lat, r.next_fix_lon,
    r.direction, r.base_alt, r.top_alt,
  ], 'airway segments');
  console.log(`  Inserted ${airwayCount.toLocaleString()} airway segments\n`);

  // ---------------------------------------------------------------------------
  // Done
  // ---------------------------------------------------------------------------
  db.close();
  const elapsed = ((Date.now() - totalStart) / 1000).toFixed(1);
  console.log('=== Import Complete ===');
  console.log(`  Waypoints:       ${waypointCount.toLocaleString()}`);
  console.log(`  Navaids:         ${navaidCount.toLocaleString()}`);
  console.log(`  Airway segments: ${airwayCount.toLocaleString()}`);
  console.log(`  Elapsed:         ${elapsed}s`);
}

main().catch((err) => {
  console.error('Import failed:', err);
  process.exit(1);
});
