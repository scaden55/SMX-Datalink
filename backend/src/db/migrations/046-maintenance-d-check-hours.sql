-- 046-maintenance-d-check-hours.sql: Add hours_at_last_d to aircraft_hours for D-check tracking

ALTER TABLE aircraft_hours ADD COLUMN hours_at_last_d REAL DEFAULT 0;

-- Add last_overhaul_date to aircraft_components for overhaul tracking
ALTER TABLE aircraft_components ADD COLUMN last_overhaul_date TEXT;
