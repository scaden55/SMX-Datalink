-- Flight planning: SimBrief username and per-bid flight plan storage
ALTER TABLE users ADD COLUMN simbrief_username TEXT DEFAULT NULL;
ALTER TABLE active_bids ADD COLUMN simbrief_ofp_json TEXT DEFAULT NULL;
ALTER TABLE active_bids ADD COLUMN flight_plan_data TEXT DEFAULT NULL;
ALTER TABLE active_bids ADD COLUMN flight_plan_phase TEXT DEFAULT 'planning';
