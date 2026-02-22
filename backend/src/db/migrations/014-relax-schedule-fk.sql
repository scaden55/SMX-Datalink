-- 014-relax-schedule-fk.sql: Remove airport FK constraints from scheduled_flights
-- Now that admins can create schedules for any of the 47k+ OurAirports entries,
-- the FK to the 26-row airports table is too restrictive.

CREATE TABLE IF NOT EXISTS scheduled_flights_new (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  flight_number   TEXT    NOT NULL,
  dep_icao        TEXT    NOT NULL,
  arr_icao        TEXT    NOT NULL,
  aircraft_type   TEXT    NOT NULL,
  dep_time        TEXT    NOT NULL,
  arr_time        TEXT    NOT NULL,
  distance_nm     INTEGER NOT NULL,
  flight_time_min INTEGER NOT NULL,
  days_of_week    TEXT    NOT NULL DEFAULT '1234567',
  is_active       INTEGER NOT NULL DEFAULT 1,
  charter_type    TEXT    DEFAULT NULL,
  created_by      INTEGER DEFAULT NULL
);

INSERT INTO scheduled_flights_new
  SELECT id, flight_number, dep_icao, arr_icao, aircraft_type,
         dep_time, arr_time, distance_nm, flight_time_min,
         days_of_week, is_active, charter_type, created_by
  FROM scheduled_flights;

DROP TABLE scheduled_flights;
ALTER TABLE scheduled_flights_new RENAME TO scheduled_flights;

-- Re-create indexes
CREATE INDEX IF NOT EXISTS idx_sched_dep  ON scheduled_flights(dep_icao);
CREATE INDEX IF NOT EXISTS idx_sched_arr  ON scheduled_flights(arr_icao);
CREATE INDEX IF NOT EXISTS idx_sched_type ON scheduled_flights(aircraft_type);
