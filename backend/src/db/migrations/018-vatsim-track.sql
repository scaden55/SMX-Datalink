-- VATSIM pilot position tracking: records all moving pilot positions
-- from the 15s poll cycle to reconstruct full flight tracks server-side.
-- Session key = "cid:logon_time" — naturally resets on reconnect.

CREATE TABLE IF NOT EXISTS vatsim_track (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_key TEXT NOT NULL,    -- "cid:logon_time"
  cid INTEGER NOT NULL,
  callsign TEXT NOT NULL,
  lat REAL NOT NULL,
  lon REAL NOT NULL,
  altitude_ft INTEGER NOT NULL,
  groundspeed INTEGER NOT NULL,
  heading INTEGER NOT NULL,
  recorded_at INTEGER NOT NULL  -- Unix ms
);

CREATE INDEX idx_vatsim_track_session ON vatsim_track(session_key, recorded_at);
CREATE INDEX idx_vatsim_track_cid ON vatsim_track(cid, recorded_at);
CREATE INDEX idx_vatsim_track_time ON vatsim_track(recorded_at);
