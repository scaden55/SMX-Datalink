# Flight Numbering Scheme Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the flat SMX-100–9999 numbering with a structured scheme that reserves ranges by purpose, removes the dash, and appends European stub suffixes.

**Architecture:** Update the `randomFlightNumber()` function with reserved-range exclusion and European suffix logic, migrate existing flight numbers to remove the dash, update user charter creation to allow manual flight numbers, and pass dep/arr info through all callers.

**Tech Stack:** SQLite migration, TypeScript backend, React frontend

---

### Task 1: Migration — Remove Dash from Existing Flight Numbers

**Files:**
- Create: `backend/src/db/migrations/029-flight-number-format.sql`

**Step 1: Create migration**

```sql
-- 029-flight-number-format.sql
-- Remove dash from SMX- flight numbers → SMX format
UPDATE scheduled_flights SET flight_number = REPLACE(flight_number, 'SMX-', 'SMX') WHERE flight_number LIKE 'SMX-%';
UPDATE active_bids SET flight_plan_data = NULL WHERE flight_plan_data IS NOT NULL;
-- Note: active_bids don't store flight_number directly, but logbook may reference old format.
-- Logbook entries are historical records — leave them as-is.
```

Actually, we only need the scheduled_flights update. The logbook stores its own `flight_number` column as historical data — don't touch it.

```sql
-- 029-flight-number-format.sql
-- Remove dash from SMX- flight numbers → SMX format (e.g., SMX-1234 → SMX1234)
UPDATE scheduled_flights SET flight_number = REPLACE(flight_number, 'SMX-', 'SMX') WHERE flight_number LIKE 'SMX-%';
```

**Step 2: Commit**

```bash
git add backend/src/db/migrations/029-flight-number-format.sql
git commit -m "feat(numbering): migration to remove dash from SMX flight numbers"
```

---

### Task 2: Backend — European Country Set and Updated randomFlightNumber()

**Files:**
- Modify: `backend/src/services/charter-generator.ts` — rewrite `randomFlightNumber()`

**Step 1: Define the European country set and reserved ranges**

Replace the entire `randomFlightNumber()` function (lines 410-427 in charter-generator.ts) with:

```typescript
/** ISO country codes for European nations (used for flight number stub suffixes). */
const EUROPEAN_COUNTRIES = new Set([
  'AT','BE','BG','HR','CY','CZ','DK','EE','FI','FR','DE','GR','HU','IS','IE',
  'IT','LV','LT','LU','MT','NL','NO','PL','PT','RO','SK','SI','ES','SE','CH',
  'GB','UA','RS','ME','MK','AL','BA','MD','BY','XK',
]);

/** Valid stub suffix letters (A-Z minus I and O). */
const STUB_LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';

/**
 * Number ranges EXCLUDED from auto-generation.
 * 0-9: Reserved (admin only)
 * 10-99: Tactical (user charter / admin)
 * 500-599, 5000-5999: Custom Dispatch
 * 700-799, 7000-7999: Reserved
 * 900-999, 9000-9999: Non-revenue
 */
function isReservedNumber(n: number): boolean {
  if (n <= 99) return true;                          // 0-99
  if (n >= 500 && n <= 599) return true;             // 500-599
  if (n >= 700 && n <= 799) return true;             // 700-799
  if (n >= 900 && n <= 999) return true;             // 900-999
  if (n >= 5000 && n <= 5999) return true;           // 5000-5999
  if (n >= 7000 && n <= 7999) return true;           // 7000-7999
  if (n >= 9000 && n <= 9999) return true;           // 9000-9999
  return false;
}

/**
 * Generate a unique random SMX flight number from the auto-generation pool.
 * Appends a European stub suffix letter if either airport is in Europe.
 *
 * @param db - Database handle
 * @param depIcao - Departure ICAO (for European suffix detection)
 * @param arrIcao - Arrival ICAO (for European suffix detection)
 */
export function randomFlightNumber(
  db: ReturnType<typeof getDb>,
  depIcao?: string,
  arrIcao?: string,
): string {
  const existing = new Set(
    (db.prepare("SELECT flight_number FROM scheduled_flights WHERE flight_number LIKE 'SMX%'").all() as { flight_number: string }[])
      .map(r => r.flight_number),
  );

  // Check if either airport is European
  let isEuropean = false;
  if (depIcao || arrIcao) {
    const checkCountry = (icao: string): string | null => {
      const legacy = db.prepare('SELECT country FROM airports WHERE icao = ?').get(icao) as { country: string } | undefined;
      if (legacy) return legacy.country;
      const oa = db.prepare('SELECT iso_country FROM oa_airports WHERE ident = ?').get(icao) as { iso_country: string } | undefined;
      return oa?.iso_country ?? null;
    };
    if (depIcao) { const c = checkCountry(depIcao); if (c && EUROPEAN_COUNTRIES.has(c)) isEuropean = true; }
    if (!isEuropean && arrIcao) { const c = checkCountry(arrIcao); if (c && EUROPEAN_COUNTRIES.has(c)) isEuropean = true; }
  }

  const suffix = isEuropean ? STUB_LETTERS[Math.floor(Math.random() * STUB_LETTERS.length)] : '';

  // Try random numbers from auto-generation pool (100-9999 minus reserved)
  for (let i = 0; i < 500; i++) {
    const num = 100 + Math.floor(Math.random() * 9900); // 100–9999
    if (isReservedNumber(num)) continue;
    const fn = `SMX${num}${suffix}`;
    if (!existing.has(fn)) return fn;
  }

  // Fallback: sequential scan
  for (let n = 100; n <= 9999; n++) {
    if (isReservedNumber(n)) continue;
    const fn = `SMX${n}${suffix}`;
    if (!existing.has(fn)) return fn;
  }

  throw new Error('No available SMX flight numbers');
}
```

Also update the JSDoc comment above the function (line ~410) to replace the old description.

**Step 2: Update all callers in charter-generator.ts**

Find all calls to `randomFlightNumber(db)` in `generateMonthlyCharters()`:

Line ~206: `const flightNumber = randomFlightNumber(db);`
Change to: `const flightNumber = randomFlightNumber(db, origin.icao, destination.ident);`

Line ~261: `const fn = randomFlightNumber(db);`
Change to: `const fn = randomFlightNumber(db, origin.icao, dest.ident);`

Also update the existing `SELECT` query string in `randomFlightNumber` from `LIKE 'SMX-%'` to `LIKE 'SMX%'` (already done in the new code above).

**Step 3: Commit**

```bash
git add backend/src/services/charter-generator.ts
git commit -m "feat(numbering): reserved ranges, no dash, European stub suffixes"
```

---

### Task 3: Backend — Update VATSIM Events and User Charter Callers

**Files:**
- Modify: `backend/src/services/vatsim-events.ts` — pass dep/arr to `randomFlightNumber()`
- Modify: `backend/src/services/schedule.ts` — update `createCharter()` to accept optional flight number

**Step 1: Update VATSIM events**

In `vatsim-events.ts`, find the two calls to `randomFlightNumber(db)`:

Line ~250: `const outboundFN = randomFlightNumber(db);`
Change to: `const outboundFN = randomFlightNumber(db, hub.icao, eventIcao);`

Line ~259: `const returnFN = randomFlightNumber(db);`
Change to: `const returnFN = randomFlightNumber(db, eventIcao, hub.icao);`

**Step 2: Update `createCharter()` in schedule.ts**

The `createCharter()` method (around line 506) currently always auto-generates a flight number. Change it to accept an optional user-provided flight number.

First, update the `CreateCharterRequest` type in `shared/src/types/schedule.ts`:

```typescript
export interface CreateCharterRequest {
  charterType: CharterType;
  depIcao: string;
  arrIcao: string;
  depTime: string;
  flightNumber?: string;  // Optional: user-provided flight number
}
```

Then in `createCharter()`, change the transaction (around line 541-548):

```typescript
    const txn = db.transaction(() => {
      // Use user-provided flight number or generate one
      const flightNumber = req.flightNumber
        ? req.flightNumber
        : randomFlightNumber(db, req.depIcao, req.arrIcao);
      const result = insertSchedule.run(
        flightNumber, req.depIcao, req.arrIcao,
        req.depTime, arrTime, distanceNm, flightTimeMin,
        req.charterType, userId
      );
      return result.lastInsertRowid as number;
    });
```

**Step 3: Build shared + backend**

```bash
npx tsc -p shared/ && npm run build -w backend
```

**Step 4: Commit**

```bash
git add backend/src/services/vatsim-events.ts backend/src/services/schedule.ts shared/src/types/schedule.ts
git commit -m "feat(numbering): pass dep/arr for European suffix, accept user flight numbers"
```

---

### Task 4: Backend — Route Validation for User Charter Flight Numbers

**Files:**
- Modify: `backend/src/routes/schedules.ts` — accept optional `flightNumber` in charter POST

**Step 1: Update the charter route**

In `backend/src/routes/schedules.ts`, the `POST /api/charters` handler (around line 191) currently validates `charterType`, `depIcao`, `arrIcao`, `depTime`. Add `flightNumber` to the destructured body:

After the existing validation block and before `const result = service.createCharter(...)`, add:

```typescript
      // Optional flight number validation
      if (body.flightNumber !== undefined) {
        if (typeof body.flightNumber !== 'string' || body.flightNumber.trim().length === 0) {
          res.status(400).json({ error: 'flightNumber must be a non-empty string if provided' });
          return;
        }
        // Normalize: strip whitespace
        body.flightNumber = body.flightNumber.trim().toUpperCase();
      }
```

The `body` is already typed as `Partial<CreateCharterRequest>`, so `flightNumber` is available after the shared type update.

**Step 2: Add the random flight number API endpoint**

Add a new endpoint that generates a random flight number for the frontend "Random" button:

```typescript
  // GET /api/charters/random-number — generate a random available flight number
  router.get('/charters/random-number', authMiddleware, (req, res) => {
    try {
      const depIcao = req.query.dep_icao as string | undefined;
      const arrIcao = req.query.arr_icao as string | undefined;
      const flightNumber = randomFlightNumber(getDb(), depIcao, arrIcao);
      res.json({ flightNumber });
    } catch (err) {
      logger.error('Schedule', 'Random flight number error', err);
      res.status(500).json({ error: 'Failed to generate flight number' });
    }
  });
```

Add imports at the top of `schedules.ts`:
```typescript
import { randomFlightNumber } from '../services/charter-generator.js';
import { getDb } from '../db/index.js';
```

IMPORTANT: This `/charters/random-number` route must be registered BEFORE the `/charters` POST route since Express matches routes in order and both start with `/charters`.

**Step 3: Build and verify**

```bash
npm run build -w backend
```

**Step 4: Commit**

```bash
git add backend/src/routes/schedules.ts
git commit -m "feat(numbering): charter route accepts flight number, random-number endpoint"
```

---

### Task 5: Frontend — Charter Modal Flight Number Input

**Files:**
- Modify: `frontend/src/pages/SchedulePage.tsx` — update `CharterModal` component

**Step 1: Add flight number state and random generator**

In the `CharterModal` component (around line 225), add new state:

```typescript
const [flightNumber, setFlightNumber] = useState('');
const [generatingFn, setGeneratingFn] = useState(false);
```

Add a handler to generate a random flight number:

```typescript
const generateRandomFn = async () => {
  setGeneratingFn(true);
  try {
    const params = new URLSearchParams();
    if (depIcao) params.set('dep_icao', depIcao);
    if (arrIcao) params.set('arr_icao', arrIcao);
    const qs = params.toString();
    const res = await api.get<{ flightNumber: string }>(`/api/charters/random-number${qs ? `?${qs}` : ''}`);
    setFlightNumber(res.flightNumber);
  } catch {
    setFlightNumber('');
  } finally {
    setGeneratingFn(false);
  }
};
```

**Step 2: Add the flight number input field**

In the CharterModal body (around line 278, in the `<div className="px-5 py-4 space-y-4">` section), add a new field AFTER the departure time field and BEFORE the error display:

```tsx
{/* Flight Number */}
<div>
  <label className="text-[10px] uppercase tracking-wider text-acars-muted font-medium mb-1.5 block">Flight Number</label>
  <div className="flex gap-2">
    <input
      type="text"
      value={flightNumber}
      onChange={e => setFlightNumber(e.target.value.toUpperCase())}
      placeholder="SMX1234 (optional)"
      maxLength={10}
      className="flex-1 h-9 rounded-md border border-acars-border bg-acars-bg text-xs text-acars-text font-mono px-2.5 outline-none focus:border-blue-400 transition-colors placeholder:text-acars-muted/50"
    />
    <button
      type="button"
      onClick={generateRandomFn}
      disabled={generatingFn}
      className="btn-secondary h-9 px-3 text-[10px] shrink-0"
      title="Generate random flight number"
    >
      {generatingFn ? <SpinnerGap className="w-3 h-3 animate-spin" /> : <ArrowCounterClockwise className="w-3 h-3" />}
      Random
    </button>
  </div>
  <p className="text-[9px] text-acars-muted mt-1">Leave blank to auto-assign</p>
</div>
```

**Step 3: Pass flight number in the API call**

In the `handleSubmit` function (around line 240), update the API call body:

```typescript
const res = await api.post<CreateCharterResponse>('/api/charters', {
  charterType,
  depIcao,
  arrIcao,
  depTime,
  ...(flightNumber.trim() ? { flightNumber: flightNumber.trim() } : {}),
});
```

**Step 4: Build and verify**

```bash
npm run build -w frontend
```

**Step 5: Commit**

```bash
git add frontend/src/pages/SchedulePage.tsx
git commit -m "feat(numbering): charter modal with optional flight number input and random button"
```

---

### Task 6: Full Build Verification

**Step 1: Build all workspaces**

```bash
npm run build
```

**Step 2: Verify no TypeScript errors across all workspaces**

All 4 workspaces (shared, backend, frontend, electron) should build clean.

**Step 3: Final commit**

```bash
git add -A
git commit -m "feat(numbering): structured flight number scheme with reserved ranges and European suffixes"
```
