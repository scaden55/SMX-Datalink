-- 006-fleet-management.sql: Add management columns to fleet table

ALTER TABLE fleet ADD COLUMN status TEXT NOT NULL DEFAULT 'active';
ALTER TABLE fleet ADD COLUMN base_icao TEXT;
ALTER TABLE fleet ADD COLUMN location_icao TEXT;
ALTER TABLE fleet ADD COLUMN remarks TEXT;
ALTER TABLE fleet ADD COLUMN updated_at TEXT;

CREATE INDEX IF NOT EXISTS idx_fleet_status ON fleet(status);
CREATE INDEX IF NOT EXISTS idx_fleet_base ON fleet(base_icao);
