-- 037-finance-engine.sql: Finance engine rate tables, aircraft profiles, and P&L records

-- Per-aircraft financial profile (lease, insurance, burn rates)
CREATE TABLE IF NOT EXISTS finance_aircraft_profiles (
  id                       INTEGER PRIMARY KEY AUTOINCREMENT,
  aircraft_id              INTEGER NOT NULL UNIQUE REFERENCES fleet(id) ON DELETE CASCADE,
  lease_type               TEXT    NOT NULL DEFAULT 'dry' CHECK (lease_type IN ('dry', 'wet')),
  lease_monthly            REAL    NOT NULL DEFAULT 0,
  insurance_hull_value     REAL    NOT NULL DEFAULT 0,
  insurance_hull_pct       REAL    NOT NULL DEFAULT 0.015,
  insurance_liability      REAL    NOT NULL DEFAULT 0,
  insurance_war_risk       REAL    NOT NULL DEFAULT 0,
  base_fuel_gph            REAL    NOT NULL DEFAULT 800,
  payload_fuel_sensitivity REAL    NOT NULL DEFAULT 0.5,
  maint_reserve_per_fh     REAL    NOT NULL DEFAULT 150,
  crew_per_diem            REAL    NOT NULL DEFAULT 4.50,
  crew_hotel_rate          REAL    NOT NULL DEFAULT 150,
  created_at               TEXT    DEFAULT (datetime('now')),
  updated_at               TEXT    DEFAULT (datetime('now'))
);

-- Per-airport station fees
CREATE TABLE IF NOT EXISTS finance_station_fees (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  icao             TEXT    NOT NULL UNIQUE,
  landing_rate     REAL    NOT NULL DEFAULT 5.50,
  parking_rate     REAL    NOT NULL DEFAULT 25.00,
  ground_handling  REAL    NOT NULL DEFAULT 350.00,
  fuel_price_gal   REAL    NOT NULL DEFAULT 5.50,
  nav_fee_per_nm   REAL    NOT NULL DEFAULT 0.12,
  deice_fee        REAL    NOT NULL DEFAULT 0,
  uld_handling     REAL    NOT NULL DEFAULT 15.00,
  created_at       TEXT    DEFAULT (datetime('now')),
  updated_at       TEXT    DEFAULT (datetime('now'))
);

-- Global rate config (single-row table)
CREATE TABLE IF NOT EXISTS finance_rate_config (
  id                   INTEGER PRIMARY KEY CHECK (id = 1),
  fuel_surcharge_pct   REAL    NOT NULL DEFAULT 0.15,
  security_fee         REAL    NOT NULL DEFAULT 25.00,
  charter_multiplier   REAL    NOT NULL DEFAULT 1.35,
  default_lane_rate    REAL    NOT NULL DEFAULT 0.45,
  valuation_charge_pct REAL    NOT NULL DEFAULT 0.005,
  default_fuel_price   REAL    NOT NULL DEFAULT 5.50,
  updated_at           TEXT    DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO finance_rate_config (id) VALUES (1);

-- Origin-destination lane base rates
CREATE TABLE IF NOT EXISTS finance_lane_rates (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  origin_icao  TEXT    NOT NULL,
  dest_icao    TEXT    NOT NULL,
  rate_per_lb  REAL    NOT NULL,
  created_at   TEXT    DEFAULT (datetime('now')),
  UNIQUE(origin_icao, dest_icao)
);

-- Commodity surcharge rates
CREATE TABLE IF NOT EXISTS finance_commodity_rates (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  commodity_code   TEXT    NOT NULL UNIQUE,
  commodity_name   TEXT    NOT NULL,
  surcharge_per_lb REAL    NOT NULL DEFAULT 0,
  created_at       TEXT    DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO finance_commodity_rates (commodity_code, commodity_name, surcharge_per_lb) VALUES
  ('GEN', 'General Freight',    0.00),
  ('DGR', 'Dangerous Goods',    0.18),
  ('PER', 'Perishable / Live',  0.12),
  ('AVI', 'Live Animals',       0.15),
  ('VAL', 'High Value',         0.20),
  ('HEA', 'Heavy / Oversized',  0.08),
  ('AUT', 'Automotive',         0.06),
  ('PHR', 'Pharmaceuticals',    0.14);

-- Maintenance check thresholds and cost ranges (finance view)
CREATE TABLE IF NOT EXISTS finance_maint_thresholds (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  check_type        TEXT    NOT NULL UNIQUE CHECK (check_type IN ('A', 'C', 'D', 'ESV')),
  interval_hours    INTEGER,
  interval_years    INTEGER,
  cost_min          REAL    NOT NULL DEFAULT 0,
  cost_max          REAL    NOT NULL DEFAULT 0,
  downtime_days_min INTEGER NOT NULL DEFAULT 0,
  downtime_days_max INTEGER NOT NULL DEFAULT 0,
  created_at        TEXT    DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO finance_maint_thresholds (check_type, interval_hours, interval_years, cost_min, cost_max, downtime_days_min, downtime_days_max) VALUES
  ('A',   500,  NULL, 15000,   50000,   1,  3),
  ('C',   5000, NULL, 500000,  1500000, 14, 30),
  ('D',   NULL, 8,    2000000, 5000000, 45, 90),
  ('ESV', 8000, NULL, 800000,  2000000, 21, 45);

-- Rated manifest header (one per cargo manifest rating)
CREATE TABLE IF NOT EXISTS finance_rated_manifests (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  cargo_manifest_id     INTEGER NOT NULL REFERENCES cargo_manifests(id) ON DELETE CASCADE,
  logbook_id            INTEGER REFERENCES logbook(id),
  total_revenue         REAL    NOT NULL DEFAULT 0,
  total_base_charge     REAL    NOT NULL DEFAULT 0,
  total_surcharges      REAL    NOT NULL DEFAULT 0,
  total_fuel_surcharge  REAL    NOT NULL DEFAULT 0,
  total_security_fees   REAL    NOT NULL DEFAULT 0,
  charter_multiplier    REAL    NOT NULL DEFAULT 1.0,
  yield_per_lb          REAL    NOT NULL DEFAULT 0,
  load_factor           REAL    NOT NULL DEFAULT 0,
  rated_at              TEXT    DEFAULT (datetime('now')),
  UNIQUE(cargo_manifest_id)
);

-- Rated shipment line items (one per ULD/AWB)
CREATE TABLE IF NOT EXISTS finance_rated_shipments (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  rated_manifest_id   INTEGER NOT NULL REFERENCES finance_rated_manifests(id) ON DELETE CASCADE,
  awb_number          TEXT    NOT NULL,
  uld_id              TEXT,
  category_code       TEXT    NOT NULL,
  actual_weight       REAL    NOT NULL DEFAULT 0,
  chargeable_weight   REAL    NOT NULL DEFAULT 0,
  base_charge         REAL    NOT NULL DEFAULT 0,
  commodity_surcharge REAL    NOT NULL DEFAULT 0,
  fuel_surcharge      REAL    NOT NULL DEFAULT 0,
  security_fee        REAL    NOT NULL DEFAULT 0,
  valuation_charge    REAL    NOT NULL DEFAULT 0,
  total_charge        REAL    NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_rated_shipments_manifest ON finance_rated_shipments(rated_manifest_id);

-- Operational events
CREATE TABLE IF NOT EXISTS finance_events (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  logbook_id       INTEGER REFERENCES logbook(id),
  event_type       TEXT    NOT NULL,
  title            TEXT    NOT NULL,
  description      TEXT,
  financial_impact REAL    NOT NULL DEFAULT 0,
  created_at       TEXT    DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_finance_events_logbook ON finance_events(logbook_id);

-- Per-flight P&L record
CREATE TABLE IF NOT EXISTS finance_flight_pnl (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  logbook_id          INTEGER NOT NULL UNIQUE REFERENCES logbook(id),
  rated_manifest_id   INTEGER REFERENCES finance_rated_manifests(id),
  cargo_revenue       REAL    NOT NULL DEFAULT 0,
  fuel_cost           REAL    NOT NULL DEFAULT 0,
  landing_fee         REAL    NOT NULL DEFAULT 0,
  parking_fee         REAL    NOT NULL DEFAULT 0,
  handling_fee        REAL    NOT NULL DEFAULT 0,
  nav_fee             REAL    NOT NULL DEFAULT 0,
  deice_fee           REAL    NOT NULL DEFAULT 0,
  uld_fee             REAL    NOT NULL DEFAULT 0,
  crew_cost           REAL    NOT NULL DEFAULT 0,
  total_variable_cost REAL    NOT NULL DEFAULT 0,
  maint_reserve       REAL    NOT NULL DEFAULT 0,
  lease_alloc         REAL    NOT NULL DEFAULT 0,
  insurance_alloc     REAL    NOT NULL DEFAULT 0,
  total_fixed_alloc   REAL    NOT NULL DEFAULT 0,
  gross_profit        REAL    NOT NULL DEFAULT 0,
  margin_pct          REAL    NOT NULL DEFAULT 0,
  load_factor         REAL    NOT NULL DEFAULT 0,
  break_even_lf       REAL    NOT NULL DEFAULT 0,
  revenue_per_bh      REAL    NOT NULL DEFAULT 0,
  cost_per_bh         REAL    NOT NULL DEFAULT 0,
  block_hours         REAL    NOT NULL DEFAULT 0,
  payload_lbs         REAL    NOT NULL DEFAULT 0,
  event_id            INTEGER REFERENCES finance_events(id),
  computed_at         TEXT    DEFAULT (datetime('now'))
);

-- Period P&L summaries
CREATE TABLE IF NOT EXISTS finance_period_pnl (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  period_type         TEXT    NOT NULL CHECK (period_type IN ('monthly', 'quarterly', 'annual')),
  period_key          TEXT    NOT NULL,
  total_revenue       REAL    NOT NULL DEFAULT 0,
  total_variable_cost REAL    NOT NULL DEFAULT 0,
  total_fixed_cost    REAL    NOT NULL DEFAULT 0,
  ebitda              REAL    NOT NULL DEFAULT 0,
  ebitdar             REAL    NOT NULL DEFAULT 0,
  casm                REAL    NOT NULL DEFAULT 0,
  rasm                REAL    NOT NULL DEFAULT 0,
  avg_yield           REAL    NOT NULL DEFAULT 0,
  total_flights       INTEGER NOT NULL DEFAULT 0,
  total_block_hours   REAL    NOT NULL DEFAULT 0,
  computed_at         TEXT    DEFAULT (datetime('now')),
  UNIQUE(period_type, period_key)
);
