-- 051-fuel-momentum-seed.sql: Seed fuel momentum direction for dynamic pricing
INSERT OR IGNORE INTO finance_rate_config (key, value) VALUES ('fuel_momentum', '1');
