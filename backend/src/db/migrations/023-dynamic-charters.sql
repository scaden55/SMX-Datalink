-- 023: Dynamic charter system — monthly generated + VATSIM event charters

-- Extend scheduled_flights with event/expiry metadata
ALTER TABLE scheduled_flights ADD COLUMN event_tag TEXT DEFAULT NULL;
ALTER TABLE scheduled_flights ADD COLUMN vatsim_event_id INTEGER DEFAULT NULL;
ALTER TABLE scheduled_flights ADD COLUMN expires_at TEXT DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_sched_charter_type ON scheduled_flights(charter_type);
CREATE INDEX IF NOT EXISTS idx_sched_expires ON scheduled_flights(expires_at);

-- Track monthly generation runs to prevent duplicates
CREATE TABLE IF NOT EXISTS charter_generation_log (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  month         TEXT NOT NULL UNIQUE,  -- 'YYYY-MM'
  generated_at  TEXT NOT NULL DEFAULT (datetime('now')),
  charter_count INTEGER NOT NULL DEFAULT 0,
  event_count   INTEGER NOT NULL DEFAULT 0
);

-- Cache VATSIM events for charter linking
CREATE TABLE IF NOT EXISTS vatsim_events (
  id          INTEGER PRIMARY KEY,  -- VATSIM event ID
  name        TEXT NOT NULL,
  event_type  TEXT NOT NULL,
  start_time  TEXT NOT NULL,
  end_time    TEXT NOT NULL,
  airports    TEXT NOT NULL DEFAULT '[]',  -- JSON array of ICAO codes
  tag         TEXT,
  description TEXT,
  fetched_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
