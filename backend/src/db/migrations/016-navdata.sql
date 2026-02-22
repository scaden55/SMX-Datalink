-- 016-navdata.sql
-- Navigation data tables: waypoints (fixes), navaids, airways
-- Source: X-Plane open navdata (earth_fix.dat, earth_nav.dat, earth_awy.dat)

CREATE TABLE IF NOT EXISTS waypoints (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  ident         TEXT NOT NULL,
  lat           REAL NOT NULL,
  lon           REAL NOT NULL,
  region        TEXT,
  airport_icao  TEXT,
  type          TEXT NOT NULL DEFAULT 'fix'
);
CREATE INDEX IF NOT EXISTS idx_waypoints_ident ON waypoints(ident);
CREATE INDEX IF NOT EXISTS idx_waypoints_region ON waypoints(region);

CREATE TABLE IF NOT EXISTS navaids (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  ident         TEXT NOT NULL,
  type          TEXT NOT NULL,
  type_code     INTEGER NOT NULL,
  lat           REAL NOT NULL,
  lon           REAL NOT NULL,
  elevation_ft  INTEGER,
  frequency     REAL,
  range_nm      INTEGER,
  bearing       REAL,
  airport_icao  TEXT,
  region        TEXT,
  name          TEXT
);
CREATE INDEX IF NOT EXISTS idx_navaids_ident ON navaids(ident);
CREATE INDEX IF NOT EXISTS idx_navaids_type ON navaids(type);
CREATE INDEX IF NOT EXISTS idx_navaids_region ON navaids(region);

CREATE TABLE IF NOT EXISTS airways (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  ident           TEXT NOT NULL,
  fix_ident       TEXT NOT NULL,
  fix_lat         REAL,
  fix_lon         REAL,
  next_fix_ident  TEXT NOT NULL,
  next_fix_lat    REAL,
  next_fix_lon    REAL,
  direction       INTEGER,
  base_alt        INTEGER,
  top_alt         INTEGER
);
CREATE INDEX IF NOT EXISTS idx_airways_ident ON airways(ident);
CREATE INDEX IF NOT EXISTS idx_airways_fix ON airways(fix_ident);
CREATE INDEX IF NOT EXISTS idx_airways_next_fix ON airways(next_fix_ident);
