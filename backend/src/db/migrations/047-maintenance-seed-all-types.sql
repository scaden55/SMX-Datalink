-- 047-maintenance-seed-all-types.sql: Seed check intervals for additional fleet types

-- A30F (Airbus A300-600F)
INSERT OR IGNORE INTO maintenance_checks (icao_type, check_type, interval_hours, interval_cycles, interval_months, overflight_pct, estimated_duration_hours, description)
VALUES
('A30F', 'A', 500, NULL, NULL, 10, 10, 'A Check - Routine inspection'),
('A30F', 'B', 4500, NULL, NULL, 0, 48, 'B Check - Intermediate inspection'),
('A30F', 'C', 6000, 3000, 18, 0, 336, 'C Check - Heavy inspection (2 weeks)'),
('A30F', 'D', NULL, NULL, 72, 0, 672, 'D Check - Structural overhaul (4 weeks)');

-- B737 (Boeing 737)
INSERT OR IGNORE INTO maintenance_checks (icao_type, check_type, interval_hours, interval_cycles, interval_months, overflight_pct, estimated_duration_hours, description)
VALUES
('B737', 'A', 500, NULL, NULL, 10, 6, 'A Check - Routine inspection'),
('B737', 'B', 4500, NULL, NULL, 0, 40, 'B Check - Intermediate inspection'),
('B737', 'C', 6000, 3000, 18, 0, 336, 'C Check - Heavy inspection (2 weeks)'),
('B737', 'D', NULL, NULL, 72, 0, 672, 'D Check - Structural overhaul (4 weeks)');

-- B738 (Boeing 737-800)
INSERT OR IGNORE INTO maintenance_checks (icao_type, check_type, interval_hours, interval_cycles, interval_months, overflight_pct, estimated_duration_hours, description)
VALUES
('B738', 'A', 500, NULL, NULL, 10, 6, 'A Check - Routine inspection'),
('B738', 'B', 4500, NULL, NULL, 0, 40, 'B Check - Intermediate inspection'),
('B738', 'C', 6000, 3000, 18, 0, 336, 'C Check - Heavy inspection (2 weeks)'),
('B738', 'D', NULL, NULL, 72, 0, 672, 'D Check - Structural overhaul (4 weeks)');

-- B77F (Boeing 777F)
INSERT OR IGNORE INTO maintenance_checks (icao_type, check_type, interval_hours, interval_cycles, interval_months, overflight_pct, estimated_duration_hours, description)
VALUES
('B77F', 'A', 500, NULL, NULL, 10, 12, 'A Check - Routine inspection'),
('B77F', 'B', 4500, NULL, NULL, 0, 56, 'B Check - Intermediate inspection'),
('B77F', 'C', 6000, 3000, 18, 0, 336, 'C Check - Heavy inspection (2 weeks)'),
('B77F', 'D', NULL, NULL, 72, 0, 672, 'D Check - Structural overhaul (4 weeks)');

-- DHC6 (de Havilland Canada DHC-6 Twin Otter)
INSERT OR IGNORE INTO maintenance_checks (icao_type, check_type, interval_hours, interval_cycles, interval_months, overflight_pct, estimated_duration_hours, description)
VALUES
('DHC6', 'A', 500, NULL, NULL, 10, 4, 'A Check - Routine inspection'),
('DHC6', 'B', 4500, NULL, NULL, 0, 24, 'B Check - Intermediate inspection'),
('DHC6', 'C', 6000, 3000, 18, 0, 168, 'C Check - Heavy inspection (1 week)'),
('DHC6', 'D', NULL, NULL, 72, 0, 504, 'D Check - Structural overhaul (3 weeks)');

-- MD1F (McDonnell Douglas MD-11F)
INSERT OR IGNORE INTO maintenance_checks (icao_type, check_type, interval_hours, interval_cycles, interval_months, overflight_pct, estimated_duration_hours, description)
VALUES
('MD1F', 'A', 500, NULL, NULL, 10, 10, 'A Check - Routine inspection'),
('MD1F', 'B', 4500, NULL, NULL, 0, 48, 'B Check - Intermediate inspection'),
('MD1F', 'C', 6000, 3000, 18, 0, 336, 'C Check - Heavy inspection (2 weeks)'),
('MD1F', 'D', NULL, NULL, 72, 0, 672, 'D Check - Structural overhaul (4 weeks)');
