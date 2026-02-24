/**
 * Typed interfaces for SQLite query results used across backend services.
 *
 * Each interface matches the exact column shape returned by a specific query.
 * Some mirror raw table rows; others reflect JOINs, aliases, or aggregates.
 *
 * Naming convention:
 *   - `*Row`       = raw table SELECT * shape
 *   - `*QueryRow`  = shaped by a specific query (JOINs, aliases, aggregates)
 */

// ─────────────────────────────────────────────────────────────
// finance.ts
// ─────────────────────────────────────────────────────────────

/** finance.ts getAllBalances() — aggregate per-pilot balance query */
export interface FinanceBalanceQueryRow {
  pilot_id: number;
  callsign: string;
  pilot_name: string;
  balance: number;
  total_pay: number;
  total_bonuses: number;
  total_deductions: number;
}

/** finance.ts getSummary() — aggregate totals across all finances */
export interface FinanceSummaryQueryRow {
  total_pay: number;
  total_bonuses: number;
  total_deductions: number;
  total_expenses: number;
  total_income: number;
}

// ─────────────────────────────────────────────────────────────
// leaderboard.ts
// ─────────────────────────────────────────────────────────────

/** leaderboard.ts getLeaderboard() — aggregate per-pilot stats */
export interface LeaderboardQueryRow {
  callsign: string | null;
  pilot_name: string | null;
  flights: number;
  hours_min: number | null;
  cargo_lbs: number | null;
  landing_rate_fpm: number | null;
  avg_score: number | null;
}

// ─────────────────────────────────────────────────────────────
// fleet.ts
// ─────────────────────────────────────────────────────────────

/** fleet.ts getUtilizationStats() — aggregate logbook stats for an aircraft */
export interface FleetUtilizationQueryRow {
  total_flights: number;
  total_hours_min: number;
  last_flight: string | null;
  avg_score: number | null;
  avg_landing_rate: number | null;
}

// ─────────────────────────────────────────────────────────────
// regulatory.ts
// ─────────────────────────────────────────────────────────────

/** regulatory.ts checkAircraftStatus() — partial fleet lookup */
export interface FleetStatusQueryRow {
  id: number;
  registration: string;
  status: string;
}

/** regulatory.ts — raw opspecs table row (SELECT *) */
export interface OpSpecRow {
  id: number;
  code: string;
  title: string;
  description: string;
  category: string;
  enforcement: string;
  is_active: number;
  created_at: string;
  updated_at: string;
}

// ─────────────────────────────────────────────────────────────
// reports.ts
// ─────────────────────────────────────────────────────────────

/** reports.ts querySummary() — aggregate logbook statistics */
export interface ReportSummaryQueryRow {
  total_flights: number;
  total_hours_min: number;
  total_distance_nm: number;
  total_fuel_lbs: number;
  total_pax: number;
  total_cargo_lbs: number;
  avg_score: number | null;
  avg_landing_rate: number | null;
}

/** reports.ts queryFinancials() — per-flight columns for financial computation */
export interface ReportFinancialFlightRow {
  aircraft_type: string | null;
  distance_nm: number | null;
  fuel_used_lbs: number | null;
  flight_time_min: number | null;
  pax_count: number | null;
  cargo_lbs: number | null;
}

/** reports.ts queryTopRoutes() — top airport pairs by flight count */
export interface ReportTopRouteQueryRow {
  dep_icao: string;
  arr_icao: string;
  dep_name: string | null;
  arr_name: string | null;
  flights: number;
}

/** reports.ts queryByPilot() — per-pilot aggregation */
export interface ReportByPilotQueryRow {
  callsign: string | null;
  pilot_name: string | null;
  flights: number;
  hours_min: number | null;
  avg_score: number | null;
}

/** reports.ts queryVolume() — daily or monthly flight count */
export interface ReportVolumeQueryRow {
  date: string;
  flights: number;
}

// ─────────────────────────────────────────────────────────────
// schedule-admin.ts
// ─────────────────────────────────────────────────────────────

/** schedule-admin.ts clone() — raw scheduled_flights table row (SELECT *) */
export interface ScheduledFlightRow {
  id: number;
  flight_number: string;
  dep_icao: string;
  arr_icao: string;
  aircraft_type: string;
  dep_time: string;
  arr_time: string;
  distance_nm: number;
  flight_time_min: number;
  days_of_week: string;
  is_active: number;
  charter_type: string | null;
  created_by: number | null;
  event_tag: string | null;
  vatsim_event_id: number | null;
  expires_at: string | null;
}
