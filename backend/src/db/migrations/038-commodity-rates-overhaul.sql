-- 038-commodity-rates-overhaul.sql
-- Replace generic 8-code commodity surcharges with realistic per-commodity cargo rates.
-- Each commodity has a full rate_per_lb, a parent category, and handling flags.

DROP TABLE IF EXISTS finance_commodity_rates;

CREATE TABLE finance_commodity_rates (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  category         TEXT    NOT NULL,
  commodity_code   TEXT    NOT NULL UNIQUE,
  commodity_name   TEXT    NOT NULL,
  rate_per_lb      REAL    NOT NULL DEFAULT 0.45,
  hazmat           INTEGER NOT NULL DEFAULT 0,
  temp_controlled  INTEGER NOT NULL DEFAULT 0,
  created_at       TEXT    DEFAULT (datetime('now')),
  updated_at       TEXT    DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_commodity_rates_category ON finance_commodity_rates(category);

-- ── General Freight ─────────────────────────────────────────
INSERT INTO finance_commodity_rates (category, commodity_code, commodity_name, rate_per_lb, hazmat, temp_controlled) VALUES
  ('general_freight', 'GEN',       'General Cargo',               0.38, 0, 0),
  ('general_freight', 'GEN-CONS',  'Consumer Goods',              0.42, 0, 0),
  ('general_freight', 'GEN-MAIL',  'Mail & Postal',               0.35, 0, 0),
  ('general_freight', 'GEN-DOCS',  'Documents & Printed Matter',  0.48, 0, 0),
  ('general_freight', 'GEN-PERS',  'Personal Effects',            0.40, 0, 0),
  ('general_freight', 'GEN-DIPL',  'Diplomatic Pouch',            0.55, 0, 0);

-- ── Pharmaceuticals & Medical ───────────────────────────────
INSERT INTO finance_commodity_rates (category, commodity_code, commodity_name, rate_per_lb, hazmat, temp_controlled) VALUES
  ('pharmaceuticals', 'PHR',       'Pharmaceuticals',             1.20, 0, 1),
  ('pharmaceuticals', 'PHR-VAX',   'Vaccines',                    1.45, 0, 1),
  ('pharmaceuticals', 'PHR-BIO',   'Biological Samples',          1.35, 0, 1),
  ('pharmaceuticals', 'PHR-MDEV',  'Medical Devices',             0.90, 0, 0),
  ('pharmaceuticals', 'PHR-SURG',  'Surgical Supplies',           0.85, 0, 0),
  ('pharmaceuticals', 'PHR-ORG',   'Human Organs (AOG)',          2.80, 0, 1);

-- ── Perishables ─────────────────────────────────────────────
INSERT INTO finance_commodity_rates (category, commodity_code, commodity_name, rate_per_lb, hazmat, temp_controlled) VALUES
  ('seafood',         'PER',       'Perishable Goods',            0.58, 0, 1),
  ('seafood',         'PER-FISH',  'Fresh Seafood',               0.72, 0, 1),
  ('seafood',         'PER-MEAT',  'Fresh Meat',                  0.65, 0, 1),
  ('seafood',         'PER-PROD',  'Fresh Produce',               0.50, 0, 1),
  ('seafood',         'PER-FLWR',  'Cut Flowers',                 0.62, 0, 1),
  ('seafood',         'PER-DARY',  'Dairy Products',              0.55, 0, 1),
  ('seafood',         'PER-FROZ',  'Frozen Food',                 0.48, 0, 1);

-- ── Electronics ─────────────────────────────────────────────
INSERT INTO finance_commodity_rates (category, commodity_code, commodity_name, rate_per_lb, hazmat, temp_controlled) VALUES
  ('electronics',     'ELE',       'Electronics',                 0.82, 0, 0),
  ('electronics',     'ELE-SEMI',  'Semiconductors',              1.10, 0, 0),
  ('electronics',     'ELE-COMP',  'Computers & Components',      0.88, 0, 0),
  ('electronics',     'ELE-TELE',  'Telecommunications Equipment',0.72, 0, 0),
  ('electronics',     'ELE-INST',  'Scientific Instruments',      0.95, 0, 0);

-- ── Machinery & Equipment ───────────────────────────────────
INSERT INTO finance_commodity_rates (category, commodity_code, commodity_name, rate_per_lb, hazmat, temp_controlled) VALUES
  ('industrial_machinery', 'MCH',       'Industrial Machinery',        0.36, 0, 0),
  ('industrial_machinery', 'MCH-AERO',  'Aircraft Parts (AOG)',        1.85, 0, 0),
  ('industrial_machinery', 'MCH-OIL',   'Oil & Gas Equipment',         0.42, 0, 0),
  ('industrial_machinery', 'MCH-TOOL',  'Tooling & Dies',              0.40, 0, 0),
  ('industrial_machinery', 'MCH-GENR',  'Generators & Turbines',       0.38, 0, 0);

-- ── Automotive ──────────────────────────────────────────────
INSERT INTO finance_commodity_rates (category, commodity_code, commodity_name, rate_per_lb, hazmat, temp_controlled) VALUES
  ('automotive',      'AUT',       'Automotive Parts',            0.38, 0, 0),
  ('automotive',      'AUT-ENG',   'Engines & Transmissions',     0.42, 0, 0),
  ('automotive',      'AUT-BODY',  'Body Panels',                 0.30, 0, 0),
  ('automotive',      'AUT-TIRE',  'Tires & Rubber',              0.28, 0, 0);

-- ── Textiles & Fashion ─────────────────────────────────────
INSERT INTO finance_commodity_rates (category, commodity_code, commodity_name, rate_per_lb, hazmat, temp_controlled) VALUES
  ('textiles',        'TEX',       'Textiles & Garments',         0.48, 0, 0),
  ('textiles',        'TEX-LUXR',  'Luxury Fashion',              0.75, 0, 0),
  ('textiles',        'TEX-LEAT',  'Leather Goods',               0.55, 0, 0),
  ('textiles',        'TEX-RAW',   'Raw Fabrics & Yarn',          0.35, 0, 0);

-- ── Dangerous Goods ─────────────────────────────────────────
INSERT INTO finance_commodity_rates (category, commodity_code, commodity_name, rate_per_lb, hazmat, temp_controlled) VALUES
  ('dangerous_goods', 'DGR',       'Dangerous Goods (General)',   0.85, 1, 0),
  ('dangerous_goods', 'DGR-LITH',  'Lithium Batteries',           1.15, 1, 0),
  ('dangerous_goods', 'DGR-FLAM',  'Flammable Liquids',           0.95, 1, 0),
  ('dangerous_goods', 'DGR-GAS',   'Compressed Gases',            0.88, 1, 0),
  ('dangerous_goods', 'DGR-CORR',  'Corrosive Substances',        0.90, 1, 0),
  ('dangerous_goods', 'DGR-EXPL',  'Explosives & Ammunition',     1.35, 1, 0),
  ('dangerous_goods', 'DGR-RAD',   'Radioactive Materials',       1.50, 1, 0),
  ('dangerous_goods', 'DGR-CHEM',  'Industrial Chemicals',        0.78, 1, 0);

-- ── Live Animals ────────────────────────────────────────────
INSERT INTO finance_commodity_rates (category, commodity_code, commodity_name, rate_per_lb, hazmat, temp_controlled) VALUES
  ('live_animals',    'AVI',       'Live Animals',                1.10, 0, 1),
  ('live_animals',    'AVI-EQUN',  'Equine (Horses)',             1.40, 0, 1),
  ('live_animals',    'AVI-LVSK',  'Livestock',                   0.95, 0, 1),
  ('live_animals',    'AVI-PET',   'Domestic Pets',               1.20, 0, 1),
  ('live_animals',    'AVI-ZOO',   'Zoo & Exotic Animals',        1.55, 0, 1);

-- ── E-Commerce & Express ────────────────────────────────────
INSERT INTO finance_commodity_rates (category, commodity_code, commodity_name, rate_per_lb, hazmat, temp_controlled) VALUES
  ('ecommerce',       'ECM',       'E-Commerce Parcels',          0.52, 0, 0),
  ('ecommerce',       'ECM-EXPR',  'Express / Next-Day',          0.85, 0, 0),
  ('ecommerce',       'ECM-XBDR',  'Cross-Border Retail',         0.60, 0, 0);

-- ── High Value ──────────────────────────────────────────────
-- (Uses general_freight category since there's no dedicated category,
--  but these are commonly transported high-value commodities)
INSERT INTO finance_commodity_rates (category, commodity_code, commodity_name, rate_per_lb, hazmat, temp_controlled) VALUES
  ('general_freight', 'VAL-CURR',  'Currency & Bank Notes',       2.20, 0, 0),
  ('general_freight', 'VAL-GEMS',  'Precious Metals & Gems',      2.50, 0, 0),
  ('general_freight', 'VAL-ART',   'Fine Art & Antiques',         1.85, 0, 0),
  ('general_freight', 'VAL-HRM',   'Human Remains',               1.60, 0, 0);
