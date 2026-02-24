# Aircraft Selection at Bid Time — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Remove aircraft assignment from charter creation and let pilots choose aircraft when bidding, with location enforcement and suitability warnings.

**Architecture:** New DB column `aircraft_id` on `active_bids` links bids to specific fleet aircraft. The charter modal drops its aircraft dropdown. The "Bid" button opens an aircraft-selector modal with hard blocks (inactive, wrong location) and soft warnings (range, runway, cargo/pax mismatch). Charter generation gets a location-aware pass producing ~20-30% of charters matched to fleet positions.

**Tech Stack:** SQLite migration, TypeScript shared types, Express API validation, React modal + toast warnings

---

### Task 1: Database Migration

**Files:**
- Create: `backend/src/db/migrations/024-bid-aircraft.sql`

**Step 1: Write the migration**

```sql
-- Add aircraft_id to active_bids (nullable for legacy rows)
ALTER TABLE active_bids ADD COLUMN aircraft_id INTEGER REFERENCES fleet(id);

-- Make aircraft_type nullable on scheduled_flights (charters without a pre-assigned type)
-- SQLite doesn't support ALTER COLUMN, but it already allows NULLs on TEXT columns.
-- We just need to ensure the code stops requiring it for charters.

CREATE INDEX IF NOT EXISTS idx_bids_aircraft ON active_bids(aircraft_id);
```

**Step 2: Verify migration runs on startup**

Run: `npm run dev:all`
Expected: Server starts without errors, `active_bids` table has `aircraft_id` column.

**Step 3: Commit**

```bash
git add backend/src/db/migrations/024-bid-aircraft.sql
git commit -m "feat: add aircraft_id column to active_bids (migration 024)"
```

---

### Task 2: Shared Type Updates

**Files:**
- Modify: `shared/src/types/schedule.ts`

**Step 1: Update types**

Changes to make in `shared/src/types/schedule.ts`:

1. **`CreateCharterRequest`** — remove `aircraftType` field:
```typescript
export interface CreateCharterRequest {
  charterType: CharterType;
  depIcao: string;
  arrIcao: string;
  depTime: string;
}
```

2. **`ScheduledFlight`** — make `aircraftType` allow `null`:
```typescript
aircraftType: string | null;
```

3. **`ScheduleListItem`** — inherits from ScheduledFlight, so it gets null automatically.

4. **`Bid`** — add `aircraftId`:
```typescript
export interface Bid {
  id: number;
  userId: number;
  scheduleId: number;
  aircraftId: number | null;
  createdAt: string;
}
```

5. **`BidWithDetails`** — add `aircraftId`, `aircraftRegistration`, `aircraftName`:
```typescript
export interface BidWithDetails extends Bid {
  flightNumber: string;
  depIcao: string;
  arrIcao: string;
  depName: string;
  arrName: string;
  aircraftType: string | null;
  depTime: string;
  arrTime: string;
  distanceNm: number;
  flightTimeMin: number;
  daysOfWeek: string;
  charterType: CharterType | null;
  eventTag: string | null;
  aircraftRegistration: string | null;
  aircraftName: string | null;
}
```

6. **`BidResponse`** — add warnings array:
```typescript
export interface BidResponse {
  bid: BidWithDetails;
  warnings: string[];
}
```

**Step 2: Rebuild shared types**

Run: `cd shared && npx tsc`
Expected: No errors.

**Step 3: Commit**

```bash
git add shared/src/types/schedule.ts
git commit -m "feat: update shared types for aircraft-at-bid (nullable aircraftType, bid aircraftId, warnings)"
```

---

### Task 3: Backend — Update Bid Placement with Aircraft Validation

**Files:**
- Modify: `backend/src/services/schedule.ts`
- Modify: `backend/src/routes/schedules.ts`

**Step 1: Add `placeBidWithAircraft` method to ScheduleService**

In `backend/src/services/schedule.ts`, replace the existing `placeBid` method with a new version that:

1. Accepts `aircraftId` parameter
2. Validates aircraft exists and is active (hard block)
3. Validates aircraft location matches departure ICAO (hard block)
4. Checks range suitability (soft warning)
5. Checks runway suitability (soft warning)
6. Checks cargo/pax mismatch (soft warning)
7. Inserts bid with `aircraft_id`
8. Returns `{ bid, warnings }`

```typescript
placeBid(userId: number, scheduleId: number, aircraftId: number): { bid: BidWithDetails; warnings: string[] } | { error: string } {
  const db = getDb();

  // 1. Validate schedule exists
  const schedule = db.prepare(`
    SELECT sf.id, sf.dep_icao, sf.arr_icao, sf.distance_nm, sf.charter_type
    FROM scheduled_flights sf WHERE sf.id = ? AND sf.is_active = 1
  `).get(scheduleId) as { id: number; dep_icao: string; arr_icao: string; distance_nm: number; charter_type: string | null } | undefined;
  if (!schedule) return { error: 'Schedule not found or inactive' };

  // 2. Validate aircraft exists and is active
  const aircraft = db.prepare(`
    SELECT id, icao_type, registration, name, range_nm, is_cargo, cat,
           COALESCE(location_icao, base_icao) AS effective_location
    FROM fleet WHERE id = ? AND status = 'active'
  `).get(aircraftId) as {
    id: number; icao_type: string; registration: string; name: string;
    range_nm: number; is_cargo: number; cat: string | null; effective_location: string | null;
  } | undefined;
  if (!aircraft) return { error: 'Aircraft is not active' };

  // 3. Location check (hard block)
  if (aircraft.effective_location && aircraft.effective_location !== schedule.dep_icao) {
    return { error: `Aircraft ${aircraft.registration} is at ${aircraft.effective_location}, not ${schedule.dep_icao}` };
  }

  // 4. Soft warnings
  const warnings: string[] = [];

  // Range warning: aircraft range * 0.9 < route distance
  if (aircraft.range_nm > 0 && aircraft.range_nm * 0.9 < schedule.distance_nm) {
    warnings.push(`Range warning: ${aircraft.registration} range (${aircraft.range_nm} nm) may be insufficient for ${schedule.distance_nm} nm route`);
  }

  // Runway warning: check destination longest runway vs aircraft category
  const minRwy = minRunwayForCategory(aircraft.cat);
  const longestRunway = db.prepare(`
    SELECT MAX(rw.length_ft) as max_len
    FROM oa_runways rw
    WHERE rw.airport_ident = ? AND rw.closed = 0
  `).get(schedule.arr_icao) as { max_len: number | null } | undefined;

  if (longestRunway?.max_len != null && longestRunway.max_len < minRwy) {
    warnings.push(`Runway warning: ${schedule.arr_icao} longest runway (${longestRunway.max_len} ft) may be short for ${aircraft.icao_type} (needs ${minRwy} ft)`);
  }

  // Type mismatch: cargo aircraft on pax charter, or pax aircraft on cargo charter (skip for reposition)
  if (schedule.charter_type && schedule.charter_type !== 'reposition') {
    const isCargo = aircraft.is_cargo === 1;
    if (schedule.charter_type === 'cargo' && !isCargo) {
      warnings.push(`Type mismatch: ${aircraft.registration} is a passenger aircraft on a cargo charter`);
    }
    if (schedule.charter_type === 'passenger' && isCargo) {
      warnings.push(`Type mismatch: ${aircraft.registration} is a cargo aircraft on a passenger charter`);
    }
  }

  // 5. Insert bid
  try {
    db.prepare('INSERT INTO active_bids (user_id, schedule_id, aircraft_id) VALUES (?, ?, ?)').run(userId, scheduleId, aircraftId);
  } catch (err: any) {
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') return { error: 'Bid already exists for this schedule' };
    throw err;
  }

  const bid = this.findBidByUserAndSchedule(userId, scheduleId);
  if (!bid) return { error: 'Failed to retrieve bid after insertion' };

  return { bid, warnings };
}
```

Import `minRunwayForCategory` from charter-generator:
```typescript
import { randomFlightNumber, minRunwayForCategory } from './charter-generator.js';
```

**Step 2: Update BidRow and toBidWithDetails to include aircraft info**

Add `aircraft_id`, `aircraft_registration`, and `aircraft_name` to the `BidRow` interface and update all bid queries to JOIN fleet:

```typescript
interface BidRow {
  // ... existing fields ...
  aircraft_id: number | null;
  aircraft_registration: string | null;
  aircraft_name: string | null;
}
```

Update all bid SELECT queries to include:
```sql
ab.aircraft_id,
f.registration AS aircraft_registration,
f.name AS aircraft_name
```

And add `LEFT JOIN fleet f ON f.id = ab.aircraft_id` to all bid queries (`findMyBids`, `findAllBids`, `findBidByUserAndSchedule`).

Update `toBidWithDetails` mapper:
```typescript
aircraftId: row.aircraft_id,
aircraftRegistration: row.aircraft_registration,
aircraftName: row.aircraft_name,
```

**Step 3: Update the route handler for POST /api/bids**

In `backend/src/routes/schedules.ts`, update the bid endpoint to accept `aircraftId`:

```typescript
router.post('/bids', authMiddleware, (req, res) => {
  try {
    const { scheduleId, aircraftId } = req.body as { scheduleId?: number; aircraftId?: number };

    if (!scheduleId || typeof scheduleId !== 'number') {
      res.status(400).json({ error: 'scheduleId (number) is required' });
      return;
    }
    if (!aircraftId || typeof aircraftId !== 'number') {
      res.status(400).json({ error: 'aircraftId (number) is required' });
      return;
    }

    const result = service.placeBid(req.user!.userId, scheduleId, aircraftId);
    if ('error' in result) {
      res.status(409).json({ error: result.error });
      return;
    }

    res.status(201).json({ bid: result.bid, warnings: result.warnings });
  } catch (err) {
    logger.error('Schedule', 'Place bid error', err);
    res.status(500).json({ error: 'Failed to place bid' });
  }
});
```

**Step 4: Verify backend compiles**

Run: `cd shared && npx tsc && cd ../backend && npx tsc --noEmit`
Expected: No type errors.

**Step 5: Commit**

```bash
git add backend/src/services/schedule.ts backend/src/routes/schedules.ts
git commit -m "feat: bid placement with aircraft validation (hard blocks + soft warnings)"
```

---

### Task 4: Backend — Update Charter Creation (Remove Aircraft Requirement)

**Files:**
- Modify: `backend/src/services/schedule.ts` (createCharter method)
- Modify: `backend/src/routes/schedules.ts` (POST /api/charters validation)

**Step 1: Update `createCharter` to not require aircraft type**

In the `createCharter` method:
- Remove `req.aircraftType` dependency
- Use a default cruise speed of 450 kts for flight time estimation (as specified in design doc)
- Insert `NULL` for `aircraft_type` column

```typescript
createCharter(userId: number, req: CreateCharterRequest): CreateCharterResponse | null {
  const db = getDb();

  const lookupCoords = (icao: string): { lat: number; lon: number } | null => {
    const legacy = db.prepare('SELECT lat, lon FROM airports WHERE icao = ?').get(icao) as { lat: number; lon: number } | undefined;
    if (legacy) return legacy;
    const oa = db.prepare('SELECT latitude_deg AS lat, longitude_deg AS lon FROM oa_airports WHERE ident = ? AND latitude_deg IS NOT NULL').get(icao) as { lat: number; lon: number } | undefined;
    return oa ?? null;
  };

  const depCoords = lookupCoords(req.depIcao);
  const arrCoords = lookupCoords(req.arrIcao);
  if (!depCoords || !arrCoords) return null;
  if (req.depIcao === req.arrIcao) return null;

  // Default 450 kts cruise for charters without a specific aircraft
  const defaultCruiseKts = 450;
  const distanceNm = haversineNm(depCoords.lat, depCoords.lon, arrCoords.lat, arrCoords.lon);
  const flightTimeMin = Math.round((distanceNm / defaultCruiseKts) * 60);

  const [depH, depM] = req.depTime.split(':').map(Number);
  const depTotalMin = depH * 60 + depM;
  const arrTotalMin = depTotalMin + flightTimeMin;
  const arrH = Math.floor(arrTotalMin / 60) % 24;
  const arrM = arrTotalMin % 60;
  const arrTime = `${String(arrH).padStart(2, '0')}:${String(arrM).padStart(2, '0')}`;

  const insertSchedule = db.prepare(`
    INSERT INTO scheduled_flights (flight_number, dep_icao, arr_icao, aircraft_type, dep_time, arr_time, distance_nm, flight_time_min, days_of_week, is_active, charter_type, created_by)
    VALUES (?, ?, ?, NULL, ?, ?, ?, ?, '1234567', 1, ?, ?)
  `);

  const txn = db.transaction(() => {
    const flightNumber = randomFlightNumber(db);
    const result = insertSchedule.run(
      flightNumber, req.depIcao, req.arrIcao,
      req.depTime, arrTime, distanceNm, flightTimeMin,
      req.charterType, userId
    );
    return result.lastInsertRowid as number;
  });

  const scheduleId = txn();

  // Note: Charter creation no longer auto-bids. Pilot must bid separately with aircraft selection.
  const schedule = this.findScheduleById(scheduleId, userId);
  if (!schedule) return null;

  return { schedule };
}
```

**Step 2: Update CreateCharterResponse type**

In `shared/src/types/schedule.ts`, update:
```typescript
export interface CreateCharterResponse {
  schedule: ScheduleListItem;
}
```

Remove the `bid` field — charters no longer auto-bid.

**Step 3: Update route validation**

In `backend/src/routes/schedules.ts`, remove the `aircraftType` requirement from POST /api/charters:

```typescript
router.post('/charters', authMiddleware, (req, res) => {
  try {
    const body = req.body as Partial<CreateCharterRequest>;

    if (!body.charterType || !VALID_CHARTER_TYPES.has(body.charterType)) {
      res.status(400).json({ error: 'charterType must be reposition, cargo, or passenger' });
      return;
    }
    if (!body.depIcao || !body.arrIcao || !body.depTime) {
      res.status(400).json({ error: 'depIcao, arrIcao, and depTime are required' });
      return;
    }
    if (body.depIcao === body.arrIcao) {
      res.status(400).json({ error: 'Departure and arrival airports must be different' });
      return;
    }
    if (!/^\d{2}:\d{2}$/.test(body.depTime)) {
      res.status(400).json({ error: 'depTime must be in HH:MM format' });
      return;
    }

    const result = service.createCharter(req.user!.userId, body as CreateCharterRequest);
    if (!result) {
      res.status(400).json({ error: 'Invalid airports' });
      return;
    }

    res.status(201).json(result);
  } catch (err) {
    logger.error('Schedule', 'Create charter error', err);
    res.status(500).json({ error: 'Failed to create charter' });
  }
});
```

**Step 4: Verify**

Run: `cd shared && npx tsc && cd ../backend && npx tsc --noEmit`

**Step 5: Commit**

```bash
git add shared/src/types/schedule.ts backend/src/services/schedule.ts backend/src/routes/schedules.ts
git commit -m "feat: charter creation no longer requires aircraft type"
```

---

### Task 5: Backend — Add Fleet Endpoint for Aircraft at Location

**Files:**
- Modify: `backend/src/services/schedule.ts`
- Modify: `backend/src/routes/schedules.ts`

**Step 1: Add `findFleetForBid` method**

Add a method to ScheduleService that returns active fleet aircraft with location status relative to a departure ICAO:

```typescript
findFleetForBid(depIcao: string): (FleetAircraft & { atDeparture: boolean })[] {
  const rows = getDb()
    .prepare('SELECT * FROM fleet WHERE status = \'active\' ORDER BY icao_type, registration')
    .all() as FleetRow[];

  return rows.map(row => {
    const aircraft = this.toFleetAircraft(row);
    const effectiveLocation = row.location_icao ?? row.base_icao;
    const atDeparture = effectiveLocation === depIcao;
    return { ...aircraft, atDeparture };
  });
}
```

**Step 2: Add route**

```typescript
// GET /api/fleet/for-bid?dep_icao=KJFK — active fleet with location match info
router.get('/fleet/for-bid', authMiddleware, (req, res) => {
  try {
    const depIcao = req.query.dep_icao as string;
    if (!depIcao) {
      res.status(400).json({ error: 'dep_icao query parameter is required' });
      return;
    }
    const fleet = service.findFleetForBid(depIcao);
    res.json({ fleet });
  } catch (err) {
    logger.error('Schedule', 'Fleet for bid error', err);
    res.status(500).json({ error: 'Failed to fetch fleet' });
  }
});
```

**Step 3: Add shared type**

In `shared/src/types/schedule.ts`:
```typescript
export interface FleetForBidItem extends FleetAircraft {
  atDeparture: boolean;
}

export interface FleetForBidResponse {
  fleet: FleetForBidItem[];
}
```

**Step 4: Verify & commit**

```bash
git add shared/src/types/schedule.ts backend/src/services/schedule.ts backend/src/routes/schedules.ts
git commit -m "feat: add GET /api/fleet/for-bid endpoint for aircraft selection"
```

---

### Task 6: Frontend — Aircraft Selector Modal

**Files:**
- Modify: `frontend/src/pages/SchedulePage.tsx`

**Step 1: Create AircraftSelectorModal component**

Add a new component inside SchedulePage.tsx that:
- Fetches active fleet via `GET /api/fleet/for-bid?dep_icao=X`
- Shows each aircraft with registration, type, name, location
- Disables aircraft not at departure (greyed out, with location shown)
- On selection, calls `POST /api/bids` with `{ scheduleId, aircraftId }`
- Displays returned warnings as toast notifications
- On hard-block error, shows error inline

```typescript
interface AircraftSelectorProps {
  schedule: ScheduleListItem;
  onClose: () => void;
  onBidPlaced: (bid: BidWithDetails, warnings: string[]) => void;
}

function AircraftSelectorModal({ schedule, onClose, onBidPlaced }: AircraftSelectorProps) {
  const [fleet, setFleet] = useState<FleetForBidItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState<number | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get<FleetForBidResponse>(`/api/fleet/for-bid?dep_icao=${schedule.depIcao}`)
      .then(data => setFleet(data.fleet))
      .catch(() => setError('Failed to load fleet'))
      .finally(() => setLoading(false));
  }, [schedule.depIcao]);

  const handleSelect = async (aircraftId: number) => {
    setSubmitting(aircraftId);
    setError('');
    try {
      const res = await api.post<BidResponse>('/api/bids', {
        scheduleId: schedule.id,
        aircraftId,
      });
      onBidPlaced(res.bid, res.warnings);
    } catch (err: any) {
      setError(err?.message || 'Failed to place bid');
    } finally {
      setSubmitting(null);
    }
  };

  // Render: modal overlay with fleet list
  // Aircraft at departure: enabled, blue highlight
  // Aircraft not at departure: greyed, disabled, shows current location
  // Show aircraft type, registration, name, range, cargo/pax indicator
}
```

Import `FleetForBidItem`, `FleetForBidResponse`, `BidResponse` from `@acars/shared`.

**Step 2: Replace direct bid call with modal**

In `SchedulePage`, change the "Bid" button handler:
- Instead of calling `handleBid(scheduleId)` directly, open the `AircraftSelectorModal`
- Add state: `const [bidModalSchedule, setBidModalSchedule] = useState<ScheduleListItem | null>(null)`
- "Bid" button: `onClick={() => setBidModalSchedule(s)}`
- On successful bid from modal: update schedules, myBids, show warning toasts, close modal

**Step 3: Show warnings as toasts**

Import toast from `../../stores/toastStore`:
```typescript
import { toast } from '../stores/toastStore';
```

When bid is placed with warnings:
```typescript
const handleBidPlaced = (bid: BidWithDetails, warnings: string[]) => {
  setMyBids(prev => [...prev, bid]);
  setSchedules(prev => prev.map(s =>
    s.id === bid.scheduleId ? { ...s, hasBid: true, bidCount: s.bidCount + 1 } : s
  ));
  setBidModalSchedule(null);
  warnings.forEach(w => toast.warning(w));
};
```

**Step 4: Verify the UI works**

Run: `npm run dev:all`
Test: Click Bid on a schedule, aircraft selector opens, select aircraft, bid placed.

**Step 5: Commit**

```bash
git add frontend/src/pages/SchedulePage.tsx
git commit -m "feat: aircraft selector modal for bid placement with warnings"
```

---

### Task 7: Frontend — Update Charter Modal (Remove Aircraft Dropdown)

**Files:**
- Modify: `frontend/src/pages/SchedulePage.tsx`

**Step 1: Remove aircraft from CharterModal**

In the `CharterModal` component:
- Remove `aircraftTypes` prop
- Remove `aircraftType` state and the aircraft `<select>` dropdown
- Remove `aircraftType` from the submit payload
- Update `canSubmit` to not require aircraftType
- The charter modal now only has: charter type, departure, arrival, departure time

**Step 2: Update CharterModal invocation**

Remove `aircraftTypes` prop from the `<CharterModal>` call.

**Step 3: Update `handleCharterCreated`**

Since charters no longer auto-bid, the callback should just add the schedule (not a bid):
```typescript
const handleCharterCreated = (res: CreateCharterResponse) => {
  setSchedules(prev => [...prev, res.schedule]);
  setCharterOpen(false);
  setExpandedId(res.schedule.id);
};
```

**Step 4: Update schedule table to show "Any" for null aircraft type**

In the table cell that shows `s.aircraftType`:
```typescript
<td className="px-4 py-2.5 text-acars-muted">{s.aircraftType ?? 'Any'}</td>
```

And in FlightPreviewPanel stats row:
```typescript
<span className="text-acars-text">{s.aircraftType ?? 'Any'}</span>
```

**Step 5: Update My Bids sidebar**

Show aircraft registration in the bid card instead of (or in addition to) aircraft type:
```typescript
<span className="text-sky-400">{bid.aircraftRegistration ?? bid.aircraftType ?? 'Any'}</span>
```

**Step 6: Verify & commit**

```bash
git add frontend/src/pages/SchedulePage.tsx
git commit -m "feat: remove aircraft from charter modal, show 'Any' for null aircraft type"
```

---

### Task 8: Charter Generation — Location-Aware Routes

**Files:**
- Modify: `backend/src/services/charter-generator.ts`

**Step 1: Add location-aware pass to `generateMonthlyCharters`**

After the main generation loop, add a second pass that generates charters matched to fleet positions:

```typescript
// ── Location-aware pass: 20-30% of target count ──────
const locationTarget = Math.floor(targetCount * (0.20 + Math.random() * 0.10));
let locationCount = 0;

// Get active fleet positions
const fleetPositions = db.prepare(`
  SELECT id, icao_type, range_nm, cruise_speed, is_cargo, cat,
         COALESCE(location_icao, base_icao) AS location
  FROM fleet
  WHERE status = 'active' AND COALESCE(location_icao, base_icao) IS NOT NULL
`).all() as (FleetTypeRow & { id: number; location: string })[];

for (const ac of fleetPositions) {
  if (locationCount >= locationTarget) break;

  // Get coordinates for this aircraft's location
  const locCoords = lookupCoords(db, ac.location);
  if (!locCoords) continue;

  const origin: AirportRow = { icao: ac.location, lat: locCoords.lat, lon: locCoords.lon };
  const maxRange = Math.floor((ac.range_nm || 2000) * 0.9);
  const minRwy = minRunwayForCategory(ac.cat);

  // Generate 1-2 charters from this location
  const chartersForAc = 1 + Math.floor(Math.random() * 2);
  for (let j = 0; j < chartersForAc && locationCount < locationTarget; j++) {
    const dest = this.findRandomDestination(db, origin, maxRange, null, minRwy);
    if (!dest || origin.icao === dest.ident) continue;

    const distanceNm = haversineNm(origin.lat, origin.lon, dest.latitude_deg, dest.longitude_deg);
    if (distanceNm < 50) continue;

    const flightTimeMin = Math.round((distanceNm / ac.cruise_speed) * 60);
    const depHour = 6 + Math.floor(Math.random() * 17);
    const depMin = Math.floor(Math.random() * 4) * 15;
    const depTime = `${String(depHour).padStart(2, '0')}:${String(depMin).padStart(2, '0')}`;
    const arrTotalMin = depHour * 60 + depMin + flightTimeMin;
    const arrH = Math.floor(arrTotalMin / 60) % 24;
    const arrM = arrTotalMin % 60;
    const arrTime = `${String(arrH).padStart(2, '0')}:${String(arrM).padStart(2, '0')}`;

    const flightNumber = randomFlightNumber(db);
    insertStmt.run(
      flightNumber, origin.icao, dest.ident, ac.icao_type,
      depTime, arrTime, distanceNm, flightTimeMin, expiresAt,
    );
    charterCount++;
    locationCount++;
  }
}
```

Add a helper to look up airport coordinates:
```typescript
function lookupCoords(db: ReturnType<typeof getDb>, icao: string): { lat: number; lon: number } | null {
  const legacy = db.prepare('SELECT lat, lon FROM airports WHERE icao = ?').get(icao) as { lat: number; lon: number } | undefined;
  if (legacy) return legacy;
  const oa = db.prepare('SELECT latitude_deg AS lat, longitude_deg AS lon FROM oa_airports WHERE ident = ? AND latitude_deg IS NOT NULL').get(icao) as { lat: number; lon: number } | undefined;
  return oa ?? null;
}
```

**Step 2: Bias toward cargo**

When picking aircraft in the location-aware pass, bias toward cargo aircraft (reflect SMA Virtual identity). The fleet positions array already includes `is_cargo` — sort to put cargo aircraft first:

```typescript
// Sort cargo-first for SMA identity
fleetPositions.sort((a, b) => b.is_cargo - a.is_cargo);
```

**Step 3: Verify generation**

Run the app, trigger a force-regenerate from admin panel.
Expected: Some generated charters now match fleet aircraft locations.

**Step 4: Commit**

```bash
git add backend/src/services/charter-generator.ts
git commit -m "feat: location-aware charter generation (20-30% matched to fleet positions)"
```

---

### Task 9: Final Integration Testing & Cleanup

**Step 1: End-to-end test**

1. Create a charter (no aircraft) — should appear in schedule with "Any" aircraft column
2. Click Bid → aircraft selector opens → select aircraft at departure → bid placed
3. Try selecting aircraft not at departure → hard block error shown
4. Select aircraft with insufficient range → bid placed with range warning toast
5. Remove bid → charter persists (for user-created), or charter stays (for generated)
6. Check My Bids sidebar shows aircraft registration

**Step 2: Verify no TypeScript errors**

Run: `cd shared && npx tsc && cd ../backend && npx tsc --noEmit && cd ../frontend && npx tsc --noEmit`

**Step 3: Final commit**

```bash
git add -A
git commit -m "feat: aircraft selection at bid time — complete implementation"
```
