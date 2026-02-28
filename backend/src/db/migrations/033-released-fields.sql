-- Track which fields were changed during the last dispatcher release
-- so the pilot can see highlighted changes and acknowledge them
ALTER TABLE active_bids ADD COLUMN released_fields TEXT DEFAULT NULL;
