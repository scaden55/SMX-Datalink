import type Database from 'better-sqlite3';

// ── Return types ────────────────────────────────────────────────

export interface FlightHoursEntry {
  callsign: string;
  name: string;
  hours: number;
  flights: number;
}

export interface LandingRateDistribution {
  distribution: Array<{ range: string; count: number }>;
  average: number;
  best: number;
  worst: number;
}

export interface FuelEfficiencyEntry {
  flightNumber: string;
  fuelPlanned: number;
  fuelUsed: number;
  efficiency: number;
}

export interface OnTimePerformance {
  onTimeCount: number;
  lateCount: number;
  totalFlights: number;
  percentage: number;
}

export interface RoutePopularityEntry {
  route: string;
  depIcao: string;
  arrIcao: string;
  count: number;
  avgLandingRate: number;
}

// ── DB row types (query-specific) ───────────────────────────────

interface FlightHoursRow {
  callsign: string | null;
  pilot_name: string | null;
  hours: number;
  flights: number;
}

interface LandingRateRow {
  landing_rate_fpm: number;
}

interface FuelEfficiencyRow {
  flight_number: string;
  fuel_planned_lbs: number | null;
  fuel_used_lbs: number | null;
}

interface OnTimeRow {
  total_flights: number;
  on_time_count: number;
}

interface RoutePopularityRow {
  dep_icao: string;
  arr_icao: string;
  cnt: number;
  avg_landing_rate: number | null;
}

// ── On-time threshold (minutes) ─────────────────────────────────
const ON_TIME_THRESHOLD_MIN = 15;

// ── Landing rate distribution buckets ───────────────────────────
const LANDING_RATE_RANGES = [
  { range: '0-100', min: 0, max: 100 },
  { range: '100-200', min: 100, max: 200 },
  { range: '200-300', min: 200, max: 300 },
  { range: '300-400', min: 300, max: 400 },
  { range: '400-500', min: 400, max: 500 },
  { range: '500+', min: 500, max: Infinity },
];

// ── Service functions ───────────────────────────────────────────

/**
 * Flight hours grouped by pilot for approved flights within a date range.
 */
export function getFlightHours(
  db: Database.Database,
  from: string,
  to: string,
): FlightHoursEntry[] {
  const rows = db.prepare(`
    SELECT
      u.callsign,
      u.first_name || ' ' || u.last_name AS pilot_name,
      COALESCE(SUM(l.flight_time_min), 0) / 60.0 AS hours,
      COUNT(*) AS flights
    FROM logbook l
    JOIN users u ON u.id = l.user_id
    WHERE l.status = 'approved'
      AND l.created_at >= ?
      AND l.created_at < ?
    GROUP BY l.user_id
    ORDER BY hours DESC
  `).all(from, to) as FlightHoursRow[];

  return rows.map(r => ({
    callsign: r.callsign ?? 'Unknown',
    name: r.pilot_name ?? 'Unknown',
    hours: Math.round(r.hours * 10) / 10,
    flights: r.flights,
  }));
}

/**
 * Landing rate distribution, average, best, and worst for approved flights.
 * Uses absolute values since landing rates are stored as negative fpm.
 */
export function getLandingRates(
  db: Database.Database,
  from: string,
  to: string,
): LandingRateDistribution {
  const rows = db.prepare(`
    SELECT ABS(l.landing_rate_fpm) AS landing_rate_fpm
    FROM logbook l
    WHERE l.landing_rate_fpm IS NOT NULL
      AND l.status = 'approved'
      AND l.created_at >= ?
      AND l.created_at < ?
  `).all(from, to) as LandingRateRow[];

  if (rows.length === 0) {
    return {
      distribution: LANDING_RATE_RANGES.map(r => ({ range: r.range, count: 0 })),
      average: 0,
      best: 0,
      worst: 0,
    };
  }

  // Build distribution buckets
  const distribution = LANDING_RATE_RANGES.map(bucket => {
    const count = rows.filter(
      r => r.landing_rate_fpm >= bucket.min && r.landing_rate_fpm < bucket.max,
    ).length;
    return { range: bucket.range, count };
  });

  const rates = rows.map(r => r.landing_rate_fpm);
  const sum = rates.reduce((a, b) => a + b, 0);

  return {
    distribution,
    average: Math.round(sum / rates.length),
    best: Math.min(...rates),
    worst: Math.max(...rates),
  };
}

/**
 * Fuel efficiency — planned vs actual fuel for approved flights that have both values.
 */
export function getFuelEfficiency(
  db: Database.Database,
  from: string,
  to: string,
): FuelEfficiencyEntry[] {
  const rows = db.prepare(`
    SELECT
      l.flight_number,
      l.fuel_planned_lbs,
      l.fuel_used_lbs
    FROM logbook l
    WHERE l.status = 'approved'
      AND l.fuel_used_lbs IS NOT NULL
      AND l.fuel_used_lbs > 0
      AND l.created_at >= ?
      AND l.created_at < ?
    ORDER BY l.created_at DESC
    LIMIT 100
  `).all(from, to) as FuelEfficiencyRow[];

  return rows.map(r => {
    const fuelPlanned = r.fuel_planned_lbs ?? 0;
    const fuelUsed = r.fuel_used_lbs ?? 0;
    // Efficiency: ratio of planned to used (>1 means under budget)
    const efficiency = fuelPlanned > 0
      ? Math.round((fuelPlanned / fuelUsed) * 1000) / 1000
      : 0;

    return {
      flightNumber: r.flight_number,
      fuelPlanned: fuelPlanned,
      fuelUsed: fuelUsed,
      efficiency,
    };
  });
}

/**
 * On-time performance based on scheduled vs actual arrival times.
 * A flight is "on time" if actual arrival is within ON_TIME_THRESHOLD_MIN
 * of scheduled arrival, or if no scheduled time exists (counted as on-time).
 */
export function getOnTimePerformance(
  db: Database.Database,
  from: string,
  to: string,
): OnTimePerformance {
  // Check if we have meaningful scheduled times to compare against
  const hasScheduledData = db.prepare(`
    SELECT COUNT(*) AS cnt
    FROM logbook
    WHERE status = 'approved'
      AND scheduled_arr IS NOT NULL
      AND actual_arr IS NOT NULL
      AND created_at >= ?
      AND created_at < ?
  `).get(from, to) as { cnt: number } | undefined;

  const scheduledCount = hasScheduledData?.cnt ?? 0;

  if (scheduledCount > 0) {
    // Compare actual vs scheduled arrival; "on time" = within threshold
    const row = db.prepare(`
      SELECT
        COUNT(*) AS total_flights,
        SUM(
          CASE
            WHEN (JULIANDAY(l.actual_arr) - JULIANDAY(l.scheduled_arr)) * 1440 <= ?
            THEN 1 ELSE 0
          END
        ) AS on_time_count
      FROM logbook l
      WHERE l.status = 'approved'
        AND l.scheduled_arr IS NOT NULL
        AND l.actual_arr IS NOT NULL
        AND l.created_at >= ?
        AND l.created_at < ?
    `).get(ON_TIME_THRESHOLD_MIN, from, to) as OnTimeRow | undefined;

    const totalFlights = row?.total_flights ?? 0;
    const onTimeCount = row?.on_time_count ?? 0;
    const lateCount = totalFlights - onTimeCount;
    const percentage = totalFlights > 0
      ? Math.round((onTimeCount / totalFlights) * 1000) / 10
      : 0;

    return { onTimeCount, lateCount, totalFlights, percentage };
  }

  // Fallback: no scheduled data — just return total approved flights
  const totalRow = db.prepare(`
    SELECT COUNT(*) AS cnt
    FROM logbook
    WHERE status = 'approved'
      AND created_at >= ?
      AND created_at < ?
  `).get(from, to) as { cnt: number } | undefined;

  const totalFlights = totalRow?.cnt ?? 0;

  return {
    onTimeCount: totalFlights,
    lateCount: 0,
    totalFlights,
    percentage: totalFlights > 0 ? 100 : 0,
  };
}

/**
 * Top 10 routes by flight count with average landing rate.
 */
export function getRoutePopularity(
  db: Database.Database,
  from: string,
  to: string,
): RoutePopularityEntry[] {
  const rows = db.prepare(`
    SELECT
      l.dep_icao,
      l.arr_icao,
      COUNT(*) AS cnt,
      AVG(ABS(l.landing_rate_fpm)) AS avg_landing_rate
    FROM logbook l
    WHERE l.status = 'approved'
      AND l.created_at >= ?
      AND l.created_at < ?
    GROUP BY l.dep_icao, l.arr_icao
    ORDER BY cnt DESC
    LIMIT 10
  `).all(from, to) as RoutePopularityRow[];

  return rows.map(r => ({
    route: `${r.dep_icao}-${r.arr_icao}`,
    depIcao: r.dep_icao,
    arrIcao: r.arr_icao,
    count: r.cnt,
    avgLandingRate: r.avg_landing_rate != null
      ? Math.round(r.avg_landing_rate)
      : 0,
  }));
}
