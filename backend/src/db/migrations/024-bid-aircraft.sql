-- 024: Add aircraft_id to active_bids for aircraft selection at bid time
ALTER TABLE active_bids ADD COLUMN aircraft_id INTEGER REFERENCES fleet(id);

CREATE INDEX IF NOT EXISTS idx_bids_aircraft ON active_bids(aircraft_id);
