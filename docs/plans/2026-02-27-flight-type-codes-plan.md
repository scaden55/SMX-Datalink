# Flight Type Codes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace `charter_type` with IATA `flight_type` letter codes across the entire stack, and unify the "Create Charter" button into a "Create" button with a flight type dropdown.

**Architecture:** SQLite migration renames `charter_type` → `flight_type` and maps old values. Shared types define `FlightType` union + `FLIGHT_TYPES` constant map. Backend validates against the 22 valid codes. Frontend replaces the 3-card charter type picker with a dropdown defaulting to `F` (Scheduled Cargo).

**Tech Stack:** TypeScript, SQLite (better-sqlite3), Express 4, React 19, @acars/shared

---

### Task 1: Database Migration

**Files:**
- Create: `backend/src/db/migrations/030-flight-type.sql`

**Step 1: Create migration file**

```sql
-- Rename charter_type column to flight_type
ALTER TABLE scheduled_flights RENAME COLUMN charter_type TO flight_type;

-- Migrate old string values to IATA letter codes
UPDATE scheduled_flights SET flight_type = 'F' WHERE flight_type = 'cargo';
UPDATE scheduled_flights SET flight_type = 'J' WHERE flight_type = 'passenger';
UPDATE scheduled_flights SET flight_type = 'P' WHERE flight_type = 'reposition';
UPDATE scheduled_flights SET flight_type = 'F' WHERE flight_type = 'generated';
UPDATE scheduled_flights SET flight_type = 'J' WHERE flight_type = 'event';
```

**Step 2: Commit**

```bash
git add backend/src/db/migrations/030-flight-type.sql
git commit -m "feat: add migration 030 — rename charter_type to flight_type with IATA code mapping"
```

---

### Task 2: Shared Types

**Files:**
- Modify: `shared/src/types/schedule.ts`

**Step 1: Replace `CharterType` with `FlightType` and add `FLIGHT_TYPES` constant**

At line 155, replace:
```typescript
export type CharterType = 'reposition' | 'cargo' | 'passenger' | 'generated' | 'event';
```

With:
```typescript
export type FlightType = 'J' | 'F' | 'C' | 'A' | 'E' | 'G' | 'H' | 'I' | 'K' | 'M' | 'O' | 'P' | 'T' | 'S' | 'B' | 'Q' | 'R' | 'L' | 'D' | 'N' | 'Y' | 'Z';

export const FLIGHT_TYPES: Record<FlightType, string> = {
  F: 'Scheduled Cargo',
  J: 'Scheduled Passenger',
  C: 'Charter Passenger',
  A: 'Additional/Supplemental Cargo',
  E: 'VIP',
  G: 'Additional/Supplemental Passenger',
  H: 'Charter Cargo',
  I: 'Ambulance',
  K: 'Training',
  M: 'Mail Service',
  O: 'Special Handling',
  P: 'Positioning',
  T: 'Technical Test',
  S: 'Shuttle',
  B: 'Additional/Supplemental Shuttle',
  Q: 'Combination Cargo/Passenger',
  R: 'Additional/Supplemental Combo',
  L: 'Special Charter',
  D: 'General Aviation',
  N: 'Air Taxi/Business',
  Y: 'Company-Specific',
  Z: 'Other',
};

export const VALID_FLIGHT_TYPE_CODES = new Set<string>(Object.keys(FLIGHT_TYPES));
```

**Step 2: Update interfaces — rename `charterType` → `flightType` and `CharterType` → `FlightType`**

In `ScheduledFlight` (line 169):
```
charterType: CharterType | null  →  flightType: FlightType | null
```

In `CreateCharterRequest` (line 184):
```
charterType: CharterType  →  flightType: FlightType
```

In `BidWithDetails` (line 216):
```
charterType: CharterType | null  →  flightType: FlightType | null
```

**Step 3: Remove all `CharterType` imports/usages — grep to confirm no remaining references**

**Step 4: Build shared to verify**

Run: `npx tsc -p shared/`
Expected: Compile errors in backend/frontend (expected — we fix those next)

**Step 5: Commit**

```bash
git add shared/src/types/schedule.ts
git commit -m "feat(shared): replace CharterType with FlightType IATA codes and FLIGHT_TYPES constant"
```

---

### Task 3: Backend — DB Row Types

**Files:**
- Modify: `backend/src/types/db-rows.ts:155`

**Step 1: Rename field in `ScheduledFlightRow`**

Line 155: `charter_type: string | null` → `flight_type: string | null`

**Step 2: Commit**

```bash
git add backend/src/types/db-rows.ts
git commit -m "fix(backend): rename charter_type to flight_type in ScheduledFlightRow"
```

---

### Task 4: Backend — Schedule Service

**Files:**
- Modify: `backend/src/services/schedule.ts`

**Step 1: Update imports (line 13)**

Replace `CharterType` with `FlightType` and `VALID_FLIGHT_TYPE_CODES` in the import from `@acars/shared`.

**Step 2: Rename `charter_type` → `flight_type` in all raw DB row interfaces**

- `ScheduleRow` (line 81): `charter_type` → `flight_type`
- `BidRow` (line 120): `charter_type` → `flight_type`

**Step 3: Rename `charterType` → `flightType` in `ScheduleFilters` (line 139)**

**Step 4: Update `findSchedules()` filter logic (lines 237-244)**

Replace references to `filters.charterType` → `filters.flightType` and SQL column `sf.charter_type` → `sf.flight_type`. The `'custom'` filter shortcut previously matched `('reposition','cargo','passenger')` — this no longer makes sense. Replace:
```typescript
if (filters.charterType) {
  if (filters.charterType === 'custom') {
    conditions.push("(sf.charter_type IN ('reposition','cargo','passenger'))");
  } else {
    conditions.push('sf.charter_type = ?');
    params.push(filters.charterType);
  }
}
```
With:
```typescript
if (filters.flightType) {
  conditions.push('sf.flight_type = ?');
  params.push(filters.flightType);
}
```

**Step 5: Update `placeBid()` query (line 320)**

SQL: `sf.charter_type` → `sf.flight_type`
Type cast: `charter_type: string | null` → `flight_type: string | null`

**Step 6: Update type mismatch warning in `placeBid()` (lines 384-392)**

The old logic checked `schedule.charter_type === 'cargo'` / `'passenger'`. With IATA codes, cargo-intent codes are `F`, `A`, `H` and passenger-intent codes are `J`, `C`, `G`. Update:
```typescript
// Type mismatch warning: cargo aircraft on passenger flight or vice versa
const CARGO_FLIGHT_TYPES = new Set(['F', 'A', 'H', 'M', 'Q', 'R']);
const PAX_FLIGHT_TYPES = new Set(['J', 'C', 'G', 'E', 'S', 'B']);
if (schedule.flight_type) {
  const isCargo = aircraft.is_cargo === 1;
  if (CARGO_FLIGHT_TYPES.has(schedule.flight_type) && !isCargo) {
    warnings.push(`Type mismatch: ${aircraft.registration} is a passenger aircraft on a cargo flight`);
  }
  if (PAX_FLIGHT_TYPES.has(schedule.flight_type) && isCargo) {
    warnings.push(`Type mismatch: ${aircraft.registration} is a cargo aircraft on a passenger flight`);
  }
}
```

**Step 7: Update `removeBid()` (lines 411-426)**

SQL: `sf.charter_type` → `sf.flight_type`
Type: `charter_type: string | null` → `flight_type: string | null`

The `userCreatedTypes` check (`['reposition', 'cargo', 'passenger']`) needs updating. User-created flights now have any flight_type code. The distinguishing factor is whether the flight was user-created (has `created_by` set and no admin origin). Since we're losing the distinction between system-generated and user-created, we need a different approach.

**Important decision:** Previously `charter_type IN ('reposition','cargo','passenger')` identified user-created charters (vs `'generated'`/`'event'` which are system-created). After migration, all types are single letters. We need to check `created_by IS NOT NULL` AND the flight has no `expires_at` (user-created charters don't expire, generated ones do). Actually the simplest approach: user-created flights have `created_by IS NOT NULL` and `expires_at IS NULL`. Update the check:

```typescript
// For removeBid:
const bid = db.prepare(
  'SELECT ab.schedule_id, sf.flight_type, sf.created_by, sf.expires_at FROM active_bids ab JOIN scheduled_flights sf ON sf.id = ab.schedule_id WHERE ab.id = ? AND ab.user_id = ?'
).get(bidId, userId) as { schedule_id: number; flight_type: string | null; created_by: number | null; expires_at: string | null } | undefined;

// User-created one-off flights: created_by is set AND no expiration (not system-generated)
const isUserCreated = bid.created_by != null && bid.expires_at == null && bid.flight_type != null;
if (isUserCreated) {
  db.prepare('DELETE FROM scheduled_flights WHERE id = ?').run(bid.schedule_id);
}
```

**Step 8: Apply same pattern to `forceRemoveBid()` (lines 431-448)**

Same SQL/logic changes as removeBid.

**Step 9: Update `findMyBids()` and `findAllBids()` SQL (lines 457, 482)**

`sf.charter_type` → `sf.flight_type`

**Step 10: Update `findBidByUserAndSchedule()` SQL (line 569)**

`sf.charter_type` → `sf.flight_type`

**Step 11: Update `createCharter()` (lines 536-549)**

SQL: `charter_type` → `flight_type`
Parameter: `req.charterType` → `req.flightType`

**Step 12: Update all mapper functions**

- `toScheduleListItem()` (line 658): `row.charter_type as CharterType` → `row.flight_type as FlightType`
- `toBidWithDetails()` (line 699): same
- `toActiveBidEntry()` (line 725): same

**Step 13: Build to verify**

Run: `npm run build -w backend`

**Step 14: Commit**

```bash
git add backend/src/services/schedule.ts
git commit -m "feat(backend): rename charter_type to flight_type across schedule service"
```

---

### Task 5: Backend — Charter Route

**Files:**
- Modify: `backend/src/routes/schedules.ts`

**Step 1: Update imports (line 5)**

`CreateCharterRequest, CharterType` → `CreateCharterRequest, VALID_FLIGHT_TYPE_CODES, FlightType`

**Step 2: Update filter (line 83)**

`charterType: req.query.charter_type` → `flightType: req.query.flight_type`

**Step 3: Replace validation in `POST /api/charters` (lines 238-247)**

Replace:
```typescript
const VALID_CHARTER_TYPES = new Set<CharterType>(['reposition', 'cargo', 'passenger']);
// ...
if (!body.charterType || !VALID_CHARTER_TYPES.has(body.charterType)) {
  res.status(400).json({ error: 'charterType must be reposition, cargo, or passenger' });
  return;
}
```

With:
```typescript
if (!body.flightType || !VALID_FLIGHT_TYPE_CODES.has(body.flightType)) {
  res.status(400).json({ error: 'flightType must be a valid IATA flight type code' });
  return;
}
```

**Step 4: Commit**

```bash
git add backend/src/routes/schedules.ts
git commit -m "feat(backend): update charter route to use flightType with IATA codes"
```

---

### Task 6: Backend — Remaining Services

**Files:**
- Modify: `backend/src/services/charter-generator.ts`
- Modify: `backend/src/services/vatsim-events.ts`
- Modify: `backend/src/services/dispatch.ts`
- Modify: `backend/src/services/bid-expiration.ts`
- Modify: `backend/src/services/regulatory.ts`
- Modify: `backend/src/services/schedule-admin.ts`
- Modify: `backend/src/routes/admin-schedules.ts`
- Modify: `backend/src/routes/regulatory.ts`

**Step 1: charter-generator.ts**

- Line 90: SQL `charter_type = 'generated'` → `flight_type = 'F'` (forceReset)
- Line 145-146: SQL `charter_type` → `flight_type`, value `'generated'` → `NULL` (the flight_type is set by aircraft_type: cargo aircraft get 'F', otherwise left to the insert). Actually, generated charters should get flight_type based on aircraft cargo status. For simplicity, set all generated charters to `'F'` since SMA is cargo-first.
  - Change the INSERT column from `charter_type` to `flight_type` and value from `'generated'` to `'F'`
- Line 288-289: SQL `charter_type IN ('generated', 'event')` → We need a new way to identify system-generated charters for cleanup. Use `expires_at IS NOT NULL` (only system-generated charters have expiration):
  ```sql
  DELETE FROM scheduled_flights
  WHERE expires_at IS NOT NULL
    AND expires_at < datetime('now')
    AND id NOT IN (SELECT schedule_id FROM active_bids)
  ```

**Step 2: vatsim-events.ts**

- Line 154: SQL `charter_type = 'event'` → `flight_type = 'J'` (or we need to identify event charters differently — by `vatsim_event_id IS NOT NULL`)
  - Change to: `vatsim_event_id IS NOT NULL` for the cleanup query
- Lines 184-185: INSERT `charter_type` → `flight_type`, value `'event'` → `'J'`

**Step 3: dispatch.ts**

- Line 21: `charter_type: string | null` → `flight_type: string | null`
- Line 58: SQL `sf.charter_type` → `sf.flight_type`
- Line 117: mapper `charterType: row.charter_type as CharterType` → `flightType: row.flight_type as FlightType`
- Update import: `CharterType` → `FlightType`

**Step 4: bid-expiration.ts**

- Line 37: SQL `sf.charter_type` → `sf.flight_type`
- Line 49: type `charter_type: string | null` → `flight_type: string | null`
- Line 55: `userCreatedTypes` logic — same approach as Task 4 Step 7. Need to also SELECT `sf.created_by, sf.expires_at` and use the `created_by IS NOT NULL AND expires_at IS NULL` check instead of string matching.
- Line 60: `bid.charter_type` → `bid.flight_type` with new logic

**Step 5: regulatory.ts**

- Line 94: parameter `charterType` → `flightType` (the classifyFlight function signature)
- Line 102-103: reasoning string update (cosmetic)
- Line 455: `charterType` → `flightType` in params interface
- Line 465: `params.charterType` → `params.flightType`

**Step 6: schedule-admin.ts**

- Line 61: `charter_type: string | null` → `flight_type: string | null`
- Line 71: filter parameter `charterType` → `flightType`
- Lines 79-84: SQL `sf.charter_type` → `sf.flight_type`, filter logic `charterType` → `flightType`
- Lines 127, 178: mapper `charterType: r.charter_type` → `flightType: r.flight_type`

**Step 7: admin-schedules.ts (route)**

- Line 39: `charterType` → `flightType` in query param

**Step 8: regulatory.ts (route)**

- Lines 22, 36, 61-62: `charterType` → `flightType`

**Step 9: Build backend**

Run: `npm run build -w backend`
Expected: PASS (all backend charter_type references resolved)

**Step 10: Commit**

```bash
git add backend/src/services/charter-generator.ts backend/src/services/vatsim-events.ts backend/src/services/dispatch.ts backend/src/services/bid-expiration.ts backend/src/services/regulatory.ts backend/src/services/schedule-admin.ts backend/src/routes/admin-schedules.ts backend/src/routes/regulatory.ts
git commit -m "feat(backend): rename charter_type to flight_type in all remaining services and routes"
```

---

### Task 7: Frontend — SchedulePage

**Files:**
- Modify: `frontend/src/pages/SchedulePage.tsx`

**Step 1: Update imports (line 33-43)**

Replace `CharterType` with `FlightType, FLIGHT_TYPES` from `@acars/shared`.

**Step 2: Remove old `CHARTER_TYPES` array (lines 88-94)**

Delete the entire `CHARTER_TYPES` constant.

**Step 3: Update `CharterModal` component (lines 220-407)**

Rename to keep same component but update internals:

- State: `const [charterType, setCharterType] = useState<CharterType>('cargo')` → `const [flightType, setFlightType] = useState<FlightType>('F')`

- Replace the 3-card grid (lines 298-322) with a `<select>` dropdown:
```tsx
<div>
  <label className="text-[10px] uppercase tracking-wider text-acars-muted font-medium mb-1.5 block">Flight Type</label>
  <select
    value={flightType}
    onChange={e => setFlightType(e.target.value as FlightType)}
    className="w-full h-9 rounded-md border border-acars-border bg-acars-bg text-xs text-acars-text px-2.5 outline-none focus:border-blue-400 transition-colors"
  >
    {(Object.entries(FLIGHT_TYPES) as [FlightType, string][]).map(([code, label]) => (
      <option key={code} value={code}>{code} — {label}</option>
    ))}
  </select>
</div>
```

- Submit payload (line 258-259): `charterType` → `flightType`

- Modal header (line 287): `"Create Charter Flight"` → `"Create Flight"`
- Footer button (line 401): `"Create Charter"` → `"Create"`

**Step 4: Update the "Create Charter" button (line 932)**

Change label: `Create Charter` → `Create`

**Step 5: Update any `charterType` references in the schedule list display**

Search for where `charterType` is displayed in the schedule list items and update to `flightType` with the FLIGHT_TYPES label.

**Step 6: Build frontend**

Run: `npm run build -w frontend`
Expected: PASS

**Step 7: Commit**

```bash
git add frontend/src/pages/SchedulePage.tsx
git commit -m "feat(frontend): replace charter type cards with flight type dropdown, rename Create Charter to Create"
```

---

### Task 8: Frontend — AdminSchedulesPage

**Files:**
- Modify: `frontend/src/pages/admin/AdminSchedulesPage.tsx`

**Step 1: Update all `charterType` references to `flightType`**

- Interface field (line 42): `charterType` → `flightType`
- Form field (line 62): `charterType` → `flightType`
- Default value (line 82): `charterType: ''` → `flightType: ''`
- Input (lines 497-498): `form.charterType` → `form.flightType`, onChange key `'charterType'` → `'flightType'`
- Filter state (line 642): `charterTypeFilter` → `flightTypeFilter`
- Filter param (line 682): `charterType` → `flightType`
- Dependencies (line 698): `charterTypeFilter` → `flightTypeFilter`
- `hasFilters` check (line 724): same
- POST body (line 748): `charterType` → `flightType`
- PATCH body (line 777): same
- Filter select (line 1022-1025): same
- Display badge (lines 1126-1134): Update to show IATA code with `FLIGHT_TYPES[s.flightType]` label
- Edit form default (line 1321): `charterType` → `flightType`

**Step 2: Update the admin charter type filter dropdown options**

Replace old hardcoded options (generated, event, cargo, etc.) with IATA codes from `FLIGHT_TYPES`.

**Step 3: Build frontend**

Run: `npm run build -w frontend`
Expected: PASS

**Step 4: Commit**

```bash
git add frontend/src/pages/admin/AdminSchedulesPage.tsx
git commit -m "feat(frontend): update admin schedules page to use flight type codes"
```

---

### Task 9: Full Build & Smoke Test

**Step 1: Build all workspaces**

Run: `npm run build`
Expected: PASS — shared, backend, frontend, electron all compile

**Step 2: Verify no remaining `charter_type` / `charterType` / `CharterType` references (except migration files)**

Run: `grep -r "charter_type\|charterType\|CharterType" --include="*.ts" --include="*.tsx" backend/src/ frontend/src/ shared/src/ | grep -v migrations/ | grep -v node_modules/`
Expected: No matches

**Step 3: Commit any stragglers and final commit**

```bash
git add -A
git commit -m "feat: unified flight creation with IATA flight type codes

Replace charter_type with flight_type across the entire stack.
Migration 030 renames the column and maps old values to IATA codes.
Create Charter button → Create with 22-type dropdown (default: F — Scheduled Cargo)."
```
