-- 050-fix-fuel-prices.sql: Correct fuel prices to realistic $/lb values
-- Jet-A is ~6.7 lbs/gal. Target: $6-8/gal range.
-- international_hub: $7.50/gal = $1.12/lb
-- major_hub:         $7.00/gal = $1.04/lb
-- regional:          $6.50/gal = $0.97/lb
-- small:             $8.00/gal = $1.19/lb (less competition)

UPDATE airport_fee_tiers SET fuel_markup = 1.12 WHERE tier = 'international_hub';
UPDATE airport_fee_tiers SET fuel_markup = 1.04 WHERE tier = 'major_hub';
UPDATE airport_fee_tiers SET fuel_markup = 0.97 WHERE tier = 'regional';
UPDATE airport_fee_tiers SET fuel_markup = 1.19 WHERE tier = 'small';
