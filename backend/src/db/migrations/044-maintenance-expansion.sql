-- 044-maintenance-expansion.sql: Discrepancies, MEL master list, table modifications

-- 1. ATA chapters reference table
CREATE TABLE IF NOT EXISTS ata_chapters (
  chapter     TEXT PRIMARY KEY,
  title       TEXT NOT NULL,
  description TEXT
);

-- 2. Discrepancies — pilot write-ups
CREATE TABLE IF NOT EXISTS discrepancies (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  aircraft_id       INTEGER NOT NULL REFERENCES fleet(id) ON DELETE CASCADE,
  flight_number     TEXT,
  logbook_entry_id  INTEGER REFERENCES logbook(id),
  reported_by       INTEGER NOT NULL REFERENCES users(id),
  reported_at       TEXT NOT NULL DEFAULT (datetime('now')),
  ata_chapter       TEXT NOT NULL REFERENCES ata_chapters(chapter),
  description       TEXT NOT NULL,
  flight_phase      TEXT,
  severity          TEXT NOT NULL CHECK(severity IN ('grounding','non_grounding')),
  status            TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','in_review','deferred','resolved','grounded')),
  resolved_by       INTEGER REFERENCES users(id),
  resolved_at       TEXT,
  resolution_type   TEXT,
  corrective_action TEXT,
  mel_deferral_id   INTEGER REFERENCES mel_deferrals(id),
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at        TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_discrep_aircraft ON discrepancies(aircraft_id);
CREATE INDEX IF NOT EXISTS idx_discrep_status   ON discrepancies(status);
CREATE INDEX IF NOT EXISTS idx_discrep_reporter ON discrepancies(reported_by);

-- 3. MEL master list — approved deferrable items per aircraft type
CREATE TABLE IF NOT EXISTS mel_master_list (
  id                     INTEGER PRIMARY KEY AUTOINCREMENT,
  icao_type              TEXT NOT NULL,
  ata_chapter            TEXT NOT NULL REFERENCES ata_chapters(chapter),
  item_number            TEXT NOT NULL,
  title                  TEXT NOT NULL,
  description            TEXT,
  category               TEXT NOT NULL CHECK(category IN ('A','B','C','D')),
  repair_interval_days   INTEGER,
  remarks                TEXT,
  operations_procedure   TEXT,
  maintenance_procedure  TEXT,
  is_active              INTEGER NOT NULL DEFAULT 1,
  created_at             TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at             TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(icao_type, item_number)
);
CREATE INDEX IF NOT EXISTS idx_mel_master_type ON mel_master_list(icao_type);
CREATE INDEX IF NOT EXISTS idx_mel_master_ata  ON mel_master_list(ata_chapter);

-- 4. Modify mel_deferrals — add linkage fields
ALTER TABLE mel_deferrals ADD COLUMN discrepancy_id INTEGER REFERENCES discrepancies(id);
ALTER TABLE mel_deferrals ADD COLUMN mel_master_id INTEGER REFERENCES mel_master_list(id);
ALTER TABLE mel_deferrals ADD COLUMN ata_chapter TEXT REFERENCES ata_chapters(chapter);
ALTER TABLE mel_deferrals ADD COLUMN placard_info TEXT;
ALTER TABLE mel_deferrals ADD COLUMN operations_procedure TEXT;
ALTER TABLE mel_deferrals ADD COLUMN maintenance_procedure TEXT;
ALTER TABLE mel_deferrals ADD COLUMN authorized_by INTEGER REFERENCES users(id);
ALTER TABLE mel_deferrals ADD COLUMN updated_at TEXT NOT NULL DEFAULT (datetime('now'));

-- 5. Modify maintenance_log — add discrepancy link
ALTER TABLE maintenance_log ADD COLUMN discrepancy_id INTEGER REFERENCES discrepancies(id);

-- 6. Modify active_bids — add MEL acknowledgment
ALTER TABLE active_bids ADD COLUMN mel_ack_at TEXT;
