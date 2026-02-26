ALTER TABLE airports ADD COLUMN is_hub INTEGER NOT NULL DEFAULT 0;
ALTER TABLE airports ADD COLUMN handler TEXT;

DELETE FROM active_bids WHERE schedule_id IN (
  SELECT id FROM scheduled_flights WHERE flight_number LIKE 'SVA-%'
);
DELETE FROM scheduled_flights WHERE flight_number LIKE 'SVA-%';
