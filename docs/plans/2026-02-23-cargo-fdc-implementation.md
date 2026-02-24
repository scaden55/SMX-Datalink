# Cargo FDC Integration — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add realistic cargo manifest generation with ULD distribution, load visualization, NOTOC documents, and backend persistence to the Flight Planning and Dispatch pages.

**Architecture:** Server-side cargo distribution engine (ported from FDC repo) generates manifests and stores them in SQLite. Frontend displays via new Cargo tabs on both info panels. Cargo config lives in a Zustand store; generation auto-triggers after OFP fetch.

**Tech Stack:** TypeScript, Express routes, better-sqlite3, Zustand, React components, Tailwind CSS, Recharts (progress bars).

**Design Doc:** `docs/plans/2026-02-23-cargo-fdc-integration-design.md`

---

## Task 1: Shared Cargo Types

**Files:**
- Create: `shared/src/types/cargo.ts`
- Modify: `shared/src/index.ts`

**Step 1: Create cargo types**

Create `shared/src/types/cargo.ts` with all type definitions needed by both backend and frontend:

```typescript
// ─── Cargo Types ────────────────────────────────────────────

export type CargoMode = 'mixed' | 'single';

export type CargoCategoryCode =
  | 'general_freight'
  | 'pharmaceuticals'
  | 'seafood'
  | 'electronics'
  | 'industrial_machinery'
  | 'automotive'
  | 'textiles'
  | 'dangerous_goods'
  | 'live_animals'
  | 'ecommerce';

export interface CargoConfig {
  cargoMode: CargoMode;
  primaryCategory: CargoCategoryCode;
  useRealWorldCompanies: boolean;
}

export interface ULD {
  uld_id: string;
  uld_type: string;
  uld_type_name: string;
  position: string;
  section: string;
  section_name: string;
  weight: number;         // cargo weight in KG
  gross_weight: number;   // cargo + tare
  tare_weight: number;
  cargo_description: string;
  category: string;
  category_name: string;
  category_code: string;
  shipper: { name: string; city: string; country: string; type: string };
  consignee: { name: string; city: string; country: string; type: string };
  awb_number: string;
  temp_controlled: boolean;
  temp_requirement: string | null;
  temp_advisory: string | null;
  hazmat: boolean;
  notoc_required: boolean;
  lithium_battery: boolean;
}

export interface SectionWeight {
  name: string;
  weight: number;
  maxWeight: number;
  utilization: number;
}

export interface NotocItem {
  uld_id: string;
  position: string;
  proper_shipping_name: string;
  un_number: string;
  class: string;
  packing_group: string;
  quantity: string;
  net_weight: string;
}

export interface CargoLoad {
  manifestNumber: string;
  aircraftIcao: string;
  aircraftName: string;
  ulds: ULD[];
  sectionWeights: Record<string, SectionWeight>;
  totalWeightKg: number;
  totalWeightDisplay: number;
  totalWeightUnit: string;
  cgPosition: number;
  cgRange: { forward: number; aft: number };
  cgTarget: number;
  payloadUtilization: number;
  aircraftMaxPayloadKg: number;
  remarks: string[];
  specialCargo: ULD[];
  notocRequired: boolean;
  notocItems: NotocItem[];
  cargoMode: CargoMode;
  primaryCategory: CargoCategoryCode | null;
}

export interface CargoManifest extends CargoLoad {
  id: number;
  flightId: number;
  userId: number;
  createdAt: string;
}

export interface CargoManifestSummary {
  id: number;
  manifestNumber: string;
  totalWeightKg: number;
  uldCount: number;
  payloadUtilization: number;
  notocRequired: boolean;
  cargoMode: CargoMode;
}

export interface GenerateCargoRequest {
  flightId: number;
  aircraftIcao: string;
  payloadKg: number;
  payloadUnit: 'LBS' | 'KGS';
  cargoMode: CargoMode;
  primaryCategory?: CargoCategoryCode;
  useRealWorldCompanies?: boolean;
}
```

**Step 2: Export from shared barrel**

Add to the end of `shared/src/index.ts` (before the utilities section):

```typescript
export type {
  CargoMode,
  CargoCategoryCode,
  CargoConfig,
  ULD,
  SectionWeight,
  NotocItem,
  CargoLoad,
  CargoManifest,
  CargoManifestSummary,
  GenerateCargoRequest,
} from './types/cargo.js';
```

**Step 3: Build shared types**

Run: `cd shared && npx tsc`
Expected: Build succeeds with 0 errors.

**Step 4: Commit**

```bash
git add shared/src/types/cargo.ts shared/src/index.ts
git commit -m "feat(shared): add cargo manifest types for FDC integration"
```

---

## Task 2: Database Migration

**Files:**
- Create: `backend/src/db/migrations/020-cargo-manifests.sql`

**Step 1: Create migration**

```sql
-- Cargo manifests: stores generated ULD distributions for flights.
-- Links to active bids / logbook entries via flight_id.

CREATE TABLE IF NOT EXISTS cargo_manifests (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  flight_id             INTEGER NOT NULL,
  user_id               INTEGER NOT NULL,
  manifest_number       TEXT NOT NULL,
  aircraft_icao         TEXT NOT NULL,
  payload_kg            REAL NOT NULL,
  cargo_mode            TEXT NOT NULL DEFAULT 'mixed',
  primary_category      TEXT,
  total_weight_kg       REAL NOT NULL,
  cg_position           REAL,
  payload_utilization   INTEGER,
  ulds_json             TEXT NOT NULL,
  section_weights_json  TEXT NOT NULL,
  remarks_json          TEXT,
  notoc_required        INTEGER DEFAULT 0,
  notoc_items_json      TEXT,
  created_at            TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX idx_cargo_manifests_flight ON cargo_manifests(flight_id);
CREATE INDEX idx_cargo_manifests_user ON cargo_manifests(user_id);

-- Add cargo_manifest_id to logbook for PIREP linkage
ALTER TABLE logbook ADD COLUMN cargo_manifest_id INTEGER REFERENCES cargo_manifests(id);
```

**Step 2: Verify migration runs**

Run: `cd backend && npm run dev` (briefly, to trigger migration runner)
Expected: Migration 020 applies without errors. Check console for `[DB] Applied migration 020-cargo-manifests.sql`.

**Step 3: Commit**

```bash
git add backend/src/db/migrations/020-cargo-manifests.sql
git commit -m "feat(db): add cargo_manifests table and logbook linkage"
```

---

## Task 3: Backend Cargo Engine — Data Files

**Files:**
- Create: `backend/src/services/cargo/aircraft-configs.ts`
- Create: `backend/src/services/cargo/cargo-categories.ts`
- Create: `backend/src/services/cargo/company-data.ts`

These are static data files ported from the FDC repo. All weights in KG.

**Step 1: Create aircraft-configs.ts**

Port the `AIRCRAFT_CONFIGS` and `ULD_TYPES` objects from FDC's `AircraftData.ts` verbatim. Include all 13 aircraft types (B77F, B748, B744, B742, A333, A332, MD11, B763, B752, B722, A306, E190, E195) and all 14 ULD types. Add the `AIRCRAFT_MAP` for ICAO type mapping. Export `getAircraftConfig()`, `convertWeight()`, `formatWeight()`, `AIRCRAFT_CONFIGS`, `ULD_TYPES`, `AIRCRAFT_MAP`.

The AIRCRAFT_MAP should include these mappings for non-freighter types:
```typescript
export const AIRCRAFT_MAP: Record<string, string> = {
  // Direct matches
  'B77F': 'B77F', 'B748': 'B748', 'B744': 'B744', 'B742': 'B742',
  'A333': 'A333', 'A332': 'A332', 'MD11': 'MD11', 'B763': 'B763',
  'B752': 'B752', 'B722': 'B722', 'A306': 'A306', 'E190': 'E190',
  'E195': 'E195',
  // Widebody mappings
  'B77W': 'B77F', 'B773': 'B77F', 'B77L': 'B77F',
  'A359': 'A332', 'A35K': 'A333', 'A346': 'A333',
  'B788': 'B763', 'B789': 'B763', 'B78X': 'B763',
  // Narrowbody mappings
  'B738': 'B752', 'B739': 'B752', 'A320': 'B752', 'A321': 'B752',
  'A319': 'B722', 'CRJ9': 'E190', 'E175': 'E190',
};
```

**Step 2: Create cargo-categories.ts**

Port `CARGO_CATEGORIES` from FDC's `CargoCategories.ts` — all 10 categories with their descriptions, temp ranges, hazmat flags, weight ranges. Export `CARGO_CATEGORIES`, `getRandomDescription()`, `getRandomWeight()`.

**Step 3: Create company-data.ts**

Port `FICTIONAL_COMPANIES` and `REAL_WORLD_COMPANIES` from FDC's `CompanyData.ts` — all category-specific shipper/consignee pools. Export `getRandomCompany()`, `generateAWBNumber()`.

**Step 4: Commit**

```bash
git add backend/src/services/cargo/
git commit -m "feat(cargo): add aircraft configs, cargo categories, and company data"
```

---

## Task 4: Backend Cargo Engine — Generator

**Files:**
- Create: `backend/src/services/cargo/cargo-generator.ts`
- Create: `backend/src/services/cargo/validation-engine.ts`
- Create: `backend/src/services/cargo/index.ts`

**Step 1: Create cargo-generator.ts**

Port the `generateCargoLoad()` function from FDC's `CargoGenerator.ts`. The function takes:
```typescript
interface GenerateParams {
  aircraftType: string;     // ICAO code (will be mapped)
  totalPayload: number;     // in the unit specified
  payloadUnit: 'LBS' | 'KGS';
  cargoMode?: 'mixed' | 'single';
  primaryCategory?: string;
  useRealWorldCompanies?: boolean;
}
```

And returns a `CargoLoad` object (from shared types). Key algorithm:

1. Convert payload to KG for internal calculations
2. Look up aircraft config via `getAircraftConfig()` (with ICAO mapping)
3. Cap payload at aircraft maxPayload
4. Iterate sections in order: mainDeck (65%), forwardHold (18%), aftHold (12%), bulk (5%)
5. For each section: shuffle positions, fill ULDs with random weights from category weight ranges
6. Minimum ULD weight: 100 KG (skip below)
7. Generate unique ULD IDs, AWB numbers, shipper/consignee for each
8. Calculate CG position (simplified: weighted average of section arm positions)
9. Generate dispatcher remarks (temp-controlled flags, DG warnings, heavy ULD notes)
10. Identify special cargo and NOTOC items
11. Generate manifest number: `CGO-YYYYMMDD-XXXX` (4-digit random)
12. Return complete CargoLoad with unit-converted display weight

**Step 2: Create validation-engine.ts**

Port the 6 validation rules from FDC's `ValidationEngine.ts`:
- `validateCargoLoad(ulds, aircraftConfig)` returns `{ valid, warnings, errors, infos }`
- Rules: DG in bulk, AVI/DG separation, cold chain, heavy cargo, CG position, section overweight

**Step 3: Create index.ts barrel**

```typescript
export { generateCargoLoad } from './cargo-generator.js';
export { validateCargoLoad } from './validation-engine.js';
export { AIRCRAFT_CONFIGS, ULD_TYPES, AIRCRAFT_MAP, getAircraftConfig, convertWeight } from './aircraft-configs.js';
export { CARGO_CATEGORIES } from './cargo-categories.js';
```

**Step 4: Commit**

```bash
git add backend/src/services/cargo/
git commit -m "feat(cargo): implement cargo distribution engine and validation"
```

---

## Task 5: Backend Cargo Service & Routes

**Files:**
- Create: `backend/src/services/cargo.ts`
- Create: `backend/src/routes/cargo.ts`
- Modify: `backend/src/index.ts` (register route)

**Step 1: Create cargo service**

`backend/src/services/cargo.ts`:

```typescript
import { getDb } from '../db/index.js';
import { generateCargoLoad } from './cargo/index.js';
import type { CargoLoad, CargoManifest, GenerateCargoRequest } from '@acars/shared';

export class CargoService {
  /** Generate a new cargo manifest and persist it. */
  generate(req: GenerateCargoRequest, userId: number): CargoManifest {
    const db = getDb();

    // Delete any existing manifest for this flight (regeneration)
    db.prepare('DELETE FROM cargo_manifests WHERE flight_id = ? AND user_id = ?')
      .run(req.flightId, userId);

    const load = generateCargoLoad({
      aircraftType: req.aircraftIcao,
      totalPayload: req.payloadKg,
      payloadUnit: req.payloadUnit,
      cargoMode: req.cargoMode,
      primaryCategory: req.primaryCategory,
      useRealWorldCompanies: req.useRealWorldCompanies ?? false,
    });

    const stmt = db.prepare(`
      INSERT INTO cargo_manifests
        (flight_id, user_id, manifest_number, aircraft_icao, payload_kg,
         cargo_mode, primary_category, total_weight_kg, cg_position,
         payload_utilization, ulds_json, section_weights_json, remarks_json,
         notoc_required, notoc_items_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      req.flightId,
      userId,
      load.manifestNumber,
      req.aircraftIcao,
      req.payloadKg,
      req.cargoMode,
      req.primaryCategory ?? null,
      load.totalWeightKg,
      load.cgPosition,
      load.payloadUtilization,
      JSON.stringify(load.ulds),
      JSON.stringify(load.sectionWeights),
      JSON.stringify(load.remarks),
      load.notocRequired ? 1 : 0,
      load.notocItems.length > 0 ? JSON.stringify(load.notocItems) : null,
    );

    return {
      ...load,
      id: result.lastInsertRowid as number,
      flightId: req.flightId,
      userId,
      createdAt: new Date().toISOString(),
    };
  }

  /** Get manifest for a flight. */
  getByFlightId(flightId: number): CargoManifest | null {
    const db = getDb();
    const row = db.prepare(
      'SELECT * FROM cargo_manifests WHERE flight_id = ? ORDER BY created_at DESC LIMIT 1'
    ).get(flightId) as any;

    if (!row) return null;
    return this.rowToManifest(row);
  }

  /** Delete a manifest (for regeneration). */
  delete(manifestId: number, userId: number): boolean {
    const db = getDb();
    const result = db.prepare(
      'DELETE FROM cargo_manifests WHERE id = ? AND user_id = ?'
    ).run(manifestId, userId);
    return result.changes > 0;
  }

  /** Link a manifest to a logbook entry. */
  linkToLogbook(logbookId: number, manifestId: number): void {
    const db = getDb();
    db.prepare('UPDATE logbook SET cargo_manifest_id = ? WHERE id = ?')
      .run(manifestId, logbookId);
  }

  private rowToManifest(row: any): CargoManifest {
    return {
      id: row.id,
      flightId: row.flight_id,
      userId: row.user_id,
      manifestNumber: row.manifest_number,
      aircraftIcao: row.aircraft_icao,
      aircraftName: '', // populated from config if needed
      ulds: JSON.parse(row.ulds_json),
      sectionWeights: JSON.parse(row.section_weights_json),
      totalWeightKg: row.total_weight_kg,
      totalWeightDisplay: row.total_weight_kg, // caller converts
      totalWeightUnit: 'KG',
      cgPosition: row.cg_position,
      cgRange: { forward: 0, aft: 0 }, // populated from config
      cgTarget: 0,
      payloadUtilization: row.payload_utilization,
      aircraftMaxPayloadKg: 0, // populated from config
      remarks: row.remarks_json ? JSON.parse(row.remarks_json) : [],
      specialCargo: [],
      notocRequired: row.notoc_required === 1,
      notocItems: row.notoc_items_json ? JSON.parse(row.notoc_items_json) : [],
      cargoMode: row.cargo_mode,
      primaryCategory: row.primary_category,
      createdAt: row.created_at,
    };
  }
}
```

**Step 2: Create cargo route**

`backend/src/routes/cargo.ts`:

```typescript
import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { CargoService } from '../services/cargo.js';

export function cargoRouter(): Router {
  const router = Router();
  const service = new CargoService();

  // Generate cargo manifest for a flight
  router.post('/cargo/generate', authMiddleware, (req, res) => {
    try {
      const userId = req.user!.userId;
      const { flightId, aircraftIcao, payloadKg, payloadUnit, cargoMode, primaryCategory, useRealWorldCompanies } = req.body;

      if (!flightId || !aircraftIcao || !payloadKg) {
        return res.status(400).json({ error: 'flightId, aircraftIcao, and payloadKg are required' });
      }

      const manifest = service.generate({
        flightId,
        aircraftIcao,
        payloadKg,
        payloadUnit: payloadUnit || 'KGS',
        cargoMode: cargoMode || 'mixed',
        primaryCategory,
        useRealWorldCompanies,
      }, userId);

      return res.json(manifest);
    } catch (err) {
      console.error('[Cargo] Generate error:', err);
      return res.status(500).json({ error: 'Failed to generate cargo manifest' });
    }
  });

  // Get cargo manifest for a flight
  router.get('/cargo/:flightId', authMiddleware, (req, res) => {
    try {
      const flightId = parseInt(req.params.flightId, 10);
      if (isNaN(flightId)) {
        return res.status(400).json({ error: 'Invalid flight ID' });
      }

      const manifest = service.getByFlightId(flightId);
      if (!manifest) {
        return res.status(404).json({ error: 'No cargo manifest found for this flight' });
      }

      return res.json(manifest);
    } catch (err) {
      console.error('[Cargo] Get error:', err);
      return res.status(500).json({ error: 'Failed to get cargo manifest' });
    }
  });

  // Delete cargo manifest (for regeneration)
  router.delete('/cargo/:manifestId', authMiddleware, (req, res) => {
    try {
      const userId = req.user!.userId;
      const manifestId = parseInt(req.params.manifestId, 10);
      if (isNaN(manifestId)) {
        return res.status(400).json({ error: 'Invalid manifest ID' });
      }

      const deleted = service.delete(manifestId, userId);
      if (!deleted) {
        return res.status(404).json({ error: 'Manifest not found or not owned by user' });
      }

      return res.json({ success: true });
    } catch (err) {
      console.error('[Cargo] Delete error:', err);
      return res.status(500).json({ error: 'Failed to delete cargo manifest' });
    }
  });

  return router;
}
```

**Step 3: Register route in index.ts**

In `backend/src/index.ts`, add alongside the other route imports:

```typescript
import { cargoRouter } from './routes/cargo.js';
```

And register it with the other business logic routes:

```typescript
app.use('/api', cargoRouter());
```

**Step 4: Build and test**

Run: `cd backend && npx tsc --noEmit`
Expected: No type errors.

Run: `npm run dev:all` and test with curl:
```bash
# Should return 401 (auth required)
curl -s http://localhost:8000/api/cargo/1
```

**Step 5: Commit**

```bash
git add backend/src/services/cargo.ts backend/src/routes/cargo.ts backend/src/index.ts
git commit -m "feat(cargo): add cargo service, REST endpoints, and route registration"
```

---

## Task 6: Frontend Cargo Store

**Files:**
- Create: `frontend/src/stores/cargoStore.ts`

**Step 1: Create the Zustand store**

```typescript
import { create } from 'zustand';
import type { CargoConfig, CargoManifest, CargoCategoryCode } from '@acars/shared';

interface CargoState {
  // Configuration (user preferences)
  config: CargoConfig;
  setCargoMode: (mode: CargoConfig['cargoMode']) => void;
  setPrimaryCategory: (cat: CargoCategoryCode) => void;
  setUseRealWorldCompanies: (use: boolean) => void;

  // Generated manifest
  manifest: CargoManifest | null;
  setManifest: (m: CargoManifest | null) => void;

  // Loading state
  generating: boolean;
  setGenerating: (g: boolean) => void;

  // Reset
  clearCargo: () => void;
}

export const useCargoStore = create<CargoState>((set) => ({
  config: {
    cargoMode: 'mixed',
    primaryCategory: 'general_freight',
    useRealWorldCompanies: false,
  },
  setCargoMode: (mode) => set((s) => ({ config: { ...s.config, cargoMode: mode } })),
  setPrimaryCategory: (cat) => set((s) => ({ config: { ...s.config, primaryCategory: cat } })),
  setUseRealWorldCompanies: (use) => set((s) => ({ config: { ...s.config, useRealWorldCompanies: use } })),

  manifest: null,
  setManifest: (m) => set({ manifest: m }),

  generating: false,
  setGenerating: (g) => set({ generating: g }),

  clearCargo: () => set({ manifest: null, generating: false }),
}));
```

**Step 2: Commit**

```bash
git add frontend/src/stores/cargoStore.ts
git commit -m "feat(cargo): add Zustand cargo store for config and manifest state"
```

---

## Task 7: Frontend — Cargo Config Panel (Planning Left Panel)

**Files:**
- Create: `frontend/src/components/cargo/CargoConfigPanel.tsx`
- Modify: `frontend/src/components/planning/PlanningLeftPanel.tsx`

**Step 1: Create CargoConfigPanel**

A collapsible section for the planning left panel. Uses `CollapsibleSection` component like other planning sections. Shows cargo mode (mixed/single), category dropdown (when single), and real-world companies checkbox.

```typescript
import { Package } from 'lucide-react';
import { CollapsibleSection } from '../common/CollapsibleSection';
import { useCargoStore } from '../../stores/cargoStore';

const CATEGORY_OPTIONS: { value: string; label: string }[] = [
  { value: 'general_freight', label: 'General Freight' },
  { value: 'pharmaceuticals', label: 'Pharmaceuticals' },
  { value: 'seafood', label: 'Seafood & Perishables' },
  { value: 'electronics', label: 'Electronics' },
  { value: 'industrial_machinery', label: 'Industrial Machinery' },
  { value: 'automotive', label: 'Automotive Parts' },
  { value: 'textiles', label: 'Textiles & Garments' },
  { value: 'dangerous_goods', label: 'Dangerous Goods' },
  { value: 'live_animals', label: 'Live Animals' },
  { value: 'ecommerce', label: 'E-Commerce' },
];

export function CargoConfigPanel() {
  const { config, setCargoMode, setPrimaryCategory, setUseRealWorldCompanies } = useCargoStore();

  return (
    <CollapsibleSection
      title="Cargo"
      icon={<Package className="w-3.5 h-3.5" />}
      status="grey"
    >
      <div className="space-y-2">
        <div>
          <label className="planning-label">Mode</label>
          <select
            value={config.cargoMode}
            onChange={(e) => setCargoMode(e.target.value as 'mixed' | 'single')}
            className="planning-input"
          >
            <option value="mixed">Mixed Freight</option>
            <option value="single">Single Commodity</option>
          </select>
        </div>

        {config.cargoMode === 'single' && (
          <div>
            <label className="planning-label">Category</label>
            <select
              value={config.primaryCategory}
              onChange={(e) => setPrimaryCategory(e.target.value as any)}
              className="planning-input"
            >
              {CATEGORY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        )}

        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={config.useRealWorldCompanies}
            onChange={(e) => setUseRealWorldCompanies(e.target.checked)}
            className="accent-blue-500"
          />
          <span className="text-[10px] text-acars-muted font-sans">Include real-world company names</span>
        </label>

        <p className="text-[9px] text-acars-muted/60 font-sans">
          Cargo generates automatically with OFP
        </p>
      </div>
    </CollapsibleSection>
  );
}
```

**Step 2: Add to PlanningLeftPanel**

In `frontend/src/components/planning/PlanningLeftPanel.tsx`, import and add between `PlanningWeightsSection` and `PlanningSimBriefSection`:

```typescript
import { CargoConfigPanel } from '../cargo/CargoConfigPanel';
```

Insert `<CargoConfigPanel />` after `<PlanningWeightsSection />` and before `<PlanningSimBriefSection />`.

**Step 3: Commit**

```bash
git add frontend/src/components/cargo/CargoConfigPanel.tsx frontend/src/components/planning/PlanningLeftPanel.tsx
git commit -m "feat(cargo): add cargo config panel to planning left sidebar"
```

---

## Task 8: Frontend — Load Summary Component

**Files:**
- Create: `frontend/src/components/cargo/LoadSummary.tsx`

**Step 1: Create LoadSummary**

Displays payload utilization bar, CG position visualization, and deck breakdown. Receives `CargoManifest` as prop. Uses inline styles and Tailwind — no external chart library needed (simple SVG/div bars).

Key sections:
1. **Total cargo weight** — large number + progress bar showing utilization %
2. **CG position** — horizontal bar with forward/aft limits, target marker, current position indicator
3. **Deck utilization** — 4 rows (main deck, fwd lower, aft lower, bulk) each with name, weight, and utilization bar

Style: matches existing aviation design system — `text-[11px]`, `font-mono`, `bg-acars-panel`, progress bars use `bg-blue-500` fill on `bg-acars-input` track.

Weight display: respect the `totalWeightUnit` field — show in LBS or KG based on user's SimBrief unit preference.

**Step 2: Commit**

```bash
git add frontend/src/components/cargo/LoadSummary.tsx
git commit -m "feat(cargo): add LoadSummary component with utilization and CG visualization"
```

---

## Task 9: Frontend — ULD Manifest Component

**Files:**
- Create: `frontend/src/components/cargo/ULDManifest.tsx`

**Step 1: Create ULDManifest**

Table displaying all ULDs with columns: ULD ID, Type, Position, Weight, AWB, Description, Special indicators.

Key features:
- Compact table with `text-[10px]` font, `font-mono` for IDs/numbers
- Temp-controlled items show blue snowflake indicator
- Hazmat items show amber warning indicator
- Lithium battery items show note
- Footer row with total ULD count and manifest number
- Scrollable if many ULDs

Style: standard table with `border-acars-border` separators, alternating row backgrounds via `even:bg-acars-bg/30`.

**Step 2: Commit**

```bash
git add frontend/src/components/cargo/ULDManifest.tsx
git commit -m "feat(cargo): add ULD manifest table component"
```

---

## Task 10: Frontend — NOTOC Section Component

**Files:**
- Create: `frontend/src/components/cargo/NOTOCSection.tsx`

**Step 1: Create NOTOCSection**

Conditional component — only renders if `manifest.notocRequired` is true. Shows:
- Amber warning header: "NOTOC — Dangerous Goods / Special Cargo"
- Table of NOTOC items: ULD ID, Position, Shipping Name, UN Number, Class, Packing Group
- Handling instructions (static text)
- "SIMULATION ONLY" disclaimer in small muted text

Style: amber-tinted header (`bg-amber-500/10 border-amber-500/30`), table matches ULDManifest style.

**Step 2: Commit**

```bash
git add frontend/src/components/cargo/NOTOCSection.tsx
git commit -m "feat(cargo): add NOTOC section for dangerous goods"
```

---

## Task 11: Frontend — Planning Cargo Tab

**Files:**
- Create: `frontend/src/components/cargo/PlanningCargoTab.tsx`
- Modify: `shared/src/types/flight-planning.ts` (add 'cargo' to PlanningInfoTab)
- Modify: `frontend/src/components/planning/PlanningInfoPanel.tsx` (add tab)

**Step 1: Create PlanningCargoTab**

Scrollable container showing LoadSummary, ULDManifest, and NOTOCSection stacked vertically. Reads from `useCargoStore`. Shows empty state "Generate OFP to see cargo manifest" when no manifest.

```typescript
import { useCargoStore } from '../../stores/cargoStore';
import { LoadSummary } from './LoadSummary';
import { ULDManifest } from './ULDManifest';
import { NOTOCSection } from './NOTOCSection';

export function PlanningCargoTab() {
  const { manifest, generating } = useCargoStore();

  if (generating) {
    return (
      <div className="flex items-center justify-center h-32">
        <span className="text-[11px] text-acars-muted font-sans animate-pulse">Generating cargo manifest...</span>
      </div>
    );
  }

  if (!manifest) {
    return (
      <div className="flex items-center justify-center h-32">
        <span className="text-[11px] text-acars-muted font-sans">Generate OFP to see cargo manifest</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <LoadSummary manifest={manifest} />
      <ULDManifest manifest={manifest} />
      {manifest.notocRequired && <NOTOCSection manifest={manifest} />}
    </div>
  );
}
```

**Step 2: Add 'cargo' to PlanningInfoTab type**

In `shared/src/types/flight-planning.ts`, update:

```typescript
export type PlanningInfoTab = 'weather' | 'notam' | 'airport-info' | 'ofp' | 'weight-balance' | 'flight-log' | 'cargo';
```

**Step 3: Add tab to PlanningInfoPanel**

In `frontend/src/components/planning/PlanningInfoPanel.tsx`:

Import:
```typescript
import { PlanningCargoTab } from '../cargo/PlanningCargoTab';
```

Add to TABS array:
```typescript
{ id: 'cargo', label: 'Cargo' },
```

Add render case:
```typescript
{planningTab === 'cargo' && <PlanningCargoTab />}
```

**Step 4: Rebuild shared types**

Run: `cd shared && npx tsc`

**Step 5: Commit**

```bash
git add frontend/src/components/cargo/PlanningCargoTab.tsx shared/src/types/flight-planning.ts frontend/src/components/planning/PlanningInfoPanel.tsx
git commit -m "feat(cargo): add Cargo tab to planning info panel"
```

---

## Task 12: Frontend — Dispatch Cargo Tab

**Files:**
- Create: `frontend/src/components/cargo/CargoTab.tsx`
- Modify: `frontend/src/stores/uiStore.ts` (add 'cargo' to InfoTab)
- Modify: `frontend/src/components/info-panel/InfoPanel.tsx` (add tab)

**Step 1: Create CargoTab**

Same layout as PlanningCargoTab but reads manifest from `useCargoStore`. The dispatch page will populate the store from the API on flight selection.

**Step 2: Add 'cargo' to InfoTab**

In `frontend/src/stores/uiStore.ts`, add `| 'cargo'` to the `InfoTab` type.

**Step 3: Add tab to InfoPanel**

In `frontend/src/components/info-panel/InfoPanel.tsx`:

Import:
```typescript
import { CargoTab } from '../cargo/CargoTab';
```

Add to TABS array:
```typescript
{ id: 'cargo', label: 'Cargo' },
```

Add render case in `renderTab()`:
```typescript
case 'cargo':
  return <CargoTab />;
```

**Step 4: Commit**

```bash
git add frontend/src/components/cargo/CargoTab.tsx frontend/src/stores/uiStore.ts frontend/src/components/info-panel/InfoPanel.tsx
git commit -m "feat(cargo): add Cargo tab to dispatch info panel"
```

---

## Task 13: Hook Cargo Generation into OFP Flow

**Files:**
- Modify: `frontend/src/components/planning/useSimBrief.ts`

This is the critical integration point. After an OFP is successfully fetched, automatically generate the cargo manifest.

**Step 1: Add cargo generation to fetchOFP**

In `useSimBrief.ts`, after the OFP is applied and auto-saved (around line 228), add cargo generation:

```typescript
import { useCargoStore } from '../../stores/cargoStore';
import { api } from '../../lib/api';

// Inside fetchOFP, after the auto-save block:
// Auto-generate cargo manifest
const cargoConfig = useCargoStore.getState().config;
const payloadWeight = ofp.weights.payload || 0;
const aircraftIcao = ofp.aircraftType || mergedForm.aircraftType || '';

if (payloadWeight > 0 && aircraftIcao && bidId) {
  useCargoStore.getState().setGenerating(true);
  api.post<CargoManifest>('/api/cargo/generate', {
    flightId: bidId,
    aircraftIcao,
    payloadKg: mergedForm.units === 'KGS' ? payloadWeight : payloadWeight / 2.20462,
    payloadUnit: mergedForm.units || 'LBS',
    cargoMode: cargoConfig.cargoMode,
    primaryCategory: cargoConfig.cargoMode === 'single' ? cargoConfig.primaryCategory : undefined,
    useRealWorldCompanies: cargoConfig.useRealWorldCompanies,
  })
    .then((manifest) => useCargoStore.getState().setManifest(manifest))
    .catch((err) => console.error('[Cargo] Auto-generate failed:', err))
    .finally(() => useCargoStore.getState().setGenerating(false));
}
```

This fires-and-forgets (non-blocking) after the OFP save so the user sees OFP data immediately while cargo generates in the background.

**Step 2: Also trigger in generateOrFetchOFP (fresh OFP path)**

The same cargo generation block should also appear in the `generateOrFetchOFP` callback's fresh-OFP code path (around line 458).

**Step 3: Commit**

```bash
git add frontend/src/components/planning/useSimBrief.ts
git commit -m "feat(cargo): auto-generate cargo manifest after OFP fetch"
```

---

## Task 14: Load Cargo on Dispatch Page

**Files:**
- Modify: `frontend/src/pages/DispatchPage.tsx`

**Step 1: Fetch cargo manifest when flight is selected**

In `DispatchPage.tsx`, in the effect that loads flight data (where `setFlightPlan` is called), add a cargo fetch:

```typescript
import { useCargoStore } from '../stores/cargoStore';

// After the flight plan is loaded:
// Load cargo manifest if available
api.get<CargoManifest>(`/api/cargo/${selectedFlight.id}`)
  .then((manifest) => useCargoStore.getState().setManifest(manifest))
  .catch(() => useCargoStore.getState().setManifest(null)); // No manifest yet — that's OK
```

**Step 2: Clear cargo on unmount**

In the cleanup effect, add:
```typescript
useCargoStore.getState().clearCargo();
```

**Step 3: Commit**

```bash
git add frontend/src/pages/DispatchPage.tsx
git commit -m "feat(cargo): load cargo manifest on dispatch page flight selection"
```

---

## Task 15: Dispatch Page — Cargo Summary Row

**Files:**
- Create: `frontend/src/components/cargo/CargoSummaryRow.tsx`
- Modify: `frontend/src/components/flight-plan/FlightPlanPanel.tsx`

**Step 1: Create CargoSummaryRow**

A collapsible summary row matching the existing Aircraft/MEL/Fuel/Terrain rows in the dispatch left panel. Uses the same `CollapsibleSection` pattern.

Header shows: "Cargo" with ULD count badge
Expanded shows: manifest number, total weight, utilization %, special cargo flags, CG position.

```typescript
import { Package } from 'lucide-react';
import { useCargoStore } from '../../stores/cargoStore';

export function CargoSummaryRow() {
  const manifest = useCargoStore((s) => s.manifest);
  if (!manifest) return null;

  const uldCount = manifest.ulds.length;
  const specialCount = manifest.specialCargo?.length ?? 0;
  const unit = manifest.totalWeightUnit === 'KGS' ? 'kg' : 'lbs';
  const displayWeight = Math.round(manifest.totalWeightDisplay).toLocaleString();

  return (
    <div className="border-b border-acars-border">
      <div className="flex items-center h-8 px-3">
        <svg className="w-3 h-3 text-[#22c55e] shrink-0 mr-2" /* checkmark */ />
        <Package className="w-3 h-3 text-blue-400 mr-1.5" />
        <span className="text-[11px] font-sans text-[#949aa2]">Cargo</span>
        <span className="ml-auto text-[11px] font-mono text-[#cdd1d8]">
          {uldCount} ULDs
        </span>
      </div>
      <div className="px-3 pb-2 space-y-1">
        <div className="flex justify-between text-[10px]">
          <span className="text-acars-muted font-sans">Manifest</span>
          <span className="font-mono text-acars-text">{manifest.manifestNumber}</span>
        </div>
        <div className="flex justify-between text-[10px]">
          <span className="text-acars-muted font-sans">Total</span>
          <span className="font-mono text-acars-text">{displayWeight} {unit} ({manifest.payloadUtilization}%)</span>
        </div>
        {manifest.notocRequired && (
          <div className="flex justify-between text-[10px]">
            <span className="text-amber-400 font-sans">NOTOC</span>
            <span className="font-mono text-amber-400">{manifest.notocItems.length} DG items</span>
          </div>
        )}
        <div className="flex justify-between text-[10px]">
          <span className="text-acars-muted font-sans">CG</span>
          <span className="font-mono text-acars-text">{manifest.cgPosition}% MAC</span>
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Add to FlightPlanPanel**

In `frontend/src/components/flight-plan/FlightPlanPanel.tsx`, import and add after `<TerrainSection>`:

```typescript
import { CargoSummaryRow } from '../cargo/CargoSummaryRow';
// ...
<CargoSummaryRow />
```

**Step 3: Commit**

```bash
git add frontend/src/components/cargo/CargoSummaryRow.tsx frontend/src/components/flight-plan/FlightPlanPanel.tsx
git commit -m "feat(cargo): add cargo summary row to dispatch left panel"
```

---

## Task 16: Logbook Integration

**Files:**
- Modify: `shared/src/types/logbook.ts` (add cargo fields to LogbookEntry)
- Modify: backend logbook service (link cargo_manifest_id on flight completion)

**Step 1: Add cargo fields to LogbookEntry type**

In `shared/src/types/logbook.ts`, add optional fields:

```typescript
cargoManifestId?: number;
cargoWeightKg?: number;
cargoUldCount?: number;
cargoNotocRequired?: boolean;
```

**Step 2: Update logbook query to include cargo data**

In the backend logbook service/route, when building logbook entries, LEFT JOIN on `cargo_manifests`:

```sql
SELECT l.*, cm.id as cargo_manifest_id, cm.total_weight_kg as cargo_weight_kg,
  (SELECT COUNT(*) FROM json_each(cm.ulds_json)) as cargo_uld_count,
  cm.notoc_required as cargo_notoc_required
FROM logbook l
LEFT JOIN cargo_manifests cm ON cm.id = l.cargo_manifest_id
WHERE ...
```

**Step 3: Link manifest on flight completion**

In the backend flight completion handler (where logbook entries are created), after inserting the logbook row, find the matching cargo manifest and link it:

```typescript
// After logbook entry created with id = logbookId:
const manifest = cargoService.getByFlightId(flightId);
if (manifest) {
  cargoService.linkToLogbook(logbookId, manifest.id);
}
```

**Step 4: Rebuild shared**

Run: `cd shared && npx tsc`

**Step 5: Commit**

```bash
git add shared/src/types/logbook.ts backend/src/services/ backend/src/routes/
git commit -m "feat(cargo): link cargo manifests to logbook entries on flight completion"
```

---

## Task 17: Visual Polish & Testing

**Files:**
- All cargo components (visual review)
- Run full app

**Step 1: Run the app**

Run: `npm run dev:all`

**Step 2: Test planning page flow**

1. Go to Flight Planning
2. Verify "Cargo" section appears in left panel between Weights and SimBrief Options
3. Set cargo mode to "Single Commodity" — verify category dropdown appears
4. Generate an OFP via SimBrief
5. After OFP loads, switch to "Cargo" tab — verify manifest appears with:
   - Load Summary (utilization bar, CG visual, deck breakdown)
   - ULD Manifest table
   - NOTOC section (if DG cargo was generated)

**Step 3: Test dispatch page flow**

1. Start a flight (creates dispatch entry)
2. Navigate to Dispatch page
3. Verify Cargo Summary Row appears in left panel
4. Switch to "Cargo" tab in info panel — verify same data displays

**Step 4: Test regeneration**

1. On planning page, regenerate OFP
2. Verify cargo manifest regenerates (old one deleted, new one created)
3. Switch to Cargo tab — verify updated data

**Step 5: Commit any fixes**

```bash
git add -A
git commit -m "fix(cargo): visual polish and integration fixes"
```

---

## Summary of All Files

### New Files (18)
| File | Purpose |
|------|---------|
| `shared/src/types/cargo.ts` | Shared cargo types |
| `backend/src/db/migrations/020-cargo-manifests.sql` | DB schema |
| `backend/src/services/cargo/aircraft-configs.ts` | 13 aircraft ULD configs |
| `backend/src/services/cargo/cargo-categories.ts` | 10 cargo categories |
| `backend/src/services/cargo/company-data.ts` | Shipper/consignee pools |
| `backend/src/services/cargo/cargo-generator.ts` | Distribution engine |
| `backend/src/services/cargo/validation-engine.ts` | Structural validation |
| `backend/src/services/cargo/index.ts` | Barrel export |
| `backend/src/services/cargo.ts` | Cargo service layer |
| `backend/src/routes/cargo.ts` | REST endpoints |
| `frontend/src/stores/cargoStore.ts` | Zustand cargo store |
| `frontend/src/components/cargo/CargoConfigPanel.tsx` | Planning config UI |
| `frontend/src/components/cargo/LoadSummary.tsx` | Utilization + CG visual |
| `frontend/src/components/cargo/ULDManifest.tsx` | ULD table |
| `frontend/src/components/cargo/NOTOCSection.tsx` | Dangerous goods |
| `frontend/src/components/cargo/PlanningCargoTab.tsx` | Planning tab content |
| `frontend/src/components/cargo/CargoTab.tsx` | Dispatch tab content |
| `frontend/src/components/cargo/CargoSummaryRow.tsx` | Dispatch summary row |

### Modified Files (8)
| File | Change |
|------|--------|
| `shared/src/index.ts` | Export cargo types |
| `shared/src/types/flight-planning.ts` | Add 'cargo' to PlanningInfoTab |
| `backend/src/index.ts` | Register cargo route |
| `frontend/src/stores/uiStore.ts` | Add 'cargo' to InfoTab |
| `frontend/src/components/planning/PlanningLeftPanel.tsx` | Add CargoConfigPanel |
| `frontend/src/components/planning/PlanningInfoPanel.tsx` | Add Cargo tab |
| `frontend/src/components/info-panel/InfoPanel.tsx` | Add Cargo tab |
| `frontend/src/components/planning/useSimBrief.ts` | Auto-generate cargo after OFP |
| `frontend/src/pages/DispatchPage.tsx` | Load cargo on flight select |
| `frontend/src/components/flight-plan/FlightPlanPanel.tsx` | Add CargoSummaryRow |
| `shared/src/types/logbook.ts` | Add cargo fields |
