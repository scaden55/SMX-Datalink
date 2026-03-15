-- 049-airline-sim-schema.sql: Airline management simulation schema
-- Drops orphaned finance-engine tables from 037, adds airport economics,
-- fleet financing, maintenance reserves, and redesigned P&L tables.

-- ──────────────────────────────────────────────────────────────────
-- 1. Drop orphaned finance-engine tables from migration 037
-- ──────────────────────────────────────────────────────────────────

DROP TABLE IF EXISTS finance_rated_shipments;
DROP TABLE IF EXISTS finance_rated_manifests;
DROP TABLE IF EXISTS finance_commodity_rates;
DROP TABLE IF EXISTS finance_maint_thresholds;
DROP TABLE IF EXISTS finance_events;
DROP TABLE IF EXISTS finance_aircraft_profiles;
DROP TABLE IF EXISTS finance_station_fees;

-- ──────────────────────────────────────────────────────────────────
-- 2. Airport economics: demand score + fee tier
-- ──────────────────────────────────────────────────────────────────

ALTER TABLE airports ADD COLUMN demand_score REAL NOT NULL DEFAULT 0.5;
ALTER TABLE airports ADD COLUMN fee_tier TEXT NOT NULL DEFAULT 'regional'
  CHECK(fee_tier IN ('international_hub','major_hub','regional','small'));

-- Fee tier schedule (rates per unit — landing per 1k lbs MTOW, handling flat, parking per hour, nav per NM, fuel per gal)
CREATE TABLE IF NOT EXISTS airport_fee_tiers (
  tier            TEXT PRIMARY KEY CHECK(tier IN ('international_hub','major_hub','regional','small')),
  landing_rate    REAL NOT NULL DEFAULT 0,
  handling_rate   REAL NOT NULL DEFAULT 0,
  parking_rate    REAL NOT NULL DEFAULT 0,
  nav_rate        REAL NOT NULL DEFAULT 0,
  fuel_markup     REAL NOT NULL DEFAULT 0
);

INSERT OR IGNORE INTO airport_fee_tiers (tier, landing_rate, handling_rate, parking_rate, nav_rate, fuel_markup) VALUES
  ('international_hub', 8.50,  850.00, 45.00, 0.18, 0.35),
  ('major_hub',         6.50,  550.00, 30.00, 0.14, 0.20),
  ('regional',          4.50,  350.00, 20.00, 0.10, 0.10),
  ('small',             2.50,  180.00, 10.00, 0.06, 0.00);

-- Auto-assign hub airports as major_hub with higher demand
UPDATE airports SET fee_tier = 'major_hub', demand_score = 0.8 WHERE is_hub = 1;

-- Known international hubs get top tier
UPDATE airports SET fee_tier = 'international_hub', demand_score = 0.95
  WHERE icao IN ('KJFK','KLAX','KORD','KATL','EGLL','EDDF','LFPG','RJTT','VHHH','WSSS','OMDB','KMEM','KSDF','PANC','KONT');

CREATE INDEX IF NOT EXISTS idx_airports_fee_tier ON airports(fee_tier);

-- ──────────────────────────────────────────────────────────────────
-- 3. Maintenance reserves on check definitions + aircraft hours
-- ──────────────────────────────────────────────────────────────────

ALTER TABLE maintenance_checks ADD COLUMN reserve_rate_per_hour REAL NOT NULL DEFAULT 0;
ALTER TABLE maintenance_checks ADD COLUMN default_cost REAL NOT NULL DEFAULT 0;

ALTER TABLE aircraft_hours ADD COLUMN maintenance_reserve_balance REAL NOT NULL DEFAULT 0;

-- Seed reserve rates for standard check types (update existing rows)
UPDATE maintenance_checks SET reserve_rate_per_hour = 60,    default_cost = 40000    WHERE check_type = 'A';
UPDATE maintenance_checks SET reserve_rate_per_hour = 15,    default_cost = 200000   WHERE check_type = 'B';
UPDATE maintenance_checks SET reserve_rate_per_hour = 20,    default_cost = 1500000  WHERE check_type = 'C';
UPDATE maintenance_checks SET reserve_rate_per_hour = 0,     default_cost = 8000000  WHERE check_type = 'D';

-- ──────────────────────────────────────────────────────────────────
-- 4. Fleet financing columns
-- ──────────────────────────────────────────────────────────────────

ALTER TABLE fleet ADD COLUMN acquisition_type TEXT NOT NULL DEFAULT 'purchased'
  CHECK(acquisition_type IN ('purchased','loan','dry_lease','wet_lease','acmi'));
ALTER TABLE fleet ADD COLUMN acquisition_cost REAL NOT NULL DEFAULT 0;
ALTER TABLE fleet ADD COLUMN down_payment REAL NOT NULL DEFAULT 0;
ALTER TABLE fleet ADD COLUMN loan_balance REAL NOT NULL DEFAULT 0;
ALTER TABLE fleet ADD COLUMN interest_rate REAL NOT NULL DEFAULT 0;
ALTER TABLE fleet ADD COLUMN loan_term_months INTEGER NOT NULL DEFAULT 0;
ALTER TABLE fleet ADD COLUMN lease_monthly REAL NOT NULL DEFAULT 0;
ALTER TABLE fleet ADD COLUMN lease_start TEXT;
ALTER TABLE fleet ADD COLUMN lease_end TEXT;
ALTER TABLE fleet ADD COLUMN insurance_monthly REAL NOT NULL DEFAULT 0;
ALTER TABLE fleet ADD COLUMN book_value REAL NOT NULL DEFAULT 0;
ALTER TABLE fleet ADD COLUMN useful_life_years INTEGER NOT NULL DEFAULT 25;
ALTER TABLE fleet ADD COLUMN depreciation_monthly REAL NOT NULL DEFAULT 0;

-- ──────────────────────────────────────────────────────────────────
-- 5. Per-flight P&L (drop old, recreate)
-- ──────────────────────────────────────────────────────────────────

DROP TABLE IF EXISTS finance_flight_pnl;

CREATE TABLE finance_flight_pnl (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  logbook_id            INTEGER NOT NULL UNIQUE REFERENCES logbook(id),
  aircraft_id           INTEGER REFERENCES fleet(id),

  -- Revenue
  cargo_revenue         REAL NOT NULL DEFAULT 0,
  pax_revenue           REAL NOT NULL DEFAULT 0,
  charter_premium       REAL NOT NULL DEFAULT 0,
  fuel_surcharge        REAL NOT NULL DEFAULT 0,
  total_revenue         REAL NOT NULL DEFAULT 0,

  -- Variable costs
  fuel_cost             REAL NOT NULL DEFAULT 0,
  landing_fee           REAL NOT NULL DEFAULT 0,
  handling_fee          REAL NOT NULL DEFAULT 0,
  nav_fee               REAL NOT NULL DEFAULT 0,
  parking_fee           REAL NOT NULL DEFAULT 0,
  crew_cost             REAL NOT NULL DEFAULT 0,
  total_variable_cost   REAL NOT NULL DEFAULT 0,

  -- Fixed cost allocations
  maint_reserve         REAL NOT NULL DEFAULT 0,
  lease_alloc           REAL NOT NULL DEFAULT 0,
  insurance_alloc       REAL NOT NULL DEFAULT 0,
  depreciation_alloc    REAL NOT NULL DEFAULT 0,
  total_fixed_alloc     REAL NOT NULL DEFAULT 0,

  -- Summary
  gross_profit          REAL NOT NULL DEFAULT 0,
  net_profit            REAL NOT NULL DEFAULT 0,
  margin_pct            REAL NOT NULL DEFAULT 0,

  -- Snapshots for auditing
  block_hours           REAL NOT NULL DEFAULT 0,
  distance_nm           REAL NOT NULL DEFAULT 0,
  payload_lbs           REAL NOT NULL DEFAULT 0,
  load_factor           REAL NOT NULL DEFAULT 0,
  fuel_price_snapshot   REAL NOT NULL DEFAULT 0,
  lane_rate_snapshot    REAL NOT NULL DEFAULT 0,
  demand_multiplier     REAL NOT NULL DEFAULT 1.0,

  computed_at           TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_flight_pnl_aircraft ON finance_flight_pnl(aircraft_id);
CREATE INDEX IF NOT EXISTS idx_flight_pnl_computed ON finance_flight_pnl(computed_at);

-- ──────────────────────────────────────────────────────────────────
-- 6. Period P&L summaries (drop old, recreate with KPIs)
-- ──────────────────────────────────────────────────────────────────

DROP TABLE IF EXISTS finance_period_pnl;

CREATE TABLE finance_period_pnl (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  period_type           TEXT NOT NULL CHECK(period_type IN ('monthly','quarterly','annual')),
  period_key            TEXT NOT NULL,

  -- Revenue
  total_revenue         REAL NOT NULL DEFAULT 0,
  cargo_revenue         REAL NOT NULL DEFAULT 0,
  pax_revenue           REAL NOT NULL DEFAULT 0,
  charter_revenue       REAL NOT NULL DEFAULT 0,
  surcharge_revenue     REAL NOT NULL DEFAULT 0,

  -- Costs
  total_variable_cost   REAL NOT NULL DEFAULT 0,
  total_fixed_cost      REAL NOT NULL DEFAULT 0,
  fuel_cost             REAL NOT NULL DEFAULT 0,
  maintenance_cost      REAL NOT NULL DEFAULT 0,
  lease_cost            REAL NOT NULL DEFAULT 0,
  crew_cost             REAL NOT NULL DEFAULT 0,
  airport_fees          REAL NOT NULL DEFAULT 0,

  -- P&L
  ebitda                REAL NOT NULL DEFAULT 0,
  net_income            REAL NOT NULL DEFAULT 0,

  -- KPIs
  ratm                  REAL NOT NULL DEFAULT 0,  -- Revenue per Available Ton Mile
  catm                  REAL NOT NULL DEFAULT 0,  -- Cost per Available Ton Mile
  avg_load_factor       REAL NOT NULL DEFAULT 0,
  avg_utilization_hrs   REAL NOT NULL DEFAULT 0,  -- Daily aircraft utilization
  total_flights         INTEGER NOT NULL DEFAULT 0,
  total_block_hours     REAL NOT NULL DEFAULT 0,
  total_asm             REAL NOT NULL DEFAULT 0,   -- Available Seat/Ton Miles

  computed_at           TEXT DEFAULT (datetime('now')),
  UNIQUE(period_type, period_key)
);

-- ──────────────────────────────────────────────────────────────────
-- 7. Rate config (drop old single-row, recreate as key-value)
-- ──────────────────────────────────────────────────────────────────

DROP TABLE IF EXISTS finance_rate_config;

CREATE TABLE finance_rate_config (
  key         TEXT PRIMARY KEY,
  value       REAL NOT NULL,
  description TEXT,
  updated_at  TEXT DEFAULT (datetime('now'))
);

-- Seed difficulty defaults
INSERT OR IGNORE INTO finance_rate_config (key, value, description) VALUES
  ('base_fuel_price',       5.50,  'Base fuel price per gallon (USD)'),
  ('fuel_volatility',       0.10,  'Max +/- random fuel price swing pct'),
  ('base_lane_rate',        0.45,  'Default cargo rate per lb per 1000 NM'),
  ('charter_multiplier',    1.35,  'Revenue multiplier for charter flights'),
  ('demand_elasticity',     0.30,  'How much demand affects rate (0-1)'),
  ('supply_penalty',        0.15,  'Rate reduction when oversupplied (0-1)'),
  ('fuel_surcharge_pct',    0.15,  'Fuel surcharge as pct of base revenue'),
  ('security_fee_flat',    25.00,  'Flat security fee per shipment'),
  ('crew_cost_per_block',  85.00,  'Crew cost per block hour'),
  ('difficulty',            0.50,  'Global difficulty scalar (0=easy, 1=hard)');

-- ──────────────────────────────────────────────────────────────────
-- 8. Lane rates (drop old, recreate with demand/supply scores)
-- ──────────────────────────────────────────────────────────────────

DROP TABLE IF EXISTS finance_lane_rates;

CREATE TABLE finance_lane_rates (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  origin_icao     TEXT NOT NULL,
  dest_icao       TEXT NOT NULL,
  rate_per_lb     REAL NOT NULL,
  demand_score    REAL NOT NULL DEFAULT 0.5,
  supply_score    REAL NOT NULL DEFAULT 0.5,
  last_updated    TEXT DEFAULT (datetime('now')),
  UNIQUE(origin_icao, dest_icao)
);

CREATE INDEX IF NOT EXISTS idx_lane_rates_origin ON finance_lane_rates(origin_icao);
CREATE INDEX IF NOT EXISTS idx_lane_rates_dest ON finance_lane_rates(dest_icao);

-- ──────────────────────────────────────────────────────────────────
-- 9. Recreate finances table with NULLABLE pilot_id
--    (SQLite doesn't support ALTER COLUMN, so copy-swap)
-- ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS finances_new (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  pilot_id    INTEGER REFERENCES users(id) ON DELETE CASCADE,
  pirep_id    INTEGER REFERENCES logbook(id),
  type        TEXT    NOT NULL CHECK (type IN ('pay', 'bonus', 'deduction', 'expense', 'income')),
  amount      REAL    NOT NULL,
  description TEXT,
  created_by  INTEGER REFERENCES users(id),
  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO finances_new (id, pilot_id, pirep_id, type, amount, description, created_by, created_at)
  SELECT id, pilot_id, pirep_id, type, amount, description, created_by, created_at FROM finances;

DROP TABLE finances;
ALTER TABLE finances_new RENAME TO finances;

CREATE INDEX IF NOT EXISTS idx_finances_pilot ON finances(pilot_id);
CREATE INDEX IF NOT EXISTS idx_finances_pirep ON finances(pirep_id);
CREATE INDEX IF NOT EXISTS idx_finances_type  ON finances(type);
CREATE INDEX IF NOT EXISTS idx_finances_date  ON finances(created_at);
