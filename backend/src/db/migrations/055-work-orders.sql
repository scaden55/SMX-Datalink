-- 055-work-orders.sql

CREATE TABLE IF NOT EXISTS work_orders (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  aircraft_id       INTEGER NOT NULL REFERENCES fleet(id) ON DELETE CASCADE,
  discrepancy_id    INTEGER NOT NULL REFERENCES discrepancies(id) ON DELETE CASCADE,
  ata_chapter       TEXT NOT NULL,
  severity          TEXT NOT NULL CHECK(severity IN ('grounding','non_grounding')),
  station           TEXT,
  estimated_hours   REAL NOT NULL,
  estimated_cost    REAL NOT NULL,
  actual_cost       REAL,
  started_at        TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at      TEXT,
  status            TEXT NOT NULL DEFAULT 'in_progress' CHECK(status IN ('in_progress','completed','accepted')),
  technician_name   TEXT,
  corrective_action TEXT,
  authority         TEXT,
  created_by        INTEGER REFERENCES users(id),
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_work_orders_aircraft ON work_orders(aircraft_id);
CREATE INDEX IF NOT EXISTS idx_work_orders_status ON work_orders(status);
CREATE INDEX IF NOT EXISTS idx_work_orders_discrepancy ON work_orders(discrepancy_id);

CREATE TABLE IF NOT EXISTS repair_estimates (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  ata_chapter_prefix   TEXT NOT NULL,
  ata_group_name       TEXT NOT NULL,
  grounding_hours      REAL NOT NULL,
  grounding_cost       REAL NOT NULL,
  non_grounding_hours  REAL NOT NULL,
  non_grounding_cost   REAL NOT NULL,
  reference_note       TEXT,
  created_at           TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at           TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(ata_chapter_prefix)
);

INSERT INTO repair_estimates (ata_chapter_prefix, ata_group_name, grounding_hours, grounding_cost, non_grounding_hours, non_grounding_cost, reference_note) VALUES
  ('00', 'General / Fallback', 12, 3000, 6, 1000, 'Default estimate for unconfigured ATA chapters'),
  ('21', 'Air Conditioning', 24, 4500, 8, 1200, 'Pack valve replacement: 16-32h, $3K-$6K'),
  ('24', 'Electrical Power', 16, 3200, 6, 800, 'Generator replacement: 12-24h, $2K-$5K'),
  ('25', 'Equipment / Furnishings', 8, 1500, 4, 500, 'Cargo door seal: 4-12h, $800-$2K'),
  ('27', 'Flight Controls', 48, 12000, 12, 3000, 'Actuator replacement: 24-72h, $8K-$15K'),
  ('28', 'Fuel', 36, 8000, 10, 2500, 'Fuel pump replacement: 24-48h, $5K-$12K'),
  ('29', 'Hydraulic Power', 32, 7500, 10, 2000, 'Hydraulic pump: 24-40h, $5K-$10K'),
  ('32', 'Landing Gear', 48, 15000, 16, 4000, 'Brake assembly: 8-24h, gear actuator: 36-72h'),
  ('34', 'Navigation', 12, 3500, 6, 1200, 'IRS/GPS unit: 8-16h, $2K-$5K'),
  ('36', 'Pneumatic', 24, 5000, 8, 1500, 'Bleed valve: 16-32h, $3K-$7K'),
  ('49', 'Auxiliary Power', 40, 18000, 12, 4000, 'APU hot section: 30-50h, $12K-$25K'),
  ('52', 'Doors', 16, 4000, 6, 1000, 'Door actuator: 12-24h, $2K-$6K'),
  ('71', 'Powerplant', 120, 45000, 24, 8000, 'Engine change: 80-160h, $30K-$60K'),
  ('72', 'Engine', 96, 35000, 20, 6000, 'Turbine section: 60-120h, $20K-$50K'),
  ('73', 'Engine Fuel / Control', 24, 6000, 8, 2000, 'FCU: 16-32h, $4K-$8K'),
  ('74', 'Ignition', 8, 2000, 4, 600, 'Igniter replacement: 4-12h, $1K-$3K'),
  ('76', 'Engine Controls', 16, 4500, 6, 1500, 'EEC/FADEC: 12-24h, $3K-$6K'),
  ('78', 'Exhaust', 20, 5500, 8, 1800, 'Tailpipe/reverser: 16-24h, $4K-$8K'),
  ('79', 'Oil', 12, 3000, 4, 800, 'Oil cooler: 8-16h, $2K-$4K'),
  ('80', 'Starting', 16, 4000, 6, 1200, 'Starter valve: 12-20h, $3K-$5K');

INSERT OR IGNORE INTO va_settings (key, value, updated_at) VALUES ('maintenance_timer_speed', '1', datetime('now'));
