# Exceedance Detection — Design Document

**Date:** 2026-02-28
**Status:** Approved

## Summary

Detect flight exceedances in real-time from SimConnect telemetry during Electron flights. Store discrete exceedance events, show them on the flight detail page, and auto-create maintenance inspections for hard landings.

## Exceedance Types

| Type | Condition | Severity |
|------|-----------|----------|
| **Hard Landing** | VS < -600 fpm at touchdown | warning (-600 to -900), critical (< -900) |
| **Overspeed** | IAS > aircraft Vmo | warning (< Vmo+10), critical (>= Vmo+10) |
| **Overweight Landing** | TOTAL WEIGHT > aircraft MLW at touchdown | warning (< MLW+5%), critical (>= MLW+5%) |
| **Unstable Approach** | VS < -1000 fpm AND AGL < 1000 ft | warning |
| **Tailstrike** | Pitch > aircraft maxPitchDeg at touchdown | critical |

## Architecture Decisions

- **Detection location:** Electron-side (200ms telemetry fidelity)
- **AGL source:** `PLANE ALT ABOVE GROUND` simvar (radar altimeter)
- **Weight source:** `TOTAL WEIGHT` simvar (current gross weight)
- **Speed limits:** Per-type lookup table in `shared/src/constants/aircraft-limits.ts`
- **Event delivery:** Socket.io event-per-exceedance (`flight:exceedance`)
- **Hard landing → maintenance:** Auto-create UNSCHEDULED maintenance_log entry
- **Scope exclusion:** Exceedance-free streak stat deferred to later iteration

## Data Model

### New DB Table: `flight_exceedances`

```sql
CREATE TABLE flight_exceedances (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  bid_id       INTEGER NOT NULL,
  logbook_id   INTEGER,
  pilot_id     INTEGER NOT NULL,
  type         TEXT NOT NULL,      -- HARD_LANDING | OVERSPEED | OVERWEIGHT_LANDING | UNSTABLE_APPROACH | TAILSTRIKE
  severity     TEXT NOT NULL DEFAULT 'warning',  -- warning | critical
  value        REAL NOT NULL,      -- measured value (e.g., -650)
  threshold    REAL NOT NULL,      -- limit exceeded (e.g., -600)
  unit         TEXT NOT NULL,      -- fpm | kts | lbs | deg
  phase        TEXT NOT NULL,      -- flight phase at detection
  message      TEXT NOT NULL,      -- human-readable description
  detected_at  TEXT NOT NULL,      -- ISO 8601 UTC
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_exceedances_bid ON flight_exceedances(bid_id);
CREATE INDEX idx_exceedances_logbook ON flight_exceedances(logbook_id);
CREATE INDEX idx_exceedances_pilot ON flight_exceedances(pilot_id);
```

### New Shared Type: `FlightExceedance`

```typescript
export type ExceedanceType =
  | 'HARD_LANDING'
  | 'OVERSPEED'
  | 'OVERWEIGHT_LANDING'
  | 'UNSTABLE_APPROACH'
  | 'TAILSTRIKE';

export type ExceedanceSeverity = 'warning' | 'critical';

export interface FlightExceedance {
  id: number;
  bidId: number;
  logbookId: number | null;
  pilotId: number;
  type: ExceedanceType;
  severity: ExceedanceSeverity;
  value: number;
  threshold: number;
  unit: string;
  phase: string;
  message: string;
  detectedAt: string;
}
```

### New Constants: `AircraftLimits`

```typescript
// shared/src/constants/aircraft-limits.ts
export interface AircraftTypeLimit {
  vmoKts: number;
  mlwLbs: number;
  maxPitchDeg: number;
}

export const AircraftLimits: Record<string, AircraftTypeLimit> = {
  B744: { vmoKts: 365, mlwLbs: 630000, maxPitchDeg: 11.5 },
  B748: { vmoKts: 365, mlwLbs: 654000, maxPitchDeg: 11.5 },
  B738: { vmoKts: 340, mlwLbs: 144500, maxPitchDeg: 11 },
  B739: { vmoKts: 340, mlwLbs: 146300, maxPitchDeg: 11 },
  B77W: { vmoKts: 360, mlwLbs: 554000, maxPitchDeg: 11.5 },
  A320: { vmoKts: 350, mlwLbs: 145505, maxPitchDeg: 12 },
  // extend for fleet types
};

export const ExceedanceThresholds = {
  HARD_LANDING_FPM: -600,
  UNSTABLE_APPROACH_VS_FPM: -1000,
  UNSTABLE_APPROACH_ALT_AGL: 1000,
} as const;
```

### New SimVars

Add to `shared/src/constants/simvars.ts`:
- `PLANE ALT ABOVE GROUND` — feet AGL (radar altimeter)
- `TOTAL WEIGHT` — pounds (current gross weight)

## Detection Logic

### Electron Service: `ExceedanceDetector`

File: `electron/src/simconnect/exceedance-detector.ts`

```typescript
class ExceedanceDetector {
  private aircraftType: string;
  private limits: AircraftTypeLimit;
  private emitted: Set<string>;  // dedup: "TYPE:phase"

  check(snapshot: TelemetrySnapshot, phase: FlightPhase, agl: number): FlightExceedance | null
  onPhaseChange(prev: FlightPhase, current: FlightPhase, snapshot: TelemetrySnapshot, agl: number): FlightExceedance[]
  reset(): void  // called on flight end
}
```

### Detection Rules

- **Hard Landing:** On APPROACH → LANDING transition, check last airborne VS. If < -600 fpm, emit.
- **Overspeed:** Every tick while airborne, check IAS > Vmo. Emit once per phase, re-arm on phase change.
- **Overweight Landing:** On APPROACH → LANDING transition, check TOTAL WEIGHT > MLW. Emit once.
- **Unstable Approach:** During APPROACH phase, check VS < -1000 fpm AND AGL < 1000 ft. Emit once per approach.
- **Tailstrike:** On APPROACH → LANDING transition, check pitch > maxPitchDeg. Emit once.

### Deduplication

Each exceedance type emits at most once per flight phase. The `emitted` set tracks `"TYPE:phase"` keys. Landing-triggered checks fire on the phase transition event, not on every tick. The set resets when a new flight starts.

## Event Flow

```
Electron ExceedanceDetector
  ├─→ IPC 'exceedance:detected' → renderer (local toast)
  └─→ VpsRelay socket.emit('flight:exceedance', payload)
        └─→ Backend WebSocket handler
              ├─→ INSERT INTO flight_exceedances
              ├─→ If HARD_LANDING → MaintenanceService.createLog(UNSCHEDULED)
              └─→ Broadcast 'dispatch:exceedance' to dispatch room
```

### New WebSocket Events

```typescript
// ClientToServerEvents
'flight:exceedance': (data: {
  type: ExceedanceType;
  severity: ExceedanceSeverity;
  value: number;
  threshold: number;
  unit: string;
  phase: string;
  message: string;
  detectedAt: string;
}) => void;

// ServerToClientEvents
'dispatch:exceedance': (data: FlightExceedance) => void;
```

### PIREP Linkage

On `PirepService.submitPirep()`, after creating the logbook entry:
```sql
UPDATE flight_exceedances SET logbook_id = ? WHERE bid_id = ?
```

### REST Endpoint

```
GET /api/logbook/:id/exceedances → FlightExceedance[]
```

## Frontend UI

### Flight Detail Page — Events Section

Added after the Performance panel on `FlightDetailPage.tsx`. Only renders if exceedances exist.

```
┌──────────────────────────────────────────────────┐
│  ⚠ Events (2)                                    │
├──────────────────────────────────────────────────┤
│  ● HARD LANDING                        CRITICAL  │
│    Landing rate: -742 fpm (limit: -600 fpm)      │
│    Detected during LANDING at 14:32:05 UTC       │
│    → Maintenance inspection scheduled            │
│                                                  │
│  ● OVERSPEED                           WARNING   │
│    IAS: 348 kts (limit: 340 kts)                 │
│    Detected during DESCENT at 14:18:42 UTC       │
└──────────────────────────────────────────────────┘
```

- Critical: red left border + red badge
- Warning: amber left border + yellow badge
- Panel: `bg-[--bg-panel]`, `rounded-md`, inner shadow

### Dispatch Live View

Toast on `dispatch:exceedance` event: `toast.warning('SA001 — Hard Landing (-742 fpm)')`

### Admin PIREP Review

Warning badge on PIREP list/detail if associated exceedances exist.

## Files Changed

| Layer | File | Change |
|-------|------|--------|
| shared | `src/constants/aircraft-limits.ts` | New — AircraftLimits + ExceedanceThresholds |
| shared | `src/constants/simvars.ts` | Add 2 simvars |
| shared | `src/types/exceedance.ts` | New — FlightExceedance type |
| shared | `src/types/websocket.ts` | Add exceedance events to S2C/C2S |
| shared | `src/index.ts` | Re-export new types/constants |
| backend | `src/db/migrations/0XX-exceedances.sql` | New — flight_exceedances table |
| backend | `src/services/exceedance.ts` | New — insert/query exceedances |
| backend | `src/services/pirep.ts` | Link exceedances to logbook on submit |
| backend | `src/websocket/handler.ts` | Handle `flight:exceedance` event |
| backend | `src/routes/logbook.ts` | Add GET /:id/exceedances endpoint |
| electron | `src/simconnect/exceedance-detector.ts` | New — detection logic |
| electron | `src/simconnect/simconnect-manager.ts` | Subscribe to new simvars |
| electron | `src/main.ts` | Wire ExceedanceDetector into telemetry loop |
| electron | `src/ipc-channels.ts` | Add EXCEEDANCE_DETECTED channel |
| electron | `src/vps-relay.ts` | Emit flight:exceedance to backend |
| frontend | `src/pages/FlightDetailPage.tsx` | Add Events section |
| frontend | `src/components/dispatch/*.tsx` | Toast on dispatch:exceedance |
