-- Add ground handler and route metadata columns to scheduled_flights
ALTER TABLE scheduled_flights ADD COLUMN origin_handler TEXT;
ALTER TABLE scheduled_flights ADD COLUMN dest_handler TEXT;
ALTER TABLE scheduled_flights ADD COLUMN fare_code TEXT;
ALTER TABLE scheduled_flights ADD COLUMN cargo_remarks TEXT;
ALTER TABLE scheduled_flights ADD COLUMN group_class TEXT;
