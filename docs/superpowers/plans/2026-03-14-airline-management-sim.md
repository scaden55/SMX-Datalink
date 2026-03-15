# Airline Management Simulation — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire all airline engines (revenue, maintenance, fleet, schedules, PIREPs) into a unified economic simulation with per-flight P&L, supply/demand pricing, fleet financing, airport fee tiers, maintenance economics, and monthly financial reporting.

**Architecture:** PIREP approval triggers a cost engine alongside the existing revenue model, producing a full `finance_flight_pnl` row. A monthly job generates fixed costs (lease, insurance, depreciation) and closes the period into `finance_period_pnl`. Supply/demand rates auto-adjust based on airport demand scores and flight frequency. All multiplied by admin-tunable difficulty settings.

**Tech Stack:** TypeScript, Express 4, better-sqlite3 (WAL), React 19, Zustand 5, Tailwind CSS, shadcn/ui

**Spec:** `docs/superpowers/specs/2026-03-14-airline-management-sim-design.md`

---

## Chunk 1: Database Foundation (Migration + Schema)

### Task 1: Drop unused migration 037 tables and create new schema

**Files:**
- Create: `backend/src/db/migrations/049-airline-sim-schema.sql`

This single migration handles the full schema transition: drops orphaned 037 tables, creates the new economic simulation tables, and adds columns to existing tables.

- [ ] **Step 1: Create migration 049**

```sql
-- 049-airline-sim-schema.sql: Airline management simulation schema

-- ═══════════════════════════════════════════════════════════
-- Drop orphaned migration 037 tables (never wired up)
-- ═══════════════════════════════════════════════════════════
DROP TABLE IF EXISTS finance_rated_shipments;
DROP TABLE IF EXISTS finance_rated_manifests;
DROP TABLE IF EXISTS finance_commodity_rates;
DROP TABLE IF EXISTS finance_maint_thresholds;
DROP TABLE IF EXISTS finance_events;
DROP TABLE IF EXISTS finance_aircraft_profiles;
DROP TABLE IF EXISTS finance_station_fees;

-- ═══════════════════════════════════════════════════════════
-- Airport economics: demand scores and fee tiers
-- ═══════════════════════════════════════════════════════════

-- Add demand_score and fee_tier to airports table
ALTER TABLE airports ADD COLUMN demand_score REAL NOT NULL DEFAULT 0.5;
ALTER TABLE airports ADD COLUMN fee_tier TEXT NOT NULL DEFAULT 'regional'
  CHECK(fee_tier IN ('international_hub','major_hub','regional','small'));

-- Airport fee tier rate table (4 rows, admin-tunable)
CREATE TABLE IF NOT EXISTS airport_fee_tiers (
  tier                TEXT PRIMARY KEY CHECK(tier IN ('international_hub','major_hub','regional','small')),
  landing_per_1000lbs REAL NOT NULL DEFAULT 5.50,
  handling_per_1000lbs REAL NOT NULL DEFAULT 4.00,
  parking_per_hour    REAL NOT NULL DEFAULT 10.00,
  nav_per_nm          REAL NOT NULL DEFAULT 0.06,
  fuel_price_per_lb   REAL NOT NULL DEFAULT 0.35
);

-- Seed default tier rates
INSERT OR IGNORE INTO airport_fee_tiers (tier, landing_per_1000lbs, handling_per_1000lbs, parking_per_hour, nav_per_nm, fuel_price_per_lb) VALUES
  ('international_hub', 8.00, 6.00, 15.00, 0.08, 0.38),
  ('major_hub',         5.50, 4.00, 10.00, 0.06, 0.35),
  ('regional',          3.00, 2.50,  5.00, 0.04, 0.33),
  ('small',             1.50, 1.00,  2.00, 0.02, 0.40);

-- Auto-assign demand_score and fee_tier based on hub status and country
-- VA hub airports get highest demand
UPDATE airports SET demand_score = 0.9, fee_tier = 'major_hub'
  WHERE icao IN (SELECT DISTINCT base_icao FROM fleet WHERE base_icao IS NOT NULL);

-- International airports
UPDATE airports SET fee_tier = 'international_hub', demand_score = MAX(demand_score, 0.7)
  WHERE country != 'US' AND country != '';

-- Small fields (no scheduled service — crude heuristic: short ICAO not starting with K)
UPDATE airports SET fee_tier = 'small', demand_score = CASE WHEN demand_score < 0.3 THEN demand_score ELSE 0.25 END
  WHERE LENGTH(icao) < 4 AND icao NOT LIKE 'K%' AND fee_tier = 'regional';

-- ═══════════════════════════════════════════════════════════
-- Maintenance economics: reserve rates and default costs
-- ═══════════════════════════════════════════════════════════

ALTER TABLE maintenance_checks ADD COLUMN reserve_rate_per_hour REAL NOT NULL DEFAULT 0;
ALTER TABLE maintenance_checks ADD COLUMN default_cost REAL NOT NULL DEFAULT 0;
ALTER TABLE aircraft_hours ADD COLUMN maintenance_reserve_balance REAL NOT NULL DEFAULT 0;

-- Seed reserve rates and default costs for all check types
UPDATE maintenance_checks SET reserve_rate_per_hour = 60,  default_cost = 40000   WHERE check_type = 'A';
UPDATE maintenance_checks SET reserve_rate_per_hour = 15,  default_cost = 200000  WHERE check_type = 'B';
UPDATE maintenance_checks SET reserve_rate_per_hour = 20,  default_cost = 1500000 WHERE check_type = 'C';
UPDATE maintenance_checks SET reserve_rate_per_hour = 0,   default_cost = 8000000 WHERE check_type = 'D';

-- ═══════════════════════════════════════════════════════════
-- Fleet financing fields
-- ═══════════════════════════════════════════════════════════

ALTER TABLE fleet ADD COLUMN acquisition_type TEXT NOT NULL DEFAULT 'purchased'
  CHECK(acquisition_type IN ('purchased','loan','dry_lease','wet_lease','acmi'));
ALTER TABLE fleet ADD COLUMN acquisition_cost REAL;
ALTER TABLE fleet ADD COLUMN down_payment REAL;
ALTER TABLE fleet ADD COLUMN loan_balance REAL;
ALTER TABLE fleet ADD COLUMN interest_rate REAL;
ALTER TABLE fleet ADD COLUMN loan_term_months INTEGER;
ALTER TABLE fleet ADD COLUMN lease_monthly REAL;
ALTER TABLE fleet ADD COLUMN lease_start TEXT;
ALTER TABLE fleet ADD COLUMN lease_end TEXT;
ALTER TABLE fleet ADD COLUMN insurance_monthly REAL NOT NULL DEFAULT 0;
ALTER TABLE fleet ADD COLUMN book_value REAL;
ALTER TABLE fleet ADD COLUMN useful_life_years INTEGER;
ALTER TABLE fleet ADD COLUMN depreciation_monthly REAL;

-- ═══════════════════════════════════════════════════════════
-- Finance tables: flight P&L and period P&L (replace 037 versions)
-- ═══════════════════════════════════════════════════════════

DROP TABLE IF EXISTS finance_flight_pnl;
CREATE TABLE IF NOT EXISTS finance_flight_pnl (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  pirep_id              INTEGER NOT NULL REFERENCES logbook(id),
  aircraft_id           INTEGER REFERENCES fleet(id),
  pilot_id              INTEGER NOT NULL REFERENCES users(id),

  -- Route info (denormalized for reporting)
  dep_icao              TEXT NOT NULL,
  arr_icao              TEXT NOT NULL,
  distance_nm           REAL NOT NULL,
  block_hours           REAL NOT NULL,
  cargo_lbs             REAL NOT NULL DEFAULT 0,

  -- Revenue
  cargo_revenue         REAL NOT NULL DEFAULT 0,
  fuel_surcharge_rev    REAL NOT NULL DEFAULT 0,
  lane_rate_modifier    REAL NOT NULL DEFAULT 1.0,
  total_revenue         REAL NOT NULL DEFAULT 0,

  -- Direct operating costs
  fuel_cost             REAL NOT NULL DEFAULT 0,
  crew_cost             REAL NOT NULL DEFAULT 0,
  landing_fees          REAL NOT NULL DEFAULT 0,
  handling_fees         REAL NOT NULL DEFAULT 0,
  nav_fees              REAL NOT NULL DEFAULT 0,
  maintenance_reserve   REAL NOT NULL DEFAULT 0,
  total_doc             REAL NOT NULL DEFAULT 0,

  -- Margin
  operating_margin      REAL NOT NULL DEFAULT 0,
  margin_pct            REAL NOT NULL DEFAULT 0,

  -- Snapshot of multipliers at computation time
  cost_multiplier       REAL NOT NULL DEFAULT 1.0,
  revenue_multiplier    REAL NOT NULL DEFAULT 1.0,

  created_at            TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_flight_pnl_pirep ON finance_flight_pnl(pirep_id);
CREATE INDEX IF NOT EXISTS idx_flight_pnl_aircraft ON finance_flight_pnl(aircraft_id);
CREATE INDEX IF NOT EXISTS idx_flight_pnl_date ON finance_flight_pnl(created_at);

DROP TABLE IF EXISTS finance_period_pnl;
CREATE TABLE IF NOT EXISTS finance_period_pnl (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  period_key            TEXT NOT NULL UNIQUE,  -- e.g. '2026-03'

  -- Revenue
  total_revenue         REAL NOT NULL DEFAULT 0,
  cargo_revenue         REAL NOT NULL DEFAULT 0,
  fuel_surcharge_rev    REAL NOT NULL DEFAULT 0,

  -- Direct operating costs
  total_doc             REAL NOT NULL DEFAULT 0,
  fuel_cost             REAL NOT NULL DEFAULT 0,
  crew_cost             REAL NOT NULL DEFAULT 0,
  landing_fees          REAL NOT NULL DEFAULT 0,
  handling_fees         REAL NOT NULL DEFAULT 0,
  nav_fees              REAL NOT NULL DEFAULT 0,
  maintenance_reserve   REAL NOT NULL DEFAULT 0,

  -- Fixed costs
  total_fixed           REAL NOT NULL DEFAULT 0,
  lease_payments        REAL NOT NULL DEFAULT 0,
  loan_payments         REAL NOT NULL DEFAULT 0,
  insurance             REAL NOT NULL DEFAULT 0,
  depreciation          REAL NOT NULL DEFAULT 0,
  hangar_parking        REAL NOT NULL DEFAULT 0,

  -- Unplanned
  maintenance_shortfall REAL NOT NULL DEFAULT 0,

  -- Totals
  operating_income      REAL NOT NULL DEFAULT 0,

  -- KPIs
  ratm                  REAL,  -- Revenue per Available Ton-Mile
  catm                  REAL,  -- Cost per Available Ton-Mile
  operating_margin_pct  REAL,
  fleet_utilization_pct REAL,
  break_even_lf         REAL,

  -- Metadata
  flights_count         INTEGER NOT NULL DEFAULT 0,
  total_block_hours     REAL NOT NULL DEFAULT 0,

  created_at            TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at            TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ═══════════════════════════════════════════════════════════
-- Keep and update finance_rate_config for difficulty settings
-- ═══════════════════════════════════════════════════════════

DROP TABLE IF EXISTS finance_rate_config;
CREATE TABLE IF NOT EXISTS finance_rate_config (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Seed difficulty defaults
INSERT OR IGNORE INTO finance_rate_config (key, value) VALUES
  ('cost_multiplier', '1.0'),
  ('revenue_multiplier', '1.0'),
  ('demand_volatility', 'medium'),
  ('maintenance_cost_factor', '1.0'),
  ('fuel_price_variability', 'moderate'),
  ('fuel_price_factor', '1.0');

-- Keep finance_lane_rates as snapshot table
DROP TABLE IF EXISTS finance_lane_rates;
CREATE TABLE IF NOT EXISTS finance_lane_rates (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  origin_icao  TEXT NOT NULL,
  dest_icao    TEXT NOT NULL,
  rate_per_lb  REAL NOT NULL,
  demand_score REAL NOT NULL DEFAULT 0.5,
  supply_score REAL NOT NULL DEFAULT 0.0,
  updated_at   TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(origin_icao, dest_icao)
);

-- ═══════════════════════════════════════════════════════════
-- Make finances.pilot_id nullable for airline-level costs
-- ═══════════════════════════════════════════════════════════

-- SQLite doesn't support ALTER COLUMN, so we recreate
CREATE TABLE finances_new (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  pilot_id    INTEGER REFERENCES users(id),
  pirep_id    INTEGER REFERENCES logbook(id),
  type        TEXT CHECK (type IN ('pay','bonus','deduction','expense','income')),
  amount      REAL NOT NULL,
  description TEXT,
  category    TEXT,
  created_by  INTEGER REFERENCES users(id),
  created_at  TEXT DEFAULT (datetime('now'))
);

INSERT INTO finances_new SELECT id, pilot_id, pirep_id, type, amount, description, category, created_by, created_at FROM finances;
DROP TABLE finances;
ALTER TABLE finances_new RENAME TO finances;

CREATE INDEX IF NOT EXISTS idx_finances_pilot ON finances(pilot_id);
CREATE INDEX IF NOT EXISTS idx_finances_pirep ON finances(pirep_id);
CREATE INDEX IF NOT EXISTS idx_finances_type ON finances(type);
CREATE INDEX IF NOT EXISTS idx_finances_date ON finances(created_at);
```

- [ ] **Step 2: Verify migration applies cleanly**

Run: `npm run dev:all` (backend will auto-apply migration on startup)
Expected: Backend starts without errors, new tables visible in SQLite

- [ ] **Step 3: Commit**

```bash
git add backend/src/db/migrations/049-airline-sim-schema.sql
git commit -m "feat: add airline management simulation schema (migration 049)"
```

---

### Task 2: Add shared types for airline economics

**Files:**
- Create: `shared/src/types/airline-economics.ts`
- Modify: `shared/src/index.ts` — add export

- [ ] **Step 1: Create airline economics types**

```typescript
// shared/src/types/airline-economics.ts

// ── Airport Economics ─────────────────────────────────────
export type AirportFeeTier = 'international_hub' | 'major_hub' | 'regional' | 'small';

export interface AirportFeeTierRates {
  tier: AirportFeeTier;
  landingPer1000lbs: number;
  handlingPer1000lbs: number;
  parkingPerHour: number;
  navPerNm: number;
  fuelPricePerLb: number;
}

// ── Fleet Financing ───────────────────────────────────────
export type AcquisitionType = 'purchased' | 'loan' | 'dry_lease' | 'wet_lease' | 'acmi';

export interface FleetFinancials {
  acquisitionType: AcquisitionType;
  acquisitionCost: number | null;
  downPayment: number | null;
  loanBalance: number | null;
  interestRate: number | null;
  loanTermMonths: number | null;
  leaseMonthly: number | null;
  leaseStart: string | null;
  leaseEnd: string | null;
  insuranceMonthly: number;
  bookValue: number | null;
  usefulLifeYears: number | null;
  depreciationMonthly: number | null;
}

// ── Per-Flight P&L ────────────────────────────────────────
export interface FlightCostBreakdown {
  fuelCost: number;
  crewCost: number;
  landingFees: number;
  handlingFees: number;
  navFees: number;
  maintenanceReserve: number;
  totalDoc: number;
}

export interface FlightPnL {
  pirepId: number;
  aircraftId: number | null;
  pilotId: number;
  depIcao: string;
  arrIcao: string;
  distanceNm: number;
  blockHours: number;
  cargoLbs: number;

  // Revenue
  cargoRevenue: number;
  fuelSurchargeRev: number;
  laneRateModifier: number;
  totalRevenue: number;

  // Costs
  costs: FlightCostBreakdown;

  // Margin
  operatingMargin: number;
  marginPct: number;

  // Multipliers snapshot
  costMultiplier: number;
  revenueMultiplier: number;
}

// ── Supply/Demand ─────────────────────────────────────────
export interface LaneRate {
  originIcao: string;
  destIcao: string;
  ratePerLb: number;
  demandScore: number;
  supplyScore: number;
  updatedAt: string;
}

// ── Period P&L ────────────────────────────────────────────
export interface PeriodPnL {
  periodKey: string;
  totalRevenue: number;
  cargoRevenue: number;
  fuelSurchargeRev: number;
  totalDoc: number;
  fuelCost: number;
  crewCost: number;
  landingFees: number;
  handlingFees: number;
  navFees: number;
  maintenanceReserve: number;
  totalFixed: number;
  leasePayments: number;
  loanPayments: number;
  insurance: number;
  depreciation: number;
  hangarParking: number;
  maintenanceShortfall: number;
  operatingIncome: number;
  ratm: number | null;
  catm: number | null;
  operatingMarginPct: number | null;
  fleetUtilizationPct: number | null;
  breakEvenLf: number | null;
  flightsCount: number;
  totalBlockHours: number;
}

// ── Difficulty Settings ───────────────────────────────────
export type DemandVolatility = 'low' | 'medium' | 'high';
export type FuelVariability = 'fixed' | 'moderate' | 'volatile';

export interface SimSettings {
  costMultiplier: number;
  revenueMultiplier: number;
  demandVolatility: DemandVolatility;
  maintenanceCostFactor: number;
  fuelPriceVariability: FuelVariability;
  fuelPriceFactor: number;
}
```

- [ ] **Step 2: Export from shared index**

Add to `shared/src/index.ts`:
```typescript
export * from './types/airline-economics.js';
```

- [ ] **Step 3: Build shared and commit**

```bash
npx tsc -p shared/
git add shared/src/types/airline-economics.ts shared/src/index.ts
git commit -m "feat(shared): add airline economics types"
```

---

## Chunk 2: Cost Engine Service

### Task 3: Create the flight cost engine

**Files:**
- Create: `backend/src/services/flight-cost-engine.ts`

This service calculates all direct operating costs for a single flight. It's called by the PIREP approval flow alongside the existing revenue model.

- [ ] **Step 1: Create flight cost engine service**

The service needs these methods:
- `calculateFlightCosts(params)` → `FlightCostBreakdown` — main entry point
- `getAirportTierRates(icao)` → looks up airport's tier, returns fee rates
- `getSimSettings()` → reads difficulty multipliers from `finance_rate_config`
- `getMaintenanceReserveRate(aircraftId)` → sums per-FH reserve rates for aircraft type
- `accrueMaintenanceReserve(aircraftId, amount)` → adds to reserve balance

**Parameters for `calculateFlightCosts`:**
```typescript
{
  depIcao: string;
  arrIcao: string;
  distanceNm: number;
  blockHours: number;
  fuelUsedLbs: number;
  aircraftId: number;      // for MTOW lookup and maint reserve
  pilotPayRate: number;     // from revenue model config
}
```

**Calculation logic:**
1. Look up departure and arrival airport tiers → get fee rates
2. Look up aircraft MTOW from fleet table
3. Fuel cost = `fuelUsedLbs × depTier.fuelPricePerLb × fuelPriceFactor`
4. Crew cost = `blockHours × pilotPayRate`
5. Landing fees = `(mtow/1000) × (depTier.landing + arrTier.landing)`
6. Handling fees = `(mtow/1000) × (depTier.handling + arrTier.handling)`
7. Nav fees = `distanceNm × depTier.navPerNm`
8. Maintenance reserve = `blockHours × totalReserveRatePerHour`
9. Accrue maintenance reserve to aircraft_hours
10. Apply `costMultiplier` to total
11. Return `FlightCostBreakdown`

For airports not in the `airports` table, use 'regional' tier defaults.

- [ ] **Step 2: Commit**

```bash
git add backend/src/services/flight-cost-engine.ts
git commit -m "feat(backend): add flight cost engine service"
```

---

### Task 4: Create the supply/demand rate engine

**Files:**
- Create: `backend/src/services/supply-demand-engine.ts`

- [ ] **Step 1: Create supply/demand service**

Methods:
- `calculateLaneRate(originIcao, destIcao, baseYield, distanceFactor)` → modified yield rate
- `getDemandScore(icao)` → airport demand_score from DB (default 0.3 for unknown)
- `getSupplyScore(originIcao, destIcao)` → `flights_in_30d / 10`, capped at 3.0
- `snapshotLaneRates()` → called by nightly job, populates `finance_lane_rates`

**Rate formula:**
```typescript
const laneDemand = (originDemand + destDemand) / 2;
const modifier = laneDemand / Math.max(supplyScore, 0.1);

// Apply volatility caps
const caps = { low: [0.8, 1.3], medium: [0.5, 2.0], high: [0.3, 2.5] };
const [floor, ceil] = caps[volatility];
const clampedModifier = Math.max(floor, Math.min(ceil, modifier));

return baseYield * distanceFactor * clampedModifier;
```

Supply score query:
```sql
SELECT COUNT(*) as flights FROM logbook
WHERE dep_icao = ? AND arr_icao = ?
  AND status = 'approved'
  AND actual_arr >= datetime('now', '-30 days')
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/services/supply-demand-engine.ts
git commit -m "feat(backend): add supply/demand rate engine"
```

---

## Chunk 3: Wire Into PIREP Flow

### Task 5: Create flight P&L orchestrator and integrate with PIREP approval

**Files:**
- Create: `backend/src/services/flight-pnl.ts` — orchestrates revenue + costs → writes `finance_flight_pnl`
- Modify: `backend/src/services/pirep.ts:221-262` — call flight P&L instead of raw revenue model
- Modify: `backend/src/services/pirep-admin.ts:130-150` — same change for admin review path
- Modify: `backend/src/services/finance.ts:23-30` — ensure `pilotId` accepts null

- [ ] **Step 1: Create flight P&L service**

The orchestrator:
1. Calls `revenueModelService.calculate()` (existing)
2. Calls `supplyDemandEngine.calculateLaneRate()` to get modifier
3. Applies modifier to revenue
4. Calls `flightCostEngine.calculateFlightCosts()`
5. Applies `revenueMultiplier` to total revenue
6. Writes `finance_flight_pnl` row
7. Returns `FlightPnL` object

```typescript
// backend/src/services/flight-pnl.ts
export class FlightPnLService {
  calculateAndRecord(params: {
    pirepId: number;
    pilotId: number;
    aircraftRegistration: string | null;
    depIcao: string;
    arrIcao: string;
    distanceNm: number;
    blockHours: number;
    cargoLbs: number;
    fuelUsedLbs: number;
  }): FlightPnL
}
```

- [ ] **Step 2: Modify pirep.ts — replace direct revenue model calls**

In `pirep.ts`, replace the auto-approve block (around lines 221-247) that calls `revenueModelService.calculate()` + `financeService.create()` with a single call to `flightPnLService.calculateAndRecord()`. The P&L service internally handles both revenue calculation and finance entry creation.

Keep the existing `maintenanceService.accumulateFlightHours()` call — it remains separate.

- [ ] **Step 3: Modify pirep-admin.ts — same change for admin review path**

Same pattern: replace lines 130-150 with `flightPnLService.calculateAndRecord()`.

- [ ] **Step 4: Modify finance.ts — allow null pilot_id**

Update the `create()` method signature to accept `pilotId: number | null`. The DB column is already nullable from migration 049.

- [ ] **Step 5: Build and verify**

```bash
npx tsc -p shared/ && npx tsc -p backend/ --noEmit
```

- [ ] **Step 6: Commit**

```bash
git add backend/src/services/flight-pnl.ts backend/src/services/pirep.ts backend/src/services/pirep-admin.ts backend/src/services/finance.ts
git commit -m "feat(backend): wire per-flight P&L into PIREP approval flow"
```

---

## Chunk 4: Monthly Cycle & Fixed Costs

### Task 6: Create monthly close service

**Files:**
- Create: `backend/src/services/monthly-close.ts`
- Modify: `backend/src/index.ts` — add monthly close job on startup + periodic check

- [ ] **Step 1: Create monthly close service**

Methods:
- `closeMonth(periodKey: string)` — idempotent: UPSERTs `finance_period_pnl` for the given month
- `generateFixedCosts(periodKey: string)` — creates finance entries for each aircraft's lease/loan/insurance/depreciation/hangar
- `checkAndCloseMissedMonths()` — on startup, checks for unclosed months and processes them
- `getCurrentPeriodKey()` → `'2026-03'` format

**Monthly close logic:**
1. Query `finance_flight_pnl` for all rows in the period → aggregate revenue and DOC columns
2. Generate fixed costs per aircraft (lease, insurance, depreciation, hangar)
3. Query maintenance shortfall (completed checks where cost > reserve)
4. Calculate KPIs (RATM, CATM, utilization, break-even LF)
5. UPSERT into `finance_period_pnl`

**Fixed cost generation per aircraft:**
- Purchased: depreciation = `acquisition_cost / (useful_life_years × 12)`
- Loan: monthly payment = standard amortization, reduce `loan_balance`
- Dry lease: `lease_monthly`
- Wet lease: `lease_monthly` (higher, includes maint)
- ACMI: `lease_monthly` (highest)
- Insurance: `insurance_monthly` (all types except ACMI)
- Hangar: `tier_parking_rate × 500` using aircraft's `base_icao` tier

- [ ] **Step 2: Wire into backend startup**

In `backend/src/index.ts`, after the existing cleanup interval:
- On startup: call `monthlyCloseService.checkAndCloseMissedMonths()`
- Add to the hourly interval: check if current month has changed since last close

- [ ] **Step 3: Commit**

```bash
git add backend/src/services/monthly-close.ts backend/src/index.ts
git commit -m "feat(backend): add monthly close service for fixed costs and period P&L"
```

---

### Task 7: Add supply/demand nightly snapshot job

**Files:**
- Modify: `backend/src/index.ts` — add daily job alongside charter generation

- [ ] **Step 1: Add lane rate snapshot to daily job**

In the existing 24-hour interval (charter generation), add:
```typescript
try {
  const count = supplyDemandEngine.snapshotLaneRates();
  if (count > 0) logger.info('Server', `Lane rate snapshot: ${count} routes updated`);
} catch (err) {
  logger.error('Server', 'Lane rate snapshot error', err);
}
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/index.ts
git commit -m "feat(backend): add nightly lane rate snapshot job"
```

---

## Chunk 5: Admin API Routes

### Task 8: Add airline economics API routes

**Files:**
- Create: `backend/src/routes/admin-economics.ts`
- Modify: `backend/src/index.ts` — register route

Routes needed:
- `GET /api/admin/economics/flight-pnl` — paginated flight P&L list with filters
- `GET /api/admin/economics/flight-pnl/:pirepId` — single flight P&L detail
- `GET /api/admin/economics/period-pnl` — all period P&L summaries
- `GET /api/admin/economics/period-pnl/:periodKey` — single period detail
- `GET /api/admin/economics/lane-rates` — current lane rate snapshot
- `GET /api/admin/economics/airport-tiers` — tier rate config
- `PUT /api/admin/economics/airport-tiers/:tier` — update tier rates
- `GET /api/admin/economics/sim-settings` — current difficulty settings
- `PUT /api/admin/economics/sim-settings` — update difficulty settings
- `POST /api/admin/economics/close-month` — manually trigger monthly close
- `GET /api/admin/economics/fleet-financials` — fleet with financing details
- `PATCH /api/admin/economics/fleet-financials/:id` — update aircraft financing

- [ ] **Step 1: Create route file**

- [ ] **Step 2: Register in index.ts**

- [ ] **Step 3: Commit**

```bash
git add backend/src/routes/admin-economics.ts backend/src/index.ts
git commit -m "feat(backend): add airline economics admin API routes"
```

---

## Chunk 6: Fleet Financing UI (Admin)

### Task 9: Add financing fields to Fleet page aircraft editor

**Files:**
- Modify: `admin/src/pages/FleetPage.tsx` — add financing section to aircraft create/edit dialog

- [ ] **Step 1: Add financing fields to aircraft dialog**

In the existing aircraft create/edit dialog, add a new "Financing" section below the existing fields:
- Acquisition type dropdown (purchased/loan/dry_lease/wet_lease/acmi)
- Conditionally show fields based on type:
  - Purchased: acquisition cost, useful life years
  - Loan: acquisition cost, down payment, interest rate, loan term
  - Dry/Wet/ACMI lease: lease monthly, lease start, lease end
- Insurance monthly (all types except ACMI)

- [ ] **Step 2: Commit**

```bash
git add admin/src/pages/FleetPage.tsx
git commit -m "feat(admin): add fleet financing fields to aircraft editor"
```

---

## Chunk 7: Dashboard P&L Integration

### Task 10: Update admin dashboard with real P&L data

**Files:**
- Modify: `backend/src/services/dashboard.ts` — query `finance_period_pnl` for financial summary
- Modify: `admin/src/components/dashboard/FinanceColumn.tsx` — display real costs, not zeros

- [ ] **Step 1: Update dashboard service**

Replace the `financialSummary` query that currently returns zero costs with a query against `finance_period_pnl` for the last 6 months. Return actual revenue, DOC, fixed costs, and operating income.

- [ ] **Step 2: Update FinanceColumn component**

Wire the real P&L data into the existing dashboard finance widgets. The RATM/CATM, spread, and route margins sections should now display actual values.

- [ ] **Step 3: Commit**

```bash
git add backend/src/services/dashboard.ts admin/src/components/dashboard/FinanceColumn.tsx
git commit -m "feat: wire real P&L data into admin dashboard finance widgets"
```

---

## Chunk 8: Difficulty Settings UI

### Task 11: Add simulation settings to admin Settings page

**Files:**
- Modify: `admin/src/pages/SettingsPage.tsx` — add "Simulation Economy" section

- [ ] **Step 1: Add simulation economy section**

Add a new card/section to the Settings page with:
- Cost multiplier slider (0.5 – 2.0, step 0.1)
- Revenue multiplier slider (0.5 – 2.0, step 0.1)
- Demand volatility dropdown (Low/Medium/High)
- Maintenance cost factor slider (0.5 – 2.0, step 0.1)
- Fuel price variability dropdown (Fixed/Moderate/Volatile)
- Save button that PUTs to `/api/admin/economics/sim-settings`

- [ ] **Step 2: Commit**

```bash
git add admin/src/pages/SettingsPage.tsx
git commit -m "feat(admin): add simulation economy difficulty settings"
```

---

## Chunk 9: Maintenance Reserve Integration

### Task 12: Wire maintenance reserve into check completion

**Files:**
- Modify: `backend/src/services/maintenance.ts` — `completeCheck()` deducts from reserve, books shortfall

- [ ] **Step 1: Update completeCheck()**

In the `completeCheck()` method (already wrapped in a transaction):
1. Get the check's `default_cost` (or use the logged cost if provided)
2. Get aircraft's `maintenance_reserve_balance`
3. If reserve >= cost: deduct from reserve, no additional P&L entry
4. If reserve < cost: deduct entire reserve, create a finance entry for the shortfall as `type='expense'`, `category='maintenance_shortfall'`, `pilot_id=NULL`
5. Apply `maintenance_cost_factor` multiplier to the cost

- [ ] **Step 2: Commit**

```bash
git add backend/src/services/maintenance.ts
git commit -m "feat(backend): wire maintenance reserve fund into check completion"
```

---

## Chunk 10: Deploy & Verify

### Task 13: Build, deploy to VPS, verify end-to-end

**Files:** All modified files

- [ ] **Step 1: Build all workspaces**

```bash
npx tsc -p shared/
npm run build -w backend
npm run build -w admin
```

- [ ] **Step 2: Deploy backend + admin to VPS**

Follow the standard deploy process: SCP dist + shared, swap, restart PM2, health check.

- [ ] **Step 3: Verify PIREP approval creates flight P&L**

Submit a test flight and verify:
- `finance_flight_pnl` row created with revenue AND costs
- `finances` ledger has pay + income entries
- Aircraft `maintenance_reserve_balance` increased
- Lane rate used in calculation reflects demand/supply

- [ ] **Step 4: Commit and push**

```bash
git add -A
git commit -m "feat: airline management simulation v1 — per-flight P&L, supply/demand, fleet financing"
git push origin main
```
