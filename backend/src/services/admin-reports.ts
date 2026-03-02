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

export interface RouteProfitabilityEntry {
  route: string;
  depIcao: string;
  arrIcao: string;
  flights: number;
  revenue: number;
  costs: number;
  profit: number;
  margin: number;
}

export interface FleetUtilizationEntry {
  registration: string;
  aircraftType: string;
  months: Array<{ month: string; hours: number }>;
  totalHours: number;
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

interface RouteProfitRow {
  dep_icao: string;
  arr_icao: string;
  flights: number;
  revenue: number;
  costs: number;
}

interface FleetUtilRow {
  registration: string;
  icao_type: string;
  month: string;
  hours: number;
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

/**
 * Route profitability — revenue minus costs per route for approved flights.
 * Revenue comes from finances with type='income' linked to PIREPs.
 * Costs come from finances with type='pay' linked to PIREPs.
 * Returns top 15 routes by profit.
 */
export function getRouteProfitability(
  db: Database.Database,
  from: string,
  to: string,
): RouteProfitabilityEntry[] {
  const rows = db.prepare(`
    SELECT
      l.dep_icao,
      l.arr_icao,
      COUNT(DISTINCT l.id) AS flights,
      COALESCE(SUM(CASE WHEN f.type = 'income' THEN f.amount ELSE 0 END), 0) AS revenue,
      COALESCE(SUM(CASE WHEN f.type = 'pay' THEN f.amount ELSE 0 END), 0) AS costs
    FROM logbook l
    LEFT JOIN finances f ON f.pirep_id = l.id
    WHERE l.status = 'approved'
      AND l.created_at >= ?
      AND l.created_at < ?
    GROUP BY l.dep_icao, l.arr_icao
    HAVING flights > 0
    ORDER BY (revenue - costs) DESC
    LIMIT 15
  `).all(from, to) as RouteProfitRow[];

  return rows.map(r => {
    const profit = r.revenue - r.costs;
    const margin = r.revenue > 0 ? Math.round((profit / r.revenue) * 1000) / 10 : 0;
    return {
      route: `${r.dep_icao}-${r.arr_icao}`,
      depIcao: r.dep_icao,
      arrIcao: r.arr_icao,
      flights: r.flights,
      revenue: Math.round(r.revenue * 100) / 100,
      costs: Math.round(r.costs * 100) / 100,
      profit: Math.round(profit * 100) / 100,
      margin,
    };
  });
}

/**
 * Fleet utilization — hours per aircraft per month for approved flights.
 */
export function getFleetUtilization(
  db: Database.Database,
  from: string,
  to: string,
): FleetUtilizationEntry[] {
  const rows = db.prepare(`
    SELECT
      l.aircraft_registration AS registration,
      l.aircraft_type AS icao_type,
      strftime('%Y-%m', l.created_at) AS month,
      SUM(l.flight_time_min) / 60.0 AS hours
    FROM logbook l
    WHERE l.status = 'approved'
      AND l.aircraft_registration IS NOT NULL
      AND l.created_at >= ?
      AND l.created_at < ?
    GROUP BY l.aircraft_registration, month
    ORDER BY l.aircraft_registration, month
  `).all(from, to) as FleetUtilRow[];

  // Group by aircraft
  const aircraftMap = new Map<string, { type: string; months: Map<string, number> }>();
  for (const row of rows) {
    if (!aircraftMap.has(row.registration)) {
      aircraftMap.set(row.registration, { type: row.icao_type, months: new Map() });
    }
    aircraftMap.get(row.registration)!.months.set(row.month, Math.round(row.hours * 10) / 10);
  }

  return Array.from(aircraftMap.entries()).map(([reg, data]) => {
    const months = Array.from(data.months.entries()).map(([month, hours]) => ({ month, hours }));
    const totalHours = months.reduce((sum, m) => sum + m.hours, 0);
    return {
      registration: reg,
      aircraftType: data.type,
      months,
      totalHours: Math.round(totalHours * 10) / 10,
    };
  }).sort((a, b) => b.totalHours - a.totalHours);
}
