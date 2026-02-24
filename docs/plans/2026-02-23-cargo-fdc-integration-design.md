# Cargo FDC Integration Design

**Date**: 2026-02-23
**Reference**: [freight-dispatch-companion](https://github.com/joemcf09/freight-dispatch-companion)
**Status**: Approved

## Overview

Integrate cargo Freight Dispatch Companion (FDC) functionality into SMA ACARS, adding realistic cargo manifest generation, ULD distribution, load visualization, and NOTOC documentation to the Flight Planning and Dispatch pages. Cargo manifests persist to the backend database for logbook/PIREP integration.

## User Requirements

1. **Cargo Distribution Engine** — auto-distribute payload into ULDs across main deck, lower holds, bulk
2. **Manifest & NOTOC Documents** — generate cargo manifest with AWB numbers, shipper/consignee, NOTOC for DG
3. **Visual Load Summary** — payload utilization bars, CG position visualization, deck breakdown
4. **Cargo Categories & Scenarios** — mixed-freight vs single-commodity, 10 categories, fictional + real companies
5. **Backend Persistence** — manifests saved to DB, linked to logbook entries and PIREPs
6. **Both Pages** — config + generation on Planning page; read-only display on Dispatch page

## Architecture

### Server-Side Cargo Engine

The cargo distribution engine runs on the **backend** so manifests get stable IDs and automatic persistence. The frontend sends config (category, mode, aircraft type, payload) and receives the generated `CargoLoad`.

### Data Flow

```
Flight Planning Page:
  1. User configures cargo options (mode, category, companies) in left panel
  2. User generates OFP via SimBrief
  3. POST /api/cargo/generate { aircraftIcao, payloadKg, cargoMode, primaryCategory, useRealWorldCompanies }
  4. Backend runs engine → saves manifest → returns CargoLoad
  5. cargoStore receives result → Cargo tab displays manifest

Dispatch Page:
  1. GET /api/cargo/:flightId → load existing manifest from DB
  2. Display in read-only Cargo tab + collapsible summary row

Flight Completion:
  1. cargo_manifest_id linked to logbook entry
  2. Logbook detail view shows cargo manifest summary
```

## Database Schema

```sql
CREATE TABLE cargo_manifests (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  flight_id             INTEGER NOT NULL,
  user_id               INTEGER NOT NULL,
  manifest_number       TEXT NOT NULL,          -- CGO-YYYYMMDD-XXXX
  aircraft_icao         TEXT NOT NULL,
  payload_kg            REAL NOT NULL,
  cargo_mode            TEXT NOT NULL DEFAULT 'mixed',
  primary_category      TEXT,
  total_weight_kg       REAL NOT NULL,
  cg_position           REAL,
  payload_utilization   INTEGER,
  ulds_json             TEXT NOT NULL,          -- JSON array of ULD objects
  section_weights_json  TEXT NOT NULL,
  remarks_json          TEXT,
  notoc_required        INTEGER DEFAULT 0,
  notoc_items_json      TEXT,
  created_at            TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

## New Files

### Shared Types
```
shared/src/types/cargo.ts
```
- `CargoCategory`, `CargoMode`, `ULDType`, `ULD`, `SectionWeight`, `CargoLoad`, `CargoConfig`
- `NotocItem`, `CargoManifestSummary`
- Exported from shared barrel

### Backend
```
backend/src/db/migrations/020-cargo.sql
backend/src/services/cargo-engine.ts        — Core distribution algorithm (ported from FDC)
backend/src/services/cargo.ts               — Service layer (generate, get, link to logbook)
backend/src/routes/cargo.ts                 — REST endpoints
```

**Endpoints:**
- `POST /api/cargo/generate` — generate + persist manifest for a flight
- `GET /api/cargo/:flightId` — retrieve manifest for a flight
- `DELETE /api/cargo/:manifestId` — delete manifest (for regeneration)

### Frontend — Cargo Engine Data (static, imported by backend)
```
frontend/src/lib/cargo/aircraft-configs.ts   — 13 aircraft type configs + ICAO mapping
frontend/src/lib/cargo/cargo-categories.ts   — 10 category definitions
frontend/src/lib/cargo/company-data.ts       — Fictional + real-world shipper/consignee pools
```

Wait — since the engine runs server-side, these data files belong in backend:
```
backend/src/services/cargo/aircraft-configs.ts
backend/src/services/cargo/cargo-categories.ts
backend/src/services/cargo/company-data.ts
backend/src/services/cargo/cargo-generator.ts
backend/src/services/cargo/validation-engine.ts
backend/src/services/cargo/index.ts
```

### Frontend — Store & Components
```
frontend/src/stores/cargoStore.ts            — Zustand store for cargo state
frontend/src/components/cargo/
  ├── CargoConfigPanel.tsx                   — Category/mode selector (Planning left panel)
  ├── CargoTab.tsx                           — Dispatch info panel cargo tab
  ├── PlanningCargoTab.tsx                   — Planning info panel cargo tab
  ├── LoadSummary.tsx                        — Payload utilization, CG visual, deck breakdown
  ├── ULDManifest.tsx                        — ULD table with AWB, descriptions
  └── NOTOCSection.tsx                       — Dangerous goods notice (conditional)
```

## Aircraft Configuration

Ship all 13 FDC aircraft configs (B77F, B748, B744, B742, A333, A332, MD11, B763, B752, B722, A306, E190, E195). When the fleet's ICAO type isn't in the list, use closest-match mapping. Design allows adding custom configs via backend later.

### ICAO Mapping Strategy
```ts
const AIRCRAFT_MAP: Record<string, string> = {
  'B77F': 'B77F', 'B748': 'B748', 'B744': 'B744', 'B742': 'B742',
  'A333': 'A333', 'A332': 'A332', 'MD11': 'MD11', 'B763': 'B763',
  'B752': 'B752', 'B722': 'B722', 'A306': 'A306', 'E190': 'E190',
  'E195': 'E195',
  // Common mappings for non-freighter types
  'B77W': 'B77F', 'B773': 'B77F', 'B77L': 'B77F',
  'B738': 'B752', 'B739': 'B752', 'A320': 'B752', 'A321': 'B752',
  'A359': 'A332', 'A35K': 'A333', 'B788': 'B763', 'B789': 'B763',
  'B78X': 'B763', 'A346': 'A333',
};
```

## UI Design

### Flight Planning Page — Left Panel
New collapsible "Cargo" section between Weights and SimBrief Generation Options:

- **Mode**: Select — Mixed Freight / Single Commodity
- **Category**: Select (visible only for Single Commodity) — 10 options
- **Real-world companies**: Checkbox
- **Info text**: "Cargo generates automatically with OFP"

### Flight Planning Page — Info Panel
New 7th tab "Cargo" after "Log":

```
[WX] [NOTAMs] [Airport] [OFP] [W&B] [Log] [Cargo]
```

Empty state: "Generate OFP to see cargo manifest"

Populated state (scrollable):
1. **Load Summary** — total weight + utilization bar, CG position visual with envelope, deck utilization bars
2. **ULD Manifest** — table with ULD ID, type, position, weight, AWB, description, special cargo indicators
3. **NOTOC** (conditional) — DG items table, handling instructions

### Dispatch Page — Info Panel
New 10th tab "Cargo" at end:

```
[Weather] [NOTAM] [Airport Info] [Suitability] [OFP] [Messages] [Tracks] [Advisories] [Flight Log] [Cargo]
```

Read-only display of same three sections.

### Dispatch Page — Left Panel
New collapsible summary row in FlightPlanPanel:
- Header: "Cargo" with ULD count badge
- Expanded: manifest number, total weight, utilization %, special cargo flags, CG position

### Logbook Integration
- `logbook` table gains optional `cargo_manifest_id` column
- Logbook detail view shows cargo summary (total weight, ULD count, special cargo, manifest number)
- PIREP includes cargo weight and ULD count

## Cargo Categories (10)

| Code | Name | Temp | Hazmat | NOTOC |
|------|------|------|--------|-------|
| GEN | General Freight | No | No | No |
| PIL | Pharmaceuticals | Yes (+2/+8C) | No | No |
| PER | Seafood & Perishables | Yes (-18/+4C) | No | No |
| ELE | Electronics | No | No | No (lithium note) |
| MCH | Industrial Machinery | No | No | No |
| AUT | Automotive Parts | No | No | No |
| TEX | Textiles & Garments | No | No | No |
| DGR | Dangerous Goods | No | Yes | Yes |
| AVI | Live Animals | Yes (+15/+25C) | No | Yes |
| ECM | E-Commerce | No | No | No |

## ULD Types (14)

PMC, PAG, PLA, PGA, AMJ, DQF, LD3, LD7, LD1, LD2, AKE, AKH, AAA, BULK

## Validation Rules

1. DG in Bulk Hold — prevent hazmat in bulk compartment
2. AVI/DG Separation — live animals away from dangerous goods
3. Cold Chain Proximity — temp-controlled cargo placement warnings
4. Heavy Cargo Floor Loading — flag ULDs exceeding 5000kg
5. CG Position — validate within aircraft CG envelope
6. Section Overweight — prevent exceeding compartment limits

## Design Principles

- **Cargo is first-class**: SMA Virtual is a cargo airline — cargo features get prominent placement
- **No purple, no glassmorphism**: Follow existing aviation design system (blue accent, solid panels)
- **Progressive disclosure**: Config collapsed by default, NOTOC only when relevant
- **Consistent with existing patterns**: Same collapsible sections, tab bars, store patterns
- **Simulation disclaimer**: All documents note "simulation only" per FDC convention
