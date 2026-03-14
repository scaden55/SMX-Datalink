-- Revenue Model configuration (single-row table)
CREATE TABLE IF NOT EXISTS revenue_model_config (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  -- Yield rates ($/lb) per aircraft class and cargo unit type
  class_i_standard REAL NOT NULL DEFAULT 10.00,
  class_i_nonstandard REAL NOT NULL DEFAULT 20.00,
  class_i_hazard REAL NOT NULL DEFAULT 40.00,
  class_ii_standard REAL NOT NULL DEFAULT 3.00,
  class_ii_nonstandard REAL NOT NULL DEFAULT 6.00,
  class_ii_hazard REAL NOT NULL DEFAULT 12.00,
  class_iii_standard REAL NOT NULL DEFAULT 2.00,
  class_iii_nonstandard REAL NOT NULL DEFAULT 4.00,
  class_iii_hazard REAL NOT NULL DEFAULT 8.00,
  -- Pilot pay
  pilot_pay_per_hour REAL NOT NULL DEFAULT 300.00,
  -- Manifest split percentages (must sum to 1.0)
  manifest_std_pct REAL NOT NULL DEFAULT 0.70,
  manifest_nonstd_pct REAL NOT NULL DEFAULT 0.20,
  manifest_hazard_pct REAL NOT NULL DEFAULT 0.10,
  -- Distance reference (nm) for log curve normalization
  reference_nm REAL NOT NULL DEFAULT 1000.0,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Seed default config row
INSERT OR IGNORE INTO revenue_model_config (id) VALUES (1);

-- Add aircraft class to fleet
ALTER TABLE fleet ADD COLUMN aircraft_class TEXT NOT NULL DEFAULT 'III'
  CHECK (aircraft_class IN ('I', 'II', 'III'));
