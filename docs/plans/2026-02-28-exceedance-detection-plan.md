# Exceedance Detection Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Detect hard landings, overspeeds, overweight landings, unstable approaches, and tailstrikes in real-time from SimConnect telemetry, store them, and display them on the flight detail page.

**Architecture:** Electron-side detection at 200ms polling. Each exceedance fires a Socket.io `flight:exceedance` event to the backend, which stores it in a new `flight_exceedances` table and broadcasts to dispatch observers. At PIREP submission, exceedances are linked to the logbook entry. The flight detail page fetches and displays them.

**Tech Stack:** TypeScript, SimConnect (MSFS), Socket.io, better-sqlite3, React

---

### Task 1: Add shared constants — AircraftLimits and ExceedanceThresholds

**Files:**
- Create: `shared/src/constants/aircraft-limits.ts`
- Modify: `shared/src/index.ts` (add re-exports)

**Step 1: Create `shared/src/constants/aircraft-limits.ts`**

```typescript
/** Per-type operating limits for exceedance detection */
export interface AircraftTypeLimit {
  vmoKts: number;       // max operating IAS (knots)
  mlwLbs: number;       // max landing weight (pounds)
  maxPitchDeg: number;  // tailstrike pitch limit (degrees nose up)
}

/**
 * Aircraft limits keyed by ICAO type code.
 * Used by ExceedanceDetector in Electron.
 * Extend as new types are added to the fleet.
 */
export const AircraftLimits: Record<string, AircraftTypeLimit> = {
  B738: { vmoKts: 340, mlwLbs: 144500, maxPitchDeg: 11 },
  B739: { vmoKts: 340, mlwLbs: 146300, maxPitchDeg: 11 },
  B744: { vmoKts: 365, mlwLbs: 630000, maxPitchDeg: 11.5 },
  B748: { vmoKts: 365, mlwLbs: 654000, maxPitchDeg: 11.5 },
  B752: { vmoKts: 350, mlwLbs: 210000, maxPitchDeg: 12 },
  B763: { vmoKts: 360, mlwLbs: 350000, maxPitchDeg: 11 },
  B77W: { vmoKts: 360, mlwLbs: 554000, maxPitchDeg: 11.5 },
  B788: { vmoKts: 360, mlwLbs: 380000, maxPitchDeg: 11 },
  A320: { vmoKts: 350, mlwLbs: 145505, maxPitchDeg: 12 },
  A332: { vmoKts: 350, mlwLbs: 396830, maxPitchDeg: 12 },
  A333: { vmoKts: 350, mlwLbs: 412264, maxPitchDeg: 12 },
  MD11: { vmoKts: 375, mlwLbs: 491500, maxPitchDeg: 10 },
  DC10: { vmoKts: 375, mlwLbs: 403000, maxPitchDeg: 10 },
  C208: { vmoKts: 175, mlwLbs: 8000, maxPitchDeg: 15 },
  C172: { vmoKts: 163, mlwLbs: 2550, maxPitchDeg: 15 },
};

/** Default limits when aircraft type is not in AircraftLimits */
export const DEFAULT_AIRCRAFT_LIMIT: AircraftTypeLimit = {
  vmoKts: 350,
  mlwLbs: 999999,  // effectively no limit
  maxPitchDeg: 12,
};

/** Universal exceedance thresholds (not aircraft-specific) */
export const ExceedanceThresholds = {
  HARD_LANDING_FPM: -600,
  HARD_LANDING_CRITICAL_FPM: -900,
  OVERSPEED_CRITICAL_MARGIN_KTS: 10,
  OVERWEIGHT_CRITICAL_MARGIN_PCT: 0.05,
  UNSTABLE_APPROACH_VS_FPM: -1000,
  UNSTABLE_APPROACH_ALT_AGL: 1000,
} as const;
```

**Step 2: Add re-exports to `shared/src/index.ts`**

After line 217 (`export { FlightPhase, PhaseThresholds } from './constants/flight-phases.js';`), add:

```typescript
export { AircraftLimits, DEFAULT_AIRCRAFT_LIMIT, ExceedanceThresholds } from './constants/aircraft-limits.js';
export type { AircraftTypeLimit } from './constants/aircraft-limits.js';
```

**Step 3: Build shared to verify**

Run: `npx tsc -p shared/ --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add shared/src/constants/aircraft-limits.ts shared/src/index.ts
git commit -m "feat(shared): add aircraft limits and exceedance thresholds"
```

---

### Task 2: Add shared types — ExceedanceType and FlightExceedance

**Files:**
- Create: `shared/src/types/exceedance.ts`
- Modify: `shared/src/types/websocket.ts` (add Socket.io events)
- Modify: `shared/src/index.ts` (add re-exports)

**Step 1: Create `shared/src/types/exceedance.ts`**

```typescript
export type ExceedanceType =
  | 'HARD_LANDING'
  | 'OVERSPEED'
  | 'OVERWEIGHT_LANDING'
  | 'UNSTABLE_APPROACH'
  | 'TAILSTRIKE';

export type ExceedanceSeverity = 'warning' | 'critical';

/** Payload sent from Electron → backend via Socket.io */
export interface ExceedanceEvent {
  type: ExceedanceType;
  severity: ExceedanceSeverity;
  value: number;
  threshold: number;
  unit: string;       // fpm | kts | lbs | deg
  phase: string;      // flight phase at detection
  message: string;    // human-readable description
  detectedAt: string; // ISO 8601 UTC
}

/** Stored exceedance record (includes DB identity fields) */
export interface FlightExceedance extends ExceedanceEvent {
  id: number;
  bidId: number;
  logbookId: number | null;
  pilotId: number;
}
```

**Step 2: Add WebSocket events to `shared/src/types/websocket.ts`**

At the top of the file, add import (after line 7):

```typescript
import type { ExceedanceEvent, FlightExceedance } from './exceedance.js';
```

In `ServerToClientEvents` (after `'bid:expired'` on line 44), add:

```typescript
  'dispatch:exceedance': (data: FlightExceedance) => void;
```

In `ClientToServerEvents` (after `'flight:ended'` on line 57), add:

```typescript
  'flight:exceedance': (data: ExceedanceEvent) => void;
```

**Step 3: Add re-exports to `shared/src/index.ts`**

After the logbook type exports (line 74), add:

```typescript
export type {
  ExceedanceType,
  ExceedanceSeverity,
  ExceedanceEvent,
  FlightExceedance,
} from './types/exceedance.js';
```

Also add `ExceedanceEvent, FlightExceedance` to the websocket.ts re-export on line 8:

```typescript
export type { TelemetrySnapshot, AcarsMessagePayload, ServerToClientEvents, ClientToServerEvents, ExceedanceEvent, FlightExceedance } from './types/websocket.js';
```

Wait — `FlightExceedance` and `ExceedanceEvent` are defined in `exceedance.ts`, not `websocket.ts`. Just re-export from `exceedance.ts`. The websocket.ts file *imports* them but doesn't re-export. So the re-export line in `index.ts` should be the one from `exceedance.ts` only. The `websocket.ts` re-export line stays as-is.

**Step 4: Build shared to verify**

Run: `npx tsc -p shared/ --noEmit`
Expected: No errors

**Step 5: Commit**

```bash
git add shared/src/types/exceedance.ts shared/src/types/websocket.ts shared/src/index.ts
git commit -m "feat(shared): add exceedance types and WebSocket events"
```

---

### Task 3: Add new SimVars — PLANE ALT ABOVE GROUND and TOTAL WEIGHT

**Files:**
- Modify: `shared/src/constants/simvars.ts` (add 2 simvars to POSITION_VARS)
- Modify: `electron/src/simconnect/simvars.ts` (same changes — this is a local copy)
- Modify: `electron/src/simconnect/reader.ts` (update `readPosition` return to include `altitudeAgl` and `totalWeight`)
- Modify: `shared/src/types/aircraft.ts` (add fields to `AircraftPosition`)

**Step 1: Add simvars to `shared/src/constants/simvars.ts`**

In `POSITION_VARS` array, after `PLANE BANK DEGREES` (line 38), add before the closing `];`:

```typescript
  { name: 'PLANE ALT ABOVE GROUND', units: 'feet', dataType: SimConnectDataType.FLOAT64 },
  { name: 'TOTAL WEIGHT', units: 'pounds', dataType: SimConnectDataType.FLOAT64 },
```

**Step 2: Apply identical changes to `electron/src/simconnect/simvars.ts`**

Same edit as Step 1 — both files are kept in sync.

**Step 3: Add fields to `AircraftPosition` type in `shared/src/types/aircraft.ts`**

After `bank: number;` add:

```typescript
  altitudeAgl: number;   // feet above ground level (radar altimeter)
  totalWeight: number;   // current gross weight in pounds
```

**Step 4: Update `readPosition` in `electron/src/simconnect/reader.ts`**

The reader must match the POSITION_VARS order exactly. After `bank: data.readFloat64(),` (line 29), add:

```typescript
    altitudeAgl: data.readFloat64(),
    totalWeight: data.readFloat64(),
```

**Step 5: Build shared + electron to verify**

Run: `npx tsc -p shared/ --noEmit`
Expected: No errors (frontend/backend may get TS errors until they use the new fields — that's fine)

**Step 6: Commit**

```bash
git add shared/src/constants/simvars.ts shared/src/types/aircraft.ts electron/src/simconnect/simvars.ts electron/src/simconnect/reader.ts
git commit -m "feat: add AGL altitude and total weight simvars"
```

---

### Task 4: Create the database migration for flight_exceedances

**Files:**
- Create: `backend/src/db/migrations/032-flight-exceedances.sql`

**Step 1: Create `backend/src/db/migrations/032-flight-exceedances.sql`**

```sql
-- Exceedance events detected during flight (hard landing, overspeed, etc.)
CREATE TABLE IF NOT EXISTS flight_exceedances (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  bid_id       INTEGER NOT NULL,
  logbook_id   INTEGER,
  pilot_id     INTEGER NOT NULL,
  type         TEXT    NOT NULL,
  severity     TEXT    NOT NULL DEFAULT 'warning',
  value        REAL    NOT NULL,
  threshold    REAL    NOT NULL,
  unit         TEXT    NOT NULL,
  phase        TEXT    NOT NULL,
  message      TEXT    NOT NULL,
  detected_at  TEXT    NOT NULL,
  created_at   TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_exceedances_bid     ON flight_exceedances(bid_id);
CREATE INDEX IF NOT EXISTS idx_exceedances_logbook ON flight_exceedances(logbook_id);
CREATE INDEX IF NOT EXISTS idx_exceedances_pilot   ON flight_exceedances(pilot_id);
```

**Step 2: Commit**

```bash
git add backend/src/db/migrations/032-flight-exceedances.sql
git commit -m "feat(backend): add flight_exceedances migration"
```

---

### Task 5: Create backend ExceedanceService

**Files:**
- Create: `backend/src/services/exceedance.ts`
- Modify: `backend/src/types/db-rows.ts` (add ExceedanceRow type)

**Step 1: Add `ExceedanceRow` to `backend/src/types/db-rows.ts`**

At the end of the file, add:

```typescript
export interface ExceedanceRow {
  id: number;
  bid_id: number;
  logbook_id: number | null;
  pilot_id: number;
  type: string;
  severity: string;
  value: number;
  threshold: number;
  unit: string;
  phase: string;
  message: string;
  detected_at: string;
  created_at: string;
}
```

**Step 2: Create `backend/src/services/exceedance.ts`**

```typescript
import { getDb } from '../db/index.js';
import type { ExceedanceRow } from '../types/db-rows.js';
import type { ExceedanceEvent, FlightExceedance } from '@acars/shared';
import { logger } from '../lib/logger.js';

function rowToExceedance(row: ExceedanceRow): FlightExceedance {
  return {
    id: row.id,
    bidId: row.bid_id,
    logbookId: row.logbook_id,
    pilotId: row.pilot_id,
    type: row.type as FlightExceedance['type'],
    severity: row.severity as FlightExceedance['severity'],
    value: row.value,
    threshold: row.threshold,
    unit: row.unit,
    phase: row.phase,
    message: row.message,
    detectedAt: row.detected_at,
  };
}

export class ExceedanceService {
  /** Insert a detected exceedance event. */
  insert(bidId: number, pilotId: number, event: ExceedanceEvent): FlightExceedance {
    const db = getDb();
    const result = db.prepare(`
      INSERT INTO flight_exceedances (bid_id, pilot_id, type, severity, value, threshold, unit, phase, message, detected_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      bidId, pilotId,
      event.type, event.severity,
      event.value, event.threshold, event.unit,
      event.phase, event.message, event.detectedAt,
    );
    logger.info('Exceedance', `Recorded ${event.type} for bid ${bidId}`, { severity: event.severity, value: event.value });
    return {
      id: result.lastInsertRowid as number,
      bidId,
      logbookId: null,
      pilotId,
      ...event,
    };
  }

  /** Link exceedances to a logbook entry after PIREP submission. */
  linkToLogbook(bidId: number, logbookId: number): void {
    const db = getDb();
    db.prepare('UPDATE flight_exceedances SET logbook_id = ? WHERE bid_id = ?').run(logbookId, bidId);
  }

  /** Get exceedances for a logbook entry. */
  findByLogbookId(logbookId: number): FlightExceedance[] {
    const db = getDb();
    const rows = db.prepare(
      'SELECT * FROM flight_exceedances WHERE logbook_id = ? ORDER BY detected_at',
    ).all(logbookId) as ExceedanceRow[];
    return rows.map(rowToExceedance);
  }

  /** Get exceedances for an active bid. */
  findByBidId(bidId: number): FlightExceedance[] {
    const db = getDb();
    const rows = db.prepare(
      'SELECT * FROM flight_exceedances WHERE bid_id = ? ORDER BY detected_at',
    ).all(bidId) as ExceedanceRow[];
    return rows.map(rowToExceedance);
  }
}
```

**Step 3: Commit**

```bash
git add backend/src/services/exceedance.ts backend/src/types/db-rows.ts
git commit -m "feat(backend): add ExceedanceService for storing exceedance events"
```

---

### Task 6: Wire exceedance handling into WebSocket handler and PIREP service

**Files:**
- Modify: `backend/src/websocket/handler.ts` (handle `flight:exceedance` event)
- Modify: `backend/src/services/pirep.ts` (link exceedances to logbook on submit)

**Step 1: Add exceedance handler to `backend/src/websocket/handler.ts`**

At the top, add imports (after existing imports ~line 14):

```typescript
import { ExceedanceService } from '../services/exceedance.js';
import { MaintenanceService } from '../services/maintenance.js';
import type { ExceedanceEvent } from '@acars/shared';
```

After `const vatsimTrackService = new VatsimTrackService();` (~line 52), add:

```typescript
  const exceedanceService = new ExceedanceService();
  const maintenanceService = new MaintenanceService();
```

After the `socket.on('flight:ended', ...)` handler (after line 365), add:

```typescript
    socket.on('flight:exceedance', (data: ExceedanceEvent) => {
      if (!socket.user) return;
      try {
        const bid = findActiveBidByUser().get(socket.user.userId) as { id: number } | undefined;
        if (!bid) return;
        const exceedance = exceedanceService.insert(bid.id, socket.user.userId, data);

        // Auto-create maintenance inspection for hard landings
        if (data.type === 'HARD_LANDING') {
          try {
            // Find aircraft from the bid's schedule
            const bidRow = getDb().prepare(
              `SELECT sf.aircraft_type FROM active_bids ab
               JOIN scheduled_flights sf ON sf.id = ab.schedule_id
               WHERE ab.id = ?`,
            ).get(bid.id) as { aircraft_type: string } | undefined;

            if (bidRow) {
              // Find fleet aircraft of this type to create maintenance entry
              const aircraft = getDb().prepare(
                `SELECT id, registration FROM fleet WHERE icao_type = ? AND status = 'active' LIMIT 1`,
              ).get(bidRow.aircraft_type) as { id: number; registration: string } | undefined;

              if (aircraft) {
                maintenanceService.createLog({
                  aircraftId: aircraft.id,
                  checkType: 'UNSCHEDULED',
                  description: `Hard landing inspection required\nLanding rate: ${data.value} fpm (limit: ${data.threshold} fpm)\nFlight by ${socket.user.callsign} at ${data.detectedAt}`,
                  scheduledDate: new Date().toISOString().split('T')[0],
                });
                logger.info('Exceedance', `Auto-created maintenance inspection for hard landing on ${aircraft.registration}`);
              }
            }
          } catch (err) {
            logger.error('Exceedance', 'Failed to create maintenance entry', err);
          }
        }

        // Broadcast to dispatch observers
        io.to(`bid:${bid.id}`).emit('dispatch:exceedance', exceedance);
      } catch (err) {
        logger.error('Exceedance', 'Failed to handle exceedance event', err);
      }
    });
```

**Step 2: Link exceedances in `backend/src/services/pirep.ts`**

Add import at the top (after existing imports):

```typescript
import { ExceedanceService } from './exceedance.js';
```

After the existing service instantiations (~line 58), add:

```typescript
const exceedanceService = new ExceedanceService();
```

Inside the `txn` function, after `db.prepare("UPDATE active_bids SET flight_plan_phase = 'completed' WHERE id = ?").run(bidId);` (line 208), add:

```typescript
      // Link exceedances to the logbook entry
      exceedanceService.linkToLogbook(bidId, logbookId);
```

**Step 3: Commit**

```bash
git add backend/src/websocket/handler.ts backend/src/services/pirep.ts
git commit -m "feat(backend): handle exceedance events and link to PIREPs"
```

---

### Task 7: Add REST endpoint for fetching exceedances

**Files:**
- Modify: `backend/src/routes/logbook.ts`

**Step 1: Add exceedance endpoint to `backend/src/routes/logbook.ts`**

Add import (after existing imports):

```typescript
import { ExceedanceService } from '../services/exceedance.js';
```

After `const service = new LogbookService();` (line 9), add:

```typescript
  const exceedanceService = new ExceedanceService();
```

After the `router.get('/logbook/:id', ...)` handler (before `return router;` on line 72), add:

```typescript
  // GET /api/logbook/:id/exceedances — exceedance events for a flight
  router.get('/logbook/:id/exceedances', authMiddleware, (req, res) => {
    try {
      const id = parseInt(req.params.id as string, 10);
      if (isNaN(id)) {
        res.status(400).json({ error: 'Invalid logbook entry ID' });
        return;
      }

      const entry = service.findById(id);
      if (!entry) {
        res.status(404).json({ error: 'Logbook entry not found' });
        return;
      }

      const isPrivileged = req.user!.role === 'admin' || req.user!.role === 'dispatcher';
      if (!isPrivileged && entry.userId !== req.user!.userId) {
        res.status(404).json({ error: 'Logbook entry not found' });
        return;
      }

      const exceedances = exceedanceService.findByLogbookId(id);
      res.json(exceedances);
    } catch (err) {
      logger.error('Logbook', 'Exceedances fetch error', err);
      res.status(500).json({ error: 'Failed to fetch exceedances' });
    }
  });
```

**Step 2: Build backend to verify**

Run: `npm run build -w backend`
Expected: No errors

**Step 3: Commit**

```bash
git add backend/src/routes/logbook.ts
git commit -m "feat(backend): add GET /api/logbook/:id/exceedances endpoint"
```

---

### Task 8: Create Electron ExceedanceDetector service

**Files:**
- Create: `electron/src/simconnect/exceedance-detector.ts`

**Step 1: Create `electron/src/simconnect/exceedance-detector.ts`**

```typescript
import {
  AircraftLimits,
  DEFAULT_AIRCRAFT_LIMIT,
  ExceedanceThresholds,
} from '@acars/shared';
import type {
  ExceedanceEvent,
  ExceedanceType,
  ExceedanceSeverity,
  AircraftPosition,
} from '@acars/shared';
import type { FlightPhase } from '@acars/shared';

/**
 * Detects flight exceedances from real-time SimConnect telemetry.
 * Runs in the Electron main process at 200ms polling frequency.
 *
 * Detection rules:
 * - Hard landing: VS < -600 fpm at touchdown
 * - Overspeed: IAS > aircraft Vmo while airborne
 * - Overweight landing: TOTAL WEIGHT > aircraft MLW at touchdown
 * - Unstable approach: VS < -1000 fpm below 1000' AGL
 * - Tailstrike: pitch > aircraft maxPitchDeg at touchdown
 *
 * Each exceedance emits at most once per flight phase (dedup via emitted set).
 */
export class ExceedanceDetector {
  private aircraftType = '';
  private emitted = new Set<string>();
  private lastAirborneVs = 0;
  private lastAirbornePitch = 0;
  private lastAirborneTotalWeight = 0;

  /** Set the aircraft ICAO type for limit lookups. Call when aircraft info arrives. */
  setAircraftType(icaoType: string): void {
    this.aircraftType = icaoType.toUpperCase();
  }

  /**
   * Continuous tick check — called every 200ms with current telemetry.
   * Returns detected exceedances (usually 0 or 1 per tick).
   */
  check(
    position: AircraftPosition,
    phase: string,
    simOnGround: boolean,
  ): ExceedanceEvent[] {
    const events: ExceedanceEvent[] = [];
    const limits = AircraftLimits[this.aircraftType] ?? DEFAULT_AIRCRAFT_LIMIT;

    // Track last airborne values for landing-triggered checks
    if (!simOnGround) {
      this.lastAirborneVs = position.verticalSpeed;
      this.lastAirbornePitch = position.pitch;
      this.lastAirborneTotalWeight = position.totalWeight;
    }

    // Overspeed: continuous check while airborne
    if (!simOnGround && position.airspeedIndicated > limits.vmoKts) {
      const key = `OVERSPEED:${phase}`;
      if (!this.emitted.has(key)) {
        this.emitted.add(key);
        const margin = position.airspeedIndicated - limits.vmoKts;
        const severity: ExceedanceSeverity = margin >= ExceedanceThresholds.OVERSPEED_CRITICAL_MARGIN_KTS ? 'critical' : 'warning';
        events.push({
          type: 'OVERSPEED',
          severity,
          value: Math.round(position.airspeedIndicated),
          threshold: limits.vmoKts,
          unit: 'kts',
          phase,
          message: `Overspeed: ${Math.round(position.airspeedIndicated)} kts IAS (Vmo: ${limits.vmoKts} kts)`,
          detectedAt: new Date().toISOString(),
        });
      }
    }

    // Unstable approach: VS < -1000 fpm below 1000' AGL during APPROACH
    if (phase === 'APPROACH' && !simOnGround) {
      const agl = position.altitudeAgl;
      if (agl < ExceedanceThresholds.UNSTABLE_APPROACH_ALT_AGL && position.verticalSpeed < ExceedanceThresholds.UNSTABLE_APPROACH_VS_FPM) {
        const key = `UNSTABLE_APPROACH:${phase}`;
        if (!this.emitted.has(key)) {
          this.emitted.add(key);
          events.push({
            type: 'UNSTABLE_APPROACH',
            severity: 'warning',
            value: Math.round(position.verticalSpeed),
            threshold: ExceedanceThresholds.UNSTABLE_APPROACH_VS_FPM,
            unit: 'fpm',
            phase,
            message: `Unstable approach: ${Math.round(position.verticalSpeed)} fpm descent at ${Math.round(agl)}' AGL (limit: ${ExceedanceThresholds.UNSTABLE_APPROACH_VS_FPM} fpm below ${ExceedanceThresholds.UNSTABLE_APPROACH_ALT_AGL}' AGL)`,
            detectedAt: new Date().toISOString(),
          });
        }
      }
    }

    return events;
  }

  /**
   * Phase transition check — called when flight phase changes.
   * Landing-triggered exceedances (hard landing, overweight, tailstrike) fire here.
   */
  onPhaseChange(
    previous: string,
    current: string,
  ): ExceedanceEvent[] {
    const events: ExceedanceEvent[] = [];

    // Only check on touchdown (transition to LANDING)
    if (current !== 'LANDING') return events;

    const limits = AircraftLimits[this.aircraftType] ?? DEFAULT_AIRCRAFT_LIMIT;
    const now = new Date().toISOString();

    // Hard landing
    if (this.lastAirborneVs < ExceedanceThresholds.HARD_LANDING_FPM) {
      const severity: ExceedanceSeverity = this.lastAirborneVs < ExceedanceThresholds.HARD_LANDING_CRITICAL_FPM ? 'critical' : 'warning';
      events.push({
        type: 'HARD_LANDING',
        severity,
        value: Math.round(this.lastAirborneVs),
        threshold: ExceedanceThresholds.HARD_LANDING_FPM,
        unit: 'fpm',
        phase: current,
        message: `Hard landing: ${Math.round(this.lastAirborneVs)} fpm (limit: ${ExceedanceThresholds.HARD_LANDING_FPM} fpm)`,
        detectedAt: now,
      });
    }

    // Overweight landing
    if (this.lastAirborneTotalWeight > limits.mlwLbs) {
      const overPct = (this.lastAirborneTotalWeight - limits.mlwLbs) / limits.mlwLbs;
      const severity: ExceedanceSeverity = overPct >= ExceedanceThresholds.OVERWEIGHT_CRITICAL_MARGIN_PCT ? 'critical' : 'warning';
      events.push({
        type: 'OVERWEIGHT_LANDING',
        severity,
        value: Math.round(this.lastAirborneTotalWeight),
        threshold: limits.mlwLbs,
        unit: 'lbs',
        phase: current,
        message: `Overweight landing: ${Math.round(this.lastAirborneTotalWeight).toLocaleString()} lbs (MLW: ${limits.mlwLbs.toLocaleString()} lbs)`,
        detectedAt: now,
      });
    }

    // Tailstrike
    if (this.lastAirbornePitch > limits.maxPitchDeg) {
      events.push({
        type: 'TAILSTRIKE',
        severity: 'critical',
        value: Math.round(this.lastAirbornePitch * 10) / 10,
        threshold: limits.maxPitchDeg,
        unit: 'deg',
        phase: current,
        message: `Tailstrike risk: ${(Math.round(this.lastAirbornePitch * 10) / 10)}° pitch (limit: ${limits.maxPitchDeg}°)`,
        detectedAt: now,
      });
    }

    return events;
  }

  /** Reset for next flight. */
  reset(): void {
    this.emitted.clear();
    this.lastAirborneVs = 0;
    this.lastAirbornePitch = 0;
    this.lastAirborneTotalWeight = 0;
    this.aircraftType = '';
  }
}
```

**Step 2: Commit**

```bash
git add electron/src/simconnect/exceedance-detector.ts
git commit -m "feat(electron): add ExceedanceDetector service"
```

---

### Task 9: Wire ExceedanceDetector into Electron main process and VPS relay

**Files:**
- Modify: `electron/src/main.ts` (integrate detector into telemetry loop)
- Modify: `electron/src/ipc-channels.ts` (add EXCEEDANCE_DETECTED channel)
- Modify: `electron/src/relay.ts` (emit `flight:exceedance` to backend)

**Step 1: Add IPC channel to `electron/src/ipc-channels.ts`**

After `SIM_DIAGNOSTIC_LOG: 'sim:diagnostic-log',` (line 27), add:

```typescript
  SIM_EXCEEDANCE: 'sim:exceedance',
```

**Step 2: Wire detector into `electron/src/main.ts`**

Add import at the top (near other simconnect imports):

```typescript
import { ExceedanceDetector } from './simconnect/exceedance-detector';
```

After `const phaseService = new FlightPhaseService();` (line 453), add:

```typescript
  const exceedanceDetector = new ExceedanceDetector();
  let previousPhase = '';
```

After `sim.on('aircraftInfoUpdate', (data) => { latestData.aircraftInfo = data; });` (line 461), add:

```typescript
  sim.on('aircraftInfoUpdate', (data) => {
    exceedanceDetector.setAircraftType(data.atcType || '');
  });
```

Wait — there's already a listener on line 461. We need to ADD to that handler, not create a duplicate. Instead, modify line 461 to:

```typescript
  sim.on('aircraftInfoUpdate', (data) => {
    latestData.aircraftInfo = data;
    exceedanceDetector.setAircraftType(data.atcType || '');
  });
```

After `sim.on('simStart', () => { phaseService.reset(); });` (line 463), add:

```typescript
  sim.on('simStart', () => { exceedanceDetector.reset(); });
```

Wait — line 463 already has a simStart listener. Modify it to:

```typescript
  sim.on('simStart', () => { phaseService.reset(); exceedanceDetector.reset(); });
```

Inside the `setInterval(() => { ... }, 200)` block, after the phase computation (line 489), add exceedance detection:

```typescript
        // Detect exceedances from current telemetry
        const exceedanceEvents = exceedanceDetector.check(
          position as any, // AircraftPosition shape
          phase,
          (flightState.simOnGround as boolean) ?? true,
        );

        // Detect landing-triggered exceedances on phase change
        if (phase !== previousPhase) {
          const phaseEvents = exceedanceDetector.onPhaseChange(previousPhase, phase);
          exceedanceEvents.push(...phaseEvents);
          previousPhase = phase;
        }

        // Emit exceedances to renderer and VPS relay
        for (const evt of exceedanceEvents) {
          mainWindow?.webContents.send(IpcChannels.SIM_EXCEEDANCE, evt);
          vpsRelay?.emitExceedance(evt);
        }
```

**Step 3: Add `emitExceedance` method to `electron/src/relay.ts`**

In the `VpsRelay` class, after the `sendTelemetry` method (after line 73), add:

```typescript
  emitExceedance(event: unknown): void {
    if (this.socket?.connected) {
      this.socket.emit('flight:exceedance', event as any);
    }
  }
```

**Step 4: Build electron to verify**

Run: `npm run build -w electron`
Expected: No errors (or acceptable warnings about CJS import patterns)

**Step 5: Commit**

```bash
git add electron/src/main.ts electron/src/ipc-channels.ts electron/src/relay.ts
git commit -m "feat(electron): wire ExceedanceDetector into telemetry loop and VPS relay"
```

---

### Task 10: Add Events section to FlightDetailPage

**Files:**
- Modify: `frontend/src/pages/FlightDetailPage.tsx`

**Step 1: Add state and fetch for exceedances**

At the top of the component (near other state), add:

```typescript
import type { FlightExceedance } from '@acars/shared';
```

And add state:

```typescript
const [exceedances, setExceedances] = useState<FlightExceedance[]>([]);
```

In the existing `useEffect` that fetches the logbook entry (or add a new useEffect after it), fetch exceedances:

```typescript
  useEffect(() => {
    if (!entry) return;
    api.get<FlightExceedance[]>(`/logbook/${entry.id}/exceedances`)
      .then(setExceedances)
      .catch(() => {}); // non-critical
  }, [entry]);
```

**Step 2: Add Events section after the Performance + Fuel grid**

After the closing `</div>` of the Performance + Fuel grid (line 387), add:

```tsx
        {/* ── Events ───────────────────────────────────────── */}
        {exceedances.length > 0 && (
          <div className="panel rounded-md p-4 mb-4">
            <h3 className="text-[11px] uppercase tracking-wider text-acars-muted font-medium mb-3 flex items-center gap-2">
              <Warning className="w-3.5 h-3.5 text-amber-400" weight="fill" />
              Events ({exceedances.length})
            </h3>
            <div className="space-y-2">
              {exceedances.map((exc) => (
                <div
                  key={exc.id}
                  className={`flex items-start justify-between text-xs p-3 rounded-md border ${
                    exc.severity === 'critical'
                      ? 'border-l-2 border-l-red-500 border-red-500/20 bg-red-500/5'
                      : 'border-l-2 border-l-amber-500 border-amber-500/20 bg-amber-500/5'
                  }`}
                >
                  <div className="space-y-0.5">
                    <div className="font-medium text-acars-text">
                      {exc.type.replace(/_/g, ' ')}
                    </div>
                    <div className="text-acars-muted">{exc.message}</div>
                    <div className="text-acars-muted text-[10px]">
                      Detected during {exc.phase} at{' '}
                      {new Date(exc.detectedAt).toLocaleTimeString('en-US', {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                        timeZone: 'UTC',
                      })}{' '}
                      UTC
                    </div>
                    {exc.type === 'HARD_LANDING' && (
                      <div className="text-amber-400 text-[10px] mt-1">
                        → Maintenance inspection scheduled
                      </div>
                    )}
                  </div>
                  <span
                    className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded ${
                      exc.severity === 'critical'
                        ? 'bg-red-500/20 text-red-400'
                        : 'bg-amber-500/20 text-amber-400'
                    }`}
                  >
                    {exc.severity}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
```

Note: `Warning` icon is already imported on line 16 of FlightDetailPage.tsx.

**Step 3: Build frontend to verify**

Run: `npm run build -w frontend`
Expected: No errors

**Step 4: Commit**

```bash
git add frontend/src/pages/FlightDetailPage.tsx
git commit -m "feat(frontend): add Events section to FlightDetailPage"
```

---

### Task 11: Build all workspaces and verify

**Step 1: Build shared first**

Run: `npx tsc -p shared/`
Expected: Clean build

**Step 2: Build remaining workspaces**

Run: `npm run build`
Expected: All workspaces build successfully

**Step 3: Fix any type errors**

If there are TypeScript errors from the new `altitudeAgl` and `totalWeight` fields on `AircraftPosition`, fix any code that constructs `AircraftPosition` objects without these fields (likely in backend telemetry mock or test utilities). Add default values `altitudeAgl: 0, totalWeight: 0` where needed.

**Step 4: Final commit**

```bash
git commit -m "build: verify all workspaces compile with exceedance detection"
```

---

## Summary of all files touched

| Layer | File | Action |
|-------|------|--------|
| shared | `src/constants/aircraft-limits.ts` | **Create** |
| shared | `src/types/exceedance.ts` | **Create** |
| shared | `src/constants/simvars.ts` | Modify — add 2 simvars |
| shared | `src/types/aircraft.ts` | Modify — add `altitudeAgl`, `totalWeight` |
| shared | `src/types/websocket.ts` | Modify — add 2 socket events |
| shared | `src/index.ts` | Modify — add re-exports |
| backend | `src/db/migrations/032-flight-exceedances.sql` | **Create** |
| backend | `src/services/exceedance.ts` | **Create** |
| backend | `src/types/db-rows.ts` | Modify — add ExceedanceRow |
| backend | `src/websocket/handler.ts` | Modify — handle flight:exceedance |
| backend | `src/services/pirep.ts` | Modify — link exceedances to logbook |
| backend | `src/routes/logbook.ts` | Modify — add GET /:id/exceedances |
| electron | `src/simconnect/exceedance-detector.ts` | **Create** |
| electron | `src/simconnect/simvars.ts` | Modify — add 2 simvars |
| electron | `src/simconnect/reader.ts` | Modify — read new simvars |
| electron | `src/main.ts` | Modify — wire detector |
| electron | `src/ipc-channels.ts` | Modify — add channel |
| electron | `src/relay.ts` | Modify — add emitExceedance |
| frontend | `src/pages/FlightDetailPage.tsx` | Modify — add Events section |
