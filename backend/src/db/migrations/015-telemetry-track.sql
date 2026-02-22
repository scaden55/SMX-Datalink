-- Telemetry track persistence for aircraft trail rendering
CREATE TABLE IF NOT EXISTS telemetry_track (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pilot_id INTEGER NOT NULL,
  bid_id INTEGER NOT NULL,
  lat REAL NOT NULL,
  lon REAL NOT NULL,
  altitude_ft INTEGER NOT NULL,
  heading INTEGER,
  speed_kts INTEGER,
  vs_fpm INTEGER,
  recorded_at INTEGER NOT NULL  -- Unix timestamp ms
);

CREATE INDEX IF NOT EXISTS idx_telemetry_track_bid ON telemetry_track(bid_id);
CREATE INDEX IF NOT EXISTS idx_telemetry_track_pilot ON telemetry_track(pilot_id, recorded_at);
