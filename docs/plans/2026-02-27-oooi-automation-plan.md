# OOOI Automation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Auto-detect OUT/OFF/ON/IN timestamps from SimConnect telemetry, store them per flight, and display an OOOI timeline on flight detail pages.

**Architecture:** Extend the existing `FlightEventTracker` singleton to capture four OOOI timestamps at phase transitions already detected by the flight phase state machine. Add four nullable columns to the `logbook` table. Update PIREP submission to store them. Build a timeline component on the flight detail page.

**Tech Stack:** TypeScript, SQLite (better-sqlite3), React, Tailwind CSS, Phosphor icons

---

### Task 1: Database Migration — Add OOOI columns to logbook

**Files:**
- Create: `backend/src/db/migrations/031-oooi-times.sql`

**Step 1: Create migration file**

```sql
-- OOOI timestamps (ISO 8601 UTC, nullable for legacy entries)
ALTER TABLE logbook ADD COLUMN oooi_out TEXT;
ALTER TABLE logbook ADD COLUMN oooi_off TEXT;
ALTER TABLE logbook ADD COLUMN oooi_on TEXT;
ALTER TABLE logbook ADD COLUMN oooi_in TEXT;
```

**Step 2: Verify migration runs**

Run: `npm run dev:all` — backend auto-applies migrations on startup. Check server log for `Migration 031-oooi-times.sql applied`.

**Step 3: Commit**

```bash
git add backend/src/db/migrations/031-oooi-times.sql
git commit -m "feat(db): add OOOI timestamp columns to logbook table"
```

---

### Task 2: Extend FlightEventTracker with OOOI capture

**Files:**
- Modify: `backend/src/services/flight-event-tracker.ts`

**Step 1: Add OOOI fields to FlightEvents interface and tracker class**

Update `FlightEvents` interface to include OOOI:

```typescript
export interface FlightEvents {
  landingRateFpm: number | null;
  takeoffFuelLbs: number | null;
  takeoffTime: string | null; // ISO UTC
  // OOOI timestamps
  oooiOut: string | null;
  oooiOff: string | null;
  oooiOn: string | null;
  oooiIn: string | null;
}
```

Add private fields:

```typescript
private oooiOut: string | null = null;
private oooiOff: string | null = null;
private oooiOn: string | null = null;
private oooiIn: string | null = null;
```

**Step 2: Extend onPhaseChange() to capture OOOI timestamps**

Add to the existing `onPhaseChange()` method:

```typescript
onPhaseChange(
  previous: string,
  current: string,
  fuelTotalLbs: number,
): void {
  // OUT: parking brake released, starting to taxi
  if (previous === 'PREFLIGHT' && current === 'TAXI_OUT') {
    this.oooiOut = new Date().toISOString();
  }

  // Takeoff: capture fuel weight and timestamp
  if (current === 'TAKEOFF' && previous !== 'TAKEOFF') {
    this.takeoffFuelLbs = Math.round(fuelTotalLbs);
    this.takeoffTime = new Date().toISOString();
  }

  // OFF: wheels off the ground (takeoff → climb)
  if (previous === 'TAKEOFF' && current === 'CLIMB') {
    this.oooiOff = new Date().toISOString();
  }

  // Landing: capture the last airborne VS as landing rate
  if (current === 'LANDING' && previous === 'APPROACH') {
    this.landingRateFpm = Math.round(this.lastVerticalSpeed);
  }

  // ON: touchdown (any phase → LANDING means wheels on ground)
  if (current === 'LANDING') {
    this.oooiOn = new Date().toISOString();
  }

  // IN: parked at destination
  if (current === 'PARKED' && (previous === 'TAXI_IN' || previous === 'LANDING')) {
    this.oooiIn = new Date().toISOString();
  }
}
```

**Step 3: Update getEvents() and reset()**

```typescript
getEvents(): FlightEvents {
  return {
    landingRateFpm: this.landingRateFpm,
    takeoffFuelLbs: this.takeoffFuelLbs,
    takeoffTime: this.takeoffTime,
    oooiOut: this.oooiOut,
    oooiOff: this.oooiOff,
    oooiOn: this.oooiOn,
    oooiIn: this.oooiIn,
  };
}

reset(): void {
  this.landingRateFpm = null;
  this.takeoffFuelLbs = null;
  this.takeoffTime = null;
  this.lastVerticalSpeed = 0;
  this.oooiOut = null;
  this.oooiOff = null;
  this.oooiOn = null;
  this.oooiIn = null;
}
```

**Step 4: Update the fallback in dispatch route**

In `backend/src/routes/dispatch.ts` around line 177, update the fallback object:

```typescript
const flightEvents = flightEventTracker
  ? flightEventTracker.getEvents()
  : { landingRateFpm: null, takeoffFuelLbs: null, takeoffTime: null,
      oooiOut: null, oooiOff: null, oooiOn: null, oooiIn: null };
```

**Step 5: Commit**

```bash
git add backend/src/services/flight-event-tracker.ts backend/src/routes/dispatch.ts
git commit -m "feat: capture OOOI timestamps in FlightEventTracker"
```

---

### Task 3: Update PIREP submission to store OOOI times

**Files:**
- Modify: `backend/src/services/pirep.ts`

**Step 1: Add OOOI columns to the logbook INSERT**

In `pirep.ts`, update the INSERT statement to include the four OOOI columns. Also fix `actual_dep` and `actual_arr` to use correct OOOI semantics, and calculate `flight_time_min` from OFF→ON.

Before the transaction, add OOOI fallback logic:

```typescript
// 4. Calculate flight time from OOOI (OFF → ON)
const now = new Date();
const oooiOff = flightEvents.oooiOff ? new Date(flightEvents.oooiOff) : null;
const oooiOn = flightEvents.oooiOn ? new Date(flightEvents.oooiOn) : null;
const takeoffTime = flightEvents.takeoffTime ? new Date(flightEvents.takeoffTime) : null;

// Flight time: prefer OFF→ON, fall back to takeoff→now
const flightTimeMin = (oooiOff && oooiOn)
  ? Math.round((oooiOn.getTime() - oooiOff.getTime()) / 60000)
  : takeoffTime
    ? Math.round((now.getTime() - takeoffTime.getTime()) / 60000)
    : 0;

// actual_dep = OFF time (wheels up), actual_arr = ON time (touchdown)
const actualDep = flightEvents.oooiOff ?? flightEvents.takeoffTime ?? now.toISOString();
const actualArr = flightEvents.oooiOn ?? now.toISOString();

// IN time fallback: use submission time if pilot submits before parking
const oooiIn = flightEvents.oooiIn ?? now.toISOString();
```

Update the INSERT to add OOOI columns:

```sql
INSERT INTO logbook (
  user_id, flight_number, dep_icao, arr_icao,
  aircraft_type, aircraft_registration,
  scheduled_dep, scheduled_arr,
  actual_dep, actual_arr,
  flight_time_min, distance_nm,
  fuel_used_lbs, fuel_planned_lbs,
  route, cruise_altitude,
  pax_count, cargo_lbs,
  landing_rate_fpm, score,
  status, remarks,
  vatsim_connected, vatsim_callsign, vatsim_cid,
  oooi_out, oooi_off, oooi_on, oooi_in
) VALUES (
  ?, ?, ?, ?,
  ?, ?,
  ?, ?,
  ?, ?,
  ?, ?,
  ?, ?,
  ?, ?,
  ?, ?,
  ?, ?,
  ?, ?,
  ?, ?, ?,
  ?, ?, ?, ?
)
```

And add the OOOI values to the `.run()` params:

```typescript
flightEvents.oooiOut,
flightEvents.oooiOff,
flightEvents.oooiOn,
oooiIn,
```

Use `actualDep` and `actualArr` variables instead of the old inline values.

**Step 2: Commit**

```bash
git add backend/src/services/pirep.ts
git commit -m "feat: store OOOI timestamps and fix actual dep/arr in PIREP submission"
```

---

### Task 4: Update shared types and backend logbook mapper

**Files:**
- Modify: `shared/src/types/logbook.ts`
- Modify: `backend/src/services/logbook.ts`
- Modify: `backend/src/types/db-rows.ts` (if LogbookRow is defined there — check; if not, update in `logbook.ts`)

**Step 1: Add OOOI fields to LogbookEntry type**

In `shared/src/types/logbook.ts`, add to the `LogbookEntry` interface:

```typescript
// OOOI timestamps (null for pre-OOOI entries)
oooiOut: string | null;
oooiOff: string | null;
oooiOn: string | null;
oooiIn: string | null;
blockTimeMin: number | null; // calculated: IN - OUT
```

**Step 2: Update LogbookRow in backend logbook service**

In `backend/src/services/logbook.ts`, add to the `LogbookRow` interface:

```typescript
oooi_out: string | null;
oooi_off: string | null;
oooi_on: string | null;
oooi_in: string | null;
```

**Step 3: Update toLogbookEntry mapper**

In `backend/src/services/logbook.ts`, add to the `toLogbookEntry` mapper:

```typescript
oooiOut: row.oooi_out,
oooiOff: row.oooi_off,
oooiOn: row.oooi_on,
oooiIn: row.oooi_in,
blockTimeMin: (row.oooi_out && row.oooi_in)
  ? Math.round((new Date(row.oooi_in).getTime() - new Date(row.oooi_out).getTime()) / 60000)
  : null,
```

**Step 4: Rebuild shared types**

Run: `npx tsc -p shared/` — ensure no type errors.

**Step 5: Commit**

```bash
git add shared/src/types/logbook.ts backend/src/services/logbook.ts
git commit -m "feat: add OOOI fields to LogbookEntry type and backend mapper"
```

---

### Task 5: Frontend — OOOI Timeline on FlightDetailPage

**Files:**
- Modify: `frontend/src/pages/FlightDetailPage.tsx`

**Step 1: Add formatDurationBetween helper**

Add a helper to compute duration between two ISO timestamps:

```typescript
function formatDurationBetween(startIso: string, endIso: string): string {
  const ms = new Date(endIso).getTime() - new Date(startIso).getTime();
  const totalMin = Math.round(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h > 0 ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m`;
}
```

**Step 2: Create OooiTimeline inline component**

Add below the helpers section, before the main component:

```tsx
function OooiTimeline({ entry }: { entry: LogbookEntry }) {
  // Need at least OUT and one other event to show timeline
  if (!entry.oooiOut) return null;

  const events = [
    { key: 'OUT', time: entry.oooiOut, label: 'Gate Out' },
    { key: 'OFF', time: entry.oooiOff, label: 'Wheels Off' },
    { key: 'ON', time: entry.oooiOn, label: 'Touchdown' },
    { key: 'IN', time: entry.oooiIn, label: 'Gate In' },
  ];

  // Calculate segment durations
  const taxiOut = entry.oooiOut && entry.oooiOff
    ? formatDurationBetween(entry.oooiOut, entry.oooiOff) : null;
  const airborne = entry.oooiOff && entry.oooiOn
    ? formatDurationBetween(entry.oooiOff, entry.oooiOn) : null;
  const taxiIn = entry.oooiOn && entry.oooiIn
    ? formatDurationBetween(entry.oooiOn, entry.oooiIn) : null;

  return (
    <div className="panel rounded-md p-4 mb-4">
      <h3 className="text-[11px] uppercase tracking-wider text-acars-muted font-medium mb-4 flex items-center gap-2">
        <Clock className="w-3.5 h-3.5 text-blue-400" />
        OOOI Times
      </h3>

      {/* Timeline bar */}
      <div className="flex items-center gap-0 mb-3">
        {/* OUT marker */}
        <div className="flex flex-col items-center">
          <div className="w-3 h-3 rounded-full bg-emerald-400 border-2 border-emerald-400/30" />
        </div>

        {/* Taxi out segment */}
        <div className="flex-1 flex flex-col items-center">
          <div className="w-full h-0.5 border-t-2 border-dashed border-acars-border" />
          {taxiOut && <div className="text-[10px] text-acars-muted mt-1">Taxi {taxiOut}</div>}
        </div>

        {/* OFF marker */}
        <div className="flex flex-col items-center">
          <div className="w-3 h-3 rounded-full bg-blue-400 border-2 border-blue-400/30" />
        </div>

        {/* Airborne segment */}
        <div className="flex-[3] flex flex-col items-center">
          <div className="w-full h-0.5 bg-blue-400" />
          {airborne && <div className="text-[10px] text-blue-400 font-semibold mt-1">Flight {airborne}</div>}
        </div>

        {/* ON marker */}
        <div className="flex flex-col items-center">
          <div className="w-3 h-3 rounded-full bg-blue-400 border-2 border-blue-400/30" />
        </div>

        {/* Taxi in segment */}
        <div className="flex-1 flex flex-col items-center">
          <div className="w-full h-0.5 border-t-2 border-dashed border-acars-border" />
          {taxiIn && <div className="text-[10px] text-acars-muted mt-1">Taxi {taxiIn}</div>}
        </div>

        {/* IN marker */}
        <div className="flex flex-col items-center">
          <div className="w-3 h-3 rounded-full bg-emerald-400 border-2 border-emerald-400/30" />
        </div>
      </div>

      {/* Timestamps row */}
      <div className="flex justify-between text-center">
        {events.map(e => (
          <div key={e.key} className="flex flex-col items-center">
            <div className="text-[10px] uppercase tracking-wider text-acars-muted font-medium">{e.key}</div>
            <div className="text-xs font-mono text-acars-text font-semibold">
              {e.time ? formatTime(e.time) : '—'}
            </div>
            <div className="text-[10px] text-acars-muted">{e.label}</div>
          </div>
        ))}
      </div>

      {/* Block time summary */}
      {entry.blockTimeMin != null && (
        <div className="mt-3 pt-3 border-t border-acars-border flex items-center justify-center gap-6">
          <div className="text-center">
            <div className="text-[10px] uppercase tracking-wider text-acars-muted">Block Time</div>
            <div className="text-sm font-mono font-bold text-acars-text">{formatDuration(entry.blockTimeMin)}</div>
          </div>
          <div className="text-center">
            <div className="text-[10px] uppercase tracking-wider text-acars-muted">Flight Time</div>
            <div className="text-sm font-mono font-bold text-blue-400">{formatDuration(entry.flightTimeMin)}</div>
          </div>
        </div>
      )}
    </div>
  );
}
```

**Step 3: Insert the timeline into the page**

Place `<OooiTimeline entry={entry} />` immediately after the Path Hero panel (after the closing `</div>` of the "Path Hero" section, before the Performance grid):

```tsx
{/* ── OOOI Timeline ──────────────────────────────────── */}
<OooiTimeline entry={entry} />

{/* ── Performance + Score ─────────────────────────────── */}
```

**Step 4: Commit**

```bash
git add frontend/src/pages/FlightDetailPage.tsx
git commit -m "feat: add OOOI timeline to flight detail page"
```

---

### Task 6: Frontend — Add Block Time column to LogbookPage

**Files:**
- Modify: `frontend/src/pages/LogbookPage.tsx`

**Step 1: Add 'block' to SortField type**

```typescript
type SortField = 'date' | 'flight' | 'route' | 'aircraft' | 'duration' | 'block' | 'landing' | 'score';
```

**Step 2: Add block time sort case**

In the sort function, add a case:

```typescript
case 'block': return dir * ((a.blockTimeMin ?? a.flightTimeMin) - (b.blockTimeMin ?? b.flightTimeMin));
```

**Step 3: Rename Duration column to "Flight" and add "Block" column**

In the table header row, change the Duration header label from `"Duration"` to `"Flight"` and add a Block header right after:

```tsx
<th className="text-left px-3 py-2.5"><SortHeader field="duration" label="Flight" /></th>
<th className="text-left px-3 py-2.5"><SortHeader field="block" label="Block" /></th>
```

In the table body, after the existing duration `<td>`, add:

```tsx
<td className="px-3 py-2.5">
  <span className="text-acars-text font-mono">
    {entry.blockTimeMin != null ? formatDuration(entry.blockTimeMin) : '—'}
  </span>
</td>
```

**Step 4: Commit**

```bash
git add frontend/src/pages/LogbookPage.tsx
git commit -m "feat: add block time column to logbook page"
```

---

### Task 7: Build and verify

**Step 1: Rebuild shared types**

Run: `npx tsc -p shared/`
Expected: No errors.

**Step 2: Build backend**

Run: `npm run build -w backend`
Expected: No errors.

**Step 3: Build frontend**

Run: `npm run build -w frontend`
Expected: No errors.

**Step 4: Manual verification**

Run: `npm run dev:all`
1. Start a flight in the sim — verify phase transitions log OOOI captures in the backend console
2. Complete a flight — verify PIREP submission includes OOOI data
3. Open the logbook — verify Block column shows for the completed flight
4. Click into flight detail — verify OOOI timeline renders with correct timestamps

**Step 5: Final commit**

If any build fixes are needed, commit them:

```bash
git commit -m "fix: resolve build issues from OOOI implementation"
```
