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
  country: string;
  is_hub: number;
  handler: string | null;
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

/** Airports with particularly good MSFS 2024 scenery — biased for selection */
const MSFS_NOTABLE_AIRPORTS = new Set([
  // Major US cargo hubs
  'KMEM', 'KSDF', 'PANC', 'KJFK', 'KORD', 'KLAX', 'KMIA', 'KDFW', 'KATL',
  'KEWR', 'KBOS', 'KSEA', 'KDEN', 'KPHX', 'KSFO', 'KIAD', 'KBWI', 'KMSP',
  'KDTW', 'KCLE', 'KCVG', 'KONT', 'KOAK', 'KSAN', 'KTPA', 'KMCO', 'KLAS',
  'KPDX', 'KSTL', 'KPIT', 'KBNA', 'KRDU', 'KIND', 'KCHS', 'KSAW',
  // Major international cargo hubs
  'VHHH', 'WSSS', 'OMDB', 'OMDW', 'EDDF', 'EHAM', 'EGLL', 'LFPG', 'LEMD',
  'LIMC', 'LTFM', 'RJTT', 'RJAA', 'RKSI', 'RPLL', 'VTBS', 'WMKK', 'VIDP',
  'VABB', 'ZBAA', 'ZSPD', 'ZGGG', 'RCTP', 'NZAA', 'YSSY', 'YMML',
  // Major European
  'EGCC', 'EDDM', 'EDDK', 'ELLX', 'EBLG', 'LSZH', 'LOWW', 'ENGM', 'EKCH',
  'ESSA', 'EFHK', 'EPWA', 'LKPR', 'LHBP', 'LGAV',
  // Americas
  'CYYZ', 'CYVR', 'CYMX', 'MMMX', 'SBGR', 'SCEL', 'SAEZ', 'SKBO', 'SVMI',
  'MROC', 'MPTO', 'TNCM', 'TJSJ',
  // Africa / Middle East
  'FAOR', 'HECA', 'DNMM', 'GOBD', 'OEJN', 'OERK', 'OTHH', 'OMAA',
]);

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
      WHERE expires_at IS NOT NULL
        AND expires_at LIKE ?
        AND id NOT IN (SELECT schedule_id FROM active_bids)
    `).run(`${targetMonth}%`);

    // Remove the generation log entry so needsGeneration returns true
    db.prepare('DELETE FROM charter_generation_log WHERE month = ?').run(targetMonth);

    logger.info('CharterGen', `Force-reset generation for ${targetMonth}`);
  }

  /** Generate 100–300 random charters for the given month. */
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

    // Load hub airports (95 route-network airports)
    const hubs = db.prepare('SELECT icao, lat, lon, country, is_hub, handler FROM airports').all() as AirportRow[];

    if (hubs.length === 0) {
      logger.warn('CharterGen', 'No hub airports found — skipping generation');
      return { charterCount: 0, eventCount: 0 };
    }

    // Target count: random between 100–300
    const targetCount = 100 + Math.floor(Math.random() * 201);
    const expiresAt = lastDayOfMonth(targetMonth);

    const insertStmt = db.prepare(`
      INSERT INTO scheduled_flights
        (flight_number, dep_icao, arr_icao, aircraft_type, dep_time, arr_time, distance_nm, flight_time_min, days_of_week, is_active, flight_type, expires_at, origin_handler, dest_handler)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, '1234567', 1, 'F', ?, ?, ?)
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
          // Domestic: hub → same-country destination
          origin = pickWeightedAirport(hubs);
          destination = this.findRandomDestination(db, origin, maxRange, origin.country, minRunway, aircraft.cat, hubs);
        } else if (roll < 0.90) {
          // International: hub → any country
          origin = pickWeightedAirport(hubs);
          destination = this.findRandomDestination(db, origin, maxRange, null, minRunway, aircraft.cat, hubs);
        } else {
          // Global: any large airport → any within range
          const globalOrigin = this.findRandomLargeAirport(db, minRunway);
          if (!globalOrigin) continue;
          origin = { icao: globalOrigin.ident, lat: globalOrigin.latitude_deg, lon: globalOrigin.longitude_deg, country: globalOrigin.iso_country, is_hub: 0, handler: null };
          destination = this.findRandomDestination(db, origin, maxRange, null, minRunway, aircraft.cat, hubs);
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

        const flightNumber = randomFlightNumber(db, origin.icao, destination.ident);

        const originHandler = origin.handler ?? null;
        const destAirport = hubs.find(h => h.icao === destination.ident);
        const destHandler = destAirport?.handler ?? null;
        insertStmt.run(
          flightNumber, origin.icao, destination.ident, aircraft.icao_type,
          depTime, arrTime, distanceNm, flightTimeMin, expiresAt,
          originHandler, destHandler,
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

        const origin: AirportRow = { icao: ac.location, lat: locCoords.lat, lon: locCoords.lon, country: locCoords.country, is_hub: 0, handler: locCoords.handler };
        const maxRange = Math.floor((ac.range_nm || 2000) * 0.9);
        const minRwy = minRunwayForCategory(ac.cat);

        // Generate 1-2 charters from this aircraft's location
        const chartersForAc = 1 + Math.floor(Math.random() * 2);
        for (let j = 0; j < chartersForAc && locationCount < locationTarget; j++) {
          const dest = this.findRandomDestination(db, origin, maxRange, null, minRwy, ac.cat, hubs);
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

          const fn = randomFlightNumber(db, origin.icao, dest.ident);
          const oHandler = origin.handler ?? null;
          const dAirport = hubs.find(h => h.icao === dest.ident);
          const dHandler = dAirport?.handler ?? null;
          insertStmt.run(fn, origin.icao, dest.ident, ac.icao_type, dTime, aTime, distNm, ftMin, expiresAt, oHandler, dHandler);
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
      WHERE expires_at IS NOT NULL
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
    aircraftCat: string | null,
    hubs: AirportRow[],
  ): OaAirportRow | null {
    const bbox = boundingBox(origin.lat, origin.lon, maxRangeNm);

    // Heavy aircraft (B77F, MD1F, etc.) only go to large airports
    const typeFilter = aircraftCat?.toUpperCase() === 'H'
      ? "a.type = 'large_airport'"
      : "a.type IN ('large_airport', 'medium_airport')";

    let sql = `
      SELECT a.ident, a.latitude_deg, a.longitude_deg, a.type, a.iso_country
      FROM oa_airports a
      WHERE ${typeFilter}
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

    // Bias towards large airports: large_airport gets 6× higher selection probability
    // ABS() required because SQLite RANDOM() returns signed integers — dividing
    // a negative value by 6 makes it LESS negative (higher), reversing the bias.
    sql += ' ORDER BY (ABS(RANDOM()) / (CASE WHEN a.type = \'large_airport\' THEN 6.0 ELSE 1.0 END)) LIMIT 40';

    const candidates = db.prepare(sql).all(...params) as OaAirportRow[];

    // Weight candidates in TypeScript for MSFS-notable and network bias
    const weighted: { candidate: OaAirportRow; weight: number }[] = [];
    for (const c of candidates) {
      const dist = haversineNm(origin.lat, origin.lon, c.latitude_deg, c.longitude_deg);
      if (dist > maxRangeNm || dist < 50) continue;

      let weight = 1.0;
      if (c.type === 'large_airport') weight *= 6.0;
      if (MSFS_NOTABLE_AIRPORTS.has(c.ident)) weight *= 3.0;
      // Bias toward airports in our route network
      const inNetwork = hubs.some(h => h.icao === c.ident);
      if (inNetwork) weight *= 5.0;

      weighted.push({ candidate: c, weight });
    }

    if (weighted.length === 0) return null;

    // Weighted random selection
    const totalW = weighted.reduce((s, w) => s + w.weight, 0);
    let r = Math.random() * totalW;
    for (const w of weighted) {
      r -= w.weight;
      if (r <= 0) return w.candidate;
    }
    return weighted[weighted.length - 1].candidate;
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

/** Pick a random airport with 3x weighting for hub airports. */
function pickWeightedAirport(airports: AirportRow[]): AirportRow {
  const totalWeight = airports.reduce((s, a) => s + (a.is_hub ? 3 : 1), 0);
  let r = Math.random() * totalWeight;
  for (const a of airports) {
    r -= a.is_hub ? 3 : 1;
    if (r <= 0) return a;
  }
  return airports[airports.length - 1];
}

/** ISO country codes for European nations (used for flight number stub suffixes). */
const EUROPEAN_COUNTRIES = new Set([
  'AT','BE','BG','HR','CY','CZ','DK','EE','FI','FR','DE','GR','HU','IS','IE',
  'IT','LV','LT','LU','MT','NL','NO','PL','PT','RO','SK','SI','ES','SE','CH',
  'GB','UA','RS','ME','MK','AL','BA','MD','BY','XK',
]);

/** Valid stub suffix letters (A-Z minus I and O). */
const STUB_LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';

/**
 * Number ranges EXCLUDED from auto-generation.
 * 0-9: Reserved (admin only)
 * 10-99: Tactical (user charter / admin)
 * 500-599, 5000-5999: Custom Dispatch
 * 700-799, 7000-7999: Reserved
 * 900-999, 9000-9999: Non-revenue
 */
function isReservedNumber(n: number): boolean {
  if (n <= 99) return true;                          // 0-99
  if (n >= 500 && n <= 599) return true;             // 500-599
  if (n >= 700 && n <= 799) return true;             // 700-799
  if (n >= 900 && n <= 999) return true;             // 900-999
  if (n >= 5000 && n <= 5999) return true;           // 5000-5999
  if (n >= 7000 && n <= 7999) return true;           // 7000-7999
  if (n >= 9000 && n <= 9999) return true;           // 9000-9999
  return false;
}

/**
 * Generate a unique random SMX flight number from the auto-generation pool.
 * Appends a European stub suffix letter if either airport is in Europe.
 *
 * @param db - Database handle
 * @param depIcao - Departure ICAO (for European suffix detection)
 * @param arrIcao - Arrival ICAO (for European suffix detection)
 */
export function randomFlightNumber(
  db: ReturnType<typeof getDb>,
  depIcao?: string,
  arrIcao?: string,
): string {
  const existing = new Set(
    (db.prepare("SELECT flight_number FROM scheduled_flights WHERE flight_number LIKE 'SMX%'").all() as { flight_number: string }[])
      .map(r => r.flight_number),
  );

  // Check if either airport is European
  let isEuropean = false;
  if (depIcao || arrIcao) {
    const checkCountry = (icao: string): string | null => {
      const legacy = db.prepare('SELECT country FROM airports WHERE icao = ?').get(icao) as { country: string } | undefined;
      if (legacy) return legacy.country;
      const oa = db.prepare('SELECT iso_country FROM oa_airports WHERE ident = ?').get(icao) as { iso_country: string } | undefined;
      return oa?.iso_country ?? null;
    };
    if (depIcao) { const c = checkCountry(depIcao); if (c && EUROPEAN_COUNTRIES.has(c)) isEuropean = true; }
    if (!isEuropean && arrIcao) { const c = checkCountry(arrIcao); if (c && EUROPEAN_COUNTRIES.has(c)) isEuropean = true; }
  }

  const suffix = isEuropean ? STUB_LETTERS[Math.floor(Math.random() * STUB_LETTERS.length)] : '';

  // Try random numbers from auto-generation pool (100-9999 minus reserved)
  for (let i = 0; i < 500; i++) {
    const num = 100 + Math.floor(Math.random() * 9900); // 100–9999
    if (isReservedNumber(num)) continue;
    const fn = `SMX${num}${suffix}`;
    if (!existing.has(fn)) return fn;
  }

  // Fallback: sequential scan
  for (let n = 100; n <= 9999; n++) {
    if (isReservedNumber(n)) continue;
    const fn = `SMX${n}${suffix}`;
    if (!existing.has(fn)) return fn;
  }

  throw new Error('No available SMX flight numbers');
}

/** Look up airport coordinates and country from hubs or oa_airports. */
function lookupCoords(db: ReturnType<typeof getDb>, icao: string): { lat: number; lon: number; country: string; handler: string | null } | null {
  const legacy = db.prepare('SELECT lat, lon, country, handler FROM airports WHERE icao = ?').get(icao) as { lat: number; lon: number; country: string; handler: string | null } | undefined;
  if (legacy) return legacy;
  const oa = db.prepare('SELECT latitude_deg AS lat, longitude_deg AS lon, iso_country AS country FROM oa_airports WHERE ident = ? AND latitude_deg IS NOT NULL').get(icao) as { lat: number; lon: number; country: string } | undefined;
  return oa ? { ...oa, handler: null } : null;
}

function pickWeighted(types: FleetTypeRow[], totalWeight: number): FleetTypeRow {
  let r = Math.random() * totalWeight;
  for (const t of types) {
    r -= t.count;
    if (r <= 0) return t;
  }
  return types[types.length - 1];
}
