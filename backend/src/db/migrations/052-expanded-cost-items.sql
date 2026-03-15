-- 052-expanded-cost-items.sql: Add granular cost line items to airport fee tiers

-- Fuel service fee (into-plane handling, % of fuel cost)
ALTER TABLE airport_fee_tiers ADD COLUMN fuel_service_pct REAL NOT NULL DEFAULT 0.12;

-- Airport authority fee per movement (flat fee per departure or arrival)
ALTER TABLE airport_fee_tiers ADD COLUMN authority_fee REAL NOT NULL DEFAULT 15.00;

-- Set realistic defaults per tier
UPDATE airport_fee_tiers SET fuel_service_pct = 0.15, authority_fee = 25.00 WHERE tier = 'international_hub';
UPDATE airport_fee_tiers SET fuel_service_pct = 0.12, authority_fee = 18.00 WHERE tier = 'major_hub';
UPDATE airport_fee_tiers SET fuel_service_pct = 0.10, authority_fee = 12.00 WHERE tier = 'regional';
UPDATE airport_fee_tiers SET fuel_service_pct = 0.08, authority_fee = 8.00 WHERE tier = 'small';

-- Update pilot pay to realistic Part 121 cargo captain rate
UPDATE revenue_model_config SET pilot_pay_per_hour = 1250.00;

-- Add new columns to finance_flight_pnl for expanded cost tracking
ALTER TABLE finance_flight_pnl ADD COLUMN fuel_service_fee REAL NOT NULL DEFAULT 0;
ALTER TABLE finance_flight_pnl ADD COLUMN authority_fees REAL NOT NULL DEFAULT 0;
ALTER TABLE finance_flight_pnl ADD COLUMN dep_handler TEXT;
ALTER TABLE finance_flight_pnl ADD COLUMN arr_handler TEXT;
