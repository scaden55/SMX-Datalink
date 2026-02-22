-- VATSIM connection tracking for logbook entries and active bids
ALTER TABLE logbook ADD COLUMN vatsim_connected INTEGER NOT NULL DEFAULT 0;
ALTER TABLE logbook ADD COLUMN vatsim_callsign TEXT;
ALTER TABLE logbook ADD COLUMN vatsim_cid INTEGER;

ALTER TABLE active_bids ADD COLUMN vatsim_connected INTEGER NOT NULL DEFAULT 0;
ALTER TABLE active_bids ADD COLUMN vatsim_callsign TEXT;
ALTER TABLE active_bids ADD COLUMN vatsim_cid INTEGER;

CREATE INDEX IF NOT EXISTS idx_logbook_vatsim ON logbook(vatsim_connected);
