-- OOOI timestamps (ISO 8601 UTC, nullable for legacy entries)
ALTER TABLE logbook ADD COLUMN oooi_out TEXT;
ALTER TABLE logbook ADD COLUMN oooi_off TEXT;
ALTER TABLE logbook ADD COLUMN oooi_on TEXT;
ALTER TABLE logbook ADD COLUMN oooi_in TEXT;
