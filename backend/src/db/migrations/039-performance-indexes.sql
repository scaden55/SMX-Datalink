-- Performance indexes for frequently queried columns
-- Covers dashboard, reports, admin, and finance engine queries

-- Finances: dashboard aggregates and ledger lookups
CREATE INDEX IF NOT EXISTS idx_finances_type_created ON finances(type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_finances_pilot_created ON finances(pilot_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_finances_category ON finances(category);

-- Logbook: fleet utilization reports
CREATE INDEX IF NOT EXISTS idx_logbook_aircraft_status_created ON logbook(aircraft_registration, status, created_at DESC);

-- Admin notifications: paginated listing
CREATE INDEX IF NOT EXISTS idx_admin_notifications_created ON admin_notifications(created_at DESC);

-- Finance engine: lookup by aircraft and station
CREATE INDEX IF NOT EXISTS idx_finance_aircraft_profiles_aircraft ON finance_aircraft_profiles(aircraft_id);
CREATE INDEX IF NOT EXISTS idx_finance_station_fees_icao ON finance_station_fees(icao);
CREATE INDEX IF NOT EXISTS idx_finance_lane_rates_origin ON finance_lane_rates(origin_icao);
CREATE INDEX IF NOT EXISTS idx_finance_lane_rates_dest ON finance_lane_rates(dest_icao);
