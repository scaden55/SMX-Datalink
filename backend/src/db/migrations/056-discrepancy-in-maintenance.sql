-- 056-discrepancy-in-maintenance.sql

PRAGMA foreign_keys = OFF;

CREATE TABLE discrepancies_new (
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
  status            TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','in_review','deferred','resolved','grounded','in_maintenance')),
  resolved_by       INTEGER REFERENCES users(id),
  resolved_at       TEXT,
  resolution_type   TEXT,
  corrective_action TEXT,
  mel_deferral_id   INTEGER REFERENCES mel_deferrals(id),
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO discrepancies_new SELECT * FROM discrepancies;

DROP TABLE discrepancies;

ALTER TABLE discrepancies_new RENAME TO discrepancies;

CREATE INDEX IF NOT EXISTS idx_discrep_aircraft ON discrepancies(aircraft_id);
CREATE INDEX IF NOT EXISTS idx_discrep_status ON discrepancies(status);
CREATE INDEX IF NOT EXISTS idx_discrep_reporter ON discrepancies(reported_by);

PRAGMA foreign_keys = ON;
