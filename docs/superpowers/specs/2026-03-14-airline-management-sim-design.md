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
