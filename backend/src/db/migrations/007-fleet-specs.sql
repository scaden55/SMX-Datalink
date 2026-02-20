-- 007-fleet-specs.sql: Add detailed aircraft specs, equipment codes, and airframe data

-- Weight specs (lbs)
ALTER TABLE fleet ADD COLUMN oew_lbs INTEGER;
ALTER TABLE fleet ADD COLUMN mzfw_lbs INTEGER;
ALTER TABLE fleet ADD COLUMN mtow_lbs INTEGER;
ALTER TABLE fleet ADD COLUMN mlw_lbs INTEGER;
ALTER TABLE fleet ADD COLUMN max_fuel_lbs INTEGER;

-- Airframe details
ALTER TABLE fleet ADD COLUMN engines TEXT;
ALTER TABLE fleet ADD COLUMN ceiling_ft INTEGER;
ALTER TABLE fleet ADD COLUMN iata_type TEXT;
ALTER TABLE fleet ADD COLUMN configuration TEXT;
ALTER TABLE fleet ADD COLUMN is_cargo INTEGER DEFAULT 0;

-- Equipment codes
ALTER TABLE fleet ADD COLUMN equip_code TEXT;
ALTER TABLE fleet ADD COLUMN transponder_code TEXT;
ALTER TABLE fleet ADD COLUMN pbn TEXT;
ALTER TABLE fleet ADD COLUMN cat TEXT;
ALTER TABLE fleet ADD COLUMN selcal TEXT;
ALTER TABLE fleet ADD COLUMN hex_code TEXT;
