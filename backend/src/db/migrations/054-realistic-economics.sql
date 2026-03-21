-- 054-realistic-economics.sql: Tune revenue rates and demand caps to realistic levels
-- Previous class III standard of $2.30/lb produced ~$340k for a 412nm/90k-lb flight.
-- Target: ~$54k for the same flight. Scale factor ≈ 0.22x.

UPDATE revenue_model_config SET
  class_i_standard    = 1.95,
  class_i_nonstandard = 6.10,
  class_i_hazard      = 36.50,
  class_ii_standard   = 0.77,
  class_ii_nonstandard = 1.08,
  class_ii_hazard     = 6.10,
  class_iii_standard  = 0.70,
  class_iii_nonstandard = 0.98,
  class_iii_hazard    = 4.20
WHERE id = 1;
