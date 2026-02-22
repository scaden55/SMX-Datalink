-- 013-ourairports.sql: OurAirports reference data (airports, runways, frequencies)

CREATE TABLE IF NOT EXISTS oa_airports (
  id                INTEGER PRIMARY KEY,
  ident             TEXT    NOT NULL UNIQUE,
  type              TEXT    NOT NULL,
  name              TEXT    NOT NULL,
  latitude_deg      REAL,
  longitude_deg     REAL,
  elevation_ft      INTEGER,
  continent         TEXT,
  iso_country       TEXT,
  iso_region        TEXT,
  municipality      TEXT,
  scheduled_service TEXT,
  gps_code          TEXT,
  iata_code         TEXT,
  local_code        TEXT,
  home_link         TEXT,
  wikipedia_link    TEXT,
  keywords          TEXT
);

CREATE INDEX IF NOT EXISTS idx_oa_airports_type        ON oa_airports(type);
CREATE INDEX IF NOT EXISTS idx_oa_airports_iata        ON oa_airports(iata_code);
CREATE INDEX IF NOT EXISTS idx_oa_airports_iso_country ON oa_airports(iso_country);

CREATE TABLE IF NOT EXISTS oa_runways (
  id                          INTEGER PRIMARY KEY,
  airport_ref                 INTEGER,
  airport_ident               TEXT    NOT NULL,
  length_ft                   INTEGER,
  width_ft                    INTEGER,
  surface                     TEXT,
  lighted                     INTEGER,
  closed                      INTEGER,
  le_ident                    TEXT,
  le_latitude_deg             REAL,
  le_longitude_deg            REAL,
  le_elevation_ft             REAL,
  le_heading_degT             REAL,
  le_displaced_threshold_ft   REAL,
  he_ident                    TEXT,
  he_latitude_deg             REAL,
  he_longitude_deg            REAL,
  he_elevation_ft             REAL,
  he_heading_degT             REAL,
  he_displaced_threshold_ft   REAL
);

CREATE INDEX IF NOT EXISTS idx_oa_runways_airport ON oa_runways(airport_ident);

CREATE TABLE IF NOT EXISTS oa_frequencies (
  id              INTEGER PRIMARY KEY,
  airport_ref     INTEGER,
  airport_ident   TEXT    NOT NULL,
  type            TEXT,
  description     TEXT,
  frequency_mhz   REAL
);

CREATE INDEX IF NOT EXISTS idx_oa_frequencies_airport ON oa_frequencies(airport_ident);
