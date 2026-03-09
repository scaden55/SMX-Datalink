# Revenue Model Design

**Date:** 2026-03-09
**Replaces:** Old finance engine (flat $50/hr pay rate)

## Core Concept

Revenue is driven by the movement of weight over distance: **Revenue Ton Miles (RTM)**.
The model uses $/kg yield rates stratified by aircraft class and cargo unit type,
with a logarithmic distance curve that compresses yield on ultra-long routes.

## Formula

```
flight_revenue = SUM( tier_kg * yield[class][unit_type] * distance_factor )
distance_factor = ln(route_nm / 100 + 1) / ln(1000 / 100 + 1)
pilot_pay = block_hours * pilot_pay_rate
```

The distance factor normalizes to 1.0 at 1000nm. Logarithmic scaling reflects
real-world yield compression on competitive long-haul trunk routes.

| Distance | Factor |
|----------|--------|
| 250nm    | 0.51x  |
| 500nm    | 0.75x  |
| 1000nm   | 1.00x  |
| 2000nm   | 1.27x  |
| 5000nm   | 1.63x  |
| 7000nm   | 1.79x  |

## Aircraft Classes

Manually assigned per aircraft on the fleet page.

| Class | Aircraft Type | Examples |
|-------|--------------|----------|
| I     | Regional     | ATR 72F, Citation Longitude, Saab 340 |
| II    | Narrowbody   | 737 BDSF, 757F |
| III   | Widebody     | 777F, MD-11F, 747F |

Yield is **inversely correlated** with aircraft class:
- Class I has zero competition on remote routes, carries premium cargo, shippers have no leverage
- Class III operates commodity freight on trunk routes with heavy competition and shipper leverage

## Cargo Unit Types

| Unit Type   | Covers | Yield Relative to Standard |
|-------------|--------|---------------------------|
| Standard    | General freight, express | 1.0x (baseline) |
| NonStandard | Pharma, live animals, temperature-controlled | 2.0x |
| Hazard      | High-value, security cargo, DGR | 4.0x |

## Yield Matrix ($/kg, admin-editable defaults)

|           | Standard | NonStandard | Hazard  |
|-----------|----------|-------------|---------|
| Class I   | $10.00   | $20.00      | $40.00  |
| Class II  | $3.00    | $6.00       | $12.00  |
| Class III | $2.00    | $4.00       | $8.00   |

## Manifest Generation

On PIREP submission, cargo weight (from SimBrief OFP `baggage/cargo` field) is
split into a randomized manifest:

- ~70% Standard (± 10% variance)
- ~20% NonStandard (± 5% variance)
- ~10% Hazard (± 5% variance)

Each tier's revenue: `tier_kg * yield[class][unit_type] * distance_factor`

## Pilot Pay

Fixed rate: **$300/hr** block time (baseline, admin-adjustable later via user profiles).
Separate finance entry from cargo revenue.

## Revenue Targets (spot checks)

| Aircraft | Route | Cargo | Distance | Revenue |
|----------|-------|-------|----------|---------|
| 777F (III) | KSAN-KSFO | 87,500 kg | 450nm | ~$186k |
| 777F (III) | KDFW-RCTP | 87,500 kg | 7,000nm | ~$468k |
| Citation (I) | PANC-PAFA | 1,600 kg | 260nm | ~$12.5k |
| 737 BDSF (II) | KORD-KMIA | 19,000 kg | 1,100nm | ~$61k |

## Data Sources

- **Cargo weight:** SimBrief OFP `baggage/cargo` field (stored in `active_bids.simbrief_ofp_json`)
- **Route distance:** `schedules.distance_nm` column
- **Aircraft class:** `fleet.aircraft_class` column (new, admin-set)
- **Block hours:** OOOI OFF→ON time from flight events

## Database Changes

### New table: `revenue_model_config`
Single-row configuration table with 9 yield cells + global settings.

```sql
CREATE TABLE revenue_model_config (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  class_i_standard REAL NOT NULL DEFAULT 10.00,
  class_i_nonstandard REAL NOT NULL DEFAULT 20.00,
  class_i_hazard REAL NOT NULL DEFAULT 40.00,
  class_ii_standard REAL NOT NULL DEFAULT 3.00,
  class_ii_nonstandard REAL NOT NULL DEFAULT 6.00,
  class_ii_hazard REAL NOT NULL DEFAULT 12.00,
  class_iii_standard REAL NOT NULL DEFAULT 2.00,
  class_iii_nonstandard REAL NOT NULL DEFAULT 4.00,
  class_iii_hazard REAL NOT NULL DEFAULT 8.00,
  pilot_pay_per_hour REAL NOT NULL DEFAULT 300.00,
  manifest_std_pct REAL NOT NULL DEFAULT 0.70,
  manifest_nonstd_pct REAL NOT NULL DEFAULT 0.20,
  manifest_hazard_pct REAL NOT NULL DEFAULT 0.10,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### New column on `fleet`: `aircraft_class`
```sql
ALTER TABLE fleet ADD COLUMN aircraft_class TEXT NOT NULL DEFAULT 'III'
  CHECK (aircraft_class IN ('I', 'II', 'III'));
```

## Implementation Scope

1. **Migration** — `revenue_model_config` table + `fleet.aircraft_class` column
2. **RevenueModelService** — calculates revenue + pilot pay on PIREP submission
3. **PIREP flow update** — replace old $50/hr calculation with revenue model
4. **Admin API** — GET/PUT `/api/admin/revenue-model` for yield matrix editing
5. **Admin Fleet page** — aircraft class dropdown per aircraft
6. **Admin Revenue Model page** — view/edit yield matrix and global settings
