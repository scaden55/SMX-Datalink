-- 017-regulatory.sql: Operations Specifications (OpSpecs) table
-- Regulatory rule engine for 14 CFR Part 121 flight classification

CREATE TABLE IF NOT EXISTS opspecs (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  code        TEXT    NOT NULL UNIQUE,
  title       TEXT    NOT NULL,
  description TEXT    NOT NULL DEFAULT '',
  category    TEXT    NOT NULL CHECK (category IN ('operations', 'maintenance', 'routes', 'special_authority', 'training')),
  enforcement TEXT    NOT NULL DEFAULT 'info_only' CHECK (enforcement IN ('hard_block', 'soft_warning', 'info_only', 'override_available')),
  is_active   INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_opspecs_code     ON opspecs(code);
CREATE INDEX IF NOT EXISTS idx_opspecs_category ON opspecs(category);

-- Auto-update trigger
CREATE TRIGGER IF NOT EXISTS opspecs_updated_at
  AFTER UPDATE ON opspecs
  FOR EACH ROW
BEGIN
  UPDATE opspecs SET updated_at = datetime('now') WHERE id = OLD.id;
END;

-- Seed 14 standard OpSpecs
INSERT INTO opspecs (code, title, description, category, enforcement) VALUES
  ('A001', 'Areas of Operation',         'Authorized geographic areas of operation',                        'operations',        'info_only'),
  ('A002', 'Flag Authority',             'Authority to conduct flag operations (14 CFR 110.2)',             'operations',        'info_only'),
  ('A003', 'Types of Operations',        'Authorized operation types (domestic/flag/supplemental)',         'operations',        'info_only'),
  ('A008', 'ETOPS Authorization',        'Extended operations authorization per 14 CFR 121.7 / Appendix P','operations',        'soft_warning'),
  ('A050', 'Authorized Airports',        'Airports authorized for scheduled/charter service',              'routes',            'info_only'),
  ('B031', 'MEL Authority',              'Minimum equipment list authorization per 14 CFR 121.628',        'maintenance',       'soft_warning'),
  ('B033', 'CDL Authority',              'Configuration deviation list authorization',                     'maintenance',       'info_only'),
  ('C059', 'Takeoff Minimums',           'Authorized lower-than-standard takeoff minimums',                'operations',        'info_only'),
  ('C074', 'Approach Operations',        'Authorized instrument approach operations',                      'operations',        'info_only'),
  ('D085', 'RVSM Authorization',         'Reduced Vertical Separation Minimum authorization (FL290-FL410)','special_authority', 'soft_warning'),
  ('D088', 'Data Link Authorization',    'CPDLC/ADS-C data link communications authorization',            'special_authority', 'info_only'),
  ('D095', 'MNPS/NAT Authorization',     'Minimum navigation performance / North Atlantic authorization',  'special_authority', 'info_only'),
  ('E115', 'Emergency Equipment',        'Emergency equipment and procedures authorization',               'operations',        'info_only'),
  ('F100', 'Aircraft Airworthiness',     'Aircraft airworthiness status per 14 CFR 21.197',                'maintenance',       'hard_block');
