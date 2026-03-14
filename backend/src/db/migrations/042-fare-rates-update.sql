-- Update revenue model yield rates to match SMX published fare schedule
-- Rates are $/kg per unit type and aircraft class
UPDATE revenue_model_config SET
  class_i_standard    = 6.40,   -- 1US: CLASS I UNIT STANDARD
  class_i_nonstandard = 19.90,  -- 1UN: CLASS I UNIT NONSTANDARD
  class_i_hazard      = 120.00, -- 1HX: CLASS I UNIT HAZARD
  class_ii_standard   = 2.50,   -- 2US: CLASS II UNIT STANDARD
  class_ii_nonstandard = 3.55,  -- 2UN: CLASS II UNIT NONSTANDARD
  class_ii_hazard     = 19.90,  -- 2HX: CLASS II UNIT HAZARD
  class_iii_standard  = 2.30,   -- 3US: CLASS III UNIT STANDARD
  class_iii_nonstandard = 3.20, -- 3UN: CLASS III UNIT NONSTANDARD
  class_iii_hazard    = 25.50,  -- 3HX: CLASS III UNIT HAZARD
  updated_at = datetime('now')
WHERE id = 1;
