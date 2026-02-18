-- Add charter support to scheduled_flights
ALTER TABLE scheduled_flights ADD COLUMN charter_type TEXT DEFAULT NULL;
ALTER TABLE scheduled_flights ADD COLUMN created_by INTEGER DEFAULT NULL REFERENCES users(id);
