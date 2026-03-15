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

/** finance.ts getRouteProfitability() — revenue vs costs per route */
export interface RouteProfitabilityRow {
  dep_icao: string;
  arr_icao: string;
  flights: number;
  revenue: number;
  costs: number;
}

/** finance.ts getPilotPaySummary() — per-pilot pay breakdown */
export interface PilotPaySummaryRow {
  pilot_id: number;
  callsign: string;
  pilot_name: string;
  hours: number;
  flights: number;
  base_pay: number;
  bonuses: number;
  deductions: number;
}

/** finance.ts getRevenueByFlight() — per-flight revenue detail */
export interface RevenueByFlightRow {
  finance_id: number;
  pirep_id: number;
  flight_number: string;
  dep_icao: string;
  arr_icao: string;
  aircraft_type: string;
  cargo_lbs: number;
  revenue: number;
  pilot_callsign: string;
  pilot_name: string;
  flight_date: string;
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
  flight_type: string | null;
  created_by: number | null;
  event_tag: string | null;
  vatsim_event_id: number | null;
  expires_at: string | null;
}

// ─────────────────────────────────────────────────────────────
// maintenance.ts
// ─────────────────────────────────────────────────────────────

/** aircraft_hours table — SELECT * shape */
export interface AircraftHoursRow {
  aircraft_id: number;
  total_hours: number;
  total_cycles: number;
  hours_at_last_a: number;
  hours_at_last_b: number;
  hours_at_last_c: number;
  cycles_at_last_c: number;
  last_d_check_date: string | null;
  hours_at_last_d: number;
  updated_at: string;
}

/** maintenance_checks table — SELECT * shape */
export interface MaintenanceCheckRow {
  id: number;
  icao_type: string;
  check_type: string;
  interval_hours: number | null;
  interval_cycles: number | null;
  interval_months: number | null;
  overflight_pct: number;
  estimated_duration_hours: number | null;
  description: string | null;
}

/** maintenance_log table — SELECT * shape */
export interface MaintenanceLogRow {
  id: number;
  aircraft_id: number;
  check_type: string;
  title: string;
  description: string | null;
  performed_by: string | null;
  performed_at: string | null;
  hours_at_check: number | null;
  cycles_at_check: number | null;
  cost: number | null;
  status: string;
  sfp_destination: string | null;
  sfp_expiry: string | null;
  created_by: number | null;
  created_at: string;
  updated_at: string;
}

/** airworthiness_directives table — SELECT * shape */
export interface AirworthinessDirectiveRow {
  id: number;
  aircraft_id: number;
  ad_number: string;
  title: string;
  description: string | null;
  compliance_status: string;
  compliance_date: string | null;
  compliance_method: string | null;
  recurring_interval_hours: number | null;
  next_due_hours: number | null;
  next_due_date: string | null;
  created_by: number | null;
  created_at: string;
  updated_at: string;
}

/** mel_deferrals table — SELECT * shape */
export interface MELDeferralRow {
  id: number;
  aircraft_id: number;
  item_number: string;
  title: string;
  category: string;
  deferral_date: string;
  expiry_date: string;
  rectified_date: string | null;
  status: string;
  remarks: string | null;
  created_by: number | null;
  created_at: string;
  discrepancy_id: number | null;
  mel_master_id: number | null;
  ata_chapter: string | null;
  placard_info: string | null;
  operations_procedure: string | null;
  maintenance_procedure: string | null;
  authorized_by: number | null;
  updated_at: string;
}

/** aircraft_components table — SELECT * shape */
export interface AircraftComponentRow {
  id: number;
  aircraft_id: number;
  component_type: string;
  position: string | null;
  serial_number: string | null;
  part_number: string | null;
  hours_since_new: number;
  cycles_since_new: number;
  hours_since_overhaul: number;
  cycles_since_overhaul: number;
  overhaul_interval_hours: number | null;
  last_overhaul_date: string | null;
  installed_date: string | null;
  status: string;
  remarks: string | null;
  created_at: string;
  updated_at: string;
}

/** Fleet + aircraft_hours JOIN for fleet status overview */
export interface FleetMaintenanceStatusRow {
  id: number;
  registration: string;
  icao_type: string;
  name: string;
  status: string;
  created_at: string | null;
  total_hours: number | null;
  total_cycles: number | null;
  hours_at_last_a: number | null;
  hours_at_last_b: number | null;
  hours_at_last_c: number | null;
  cycles_at_last_c: number | null;
  last_d_check_date: string | null;
  hours_at_last_d: number | null;
}

/** maintenance_log JOIN fleet for list queries */
export interface MaintenanceLogJoinRow extends MaintenanceLogRow {
  registration: string;
}

/** airworthiness_directives JOIN fleet for list queries */
export interface ADJoinRow extends AirworthinessDirectiveRow {
  registration: string;
}

/** mel_deferrals JOIN fleet for list queries */
export interface MELJoinRow extends MELDeferralRow {
  registration: string;
}

/** aircraft_components JOIN fleet for list queries */
export interface ComponentJoinRow extends AircraftComponentRow {
  registration: string;
}

// ─────────────────────────────────────────────────────────────
// discrepancy.ts / mel-master.ts
// ─────────────────────────────────────────────────────────────

/** discrepancies table raw row */
export interface DiscrepancyRow {
  id: number;
  aircraft_id: number;
  flight_number: string | null;
  logbook_entry_id: number | null;
  reported_by: number;
  reported_at: string;
  ata_chapter: string;
  description: string;
  flight_phase: string | null;
  severity: string;
  status: string;
  resolved_by: number | null;
  resolved_at: string | null;
  resolution_type: string | null;
  corrective_action: string | null;
  mel_deferral_id: number | null;
  created_at: string;
  updated_at: string;
}

/** discrepancies JOIN fleet + users + ata_chapters for list queries */
export interface DiscrepancyJoinRow extends DiscrepancyRow {
  registration: string;
  reporter_name: string;
  resolver_name: string | null;
  ata_title: string;
}

/** mel_master_list table raw row */
export interface MelMasterRow {
  id: number;
  icao_type: string;
  ata_chapter: string;
  item_number: string;
  title: string;
  description: string | null;
  category: string;
  repair_interval_days: number | null;
  remarks: string | null;
  operations_procedure: string | null;
  maintenance_procedure: string | null;
  is_active: number;
  created_at: string;
  updated_at: string;
}

/** mel_master_list JOIN ata_chapters */
export interface MelMasterJoinRow extends MelMasterRow {
  ata_title: string;
}

/** ata_chapters table raw row */
export interface ATAChapterRow {
  chapter: string;
  title: string;
  description: string | null;
}

// ─────────────────────────────────────────────────────────────
// finance-engine
// ─────────────────────────────────────────────────────────────

/** finance_aircraft_profiles JOIN fleet */
export interface FinanceAircraftProfileRow {
  id: number;
  aircraft_id: number;
  registration: string;
  icao_type: string;
  mtow_lbs: number | null;
  cargo_capacity_lbs: number | null;
  lease_type: string;
  lease_monthly: number;
  insurance_hull_value: number;
  insurance_hull_pct: number;
  insurance_liability: number;
  insurance_war_risk: number;
  base_fuel_gph: number;
  payload_fuel_sensitivity: number;
  maint_reserve_per_fh: number;
  crew_per_diem: number;
  crew_hotel_rate: number;
  created_at: string;
  updated_at: string;
}

/** finance_station_fees table — SELECT * shape */
export interface FinanceStationFeesRow {
  id: number;
  icao: string;
  landing_rate: number;
  parking_rate: number;
  ground_handling: number;
  fuel_price_gal: number;
  nav_fee_per_nm: number;
  deice_fee: number;
  uld_handling: number;
  created_at: string;
  updated_at: string;
}

/** finance_rate_config table — single row */
export interface FinanceRateConfigRow {
  id: number;
  fuel_surcharge_pct: number;
  security_fee: number;
  charter_multiplier: number;
  default_lane_rate: number;
  valuation_charge_pct: number;
  default_fuel_price: number;
  updated_at: string;
}

/** finance_lane_rates table — SELECT * shape */
export interface FinanceLaneRateRow {
  id: number;
  origin_icao: string;
  dest_icao: string;
  rate_per_lb: number;
  created_at: string;
}

/** finance_commodity_rates table — SELECT * shape */
export interface FinanceCommodityRateRow {
  id: number;
  category: string;
  commodity_code: string;
  commodity_name: string;
  rate_per_lb: number;
  hazmat: number;
  temp_controlled: number;
  created_at: string;
  updated_at: string;
}

/** finance_maint_thresholds table — SELECT * shape */
export interface FinanceMaintThresholdRow {
  id: number;
  check_type: string;
  interval_hours: number | null;
  interval_years: number | null;
  cost_min: number;
  cost_max: number;
  downtime_days_min: number;
  downtime_days_max: number;
  created_at: string;
}

/** finance_rated_manifests table — SELECT * shape */
export interface FinanceRatedManifestRow {
  id: number;
  cargo_manifest_id: number;
  logbook_id: number | null;
  total_revenue: number;
  total_base_charge: number;
  total_surcharges: number;
  total_fuel_surcharge: number;
  total_security_fees: number;
  charter_multiplier: number;
  yield_per_lb: number;
  load_factor: number;
  rated_at: string;
}

/** finance_rated_shipments table — SELECT * shape */
export interface FinanceRatedShipmentRow {
  id: number;
  rated_manifest_id: number;
  awb_number: string;
  uld_id: string | null;
  category_code: string;
  actual_weight: number;
  chargeable_weight: number;
  base_charge: number;
  commodity_surcharge: number;
  fuel_surcharge: number;
  security_fee: number;
  valuation_charge: number;
  total_charge: number;
}

/** finance_flight_pnl table — SELECT * shape */
export interface FinanceFlightPnLRow {
  id: number;
  logbook_id: number;
  rated_manifest_id: number | null;
  cargo_revenue: number;
  fuel_cost: number;
  landing_fee: number;
  parking_fee: number;
  handling_fee: number;
  nav_fee: number;
  deice_fee: number;
  uld_fee: number;
  crew_cost: number;
  total_variable_cost: number;
  maint_reserve: number;
  lease_alloc: number;
  insurance_alloc: number;
  total_fixed_alloc: number;
  gross_profit: number;
  margin_pct: number;
  load_factor: number;
  break_even_lf: number;
  revenue_per_bh: number;
  cost_per_bh: number;
  block_hours: number;
  payload_lbs: number;
  event_id: number | null;
  computed_at: string;
}

/** finance_flight_pnl JOIN logbook for display */
export interface FinanceFlightPnLJoinRow extends FinanceFlightPnLRow {
  flight_number: string;
  dep_icao: string;
  arr_icao: string;
}

/** finance_period_pnl table — SELECT * shape */
export interface FinancePeriodPnLRow {
  id: number;
  period_type: string;
  period_key: string;
  total_revenue: number;
  total_variable_cost: number;
  total_fixed_cost: number;
  ebitda: number;
  ebitdar: number;
  casm: number;
  rasm: number;
  avg_yield: number;
  total_flights: number;
  total_block_hours: number;
  computed_at: string;
}

/** finance_events table — SELECT * shape */
export interface FinanceEventRow {
  id: number;
  logbook_id: number | null;
  event_type: string;
  title: string;
  description: string | null;
  financial_impact: number;
  created_at: string;
}

// ─────────────────────────────────────────────────────────────
// exceedance.ts
// ─────────────────────────────────────────────────────────────

/** flight_exceedances table — SELECT * shape */
export interface ExceedanceRow {
  id: number;
  bid_id: number;
  logbook_id: number | null;
  pilot_id: number;
  type: string;
  severity: string;
  value: number;
  threshold: number;
  unit: string;
  phase: string;
  message: string;
  detected_at: string;
  created_at: string;
}
