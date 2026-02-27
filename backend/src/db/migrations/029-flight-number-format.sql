-- 029-flight-number-format.sql
-- Remove dash from SMX- flight numbers -> SMX format (e.g., SMX-1234 -> SMX1234)
UPDATE scheduled_flights SET flight_number = REPLACE(flight_number, 'SMX-', 'SMX') WHERE flight_number LIKE 'SMX-%';
