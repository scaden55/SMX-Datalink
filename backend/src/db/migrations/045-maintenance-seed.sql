-- 045-maintenance-seed.sql: Seed ATA chapters, default check intervals, MEL master list

-- ATA 100 Chapters
INSERT OR IGNORE INTO ata_chapters (chapter, title) VALUES
('05', 'Time Limits / Maintenance Checks'),
('06', 'Dimensions and Areas'),
('07', 'Lifting and Shoring'),
('08', 'Leveling and Weighing'),
('09', 'Towing and Taxiing'),
('10', 'Parking, Mooring, Storage, and Return to Service'),
('11', 'Placards and Markings'),
('12', 'Servicing'),
('20', 'Standard Practices - Airframe'),
('21', 'Air Conditioning'),
('22', 'Auto Flight'),
('23', 'Communications'),
('24', 'Electrical Power'),
('25', 'Equipment / Furnishings'),
('26', 'Fire Protection'),
('27', 'Flight Controls'),
('28', 'Fuel'),
('29', 'Hydraulic Power'),
('30', 'Ice and Rain Protection'),
('31', 'Indicating / Recording Systems'),
('32', 'Landing Gear'),
('33', 'Lights'),
('34', 'Navigation'),
('35', 'Oxygen'),
('36', 'Pneumatic'),
('37', 'Vacuum'),
('38', 'Water / Waste'),
('45', 'Central Maintenance System'),
('46', 'Information Systems'),
('49', 'Airborne Auxiliary Power'),
('51', 'Standard Practices and Structures'),
('52', 'Doors'),
('53', 'Fuselage'),
('54', 'Nacelles / Pylons'),
('55', 'Stabilizers'),
('56', 'Windows'),
('57', 'Wings'),
('70', 'Standard Practices - Engines'),
('71', 'Power Plant'),
('72', 'Engine - Turbine / Turboprop'),
('73', 'Engine Fuel and Control'),
('74', 'Ignition'),
('75', 'Air'),
('76', 'Engine Controls'),
('77', 'Engine Indicating'),
('78', 'Exhaust'),
('79', 'Oil'),
('80', 'Starting');

-- Default check intervals for B763 (Boeing 767-300F)
INSERT OR IGNORE INTO maintenance_checks (icao_type, check_type, interval_hours, interval_cycles, interval_months, overflight_pct, estimated_duration_hours, description)
VALUES
('B763', 'A', 500, NULL, NULL, 10, 8, 'A Check - Routine inspection'),
('B763', 'B', 4500, NULL, NULL, 0, 48, 'B Check - Intermediate inspection'),
('B763', 'C', 6000, 3000, 18, 0, 336, 'C Check - Heavy inspection (2 weeks)'),
('B763', 'D', NULL, NULL, 72, 0, 672, 'D Check - Structural overhaul (4 weeks)');

-- Default check intervals for B752 (Boeing 757-200F)
INSERT OR IGNORE INTO maintenance_checks (icao_type, check_type, interval_hours, interval_cycles, interval_months, overflight_pct, estimated_duration_hours, description)
VALUES
('B752', 'A', 500, NULL, NULL, 10, 6, 'A Check - Routine inspection'),
('B752', 'B', 4000, NULL, NULL, 0, 40, 'B Check - Intermediate inspection'),
('B752', 'C', 5500, 2800, 18, 0, 336, 'C Check - Heavy inspection (2 weeks)'),
('B752', 'D', NULL, NULL, 72, 0, 672, 'D Check - Structural overhaul (4 weeks)');

-- MEL Master List — B763 common deferrable items
INSERT OR IGNORE INTO mel_master_list (icao_type, ata_chapter, item_number, title, category, repair_interval_days, remarks, operations_procedure, maintenance_procedure) VALUES
-- ATA 21 Air Conditioning
('B763', '21', '21-01', 'Pack Valve (one of two)', 'C', NULL, 'One pack must remain operative', 'Dispatch with one pack inop. May affect max altitude.', 'Deactivate and placard inop pack valve.'),
('B763', '21', '21-02', 'Cargo Compartment Heater', 'C', NULL, 'Perishable cargo restrictions apply', 'No perishable cargo in affected compartment.', 'Placard affected compartment heater INOP.'),
-- ATA 23 Communications
('B763', '23', '23-01', 'HF Radio (one of two)', 'C', NULL, 'One HF must remain operative for ETOPS', 'Dispatch with one HF inop. ETOPS restrictions may apply.', 'Placard HF radio INOP.'),
('B763', '23', '23-02', 'SATCOM System', 'D', NULL, NULL, 'Standard voice comms required via VHF/HF.', 'Deactivate and placard SATCOM INOP.'),
('B763', '23', '23-03', 'ACARS Datalink (one of two)', 'C', NULL, 'One ACARS must remain operative', 'Dispatch with one ACARS inop.', 'Placard ACARS unit INOP.'),
-- ATA 26 Fire Protection
('B763', '26', '26-01', 'Cargo Smoke Detector (one per zone, spare remaining)', 'B', NULL, 'At least one detector per zone must remain operative', 'Affected zone must retain minimum detection coverage.', 'Test remaining detectors. Placard inop detector.'),
-- ATA 29 Hydraulic Power
('B763', '29', '29-01', 'Hydraulic Quantity Indicator (one of three)', 'C', NULL, 'Two indicators must remain operative', 'Monitor remaining hydraulic qty indicators.', 'Placard inop indicator.'),
-- ATA 30 Ice/Rain Protection
('B763', '30', '30-01', 'Windshield Heat (one panel)', 'B', NULL, 'Affected side windshield must not be PIC side', 'Pilot must not occupy seat on affected side in icing conditions.', 'Placard affected windshield heat INOP.'),
-- ATA 33 Lights
('B763', '33', '33-01', 'Logo Light', 'C', NULL, NULL, 'No operational impact.', 'Placard logo light INOP.'),
('B763', '33', '33-02', 'Landing Light (one of two)', 'C', NULL, 'One landing light must remain operative', 'Dispatch with one landing light inop. Night ops unaffected with one.', 'Placard inop landing light.'),
('B763', '33', '33-03', 'Cargo Compartment Light (one per zone)', 'D', NULL, NULL, 'Portable lighting available for cargo loading.', 'Placard affected light INOP.'),
-- ATA 34 Navigation
('B763', '34', '34-01', 'Weather Radar', 'B', NULL, 'Must not dispatch into known areas of thunderstorm activity', 'Avoid areas of known thunderstorm activity. File routes clear of convective weather.', 'Placard WX RADAR INOP.'),
('B763', '34', '34-02', 'IRS (one of three)', 'C', NULL, 'Two IRS must remain operative', 'Dispatch with two operative IRS. ETOPS restrictions may apply.', 'Deactivate and placard inop IRS.'),
('B763', '34', '34-03', 'GPS Receiver (one of two)', 'C', NULL, 'One GPS must remain operative', 'Dispatch with one GPS. RNP restrictions may apply.', 'Placard inop GPS receiver.'),
('B763', '34', '34-04', 'Radio Altimeter (one of two)', 'B', NULL, 'One must remain for CAT I approaches', 'CAT II/III approaches prohibited. Autoland not available.', 'Placard inop radio altimeter.'),
-- ATA 35 Oxygen
('B763', '35', '35-01', 'Portable Oxygen Bottle (one spare)', 'C', NULL, 'Minimum required bottles must remain', 'Verify remaining portable O2 meets minimum.', 'Remove defective bottle, placard location.'),
-- ATA 49 APU
('B763', '49', '49-01', 'APU', 'C', NULL, 'Ground power/air must be available at origin and destination', 'Dispatch only to airports with ground power and air start.', 'Placard APU INOP. Verify ground support at all stations.'),
-- ATA 52 Doors
('B763', '52', '52-01', 'Cargo Door Warning Light', 'B', NULL, 'Door must be verified closed by alternate means', 'Ground crew must verify door secure by visual inspection.', 'Placard warning light INOP. Add visual check to preflight.');

-- MEL Master List — B752 common deferrable items
INSERT OR IGNORE INTO mel_master_list (icao_type, ata_chapter, item_number, title, category, repair_interval_days, remarks, operations_procedure, maintenance_procedure) VALUES
-- ATA 21 Air Conditioning
('B752', '21', '21-01', 'Pack Valve (one of two)', 'C', NULL, 'One pack must remain operative', 'Dispatch with one pack inop. May affect max altitude.', 'Deactivate and placard inop pack valve.'),
('B752', '21', '21-02', 'Cargo Compartment Heater', 'C', NULL, 'Perishable cargo restrictions apply', 'No perishable cargo in affected compartment.', 'Placard affected compartment heater INOP.'),
-- ATA 23 Communications
('B752', '23', '23-01', 'HF Radio', 'C', NULL, 'VHF must remain operative', 'Domestic ops only, no oceanic dispatch.', 'Placard HF INOP.'),
('B752', '23', '23-02', 'ACARS Datalink', 'C', NULL, NULL, 'Standard voice position reports required.', 'Placard ACARS INOP.'),
-- ATA 26 Fire Protection
('B752', '26', '26-01', 'Cargo Smoke Detector (one per zone, spare remaining)', 'B', NULL, 'At least one detector per zone must remain', 'Affected zone must retain minimum detection.', 'Test remaining detectors. Placard inop.'),
-- ATA 29 Hydraulic
('B752', '29', '29-01', 'Hydraulic Quantity Indicator (one of two)', 'C', NULL, 'One indicator must remain operative', 'Monitor remaining hydraulic qty indicator.', 'Placard inop indicator.'),
-- ATA 30 Ice/Rain
('B752', '30', '30-01', 'Windshield Heat (one panel)', 'B', NULL, 'Affected side must not be PIC side', 'Pilot must not occupy affected side in icing.', 'Placard windshield heat INOP.'),
-- ATA 33 Lights
('B752', '33', '33-01', 'Logo Light', 'C', NULL, NULL, 'No operational impact.', 'Placard logo light INOP.'),
('B752', '33', '33-02', 'Landing Light (one of two)', 'C', NULL, 'One must remain operative', 'Dispatch with one landing light inop.', 'Placard inop landing light.'),
('B752', '33', '33-03', 'Cargo Compartment Light', 'D', NULL, NULL, 'Portable lighting for cargo loading.', 'Placard affected light INOP.'),
-- ATA 34 Navigation
('B752', '34', '34-01', 'Weather Radar', 'B', NULL, 'No dispatch into known thunderstorm areas', 'Avoid areas of thunderstorm activity.', 'Placard WX RADAR INOP.'),
('B752', '34', '34-02', 'IRS (one of three)', 'C', NULL, 'Two IRS must remain operative', 'Dispatch with two operative IRS.', 'Deactivate and placard inop IRS.'),
('B752', '34', '34-03', 'GPS Receiver (one of two)', 'C', NULL, 'One GPS must remain operative', 'Dispatch with one GPS. RNP restrictions may apply.', 'Placard inop GPS.'),
-- ATA 35 Oxygen
('B752', '35', '35-01', 'Portable Oxygen Bottle (one spare)', 'C', NULL, 'Minimum bottles must remain', 'Verify remaining O2 meets minimum.', 'Remove defective bottle.'),
-- ATA 49 APU
('B752', '49', '49-01', 'APU', 'C', NULL, 'Ground power/air must be available', 'Dispatch only to airports with ground support.', 'Placard APU INOP.'),
-- ATA 52 Doors
('B752', '52', '52-01', 'Cargo Door Warning Light', 'B', NULL, 'Door must be verified by alternate means', 'Ground crew visual inspection required.', 'Placard warning light INOP.');
