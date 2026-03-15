-- 048-fleet-created-at.sql: Add created_at to fleet table for D-check baseline
ALTER TABLE fleet ADD COLUMN created_at TEXT NOT NULL DEFAULT (datetime('now'));

-- Backfill existing aircraft: use aircraft_hours.updated_at if available, else now()
UPDATE fleet SET created_at = COALESCE(
  (SELECT ah.updated_at FROM aircraft_hours ah WHERE ah.aircraft_id = fleet.id),
  datetime('now')
);
