# Dispatch Page Functional Fields — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make existing dispatch page fields functional — runway dropdowns from DB, SID/STAR text inputs, alternate airport search modal, editable aircraft/cruise/CI/AOB fields, PIC auto-fill from SimBrief, and route repositioned above nav procedures.

**Architecture:** The dispatch panel lives at `frontend/src/components/flight-plan/FlightPlanPanel.tsx` and renders inside `AppShell`. Fields currently use hardcoded "AUTO" values. We add a backend search endpoint, wire runway data via existing `/api/airports/:icao`, extend `FlightPlanFormData` with new fields, and update the `NavProcedureRow` and `AircraftSection` components to be interactive. All editable fields integrate with `DispatchEditContext` for auto-save.

**Tech Stack:** React 19, Zustand, TypeScript, Express, better-sqlite3, Tailwind CSS

---

### Task 1: Backend — Add airport search endpoint

**Files:**
- Modify: `backend/src/services/airport-detail.ts`
- Modify: `backend/src/routes/airports.ts`

**Step 1: Add `search` method to `AirportDetailService`**

In `backend/src/services/airport-detail.ts`, add after `getByIcao` method (after line 176):

```typescript
/** Search airports by ICAO prefix, IATA code, or name (case-insensitive). */
searchAirports(query: string, limit = 10): AirportSearchResult[] {
  const db = getDb();
  const pattern = `%${query}%`;
  const upperQuery = query.toUpperCase();
  return db.prepare(
    `SELECT ident, name, iata_code, municipality, iso_country
     FROM oa_airports
     WHERE (ident LIKE ? OR iata_code LIKE ? OR UPPER(name) LIKE ?)
       AND type IN ('large_airport', 'medium_airport', 'small_airport')
     ORDER BY
       CASE WHEN ident = ? THEN 0 WHEN ident LIKE ? THEN 1 ELSE 2 END,
       length_ft DESC NULLS LAST
     LIMIT ?`,
  ).all(upperQuery + '%', upperQuery + '%', pattern.toUpperCase(), upperQuery, upperQuery + '%', limit) as AirportSearchResult[];
}
```

Add the interface near the top public types section:

```typescript
export interface AirportSearchResult {
  ident: string;
  name: string;
  iata_code: string | null;
  municipality: string | null;
  iso_country: string | null;
}
```

**Step 2: Add route in `backend/src/routes/airports.ts`**

Add before the `/:icao` route (to avoid param collision):

```typescript
// GET /api/airports/search?q=<query>&limit=10
router.get('/airports/search', (req, res) => {
  try {
    const q = (req.query.q as string || '').trim();
    if (q.length < 2) {
      return res.json([]);
    }
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);
    const results = service.searchAirports(q, limit);
    return res.json(results);
  } catch (err) {
    console.error('[AirportDetail] Search error:', err);
    return res.status(500).json({ error: 'Failed to search airports' });
  }
});
```

**Step 3: Verify** — `curl http://localhost:3001/api/airports/search?q=KJFK` returns results.

**Step 4: Commit** — `feat: add airport search endpoint`

---

### Task 2: Shared types — Extend FlightPlanFormData with new fields

**Files:**
- Modify: `shared/src/types/flight-planning.ts`
- Modify: `frontend/src/stores/flightPlanStore.ts` (emptyForm)
- Modify: `frontend/src/components/planning/simbrief-parser.ts` (ofpToFormFields + parseSimBriefResponse)

**Step 1: Add fields to `FlightPlanFormData`** in `shared/src/types/flight-planning.ts` (after line 130, before `melRestrictions`):

```typescript
  depRunway: string;
  arrRunway: string;
  sid: string;
  star: string;
  aobFL: string;
  pic: string;
```

**Step 2: Add fields to `emptyForm`** in `frontend/src/stores/flightPlanStore.ts` (after `cargoLbs: ''`):

```typescript
  depRunway: '',
  arrRunway: '',
  sid: '',
  star: '',
  aobFL: '',
  pic: '',
```

**Step 3: Parse pilot name from SimBrief and map new fields**

In `simbrief-parser.ts` `parseSimBriefResponse`:
- SimBrief JSON has `crew.cpt` field for pilot name. Add to `SimBriefOFP` interface in shared types:

Add to `SimBriefOFP` interface (after `rawText: string;`):
```typescript
  pilotName: string;
```

In `parseSimBriefResponse` (around line 153), extract pilot name:
```typescript
const crew = json.crew ?? {};
const pilotName = toStr(crew.cpt) || toStr(general.pilot);
```

Add `pilotName` to the return object.

In `ofpToFormFields`, add mapping:
```typescript
  pic: ofp.pilotName || '',
```

**Step 4: Rebuild shared types** — `npx tsc -p shared/tsconfig.json`

**Step 5: Commit** — `feat: extend FlightPlanFormData with runway/SID/STAR/PIC fields`

---

### Task 3: Frontend — Rewrite NavProcedureRow with functional fields

**Files:**
- Modify: `frontend/src/components/flight-plan/NavProcedureRow.tsx`
- Modify: `frontend/src/components/flight-plan/FlightPlanPanel.tsx` (move RouteSection, pass props)

**Step 1: Rewrite `NavProcedureRow.tsx`**

The component needs to:
- Accept `originIcao`, `destIcao`, `formData` as props
- Fetch runways from `/api/airports/:icao` for both origin and destination
- Populate departure runway dropdown from origin runways
- Populate arrival runway dropdown from destination runways
- SID and STAR as text inputs
- Dest Alt 1/2 as text inputs with search icon that opens modal
- All fields wired to `DispatchEditContext.onFieldChange`

```typescript
import { useState, useEffect } from 'react';
import { Search } from 'lucide-react';
import { api } from '../../lib/api';
import { useDispatchEdit } from '../../contexts/DispatchEditContext';
import type { FlightPlanFormData } from '@acars/shared';

interface AirportRunway {
  le_ident: string;
  he_ident: string;
  length_ft: number;
  width_ft: number;
  surface: string;
  lighted: boolean;
}

interface NavProcedureRowProps {
  formData?: FlightPlanFormData | null;
  onOpenAltSearch?: (field: 'alternate1' | 'alternate2') => void;
}

export function NavProcedureRow({ formData, onOpenAltSearch }: NavProcedureRowProps) {
  const { canEdit, editableFields, onFieldChange } = useDispatchEdit();
  const [originRunways, setOriginRunways] = useState<string[]>([]);
  const [destRunways, setDestRunways] = useState<string[]>([]);

  const origin = formData?.origin ?? '';
  const dest = formData?.destination ?? '';

  // Fetch runways when origin changes
  useEffect(() => {
    if (origin.length === 4) {
      api.get<{ runways: AirportRunway[] }>(`/api/airports/${origin}`)
        .then((data) => {
          const rwys = (data.runways ?? []).flatMap((r) => {
            const entries: string[] = [];
            if (r.le_ident) entries.push(`${r.le_ident} (${r.length_ft.toLocaleString()}ft)`);
            if (r.he_ident) entries.push(`${r.he_ident} (${r.length_ft.toLocaleString()}ft)`);
            return entries;
          });
          setOriginRunways(rwys);
        })
        .catch(() => setOriginRunways([]));
    } else {
      setOriginRunways([]);
    }
  }, [origin]);

  // Fetch runways when destination changes
  useEffect(() => {
    if (dest.length === 4) {
      api.get<{ runways: AirportRunway[] }>(`/api/airports/${dest}`)
        .then((data) => {
          const rwys = (data.runways ?? []).flatMap((r) => {
            const entries: string[] = [];
            if (r.le_ident) entries.push(`${r.le_ident} (${r.length_ft.toLocaleString()}ft)`);
            if (r.he_ident) entries.push(`${r.he_ident} (${r.length_ft.toLocaleString()}ft)`);
            return entries;
          });
          setDestRunways(rwys);
        })
        .catch(() => setDestRunways([]));
    } else {
      setDestRunways([]);
    }
  }, [dest]);

  const depRunway = editableFields.depRunway ?? formData?.depRunway ?? '';
  const arrRunway = editableFields.arrRunway ?? formData?.arrRunway ?? '';
  const sid = editableFields.sid ?? formData?.sid ?? '';
  const star = editableFields.star ?? formData?.star ?? '';
  const alt1 = editableFields.alternate1 ?? formData?.alternate1 ?? '';
  const alt2 = editableFields.alternate2 ?? formData?.alternate2 ?? '';

  const selectCls = "bg-acars-input border border-acars-border text-[11px] font-mono text-[#cdd1d8] rounded-md px-1.5 py-0.5 outline-none focus:border-blue-400 truncate w-full";
  const inputCls = selectCls;

  return (
    <div className="border-b border-acars-border px-3 py-2">
      <div className="flex items-end gap-1.5">
        {/* Departure Runway */}
        <div className="flex flex-col min-w-0 flex-1">
          <span className="text-[9px] font-sans text-[#656b75] mb-0.5">Runway</span>
          <select
            value={depRunway}
            onChange={(e) => onFieldChange('depRunway', e.target.value)}
            disabled={!canEdit}
            className={selectCls}
          >
            <option value="">AUTO</option>
            {originRunways.map((r) => <option key={r} value={r.split(' ')[0]}>{r}</option>)}
          </select>
        </div>

        {/* SID */}
        <div className="flex flex-col min-w-0 flex-1">
          <span className="text-[9px] font-sans text-[#656b75] mb-0.5">SID</span>
          <input
            type="text"
            value={sid}
            onChange={(e) => onFieldChange('sid', e.target.value.toUpperCase())}
            disabled={!canEdit}
            placeholder="---"
            className={inputCls}
          />
        </div>

        {/* STAR */}
        <div className="flex flex-col min-w-0 flex-1">
          <span className="text-[9px] font-sans text-[#656b75] mb-0.5">STAR</span>
          <input
            type="text"
            value={star}
            onChange={(e) => onFieldChange('star', e.target.value.toUpperCase())}
            disabled={!canEdit}
            placeholder="---"
            className={inputCls}
          />
        </div>

        {/* Arrival Runway */}
        <div className="flex flex-col min-w-0 flex-1">
          <span className="text-[9px] font-sans text-[#656b75] mb-0.5">Runway</span>
          <select
            value={arrRunway}
            onChange={(e) => onFieldChange('arrRunway', e.target.value)}
            disabled={!canEdit}
            className={selectCls}
          >
            <option value="">AUTO</option>
            {destRunways.map((r) => <option key={r} value={r.split(' ')[0]}>{r}</option>)}
          </select>
        </div>

        {/* Dest Alt 1 */}
        <div className="flex flex-col min-w-0 flex-1">
          <span className="text-[9px] font-sans text-[#656b75] mb-0.5">Dest Alt 1</span>
          <div className="flex gap-0.5">
            <input
              type="text"
              value={alt1}
              onChange={(e) => onFieldChange('alternate1', e.target.value.toUpperCase())}
              disabled={!canEdit}
              placeholder="---"
              maxLength={4}
              className={inputCls}
            />
            {canEdit && onOpenAltSearch && (
              <button onClick={() => onOpenAltSearch('alternate1')} className="text-[#656b75] hover:text-blue-400 shrink-0">
                <Search className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* Dest Alt 2 */}
        <div className="flex flex-col min-w-0 flex-1">
          <span className="text-[9px] font-sans text-[#656b75] mb-0.5">Dest Alt 2</span>
          <div className="flex gap-0.5">
            <input
              type="text"
              value={alt2}
              onChange={(e) => onFieldChange('alternate2', e.target.value.toUpperCase())}
              disabled={!canEdit}
              placeholder="---"
              maxLength={4}
              className={inputCls}
            />
            {canEdit && onOpenAltSearch && (
              <button onClick={() => onOpenAltSearch('alternate2')} className="text-[#656b75] hover:text-blue-400 shrink-0">
                <Search className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Commit** — `feat: functional runway dropdowns, SID/STAR inputs, alternate fields`

---

### Task 4: Frontend — Alternate airport search modal

**Files:**
- Create: `frontend/src/components/flight-plan/AirportSearchModal.tsx`
- Modify: `frontend/src/components/flight-plan/FlightPlanPanel.tsx`

**Step 1: Create `AirportSearchModal.tsx`**

Modal component with debounced search against `/api/airports/search`. Shows results list, click to select and close.

Key behavior:
- Text input with 300ms debounce
- Calls `GET /api/airports/search?q={query}&limit=10`
- Results show: ICAO (bold), name, municipality, country
- Click result → calls `onSelect(icao)` → closes modal
- Escape key or backdrop click closes modal

**Step 2: Wire modal into `FlightPlanPanel.tsx`**

Add state for `altSearchField` and `showAltSearch`. Pass `onOpenAltSearch` to `NavProcedureRow`. When modal selects, call `onFieldChange(altSearchField, icao)`.

**Step 3: Commit** — `feat: alternate airport search modal`

---

### Task 5: Frontend — Make AircraftSection fields editable

**Files:**
- Modify: `frontend/src/components/flight-plan/AircraftSection.tsx`

**Step 1: Rewrite `AircraftSection`**

Replace `readOnly` inputs with editable inputs wired to `DispatchEditContext`:
- Aircraft: read-only (comes from SimConnect/telemetry)
- Cruise FL: editable text input (from `editableFields.cruiseFL`)
- CI Value: editable text input (from `editableFields.costIndex`)
- AOB FL: editable text input (from `editableFields.aobFL`)
- PIC: editable text input (from `editableFields.pic`), auto-filled from SimBrief

```typescript
import { useDispatchEdit } from '../../contexts/DispatchEditContext';
import type { FlightPlanFormData } from '@acars/shared';

interface AircraftSectionProps {
  title: string;
  tailNumber: string;
  type: string;
  formData?: FlightPlanFormData | null;
}

export function AircraftSection({ title, tailNumber, type, formData }: AircraftSectionProps) {
  const { canEdit, editableFields, onFieldChange } = useDispatchEdit();

  const cruiseFL = editableFields.cruiseFL ?? formData?.cruiseFL ?? '';
  const costIdx = editableFields.costIndex ?? formData?.costIndex ?? '';
  const aobFL = editableFields.aobFL ?? formData?.aobFL ?? '';
  const pic = editableFields.pic ?? formData?.pic ?? '';

  const inputCls = "bg-acars-input border border-acars-border text-[11px] font-mono text-[#cdd1d8] rounded-md px-1.5 py-0.5 outline-none focus:border-blue-400 truncate w-full";

  return (
    <div className="border-b border-acars-border px-3 py-2 space-y-2">
      <div className="flex items-end gap-1.5">
        {/* Aircraft — read-only from SimConnect */}
        <div className="flex flex-col min-w-0 flex-[2]">
          <span className="text-[9px] font-sans text-[#656b75] mb-0.5">Aircraft</span>
          <input type="text" value={`${tailNumber} (${type})`} readOnly className={inputCls} />
        </div>
        {/* Cruise — editable */}
        <div className="flex flex-col min-w-0 flex-1">
          <span className="text-[9px] font-sans text-[#656b75] mb-0.5">Cruise</span>
          <input
            type="text" value={cruiseFL}
            onChange={(e) => onFieldChange('cruiseFL', e.target.value.toUpperCase())}
            disabled={!canEdit} placeholder="FL350" className={inputCls}
          />
        </div>
        {/* CI — editable */}
        <div className="flex flex-col min-w-0 flex-1">
          <span className="text-[9px] font-sans text-[#656b75] mb-0.5">CI Value</span>
          <input
            type="text" value={costIdx}
            onChange={(e) => onFieldChange('costIndex', e.target.value)}
            disabled={!canEdit} placeholder="0" className={inputCls}
          />
        </div>
        {/* AOB FL — editable */}
        <div className="flex flex-col min-w-0 flex-1">
          <span className="text-[9px] font-sans text-[#656b75] mb-0.5">AOB FL</span>
          <input
            type="text" value={aobFL}
            onChange={(e) => onFieldChange('aobFL', e.target.value.toUpperCase())}
            disabled={!canEdit} placeholder="FL350" className={inputCls}
          />
        </div>
      </div>
      {/* PIC — editable, auto-filled from SimBrief */}
      <div className="flex items-end gap-1.5">
        <div className="flex flex-col flex-1 min-w-0">
          <span className="text-[9px] font-sans text-[#656b75] mb-0.5">Pilot in Command</span>
          <input
            type="text"
            value={pic || (title !== '---' ? `${title} | PIC | Left Seat` : '---')}
            onChange={(e) => onFieldChange('pic', e.target.value)}
            disabled={!canEdit}
            className={inputCls}
          />
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Commit** — `feat: editable cruise/CI/AOB/PIC in AircraftSection`

---

### Task 6: Frontend — Move RouteSection above NavProcedureRow

**Files:**
- Modify: `frontend/src/components/flight-plan/FlightPlanPanel.tsx`

**Step 1:** In `FlightPlanPanel.tsx`, reorder components. Move `<RouteSection />` from the bottom collapsible group (line 71) to sit between `<ScenarioBar>` (line 47) and `<NavProcedureRow>` (line 50):

```tsx
{/* Item 3: Scenario + Flight Rules chips */}
<ScenarioBar formData={formData} ruleChips={ruleChips} />

{/* Route — moved above nav procedures */}
<RouteSection />

{/* Item 4: Runway / SID / STAR / Dest Alt */}
<NavProcedureRow formData={formData} onOpenAltSearch={handleOpenAltSearch} />
```

Remove the old `<RouteSection />` from the collapsible group below.

**Step 2: Commit** — `feat: reposition route above nav procedure row`

---

### Task 7: Integration test — verify full flow

**Steps:**
1. Start dev servers (`npm run dev:all`)
2. Navigate to dispatch page with an active bid
3. Verify runway dropdowns populate when origin/dest are set (4-char ICAO)
4. Verify SID/STAR text fields accept input
5. Verify alternate search modal opens, searches, and fills field
6. Verify cruise FL, CI, AOB FL are editable
7. Verify PIC auto-fills after OFP generation
8. Verify route section appears above runway/SID/STAR row
9. TypeScript compiles cleanly: `npx tsc --noEmit -p frontend/tsconfig.json`

**Step: Commit** — `feat: dispatch page functional fields complete`

---

### Task Order & Dependencies

```
Task 1 (backend search) ──────┐
Task 2 (shared types) ────────┤
                               ├── Task 3 (NavProcedureRow) ── Task 4 (search modal)
Task 5 (AircraftSection) ─────┤
Task 6 (move route) ──────────┘
                               └── Task 7 (integration test)
```

Tasks 1, 2, 5, 6 are independent and can be parallelized.
Tasks 3 and 4 depend on Tasks 1 and 2.
Task 7 is the final verification.
