-- 025-maintenance.sql: Add maintenance tracking tables (aircraft hours, checks, log, ADs, MEL deferrals, components)

-- 1. aircraft_hours — One row per aircraft, tracks cumulative hours/cycles
CREATE TABLE IF NOT EXISTS aircraft_hours (
  aircraft_id       INTEGER PRIMARY KEY REFERENCES fleet(id) ON DELETE CASCADE,
  total_hours       REAL    NOT NULL DEFAULT 0,
  total_cycles      INTEGER NOT NULL DEFAULT 0,
  hours_at_last_a   REAL    DEFAULT 0,
  hours_at_last_b   REAL    DEFAULT 0,
  hours_at_last_c   REAL    DEFAULT 0,
  cycles_at_last_c  INTEGER DEFAULT 0,
  last_d_check_date TEXT,
  updated_at        TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- 2. maintenance_checks — Check interval definitions per aircraft type
CREATE TABLE IF NOT EXISTS maintenance_checks (
  id                       INTEGER PRIMARY KEY AUTOINCREMENT,
  icao_type                TEXT    NOT NULL,
  check_type               TEXT    NOT NULL CHECK(check_type IN ('A','B','C','D')),
  interval_hours           REAL,
  interval_cycles          INTEGER,
  interval_months          INTEGER,
  overflight_pct           REAL    NOT NULL DEFAULT 0,
  estimated_duration_hours INTEGER,
  description              TEXT,
  UNIQUE(icao_type, check_type)
);
CREATE INDEX IF NOT EXISTS idx_maint_checks_type ON maintenance_checks(icao_type);

-- 3. maintenance_log — Every maintenance action
CREATE TABLE IF NOT EXISTS maintenance_log (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  aircraft_id     INTEGER NOT NULL REFERENCES fleet(id) ON DELETE CASCADE,
  check_type      TEXT    NOT NULL CHECK(check_type IN ('A','B','C','D','LINE','UNSCHEDULED','AD','MEL','SFP')),
  title           TEXT    NOT NULL,
  description     TEXT,
  performed_by    TEXT,
  performed_at    TEXT,
  hours_at_check  REAL,
  cycles_at_check INTEGER,
  cost            REAL,
  status          TEXT    NOT NULL DEFAULT 'scheduled' CHECK(status IN ('scheduled','in_progress','completed','deferred')),
  sfp_destination TEXT,
  sfp_expiry      TEXT,
  created_by      INTEGER REFERENCES users(id),
  created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_maint_log_aircraft ON maintenance_log(aircraft_id);
CREATE INDEX IF NOT EXISTS idx_maint_log_status   ON maintenance_log(status);
CREATE INDEX IF NOT EXISTS idx_maint_log_type     ON maintenance_log(check_type);

-- 4. airworthiness_directives — AD compliance tracking
CREATE TABLE IF NOT EXISTS airworthiness_directives (
  id                       INTEGER PRIMARY KEY AUTOINCREMENT,
  aircraft_id              INTEGER NOT NULL REFERENCES fleet(id) ON DELETE CASCADE,
  ad_number                TEXT    NOT NULL,
  title                    TEXT    NOT NULL,
  description              TEXT,
  compliance_status        TEXT    NOT NULL DEFAULT 'open' CHECK(compliance_status IN ('open','complied','recurring','not_applicable')),
  compliance_date          TEXT,
  compliance_method        TEXT,
  recurring_interval_hours REAL,
  next_due_hours           REAL,
  next_due_date            TEXT,
  created_by               INTEGER REFERENCES users(id),
  created_at               TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at               TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_ad_aircraft ON airworthiness_directives(aircraft_id);
CREATE INDEX IF NOT EXISTS idx_ad_status   ON airworthiness_directives(compliance_status);

-- 5. mel_deferrals — MEL deferred items
CREATE TABLE IF NOT EXISTS mel_deferrals (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  aircraft_id     INTEGER NOT NULL REFERENCES fleet(id) ON DELETE CASCADE,
  item_number     TEXT    NOT NULL,
  title           TEXT    NOT NULL,
  category        TEXT    NOT NULL CHECK(category IN ('A','B','C','D')),
  deferral_date   TEXT    NOT NULL,
  expiry_date     TEXT    NOT NULL,
  rectified_date  TEXT,
  status          TEXT    NOT NULL DEFAULT 'open' CHECK(status IN ('open','rectified','expired')),
  remarks         TEXT,
  created_by      INTEGER REFERENCES users(id),
  created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_mel_aircraft ON mel_deferrals(aircraft_id);
CREATE INDEX IF NOT EXISTS idx_mel_status   ON mel_deferrals(status);

-- 6. aircraft_components — Life-limited component tracking
CREATE TABLE IF NOT EXISTS aircraft_components (
  id                       INTEGER PRIMARY KEY AUTOINCREMENT,
  aircraft_id              INTEGER NOT NULL REFERENCES fleet(id) ON DELETE CASCADE,
  component_type           TEXT    NOT NULL CHECK(component_type IN ('ENGINE','APU','LANDING_GEAR','PROP','AVIONICS','OTHER')),
  position                 TEXT,
  serial_number            TEXT,
  part_number              TEXT,
  hours_since_new          REAL    NOT NULL DEFAULT 0,
  cycles_since_new         INTEGER NOT NULL DEFAULT 0,
  hours_since_overhaul     REAL    NOT NULL DEFAULT 0,
  cycles_since_overhaul    INTEGER NOT NULL DEFAULT 0,
  overhaul_interval_hours  REAL,
  installed_date           TEXT,
  status                   TEXT    NOT NULL DEFAULT 'installed' CHECK(status IN ('installed','removed','in_shop','scrapped')),
  remarks                  TEXT,
  created_at               TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at               TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_comp_aircraft ON aircraft_components(aircraft_id);
CREATE INDEX IF NOT EXISTS idx_comp_status   ON aircraft_components(status);
