-- 002-schedule.sql: Airports, fleet, scheduled flights, and bids

CREATE TABLE IF NOT EXISTS airports (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  icao      TEXT    NOT NULL UNIQUE,
  name      TEXT    NOT NULL,
  city      TEXT    NOT NULL,
  state     TEXT    NOT NULL DEFAULT '',
  country   TEXT    NOT NULL DEFAULT 'US',
  lat       REAL    NOT NULL,
  lon       REAL    NOT NULL,
  elevation INTEGER NOT NULL DEFAULT 0,
  timezone  TEXT    NOT NULL DEFAULT 'America/New_York'
);

CREATE INDEX IF NOT EXISTS idx_airports_icao ON airports(icao);

CREATE TABLE IF NOT EXISTS fleet (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  icao_type         TEXT    NOT NULL,
  name              TEXT    NOT NULL,
  registration      TEXT    NOT NULL UNIQUE,
  airline           TEXT    NOT NULL DEFAULT 'SMA',
  range_nm          INTEGER NOT NULL DEFAULT 0,
  cruise_speed      INTEGER NOT NULL DEFAULT 0,
  pax_capacity      INTEGER NOT NULL DEFAULT 0,
  cargo_capacity_lbs INTEGER NOT NULL DEFAULT 0,
  is_active         INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_fleet_type ON fleet(icao_type);

CREATE TABLE IF NOT EXISTS scheduled_flights (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  flight_number   TEXT    NOT NULL,
  dep_icao        TEXT    NOT NULL REFERENCES airports(icao),
  arr_icao        TEXT    NOT NULL REFERENCES airports(icao),
  aircraft_type   TEXT    NOT NULL,
  dep_time        TEXT    NOT NULL,
  arr_time        TEXT    NOT NULL,
  distance_nm     INTEGER NOT NULL,
  flight_time_min INTEGER NOT NULL,
  days_of_week    TEXT    NOT NULL DEFAULT '1234567',
  is_active       INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_sched_dep  ON scheduled_flights(dep_icao);
CREATE INDEX IF NOT EXISTS idx_sched_arr  ON scheduled_flights(arr_icao);
CREATE INDEX IF NOT EXISTS idx_sched_type ON scheduled_flights(aircraft_type);

CREATE TABLE IF NOT EXISTS active_bids (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  schedule_id INTEGER NOT NULL REFERENCES scheduled_flights(id) ON DELETE CASCADE,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, schedule_id)
);

CREATE INDEX IF NOT EXISTS idx_bids_user     ON active_bids(user_id);
CREATE INDEX IF NOT EXISTS idx_bids_schedule ON active_bids(schedule_id);
