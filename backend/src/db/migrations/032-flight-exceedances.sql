-- Exceedance events detected during flight (hard landing, overspeed, etc.)
CREATE TABLE IF NOT EXISTS flight_exceedances (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  bid_id       INTEGER NOT NULL,
  logbook_id   INTEGER,
  pilot_id     INTEGER NOT NULL,
  type         TEXT    NOT NULL,
  severity     TEXT    NOT NULL DEFAULT 'warning',
  value        REAL    NOT NULL,
  threshold    REAL    NOT NULL,
  unit         TEXT    NOT NULL,
  phase        TEXT    NOT NULL,
  message      TEXT    NOT NULL,
  detected_at  TEXT    NOT NULL,
  created_at   TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_exceedances_bid     ON flight_exceedances(bid_id);
CREATE INDEX IF NOT EXISTS idx_exceedances_logbook ON flight_exceedances(logbook_id);
CREATE INDEX IF NOT EXISTS idx_exceedances_pilot   ON flight_exceedances(pilot_id);
