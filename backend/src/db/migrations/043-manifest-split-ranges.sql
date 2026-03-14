-- Replace fixed manifest split percentages with min/max ranges
-- The service picks a random value within each range per flight

ALTER TABLE revenue_model_config ADD COLUMN manifest_std_min REAL NOT NULL DEFAULT 0.80;
ALTER TABLE revenue_model_config ADD COLUMN manifest_std_max REAL NOT NULL DEFAULT 1.00;
ALTER TABLE revenue_model_config ADD COLUMN manifest_nonstd_min REAL NOT NULL DEFAULT 0.10;
ALTER TABLE revenue_model_config ADD COLUMN manifest_nonstd_max REAL NOT NULL DEFAULT 0.20;
ALTER TABLE revenue_model_config ADD COLUMN manifest_hazard_min REAL NOT NULL DEFAULT 0.00;
ALTER TABLE revenue_model_config ADD COLUMN manifest_hazard_max REAL NOT NULL DEFAULT 0.10;

-- Migrate existing values: use old single pct as midpoint of a ±5% range, clamped to [0,1]
UPDATE revenue_model_config SET
  manifest_std_min    = MAX(0, manifest_std_pct - 0.05),
  manifest_std_max    = MIN(1, manifest_std_pct + 0.05),
  manifest_nonstd_min = MAX(0, manifest_nonstd_pct - 0.05),
  manifest_nonstd_max = MIN(1, manifest_nonstd_pct + 0.05),
  manifest_hazard_min = MAX(0, manifest_hazard_pct - 0.05),
  manifest_hazard_max = MIN(1, manifest_hazard_pct + 0.05)
WHERE id = 1;

-- Set the new defaults from user's specified ranges
UPDATE revenue_model_config SET
  manifest_std_min    = 0.80,
  manifest_std_max    = 1.00,
  manifest_nonstd_min = 0.10,
  manifest_nonstd_max = 0.20,
  manifest_hazard_min = 0.00,
  manifest_hazard_max = 0.10
WHERE id = 1;
