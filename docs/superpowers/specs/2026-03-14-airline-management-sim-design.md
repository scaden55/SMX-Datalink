# Airline Management Simulation — Design Spec

**Date:** 2026-03-14
**Status:** Approved
**Scope:** Integrate Revenue, Maintenance, Fleet, Schedules, and PIREP engines into a cohesive airline management simulation for MSFS 2024.

## Philosophy

Sim-friendly realism (Option B): real cost categories and realistic ratios, tuned so a well-run VA stays profitable. Admin-tunable difficulty knobs control the economic feel from casual to hardcore.

---

## 1. Per-Flight P&L

Every PIREP approval (auto or manual) generates a full `finance_flight_pnl` row with itemized revenue and costs.

### Revenue
- Cargo yield from manifest split (existing system)
- Lane rate modifier from supply/demand engine (new)
- Fuel surcharge pass-through (% of fuel cost added to revenue)
- Global `revenue_multiplier` applied last

### Direct Operating Costs (booked per-flight)
- **Fuel**: `fuel_used_lbs x fuel_price_per_lb` (fuel price from departure airport tier)
- **Crew**: `block_hours x pilot_pay_rate` (already exists, now also counted as a cost line)
- **Landing fees**: departure + arrival, `(aircraft_mtow / 1000) x tier_landing_rate`
- **Ground handling**: departure + arrival, `(aircraft_mtow / 1000) x tier_handling_rate`
- **Navigation fees**: `distance_nm x tier_nav_rate` (departure airport tier)
- **Maintenance reserve accrual**: `block_hours x reserve_rate_per_hour`
- Global `cost_multiplier` applied to all costs

### Output
- `finance_flight_pnl` row: revenue breakdown, itemized costs, operating margin
- Pilot sees flight profitability in PIREP summary
- Dashboard shows route-level margins

---

## 2. Supply/Demand Rate Engine

Lane rates are never manually entered. They're computed on-the-fly from demand and supply scores.

### Demand Scoring (seeded, mostly static)
- Each airport gets a `demand_score` (0.0 - 1.0) from characteristics:
  - Hub airports in VA network: 0.8 - 1.0
  - Major metros / international: 0.6 - 0.9
  - Regional airports: 0.3 - 0.5
  - Small fields: 0.1 - 0.3
- Per-lane demand = `(origin_demand + dest_demand) / 2`, modified by distance

### Supply Tracking (dynamic)
- Supply score per route = flights in last 30 days on that origin-dest pair
- More flights = higher supply = downward rate pressure

### Rate Calculation
- `lane_rate = base_yield x distance_factor x (demand_score / max(supply_score, 0.1))`
- Capped: floor 0.5x, ceiling 2.5x of base yield
- `demand_volatility` setting (low/medium/high) controls swing magnitude

### Auto-Generation
- Rates computed at PIREP approval time
- Nightly job snapshots current rates to `finance_lane_rates` for dashboard display
- Zero admin management of individual routes

### Effect
Neglected routes become more lucrative. Oversaturated routes become less profitable. Pilots incentivized to spread across the network.

---

## 3. Fleet Acquisition & Financing

When an admin adds an aircraft, they choose a financing method.

### Financing Options

| Method | Upfront Cost | Monthly Cost | Maintenance | Insurance | Ownership |
|--------|-------------|-------------|-------------|-----------|-----------|
| **Purchase (outright)** | Full price | None (depreciation only) | Airline | Airline | Yes |
| **Purchase (loan)** | Down payment (e.g., 20%) | Amortized P+I | Airline | Airline | Yes (with lien) |
| **Dry lease** | None | Fixed lease rate | Airline | Airline | No |
| **Wet lease** | None | Higher rate (includes crew + maint) | Lessor (heavy), Airline (line) | Lessor | No |
| **ACMI** | None | Highest rate (A+C+M+I bundled) | Lessor | Lessor | No |

### Fleet Financial Fields (added to fleet table)
- `acquisition_type` (purchased/loan/dry_lease/wet_lease/acmi)
- `acquisition_cost`, `down_payment`, `loan_balance`, `interest_rate`, `loan_term_months`
- `lease_monthly`, `lease_start`, `lease_end`
- `insurance_monthly` (separate for purchase/dry_lease, bundled for wet/acmi)
- `book_value`, `useful_life_years`, `depreciation_monthly`

### Monthly Cycle
Monthly job generates finance entries per aircraft: lease/loan payment, insurance, depreciation. Fixed costs hit regardless of flying activity.

### Purchased Aircraft
- Book value depreciates straight-line over useful life
- Early payoff available for loans
- Aircraft is an asset on the balance sheet

---

## 4. Airport Fee Tiers

Four tiers, auto-assigned from airport characteristics. Admin can override individual airports.

### Tier Assignment
| Tier | Logic | Examples |
|------|-------|---------|
| International Hub | Foreign airports + major US international | EGLL, RJTT, KJFK |
| Major Hub | VA hub airports + class B fields | KDEN, KDFW, KBUR |
| Regional | US airports with scheduled service | KROW, KRDU |
| Small Field | Everything else | GA fields, remote strips |

### Default Fee Schedule (admin-tunable)

| Fee | Int'l Hub | Major Hub | Regional | Small |
|-----|-----------|-----------|----------|-------|
| Landing (per 1000 lbs MTOW) | $8.00 | $5.50 | $3.00 | $1.50 |
| Ground handling (per 1000 lbs MTOW) | $6.00 | $4.00 | $2.50 | $1.00 |
| Parking (per hour) | $15.00 | $10.00 | $5.00 | $2.00 |
| Nav/overflight (per NM) | $0.08 | $0.06 | $0.04 | $0.02 |
| Fuel price (per lb Jet-A) | $0.38 | $0.35 | $0.33 | $0.40 |

Small field fuel slightly higher (less competition) — mirrors reality.

### Per-Flight Calculation
- Landing = `(mtow / 1000) x tier_rate` at both departure and arrival
- Ground handling = same formula, both ends
- Nav fee = `distance_nm x nav_rate` (departure tier)
- Fuel cost = `fuel_used_lbs x fuel_price` (departure tier — where you fueled)

---

## 5. Maintenance Economics

### Maintenance Reserve Fund
- Per-aircraft reserve accrues each flight hour
- Default rates (admin-tunable per aircraft type):
  - A-check reserve: $60/FH
  - C-check reserve: $20/FH
  - Engine overhaul reserve: $120/FH
  - Total default: ~$200/FH
- Accrual is a direct operating cost on each PIREP
- Balance tracked per aircraft (new field: `maintenance_reserve_balance` on `aircraft_hours`)

### Check Cost Settlement
- Check cost deducted from aircraft's reserve balance on completion
- Reserve covers cost: no additional P&L impact (already accrued)
- Reserve insufficient: shortfall hits P&L as unplanned maintenance expense
- Creates dynamic where deferred maintenance is "cheap" until the bill comes

### Default Check Costs (seeded, admin-configurable)
- A-check: $30,000 - $50,000
- B-check: $150,000 - $250,000
- C-check: $1,000,000 - $2,000,000
- D-check: $5,000,000 - $12,000,000
- Engine overhaul: $2,000,000 - $5,000,000

### Aircraft Out-of-Service Impact
- Aircraft in maintenance: zero revenue, fixed costs continue
- Fleet utilization KPI: `total_block_hours / (active_aircraft x available_hours_per_month)`
- Dashboard shows financial drag of idle aircraft

---

## 6. Monthly Financial Cycle & Reporting

### Monthly Close Job
Runs automatically on 1st of each month (admin can trigger manually).

**Fixed costs generated per aircraft:**
- Lease/loan payment (from fleet financing terms)
- Insurance premium
- Depreciation (purchased aircraft only)
- Hangar/parking (base airport tier rate x 720 hrs)

### Period P&L Structure (`finance_period_pnl`)

```
REVENUE
  Cargo revenue
  Fuel surcharge revenue
  Total Revenue

DIRECT OPERATING COSTS
  Fuel
  Crew (pilot pay)
  Landing & handling fees
  Navigation fees
  Maintenance reserve accrual
  Total DOC

FIXED COSTS
  Aircraft lease/loan payments
  Insurance
  Depreciation
  Total Fixed Costs

UNPLANNED COSTS
  Maintenance shortfall
  AOG expenses

OPERATING INCOME = Revenue - DOC - Fixed - Unplanned

KEY RATIOS
  CASM (Cost per Available Ton-Mile)
  RATM (Revenue per Available Ton-Mile)
  Operating margin %
  Fleet utilization %
  Break-even load factor
```

### Dashboard Integration
- Monthly P&L chart: revenue vs costs over time (fixes currently-zero cost lines)
- Route margin chart: top/bottom 5 routes by profitability
- Fleet economics: per-aircraft contribution (revenue - allocated costs)

---

## 7. Difficulty Settings

All on the admin Settings page. Single place to control economic feel.

| Setting | Range | Default | Effect |
|---------|-------|---------|--------|
| Cost multiplier | 0.5x - 2.0x | 1.0 | Scales all operating costs |
| Revenue multiplier | 0.5x - 2.0x | 1.0 | Scales cargo yield rates |
| Demand volatility | Low / Medium / High | Medium | Supply/demand rate swing magnitude |
| Maintenance cost factor | 0.5x - 2.0x | 1.0 | Scales check costs and reserve rates |
| Fuel price variability | Fixed / Moderate / Volatile | Moderate | Fuel price stability over time |

---

## 8. Migration Strategy

Migration 037 (`finance-engine.sql`) defined 10+ finance tables that were never wired up. Several conflict with this spec:

### Tables to DROP and Recreate
- `finance_aircraft_profiles` — uses `lease_type ('dry','wet')`, incompatible with 5 acquisition types. Replace with fleet table columns.
- `finance_station_fees` — uses flat per-airport rates, incompatible with tier × MTOW model. Replace with `airport_fee_tiers` table.
- `finance_maint_thresholds` — uses check types `(A, C, D, ESV)`, no B-check or per-FH reserve rates. Replace with `maintenance_reserve_rates` fields on `maintenance_checks`.
- `finance_commodity_rates` — not used in this spec. Drop (can re-add later if needed).
- `finance_rated_manifests`, `finance_rated_shipments` — replaced by existing revenue model manifest split. Drop.

### Tables to ALTER
- `finance_flight_pnl` — keep structure but update columns to match spec (add `fuel_surcharge_revenue`, `lane_rate_modifier`, `maintenance_reserve`; rename `rasm` → `ratm`; drop unused columns like `deice_fee`, `uld_fee`).
- `finance_period_pnl` — keep structure, rename `rasm` → `ratm` (cargo airline uses ton-miles not seat-miles).
- `finance_rate_config` — keep and extend for difficulty settings storage.
- `finance_lane_rates` — keep as snapshot table for dashboard display.

### New Tables/Columns
- `airports.demand_score` REAL DEFAULT 0.5 — seeded from hub status and country. For airports not in the VA's `airports` table, use a default of 0.3 (unknown airport).
- `airports.fee_tier` TEXT DEFAULT 'regional' — auto-assigned, admin-overridable.
- `airport_fee_tiers` — 4 rows (international_hub, major_hub, regional, small) with landing/handling/parking/nav/fuel rates.
- `aircraft_hours.maintenance_reserve_balance` REAL DEFAULT 0.
- `maintenance_checks.reserve_rate_per_hour` REAL DEFAULT 0 — per-FH reserve accrual rate per check type.
- `maintenance_checks.default_cost` REAL — default cost for completing this check type.
- Fleet table: acquisition/financing fields (Section 3).

### finances Ledger
Make `pilot_id` NULLABLE on the `finances` table. Airline-level costs (lease, insurance, depreciation, maintenance shortfall) use `pilot_id = NULL`. Per-flight costs continue using the pilot's ID. This preserves the existing ledger while supporting airline-level entries.

---

## 9. Formula Definitions

### Supply Score Normalization
- `supply_score = flights_in_30d / 10` (10 flights/month = supply score 1.0 = "adequately served")
- Capped at 3.0 (30+ flights/month = max supply pressure)
- Computed at query time from `logbook` table (30-day rolling window, no materialized state)
- Routes with zero flights naturally have supply_score = 0, hitting the floor of 0.1 in the rate formula

### Demand Volatility Multiplier
- Low: rate swing capped at 0.8x – 1.3x of base
- Medium: rate swing capped at 0.5x – 2.0x of base (default)
- High: rate swing capped at 0.3x – 2.5x of base

### RATM (Revenue per Available Ton-Mile)
`RATM = total_cargo_revenue / (cargo_capacity_lbs × distance_nm / 2000)`
Where cargo_capacity_lbs comes from fleet table, distance_nm from the schedule.

### CATM (Cost per Available Ton-Mile)
`CATM = total_operating_costs / (cargo_capacity_lbs × distance_nm / 2000)`

### Break-Even Load Factor
`BELF = total_operating_costs / (RATM × cargo_capacity_lbs × distance_nm / 2000)`
The minimum load factor needed for a route to cover its costs.

### Fleet Utilization
`utilization = sum(block_hours_this_month) / (active_aircraft_count × 720)`
720 = hours in a 30-day month.

### Fuel Price Variability
- **Fixed**: fuel price per tier is constant (from `airport_fee_tiers`)
- **Moderate**: ±5% random perturbation per month, applied globally to all tiers
- **Volatile**: ±15% perturbation per month, with momentum (trending up or down for 2-4 months)
- Perturbation stored as `fuel_price_factor` in `finance_rate_config`, updated by monthly job

### Hangar/Parking Monthly Cost
`hangar_monthly = tier_parking_rate × 24 × 30` (24 hrs/day × 30 days, but only charged for days NOT flying)
Simplified: `hangar_monthly = tier_parking_rate × 500` (assumes ~21 idle days/month for typical utilization)
Uses the aircraft's `base_icao` tier. If `base_icao` is null, uses Regional tier as default.

---

## 10. Monthly Close Semantics

### Idempotency
- Monthly close keyed by `period_key` (e.g., "2026-03" for March 2026)
- Re-running the close for the same period UPSERTs the `finance_period_pnl` row and replaces fixed-cost finance entries for that period
- This allows corrections without double-counting

### Retroactive PIREPs
- PIREPs approved after month close hit the CURRENT month's P&L, not the closed month
- The `finance_flight_pnl` row uses the PIREP approval date, not the flight date
- This avoids reopening closed periods

### Missed Close
- On server startup, check if any months since the last close are unclosed
- Auto-close any missed months before processing the current month

---

## 11. Difficulty Settings Storage

All difficulty settings stored in the existing `va_settings` table (key-value pairs):
- `sim.cost_multiplier` = "1.0"
- `sim.revenue_multiplier` = "1.0"
- `sim.demand_volatility` = "medium"
- `sim.maintenance_cost_factor` = "1.0"
- `sim.fuel_price_variability` = "moderate"

Multipliers are snapshotted into each `finance_flight_pnl` row at computation time so historical P&L is not affected by setting changes.

---

## Implementation Phases

1. **Per-flight P&L** — wire cost breakdown into PIREP approval flow, populate `finance_flight_pnl`
2. **Supply/demand engine** — demand scoring, supply tracking, lane rate calculation
3. **Fleet financing** — acquisition types, monthly cost generation, depreciation
4. **Airport fee tiers** — auto-assignment, tier rate tables, per-flight fee calculation
5. **Maintenance economics** — reserve fund, check cost settlement, shortfall tracking
6. **Monthly cycle & reporting** — monthly close job, period P&L, dashboard integration
7. **Difficulty settings** — global multipliers on Settings page

---

## Data Flow Summary

```
PIREP Approved
  |
  +---> Revenue Model (existing)
  |       +---> Supply/Demand modifier (new)
  |       +---> Lane rate calculation (new)
  |       +---> Fuel surcharge (new)
  |
  +---> Cost Engine (new)
  |       +---> Fuel cost (airport tier x fuel used)
  |       +---> Crew cost (block hours x rate)
  |       +---> Landing/handling (airport tier x MTOW)
  |       +---> Nav fees (distance x tier rate)
  |       +---> Maintenance reserve (block hours x rate)
  |
  +---> finance_flight_pnl row (new)
  +---> finances ledger entries (existing, enhanced)
  +---> Maintenance hours accumulation (existing)
  +---> Supply score update (new)

Monthly Job (1st of month)
  |
  +---> Per-aircraft fixed costs
  |       +---> Lease/loan payments
  |       +---> Insurance
  |       +---> Depreciation
  |       +---> Hangar fees
  |
  +---> finance_period_pnl row (new)
  +---> Lane rate snapshot (new)
  +---> Fuel price adjustment (if volatile)
```
