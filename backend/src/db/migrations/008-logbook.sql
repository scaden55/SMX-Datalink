-- 008-logbook.sql: Pilot logbook / PIREP records

CREATE TABLE IF NOT EXISTS logbook (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id               INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  flight_number         TEXT    NOT NULL,
  dep_icao              TEXT    NOT NULL,
  arr_icao              TEXT    NOT NULL,
  aircraft_type         TEXT    NOT NULL,
  aircraft_registration TEXT,
  scheduled_dep         TEXT,
  scheduled_arr         TEXT,
  actual_dep            TEXT    NOT NULL,
  actual_arr            TEXT    NOT NULL,
  flight_time_min       INTEGER NOT NULL,
  distance_nm           INTEGER NOT NULL,
  fuel_used_lbs         INTEGER,
  fuel_planned_lbs      INTEGER,
  route                 TEXT,
  cruise_altitude       TEXT,
  pax_count             INTEGER DEFAULT 0,
  cargo_lbs             INTEGER DEFAULT 0,
  landing_rate_fpm      INTEGER,
  score                 INTEGER,
  status                TEXT    NOT NULL DEFAULT 'completed',
  remarks               TEXT,
  created_at            TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_logbook_user   ON logbook(user_id);
CREATE INDEX IF NOT EXISTS idx_logbook_date   ON logbook(created_at);
CREATE INDEX IF NOT EXISTS idx_logbook_dep    ON logbook(dep_icao);
CREATE INDEX IF NOT EXISTS idx_logbook_arr    ON logbook(arr_icao);
CREATE INDEX IF NOT EXISTS idx_logbook_status ON logbook(status);
