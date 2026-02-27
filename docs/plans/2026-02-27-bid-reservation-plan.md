# Bid Reservation System Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make bids exclusive 24-hour reservations that lock both the flight and aircraft, with admin force-removal and fleet page status display.

**Architecture:** Add `expires_at` column to `active_bids`, enforce schedule+aircraft exclusivity in `placeBid()`, run a 5-minute interval sweep to delete expired bids, add admin force-remove endpoint, extend fleet API to include bid reservation info, and update frontend to show reserved/in-flight status.

**Tech Stack:** SQLite migration, Express routes, Socket.io events, React/Tailwind frontend

---

### Task 1: Database Migration — Add `expires_at` Column

**Files:**
- Create: `backend/src/db/migrations/028-bid-expiration.sql`

**Step 1: Create migration file**

```sql
-- 028-bid-expiration.sql
-- Add expiration timestamp to active_bids for 24-hour bid reservations
ALTER TABLE active_bids ADD COLUMN expires_at TEXT;

-- Backfill existing bids: set expires_at to 24 hours from created_at
UPDATE active_bids SET expires_at = datetime(created_at, '+24 hours') WHERE expires_at IS NULL;
```

**Step 2: Verify migration runs on startup**

The migration system auto-applies new files. Run `npm run dev:all` and check the backend log for the migration applying successfully. Stop the app after confirming.

**Step 3: Commit**

```bash
git add backend/src/db/migrations/028-bid-expiration.sql
git commit -m "feat(bids): add expires_at column for 24-hour bid reservations"
```

---

### Task 2: Shared Types — Add `expiresAt` to Bid, Add Socket Event, Add Fleet Bid Info

**Files:**
- Modify: `shared/src/types/schedule.ts` (Bid interface, FleetAircraft interface)
- Modify: `shared/src/types/websocket.ts` (ServerToClientEvents)

**Step 1: Add `expiresAt` to `Bid` interface**

In `shared/src/types/schedule.ts`, add `expiresAt` to the `Bid` interface (after `createdAt`):

```typescript
export interface Bid {
  id: number;
  userId: number;
  scheduleId: number;
  aircraftId: number | null;
  createdAt: string;
  expiresAt: string | null;
}
```

**Step 2: Add `reservedByBidId` and `bidFlightPhase` to `FleetAircraft`**

At the bottom of the `FleetAircraft` interface, add:

```typescript
  // Bid reservation info (computed, not stored in DB)
  reservedByPilot: string | null;
  bidFlightPhase: string | null;
```

**Step 3: Update `ScheduleListItem` — change `bidCount` semantics to `isReserved`**

In the `ScheduleListItem` interface, add an `isReserved` field:

```typescript
export interface ScheduleListItem extends ScheduledFlight {
  depName: string;
  arrName: string;
  bidCount: number;
  hasBid: boolean;
  isReserved: boolean;
  reservedByCallsign: string | null;
  eventName: string | null;
}
```

**Step 4: Add `bid:expired` socket event**

In `shared/src/types/websocket.ts`, add to `ServerToClientEvents`:

```typescript
  'bid:expired': (data: { bidId: number; flightNumber: string; reason: 'expired' | 'admin_removed' }) => void;
```

**Step 5: Build shared**

```bash
npx tsc -p shared/
```

**Step 6: Commit**

```bash
git add shared/src/types/schedule.ts shared/src/types/websocket.ts
git commit -m "feat(shared): add bid expiration types, fleet reservation info, bid:expired socket event"
```

---

### Task 3: Backend — Bid Exclusivity & Expiration in `placeBid()`

**Files:**
- Modify: `backend/src/services/schedule.ts` — `BidRow` interface, `placeBid()`, `toBidWithDetails()`

**Step 1: Add `expires_at` to `BidRow` interface**

In `backend/src/services/schedule.ts`, add `expires_at: string | null;` to the `BidRow` interface (after `created_at`).

**Step 2: Add exclusivity checks to `placeBid()`**

In the `placeBid()` method, AFTER the aircraft validation (line ~317) and BEFORE the warnings block (line ~320), add two new checks:

```typescript
    // 3. Check schedule exclusivity — only one pilot per flight
    const existingScheduleBid = db.prepare(`
      SELECT ab.id, u.callsign FROM active_bids ab
      JOIN users u ON u.id = ab.user_id
      WHERE ab.schedule_id = ? AND ab.user_id != ?
        AND (ab.expires_at IS NULL OR ab.expires_at > datetime('now'))
    `).get(scheduleId, userId) as { id: number; callsign: string } | undefined;
    if (existingScheduleBid) {
      return { error: `This flight is already reserved by ${existingScheduleBid.callsign}` };
    }

    // 4. Check aircraft exclusivity — only one pilot per aircraft
    const existingAircraftBid = db.prepare(`
      SELECT ab.id, u.callsign, sf.flight_number FROM active_bids ab
      JOIN users u ON u.id = ab.user_id
      JOIN scheduled_flights sf ON sf.id = ab.schedule_id
      WHERE ab.aircraft_id = ? AND ab.user_id != ?
        AND (ab.expires_at IS NULL OR ab.expires_at > datetime('now'))
    `).get(aircraftId, userId) as { id: number; callsign: string; flight_number: string } | undefined;
    if (existingAircraftBid) {
      return { error: `Aircraft is reserved by ${existingAircraftBid.callsign} for flight ${existingAircraftBid.flight_number}` };
    }
```

**Step 3: Update INSERT to include `expires_at`**

Change the INSERT statement in `placeBid()` from:

```typescript
db.prepare('INSERT INTO active_bids (user_id, schedule_id, aircraft_id) VALUES (?, ?, ?)').run(userId, scheduleId, aircraftId);
```

To:

```typescript
db.prepare("INSERT INTO active_bids (user_id, schedule_id, aircraft_id, expires_at) VALUES (?, ?, ?, datetime('now', '+24 hours'))").run(userId, scheduleId, aircraftId);
```

**Step 4: Update `toBidWithDetails` mapper**

Add `expiresAt: row.expires_at ?? null` to the return object in `toBidWithDetails()`.

**Step 5: Update all bid SELECT queries**

In `findMyBids()`, `findAllBids()`, and `findBidByUserAndSchedule()` — add `ab.expires_at` to the SELECT column list.

**Step 6: Build and verify**

```bash
npx tsc -p shared/ && npm run build -w backend
```

**Step 7: Commit**

```bash
git add backend/src/services/schedule.ts
git commit -m "feat(bids): enforce schedule + aircraft exclusivity, set 24h expiration on bid"
```

---

### Task 4: Backend — Bid Expiration Sweep Service

**Files:**
- Create: `backend/src/services/bid-expiration.ts`
- Modify: `backend/src/index.ts` (register the interval)

**Step 1: Create `BidExpirationService`**

```typescript
import type { Server as SocketServer } from 'socket.io';
import type { ServerToClientEvents, ClientToServerEvents } from '@acars/shared';
import { getDb } from '../db/index.js';
import { logger } from '../lib/logger.js';

/**
 * Sweeps expired bids every 5 minutes.
 * Bids with flight_plan_phase = 'airborne' or 'active' are protected from expiry.
 */
export class BidExpirationService {
  private interval: ReturnType<typeof setInterval> | null = null;
  private io: SocketServer<ClientToServerEvents, ServerToClientEvents>;

  constructor(io: SocketServer<ClientToServerEvents, ServerToClientEvents>) {
    this.io = io;
  }

  start(): void {
    // Run immediately on startup, then every 5 minutes
    this.sweep();
    this.interval = setInterval(() => this.sweep(), 5 * 60 * 1000);
    this.interval.unref();
    logger.info('BidExpiration', 'Sweep service started (every 5 min)');
  }

  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  private sweep(): void {
    const db = getDb();

    // Find expired bids that are NOT airborne/active (protected phases)
    const expiredBids = db.prepare(`
      SELECT ab.id, ab.user_id, ab.schedule_id, ab.aircraft_id,
             sf.flight_number, sf.charter_type, ab.flight_plan_phase
      FROM active_bids ab
      JOIN scheduled_flights sf ON sf.id = ab.schedule_id
      WHERE ab.expires_at IS NOT NULL
        AND ab.expires_at < datetime('now')
        AND (ab.flight_plan_phase IS NULL OR ab.flight_plan_phase NOT IN ('airborne', 'active'))
    `).all() as {
      id: number;
      user_id: number;
      schedule_id: number;
      aircraft_id: number | null;
      flight_number: string;
      charter_type: string | null;
      flight_plan_phase: string | null;
    }[];

    if (expiredBids.length === 0) return;

    const userCreatedTypes = ['reposition', 'cargo', 'passenger'];

    for (const bid of expiredBids) {
      // Delete the bid
      db.prepare('DELETE FROM active_bids WHERE id = ?').run(bid.id);

      // Delete user-created charter schedules (one-off)
      if (bid.charter_type && userCreatedTypes.includes(bid.charter_type)) {
        db.prepare('DELETE FROM scheduled_flights WHERE id = ?').run(bid.schedule_id);
      }

      // Notify the pilot via socket
      this.notifyUser(bid.user_id, bid.id, bid.flight_number, 'expired');

      logger.info('BidExpiration', `Expired bid ${bid.id} for flight ${bid.flight_number} (user ${bid.user_id})`);
    }
  }

  /** Notify a specific user about bid expiration via their connected sockets */
  notifyUser(userId: number, bidId: number, flightNumber: string, reason: 'expired' | 'admin_removed'): void {
    // Find all connected sockets for this user
    for (const [, socket] of this.io.sockets.sockets) {
      const s = socket as any;
      if (s.user?.userId === userId) {
        socket.emit('bid:expired', { bidId, flightNumber, reason });
      }
    }
  }
}
```

**Step 2: Register in `backend/src/index.ts`**

After the WebSocket setup line (`const io = setupWebSocket(...)`), add:

```typescript
import { BidExpirationService } from './services/bid-expiration.js';
```

After `app.use('/api', dispatchRouter(io, telemetry, flightEventTracker));`, add:

```typescript
// Bid expiration sweep (every 5 minutes)
const bidExpiration = new BidExpirationService(io);
bidExpiration.start();
```

In the `shutdown()` function, add `bidExpiration.stop();` before `io.close();`.

**Step 3: Build and verify**

```bash
npm run build -w backend
```

**Step 4: Commit**

```bash
git add backend/src/services/bid-expiration.ts backend/src/index.ts
git commit -m "feat(bids): add 5-minute expiration sweep service with socket notifications"
```

---

### Task 5: Backend — Admin Force-Remove Endpoint

**Files:**
- Modify: `backend/src/services/schedule.ts` — add `forceRemoveBid()` method
- Modify: `backend/src/routes/schedules.ts` — add `DELETE /api/bids/:id/force` route

**Step 1: Add `forceRemoveBid()` to `ScheduleService`**

In `backend/src/services/schedule.ts`, after `removeBid()`, add:

```typescript
  forceRemoveBid(bidId: number): { userId: number; flightNumber: string } | null {
    const db = getDb();

    const bid = db.prepare(
      'SELECT ab.user_id, ab.schedule_id, sf.flight_number, sf.charter_type FROM active_bids ab JOIN scheduled_flights sf ON sf.id = ab.schedule_id WHERE ab.id = ?'
    ).get(bidId) as { user_id: number; schedule_id: number; flight_number: string; charter_type: string | null } | undefined;

    if (!bid) return null;

    db.prepare('DELETE FROM active_bids WHERE id = ?').run(bidId);

    // User-created charters are one-off — delete the schedule when bid is removed
    const userCreatedTypes = ['reposition', 'cargo', 'passenger'];
    if (bid.charter_type && userCreatedTypes.includes(bid.charter_type)) {
      db.prepare('DELETE FROM scheduled_flights WHERE id = ?').run(bid.schedule_id);
    }

    return { userId: bid.user_id, flightNumber: bid.flight_number };
  }
```

**Step 2: Add route in `backend/src/routes/schedules.ts`**

The route needs access to the `BidExpirationService` for notifications. Instead, we'll pass `io` to the schedule router.

Change `scheduleRouter()` signature to accept `io`:

```typescript
export function scheduleRouter(io?: SocketServer<ClientToServerEvents, ServerToClientEvents>): Router {
```

Add the necessary imports at the top:

```typescript
import type { Server as SocketServer } from 'socket.io';
import type { ServerToClientEvents, ClientToServerEvents } from '@acars/shared';
import { adminMiddleware } from '../middleware/auth.js';
```

Add the route after the existing `DELETE /api/bids/:id`:

```typescript
  // DELETE /api/bids/:id/force — admin force-remove (any bid)
  router.delete('/bids/:id/force', authMiddleware, adminMiddleware, (req, res) => {
    try {
      const bidId = parseInt(req.params.id as string, 10);
      if (isNaN(bidId)) {
        res.status(400).json({ error: 'Invalid bid ID' });
        return;
      }

      const result = service.forceRemoveBid(bidId);
      if (!result) {
        res.status(404).json({ error: 'Bid not found' });
        return;
      }

      // Notify the affected pilot
      if (io) {
        for (const [, socket] of io.sockets.sockets) {
          const s = socket as any;
          if (s.user?.userId === result.userId) {
            socket.emit('bid:expired', { bidId, flightNumber: result.flightNumber, reason: 'admin_removed' });
          }
        }
      }

      logger.info('Schedule', `Admin ${req.user!.callsign} force-removed bid ${bidId} (flight ${result.flightNumber})`);
      res.status(204).send();
    } catch (err) {
      logger.error('Schedule', 'Force remove bid error', err);
      res.status(500).json({ error: 'Failed to remove bid' });
    }
  });
```

**Step 3: Update `index.ts` to pass `io` to `scheduleRouter`**

In `backend/src/index.ts`, change:

```typescript
app.use('/api', scheduleRouter());
```

To:

```typescript
app.use('/api', scheduleRouter(io));
```

Note: `scheduleRouter` is registered before `io` is created. Move the `scheduleRouter` registration to AFTER the `setupWebSocket` call. The line should go after `const io = setupWebSocket(...)`.

**Step 4: Build and verify**

```bash
npm run build -w backend
```

**Step 5: Commit**

```bash
git add backend/src/services/schedule.ts backend/src/routes/schedules.ts backend/src/index.ts
git commit -m "feat(bids): add admin force-remove endpoint with socket notification"
```

---

### Task 6: Backend — Update Fleet API to Include Bid Reservation Info

**Files:**
- Modify: `backend/src/services/fleet.ts` — update `findAll()` to include bid info
- Modify: `backend/src/services/schedule.ts` — update `findFleetForBid()` to exclude reserved aircraft
- Modify: `backend/src/services/schedule.ts` — update `findSchedules()` to include `isReserved`

**Step 1: Update `FleetService.findAll()` to return bid reservation info**

In `backend/src/services/fleet.ts`, update the SQL query in `findAll()` to LEFT JOIN active_bids:

```typescript
  findAll(filters?: FleetFilters): FleetAircraft[] {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (filters?.icaoType) {
      conditions.push('f.icao_type = ?');
      params.push(filters.icaoType);
    }
    if (filters?.status && VALID_STATUSES.has(filters.status)) {
      conditions.push('f.status = ?');
      params.push(filters.status);
    }
    if (filters?.search) {
      conditions.push('(f.registration LIKE ? OR f.name LIKE ? OR f.icao_type LIKE ? OR f.base_icao LIKE ?)');
      const term = `%${filters.search}%`;
      params.push(term, term, term, term);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const sql = `
      SELECT f.*,
        ab.id AS bid_id,
        ab.flight_plan_phase AS bid_flight_phase,
        u.callsign AS bid_pilot_callsign
      FROM fleet f
      LEFT JOIN active_bids ab ON ab.aircraft_id = f.id
        AND (ab.expires_at IS NULL OR ab.expires_at > datetime('now'))
      LEFT JOIN users u ON u.id = ab.user_id
      ${where}
      ORDER BY f.icao_type, f.registration
    `;

    const rows = getDb().prepare(sql).all(...params) as (FleetRow & {
      bid_id: number | null;
      bid_flight_phase: string | null;
      bid_pilot_callsign: string | null;
    })[];

    return rows.map(row => ({
      ...this.toFleetAircraft(row),
      reservedByPilot: row.bid_pilot_callsign ?? null,
      bidFlightPhase: row.bid_flight_phase ?? null,
    }));
  }
```

**Step 2: Update `ScheduleService.findFleetForBid()` to exclude aircraft reserved by others**

In `backend/src/services/schedule.ts`, update `findFleetForBid()` to accept `userId` and filter out reserved aircraft:

```typescript
  findFleetForBid(depIcao: string, userId: number): FleetForBidItem[] {
    const rows = getDb()
      .prepare(`
        SELECT f.* FROM fleet f
        WHERE f.status = 'active'
          AND NOT EXISTS (
            SELECT 1 FROM active_bids ab
            WHERE ab.aircraft_id = f.id
              AND ab.user_id != ?
              AND (ab.expires_at IS NULL OR ab.expires_at > datetime('now'))
          )
        ORDER BY f.icao_type, f.registration
      `)
      .all(userId) as FleetRow[];

    return rows.map(row => {
      const aircraft = this.toFleetAircraft(row);
      const effectiveLocation = row.location_icao ?? row.base_icao;
      const atDeparture = effectiveLocation === depIcao;
      return { ...aircraft, atDeparture };
    });
  }
```

**Step 3: Update fleet/for-bid route to pass userId**

In `backend/src/routes/schedules.ts`, update the `/fleet/for-bid` handler:

```typescript
const fleet = service.findFleetForBid(depIcao, req.user!.userId);
```

**Step 4: Update `findSchedules()` to include `isReserved` info**

In the `findSchedules()` SQL query, add a subquery to check if the schedule has a non-expired bid from another user:

Add after the `has_bid` subquery:

```sql
(SELECT COUNT(*) FROM active_bids ab WHERE ab.schedule_id = sf.id AND ab.user_id != ? AND (ab.expires_at IS NULL OR ab.expires_at > datetime('now'))) AS is_reserved,
(SELECT u.callsign FROM active_bids ab JOIN users u ON u.id = ab.user_id WHERE ab.schedule_id = sf.id AND ab.user_id != ? AND (ab.expires_at IS NULL OR ab.expires_at > datetime('now')) LIMIT 1) AS reserved_by_callsign,
```

The `userIdParam` will need to be passed twice more. Update the `.all()` params accordingly:

```typescript
.all(userIdParam, userIdParam, userIdParam, ...params)
```

**Step 5: Update `ScheduleRow` and `toScheduleListItem` mapper**

Add to `ScheduleRow`:
```typescript
  is_reserved: number;
  reserved_by_callsign: string | null;
```

Add to the `toScheduleListItem()` return:
```typescript
  isReserved: row.is_reserved > 0,
  reservedByCallsign: row.reserved_by_callsign ?? null,
```

**Step 6: Build and verify**

```bash
npx tsc -p shared/ && npm run build -w backend
```

**Step 7: Commit**

```bash
git add backend/src/services/fleet.ts backend/src/services/schedule.ts backend/src/routes/schedules.ts
git commit -m "feat(bids): fleet API shows reservation status, schedule API shows reserved state"
```

---

### Task 7: Frontend — Schedule Page Bid Exclusivity UI

**Files:**
- Modify: `frontend/src/pages/SchedulePage.tsx`

**Step 1: Update bid button to respect `isReserved`**

In the schedule table rows where the bid/unbid buttons are rendered, add a check: if the schedule `isReserved` is true and the user doesn't already have a bid (`!hasBid`), show a "Reserved" badge instead of a bid button.

Find the bid action button area and wrap with:

```typescript
{schedule.isReserved && !schedule.hasBid ? (
  <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide bg-amber-500/10 text-amber-400 border border-amber-400/20">
    Reserved
  </span>
) : (
  // existing bid/unbid button
)}
```

**Step 2: Show expiry countdown on user's own bids**

In the "My Bids" sidebar section, for each bid display the time remaining. Add a helper:

```typescript
function formatTimeRemaining(expiresAt: string | null): string | null {
  if (!expiresAt) return null;
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return 'Expired';
  const hours = Math.floor(ms / 3600000);
  const mins = Math.floor((ms % 3600000) / 60000);
  return `${hours}h ${mins}m`;
}
```

Show the remaining time below each bid in the sidebar:

```typescript
<span className="text-[9px] text-acars-muted">{formatTimeRemaining(bid.expiresAt)}</span>
```

**Step 3: Listen for `bid:expired` socket event**

Add a socket listener for `bid:expired` in the SchedulePage (or app-level). When received:
- Show a toast: `toast.warning(\`Your bid for ${data.flightNumber} ${data.reason === 'expired' ? 'has expired' : 'was removed by an administrator'}\`)`
- Re-fetch bids

**Step 4: Build and verify**

```bash
npm run build -w frontend
```

**Step 5: Commit**

```bash
git add frontend/src/pages/SchedulePage.tsx
git commit -m "feat(bids): schedule page shows reserved flights, expiry countdown, and expired notifications"
```

---

### Task 8: Frontend — Fleet Page Reservation Status

**Files:**
- Modify: `frontend/src/pages/FleetPage.tsx`

**Step 1: Add `Reserved` and `In Flight` badge variants**

Update the `StatusBadge` component or add a new `FleetStatusBadge` that considers bid info:

```typescript
function FleetStatusDisplay({ aircraft }: { aircraft: FleetAircraft }) {
  // If aircraft has an active bid, show reservation status
  if (aircraft.bidFlightPhase === 'airborne' || aircraft.bidFlightPhase === 'active') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide bg-blue-500/10 text-blue-400 border border-blue-400/20">
        In Flight
      </span>
    );
  }
  if (aircraft.reservedByPilot) {
    return (
      <div className="flex flex-col items-center gap-0.5">
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide bg-amber-500/10 text-amber-400 border border-amber-400/20">
          Reserved
        </span>
        <span className="text-[9px] text-acars-muted">{aircraft.reservedByPilot}</span>
      </div>
    );
  }
  // Fall back to normal fleet status
  return <StatusBadge status={aircraft.status} />;
}
```

**Step 2: Replace `StatusBadge` with `FleetStatusDisplay` in the table**

In the fleet table body, replace:

```typescript
<StatusBadge status={a.status} />
```

With:

```typescript
<FleetStatusDisplay aircraft={a} />
```

**Step 3: Update status counts to include reserved/in-flight**

Update the `statusCounts` memo to also count reserved and in-flight aircraft:

```typescript
const statusCounts = useMemo(() => {
  const counts = { active: 0, stored: 0, retired: 0, maintenance: 0, reserved: 0, inFlight: 0 };
  fleet.forEach(a => {
    if (a.bidFlightPhase === 'airborne' || a.bidFlightPhase === 'active') {
      counts.inFlight++;
    } else if (a.reservedByPilot) {
      counts.reserved++;
    } else if (counts[a.status] !== undefined) {
      counts[a.status]++;
    }
  });
  return counts;
}, [fleet]);
```

Display the new counts in the header bar after the existing ones:

```typescript
{statusCounts.reserved > 0 && <span className="text-[10px] text-amber-400 tabular-nums">{statusCounts.reserved} reserved</span>}
{statusCounts.inFlight > 0 && <span className="text-[10px] text-blue-400 tabular-nums">{statusCounts.inFlight} in flight</span>}
```

**Step 4: Build and verify**

```bash
npm run build -w frontend
```

**Step 5: Commit**

```bash
git add frontend/src/pages/FleetPage.tsx
git commit -m "feat(fleet): show Reserved/In Flight status badges for bid-locked aircraft"
```

---

### Task 9: Frontend — Admin Bid Management (All Bids view)

**Files:**
- Modify: `frontend/src/pages/SchedulePage.tsx` (or wherever AllBids is rendered — check for `findAllBids` usage)

**Step 1: Find where all bids are displayed for admins**

Search for the admin bids view (likely uses `GET /api/bids/all`). Add a "Force Remove" button on each bid row visible only to admin users.

**Step 2: Add force-remove handler**

```typescript
const handleForceRemove = async (bidId: number) => {
  if (!confirm('Remove this bid? The pilot will be notified.')) return;
  try {
    await api.delete(`/api/bids/${bidId}/force`);
    // Re-fetch bids list
    fetchAllBids();
    toast.success('Bid removed');
  } catch (err: any) {
    toast.error(err?.message || 'Failed to remove bid');
  }
};
```

**Step 3: Render the button**

In each bid row for admin view, add:

```typescript
<button
  onClick={() => handleForceRemove(bid.id)}
  className="text-[10px] text-red-400 hover:text-red-300 transition-colors"
>
  Force Remove
</button>
```

**Step 4: Build and verify**

```bash
npm run build -w frontend
```

**Step 5: Commit**

```bash
git add frontend/src/pages/SchedulePage.tsx
git commit -m "feat(bids): admin can force-remove any pilot's bid"
```

---

### Task 10: Integration Test — Full Flow Verification

**Step 1: Run the full app**

```bash
npm run dev:all
```

**Step 2: Manual verification checklist**

1. **Bid placement**: Log in as a pilot, bid on a flight — verify `expires_at` is set (check bid response)
2. **Exclusivity**: Log in as a second user, try to bid on the same flight — should be rejected
3. **Aircraft lock**: Try to bid with the same aircraft on a different flight as the second user — should be rejected
4. **Fleet page**: Check fleet page shows "Reserved" badge on the aircraft with a bid
5. **Expiry countdown**: Check My Bids sidebar shows time remaining
6. **Admin force-remove**: Log in as admin, go to all bids view, force-remove a bid — verify toast notification on pilot's screen
7. **Expired bid sweep**: (Optionally reduce sweep interval to test) — verify expired bids are cleaned up

**Step 3: Final commit**

```bash
git add -A
git commit -m "feat(bids): bid reservation system — 24h expiry, exclusivity, admin force-remove, fleet status"
```
