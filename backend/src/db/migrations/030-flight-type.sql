-- Rename charter_type column to flight_type
ALTER TABLE scheduled_flights RENAME COLUMN charter_type TO flight_type;

-- Migrate old string values to IATA letter codes
UPDATE scheduled_flights SET flight_type = 'F' WHERE flight_type = 'cargo';
UPDATE scheduled_flights SET flight_type = 'J' WHERE flight_type = 'passenger';
UPDATE scheduled_flights SET flight_type = 'P' WHERE flight_type = 'reposition';
UPDATE scheduled_flights SET flight_type = 'F' WHERE flight_type = 'generated';
UPDATE scheduled_flights SET flight_type = 'J' WHERE flight_type = 'event';
