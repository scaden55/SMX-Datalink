# SMA ACARS Codebase Audit — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Harden the full-stack TypeScript monorepo for production readiness — fix bugs, eliminate security issues, improve performance, enforce DRY, and prevent memory leaks.

**Architecture:** Systematic 6-phase audit working from infrastructure up through type safety, error handling, performance, DRY refactoring, and polish. Each phase builds on the previous — security first, types second (so later phases benefit from proper types), error handling third, then performance and cleanup.

**Tech Stack:** TypeScript, Express 4, React 19, Zustand 5, Socket.io 4, better-sqlite3, Vite 6, Electron 33

---

## Phase 1: Security & Infrastructure

### Task 1: Remove committed secrets from Git

**Files:**
- Delete from tracking: `backend/.env`
- Create: `backend/.env.example`
- Modify: `backend/.gitignore` (verify .env is listed)

**Step 1: Create .env.example with placeholder values**

Create `backend/.env.example`:
```env
PORT=3001
CORS_ORIGIN=*
SIMCONNECT_ENABLED=true
SIMCONNECT_POLL_INTERVAL=1000
SIMCONNECT_RECONNECT_INTERVAL=5000
JWT_SECRET=replace-with-64-char-hex-secret
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d
DB_PATH=./data/acars.db
SIMBRIEF_API_KEY=replace-with-your-simbrief-api-key
VATSIM_ENABLED=true
VATSIM_POLL_INTERVAL=15000
```

**Step 2: Remove .env from Git tracking (keep local file)**

```bash
git rm --cached backend/.env
```

**Step 3: Verify .gitignore covers .env files**

Check `backend/.gitignore` or root `.gitignore` includes:
```
*.env
.env
.env.*
!.env.example
```

**Step 4: Commit**

```bash
git add backend/.env.example .gitignore
git commit -m "security: remove committed .env, add .env.example template"
```

---

### Task 2: Exclude .env from Electron build

**Files:**
- Modify: `electron/package.json:53-56`

**Step 1: Remove .env from extraResources**

In `electron/package.json`, remove this block from the `extraResources` array:
```json
{
  "from": "../backend/.env",
  "to": "backend/.env"
}
```

The backend already generates a random dev JWT secret when `JWT_SECRET` env var is missing (see `backend/src/config.ts:19`), so Electron dev mode works without a bundled `.env`. For production Electron builds, environment variables should be set by the VPS or passed at launch.

**Step 2: Commit**

```bash
git add electron/package.json
git commit -m "security: exclude .env from Electron installer bundle"
```

---

### Task 3: Make frontend API base URL configurable

**Files:**
- Modify: `frontend/src/lib/api.ts:6-15`

**Step 1: Replace hardcoded localhost with env-driven config**

In `frontend/src/lib/api.ts`, replace lines 4-15:

```typescript
// Electron: connect to backend started by Electron main process
// Dev browser: relative paths work via Vite proxy
// Production: VITE_API_BASE environment variable
const FALLBACK_BACKEND = 'http://localhost:3001';

let apiBase = '';

const apiBaseReady: Promise<void> = (async () => {
  if (window.electronAPI) {
    apiBase = import.meta.env.VITE_API_BASE || FALLBACK_BACKEND;
  }
  // Browser dev mode: apiBase stays '' (Vite proxy handles /api)
})();
```

This allows overriding the backend URL via `VITE_API_BASE` in `.env` or at build time, which is needed for VPS deployment.

**Step 2: Commit**

```bash
git add frontend/src/lib/api.ts
git commit -m "infra: make API base URL configurable via VITE_API_BASE"
```

---

## Phase 2: Type Safety — Eliminate `as any`

### Task 4: Add typed DB row interfaces for backend services

**Files:**
- Create: `backend/src/types/db-rows.ts`

**Step 1: Create centralized DB row type definitions**

Create `backend/src/types/db-rows.ts` with interfaces for all DB query results that currently use `as any`. These mirror the SQLite table schemas:

```typescript
// ── Finance rows ─────────────────────────────────────────
export interface FinanceRow {
  id: number;
  pilot_id: number;
  type: 'pay' | 'bonus' | 'deduction' | 'expense' | 'income';
  amount: number;
  description: string | null;
  created_by: number | null;
  created_at: string;
}

export interface FinanceSummaryRow {
  type: string;
  total: number;
  count: number;
}

export interface FinanceBalanceRow {
  pilot_id: number;
  callsign: string;
  balance: number;
}

// ── Fleet rows ───────────────────────────────────────────
export interface FleetRow {
  id: number;
  registration: string;
  icao_type: string;
  name: string;
  max_pax: number;
  max_cargo_kg: number;
  max_fuel_kg: number;
  oew_kg: number;
  mtow_kg: number;
  mlw_kg: number;
  mzfw_kg: number;
  range_nm: number;
  cruise_speed_kts: number;
  fuel_burn_kgh: number;
  is_active: number;
  status: string;
  location_icao: string | null;
  total_hours: number;
  total_cycles: number;
  livery: string | null;
}

// ── Leaderboard rows ─────────────────────────────────────
export interface LeaderboardRow {
  user_id: number;
  callsign: string;
  total_flights: number;
  total_hours: number;
  total_cargo_kg: number;
  total_pax: number;
  avg_landing_rate: number;
}

// ── Reports rows ─────────────────────────────────────────
export interface ReportSummaryRow {
  total_flights: number;
  total_hours: number;
  total_cargo_kg: number;
  avg_landing_rate: number;
}

export interface ReportTrendRow {
  period: string;
  flights: number;
  hours: number;
  cargo_kg: number;
}

export interface ReportRouteRow {
  dep_icao: string;
  arr_icao: string;
  flights: number;
  total_hours: number;
}

export interface ReportAircraftRow {
  icao_type: string;
  flights: number;
  total_hours: number;
}

export interface ReportPilotRow {
  user_id: number;
  callsign: string;
  flights: number;
  hours: number;
  cargo_kg: number;
}

// ── Regulatory / OpsSpecs rows ───────────────────────────
export interface OpsSpecRow {
  id: number;
  code: string;
  title: string;
  description: string | null;
  is_active: number;
  created_at: string;
  updated_at: string;
}

// ── Schedule rows ────────────────────────────────────────
export interface ScheduledFlightRow {
  id: number;
  flight_number: string;
  dep_icao: string;
  arr_icao: string;
  aircraft_type: string;
  dep_time: string;
  distance_nm: number;
  flight_time_min: number;
  is_active: number;
}

// ── User rows ────────────────────────────────────────────
export interface UserRow {
  id: number;
  email: string;
  callsign: string;
  role: 'admin' | 'dispatcher' | 'pilot';
  status: 'active' | 'inactive' | 'suspended';
  created_at: string;
}

// ── PIREP rows ───────────────────────────────────────────
export interface PirepRow {
  id: number;
  bid_id: number;
  user_id: number;
  status: 'pending' | 'approved' | 'rejected';
  flight_number: string;
  dep_icao: string;
  arr_icao: string;
  aircraft_reg: string;
  block_time_min: number;
  landing_rate: number;
  fuel_used_kg: number;
  cargo_kg: number;
  pax: number;
  notes: string | null;
  filed_at: string;
  reviewed_at: string | null;
  reviewed_by: number | null;
}

// ── Logbook rows ─────────────────────────────────────────
export interface LogbookRow {
  id: number;
  user_id: number;
  flight_number: string;
  dep_icao: string;
  arr_icao: string;
  aircraft_type: string;
  aircraft_reg: string;
  block_time_min: number;
  landing_rate: number;
  fuel_used_kg: number;
  cargo_kg: number;
  pax: number;
  status: string;
  filed_at: string;
}
```

**Step 2: Commit**

```bash
git add backend/src/types/db-rows.ts
git commit -m "types: add centralized DB row interfaces to replace as-any casts"
```

---

### Task 5: Replace `as any` in backend services

**Files:**
- Modify: `backend/src/services/finance.ts` (lines 97, 127)
- Modify: `backend/src/services/leaderboard.ts` (line 26)
- Modify: `backend/src/services/fleet.ts` (line 225)
- Modify: `backend/src/services/regulatory.ts` (lines 236, 269, 537, 544, 568)
- Modify: `backend/src/services/pirep.ts` (line 230)
- Modify: `backend/src/services/pirep-admin.ts` (line 150)
- Modify: `backend/src/services/reports.ts` (lines 154, 189, 268, 293, 318)
- Modify: `backend/src/services/schedule-admin.ts` (lines 149, 324)
- Modify: `backend/src/services/settings.ts` (line 26)
- Modify: `backend/src/services/user.ts` (line 33)

**Step 1: In each file, replace `as any` or `as any[]` with the typed DB row interface**

Pattern for each replacement:
```typescript
// Before:
const rows = getDb().prepare(sql).all(...params) as any[];

// After:
import type { LeaderboardRow } from '../types/db-rows.js';
const rows = getDb().prepare(sql).all(...params) as LeaderboardRow[];
```

Apply this across all files listed above, using the appropriate row type from `db-rows.ts`.

**Step 2: Build to verify**

```bash
cd backend && npx tsc --noEmit
```
Expected: 0 errors

**Step 3: Commit**

```bash
git add backend/src/services/
git commit -m "types: replace as-any DB casts with typed row interfaces"
```

---

### Task 6: Replace `as any` in backend route handlers (query params)

**Files:**
- Modify: `backend/src/routes/admin-finances.ts` (line 16)
- Modify: `backend/src/routes/admin-pireps.ts` (line 16)
- Modify: `backend/src/routes/admin-users.ts` (lines 20-21)
- Modify: `backend/src/routes/logbook.ts` (line 26)
- Modify: `backend/src/routes/flight-plan.ts` (line 204)
- Modify: `backend/src/routes/admin-settings.ts` (line 31)
- Modify: `backend/src/routes/admin-audit.ts`
- Modify: `backend/src/routes/track.ts` (line 20)

**Step 1: Replace query param `as any` with validated string casts + type guards**

Pattern for each route:
```typescript
// Before:
type: req.query.type as any,

// After:
type: typeof req.query.type === 'string' ? req.query.type : undefined,
```

For `track.ts` specifically (line 20):
```typescript
// Before:
const user = (req as any).user;

// After (use Express Request augmentation):
const user = req.user;
```

This requires the auth middleware to augment the Express Request type, which it likely already does.

**Step 2: Build to verify**

```bash
cd backend && npx tsc --noEmit
```

**Step 3: Commit**

```bash
git add backend/src/routes/
git commit -m "types: replace as-any query param casts with proper validation"
```

---

### Task 7: Replace `as any` in frontend components

**Files:**
- Modify: `frontend/src/hooks/useSocket.ts` (line 40)
- Modify: `frontend/src/components/info-panel/MessagesTab.tsx` (lines 74, 83, 86, 87)
- Modify: `frontend/src/components/flight-plan/AircraftSection.tsx` (lines 16-17)
- Modify: `frontend/src/components/flight-plan/NavProcedureRow.tsx` (lines 170-173)
- Modify: `frontend/src/components/map/AirportLabels.tsx` (line 76)
- Modify: `frontend/src/components/map/FirBoundaryLayer.tsx` (line 133)
- Modify: `frontend/src/components/map/TraconBoundaryLayer.tsx` (line 170)
- Modify: `frontend/src/components/map/GroundChartOverlay.tsx` (lines 135, 141, 165)
- Modify: `frontend/src/pages/FlightPlanningPage.tsx` (line 123)
- Modify: `frontend/src/components/planning/PlanningFuelSection.tsx` (line 36)
- Modify: `frontend/src/components/planning/PlanningWeightsSection.tsx` (line 34)
- Modify: `frontend/src/pages/admin/AdminSchedulesPage.tsx` (lines 450, 465)
- Modify: `frontend/src/stores/socketStore.ts`

**Step 1: Fix socketStore to use the proper AcarsSocket type**

In `frontend/src/stores/socketStore.ts`:
```typescript
import { create } from 'zustand';
import type { Socket } from 'socket.io-client';
import type { ServerToClientEvents, ClientToServerEvents } from '@acars/shared';

type AcarsSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

interface SocketState {
  socket: AcarsSocket | null;
  setSocket: (socket: AcarsSocket | null) => void;
}

export const useSocketStore = create<SocketState>((set) => ({
  socket: null,
  setSocket: (socket) => set({ socket }),
}));
```

Then in `useSocket.ts` line 40, the `as any` is no longer needed.

**Step 2: Fix MessagesTab socket events**

Add `dispatch:subscribe`, `dispatch:unsubscribe`, and `acars:message` to the shared WebSocket event types in `shared/src/types/websocket.ts` if not present, then remove `as any` casts.

**Step 3: Fix Leaflet `iconSize: undefined as any`**

Replace with: `iconSize: [0, 0]` (Leaflet accepts `[0, 0]` for invisible icons used as label anchors).

**Step 4: Fix editableFields `as any` casts**

Add the missing fields to the `EditableFields` type in the flight plan store, or use proper optional chaining:
```typescript
// Before:
const aobFL = (editableFields as any).aobFL;
// After:
const aobFL = 'aobFL' in editableFields ? (editableFields as Record<string, unknown>).aobFL as string : '';
```

Better: extend the type definition to include these fields.

**Step 5: Fix GeoJSON `as any`**

Use `L.geoJSON(feature as GeoJSON.Feature, {` — Leaflet accepts this type.

**Step 6: Fix AdminSchedulesPage numeric field `as any`**

```typescript
// Before:
set('distanceNm', e.target.value ? parseInt(e.target.value) : ('' as any))
// After:
set('distanceNm', e.target.value ? parseInt(e.target.value) : 0)
```

**Step 7: Build to verify**

```bash
cd frontend && npx tsc --noEmit
```

**Step 8: Commit**

```bash
git add frontend/src/ shared/src/
git commit -m "types: eliminate all as-any casts in frontend components"
```

---

## Phase 3: Error Handling & Resilience

### Task 8: Create toast notification system

**Files:**
- Create: `frontend/src/stores/toastStore.ts`
- Create: `frontend/src/components/ui/Toaster.tsx`
- Modify: `frontend/src/App.tsx` (add Toaster to root)

**Step 1: Create toastStore**

```typescript
import { create } from 'zustand';

export interface Toast {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  duration?: number;
}

interface ToastState {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
}

let nextId = 0;

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  addToast: (toast) => {
    const id = String(++nextId);
    set((s) => ({ toasts: [...s.toasts, { ...toast, id }] }));
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    }, toast.duration ?? 5000);
  },
  removeToast: (id) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

// Convenience function for use outside React components
export const toast = {
  success: (message: string) => useToastStore.getState().addToast({ type: 'success', message }),
  error: (message: string) => useToastStore.getState().addToast({ type: 'error', message }),
  warning: (message: string) => useToastStore.getState().addToast({ type: 'warning', message }),
  info: (message: string) => useToastStore.getState().addToast({ type: 'info', message }),
};
```

**Step 2: Create Toaster component**

```typescript
import { useToastStore } from '../../stores/toastStore';
import { X } from 'lucide-react';

const colorMap = {
  success: 'border-green-500/30 bg-green-500/10 text-green-400',
  error: 'border-red-500/30 bg-red-500/10 text-red-400',
  warning: 'border-amber-500/30 bg-amber-500/10 text-amber-400',
  info: 'border-blue-500/30 bg-blue-500/10 text-blue-400',
};

export function Toaster() {
  const toasts = useToastStore((s) => s.toasts);
  const removeToast = useToastStore((s) => s.removeToast);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[10000] flex flex-col gap-2 max-w-sm">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`flex items-center gap-2 px-3 py-2 rounded-md border text-[11px] font-sans shadow-lg animate-in slide-in-from-right ${colorMap[t.type]}`}
        >
          <span className="flex-1">{t.message}</span>
          <button
            onClick={() => removeToast(t.id)}
            className="shrink-0 opacity-60 hover:opacity-100"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      ))}
    </div>
  );
}
```

**Step 3: Add Toaster to App root**

Add `<Toaster />` at the end of the App component's return JSX, before the closing fragment.

**Step 4: Commit**

```bash
git add frontend/src/stores/toastStore.ts frontend/src/components/ui/Toaster.tsx frontend/src/App.tsx
git commit -m "feat: add global toast notification system"
```

---

### Task 9: Replace silent failures with toast notifications

**Files:**
- Modify: `frontend/src/components/planning/useSimBrief.ts` (~line 187-198)
- Modify: `frontend/src/hooks/useVatsim.ts` (line 29-31)
- Modify: `frontend/src/stores/authStore.ts` (logout catch)
- Modify: `frontend/src/pages/FlightPlanningPage.tsx` (line 64-66, 136-140, 179-180)
- Modify: `frontend/src/components/info-panel/MessagesTab.tsx` (line 63-65, 105-107)

**Step 1: In each file, replace `console.error(...)` with `toast.error(...)` and keep the console.error for dev logging**

Pattern:
```typescript
import { toast } from '../stores/toastStore';

// Before:
} catch (err) {
  console.error('[Planning] Failed to load reference data:', err);
}

// After:
} catch (err) {
  console.error('[Planning] Failed to load reference data:', err);
  toast.error('Failed to load reference data');
}
```

Apply to all listed files. For VATSIM (optional data), use `toast.warning` instead of `toast.error`.

**Step 2: Commit**

```bash
git add frontend/src/
git commit -m "fix: surface silent API failures as toast notifications"
```

---

### Task 10: Add AbortController to FlightPlanningPage

**Files:**
- Modify: `frontend/src/pages/FlightPlanningPage.tsx` (lines 54-67, 81-145)

**Step 1: Replace `let cancelled` pattern with AbortController**

```typescript
// Reference data load (lines 54-67):
useEffect(() => {
  const controller = new AbortController();

  Promise.all([
    api.get<Airport[]>('/api/airports'),
    api.get<FleetAircraft[]>('/api/fleet'),
    api.get<MyBidsResponse>('/api/bids/my'),
  ]).then(([airports, fleet, bidsRes]) => {
    if (controller.signal.aborted) return;
    setAirports(airports);
    setFleet(fleet);
    setBids(bidsRes.bids);
    setBidsLoaded(true);
  }).catch((err) => {
    if (controller.signal.aborted) return;
    console.error('[Planning] Failed to load reference data:', err);
    toast.error('Failed to load reference data');
    setBidsLoaded(true);
  });

  return () => controller.abort();
}, [setAirports, setFleet]);
```

Apply the same pattern to the bid loading effect (lines 81-145).

**Step 2: Commit**

```bash
git add frontend/src/pages/FlightPlanningPage.tsx
git commit -m "fix: add AbortController to prevent stale state on rapid navigation"
```

---

## Phase 4: Performance & Memory

### Task 11: Add React.memo to expensive components

**Files:**
- Modify: `frontend/src/components/admin/AdminTable.tsx`

**Step 1: Wrap AdminTable with React.memo**

```typescript
import { useState, memo } from 'react';

// ... existing code ...

function AdminTableInner<T>({ ... }: AdminTableProps<T>) {
  // ... existing component body ...
}

export const AdminTable = memo(AdminTableInner) as typeof AdminTableInner;
```

Note: Generic components with memo need the `as typeof` cast to preserve the generic parameter.

**Step 2: Wrap other static child components**

For `AirportLabels`, `FirBoundaryLayer`, `TraconBoundaryLayer` — these take props that rarely change (airport data), so wrapping in `memo` prevents re-renders when parent map state changes.

**Step 3: Commit**

```bash
git add frontend/src/components/
git commit -m "perf: add React.memo to expensive list and map components"
```

---

### Task 12: Add useCallback to socket event handlers

**Files:**
- Modify: `frontend/src/components/admin/AdminTable.tsx` (handleSort, toggleAll, toggleRow)

**Step 1: Wrap handler functions in useCallback**

```typescript
import { useState, useCallback, memo } from 'react';

const handleSort = useCallback((key: string) => {
  setSortKey((prev) => {
    if (prev === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
      return prev;
    }
    setSortDir('asc');
    return key;
  });
}, []);

const toggleAll = useCallback(() => {
  if (!getRowId || !onSelectChange) return;
  if (allSelected) {
    onSelectChange(new Set());
  } else {
    onSelectChange(new Set(data.map(r => getRowId(r))));
  }
}, [getRowId, onSelectChange, allSelected, data]);

const toggleRow = useCallback((id: number) => {
  if (!onSelectChange || !selectedIds) return;
  const next = new Set(selectedIds);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  onSelectChange(next);
}, [onSelectChange, selectedIds]);
```

**Step 2: Commit**

```bash
git add frontend/src/components/admin/AdminTable.tsx
git commit -m "perf: useCallback for AdminTable event handlers"
```

---

### Task 13: Add lazy loading for Leaflet map components

**Files:**
- Modify: `frontend/src/pages/FlightPlanningPage.tsx`
- Modify: `frontend/src/pages/DispatchPage.tsx` (or wherever maps are imported)

**Step 1: Lazy-load map components**

```typescript
import { lazy, Suspense } from 'react';

const PlanningMap = lazy(() =>
  import('../components/planning/PlanningMap').then((m) => ({ default: m.PlanningMap }))
);

// In JSX:
<Suspense fallback={<div className="flex-1 bg-acars-bg" />}>
  <PlanningMap />
</Suspense>
```

This moves the entire Leaflet library out of the initial bundle chunk.

**Step 2: Build and check chunk sizes**

```bash
cd frontend && npm run build
```

Verify main chunk is reduced from 1,485 KB.

**Step 3: Commit**

```bash
git add frontend/src/pages/
git commit -m "perf: lazy-load Leaflet map components to reduce initial bundle"
```

---

## Phase 5: DRY Refactoring

### Task 14: Extract useSocketSubscription hook

**Files:**
- Create: `frontend/src/hooks/useSocketSubscription.ts`
- Modify: `frontend/src/hooks/useVatsim.ts`
- Modify: `frontend/src/hooks/useTrack.ts`
- Modify: `frontend/src/components/info-panel/MessagesTab.tsx`

**Step 1: Create the shared hook**

```typescript
import { useEffect } from 'react';
import { useSocketStore } from '../stores/socketStore';
import type { ServerToClientEvents, ClientToServerEvents } from '@acars/shared';

/**
 * Subscribe to a socket room and event with automatic cleanup.
 * Replaces the repeated pattern of:
 *   socket.emit('X:subscribe', id);
 *   socket.on('X:event', handler);
 *   return () => { socket.emit('X:unsubscribe', id); socket.off('X:event', handler); };
 */
export function useSocketSubscription<E extends keyof ServerToClientEvents>(
  subscribeEvent: keyof ClientToServerEvents | null,
  unsubscribeEvent: keyof ClientToServerEvents | null,
  listenEvent: E,
  handler: ServerToClientEvents[E],
  subscribeArg?: unknown,
): void {
  const socket = useSocketStore((s) => s.socket);

  useEffect(() => {
    if (!socket || !subscribeEvent) return;

    if (subscribeArg !== undefined) {
      (socket.emit as Function)(subscribeEvent, subscribeArg);
    } else {
      (socket.emit as Function)(subscribeEvent);
    }

    socket.on(listenEvent, handler as any);

    return () => {
      if (unsubscribeEvent) {
        if (subscribeArg !== undefined) {
          (socket.emit as Function)(unsubscribeEvent, subscribeArg);
        } else {
          (socket.emit as Function)(unsubscribeEvent);
        }
      }
      socket.off(listenEvent, handler as any);
    };
  }, [socket, subscribeEvent, unsubscribeEvent, listenEvent, handler, subscribeArg]);
}
```

**Step 2: Refactor useVatsim to use the hook**

```typescript
// Replace the WebSocket subscription useEffect with:
const handleUpdate = useCallback((data: VatsimUpdateEvent) => {
  // ... same reconstruction logic ...
  setSnapshot(snapshot);
}, [setSnapshot]);

useSocketSubscription('vatsim:subscribe', 'vatsim:unsubscribe', 'vatsim:update', handleUpdate);
```

**Step 3: Refactor useTrack similarly**

**Step 4: Commit**

```bash
git add frontend/src/hooks/
git commit -m "refactor: extract useSocketSubscription hook (DRY socket pattern)"
```

---

### Task 15: Deduplicate weather fetching

**Files:**
- Modify: `frontend/src/hooks/useDispatchData.ts`
- Verify: `frontend/src/lib/weather-api.ts` is already the single source

**Step 1: Confirm weather-api.ts is the shared utility**

`weather-api.ts` already exports `fetchMetar`, `fetchTaf`, `fetchNotams`. Both `useDispatchData.ts` and `useWeather.ts` import from it. The duplication is NOT in the fetch functions themselves — it's in the caching logic.

`useDispatchData` has its own `metarCacheRef`/`tafCacheRef` while `useWeather` uses `weatherCache` from the flightPlanStore. These serve different pages (Dispatch vs Planning) with different data shapes.

**Decision: NOT a DRY violation** — these are separate concerns using a shared fetch utility. The caching is appropriately scoped to each consumer. No change needed.

**Step 2: Document this decision in a comment**

Add a brief comment at the top of `useDispatchData.ts`:
```typescript
/**
 * Dispatch-specific weather data hook with its own cache (separate from useWeather).
 * Both hooks share fetchMetar/fetchTaf from weather-api.ts but cache independently
 * because Dispatch and Planning pages have different lifecycles.
 */
```

**Step 3: Commit**

```bash
git add frontend/src/hooks/useDispatchData.ts
git commit -m "docs: clarify weather hook caching is intentionally separate"
```

---

### Task 16: Create backend logger utility

**Files:**
- Create: `backend/src/lib/logger.ts`
- Modify: All backend route files and services that use `console.error`/`console.warn`

**Step 1: Create a minimal structured logger**

```typescript
type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVELS: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };

const minLevel = process.env.LOG_LEVEL as LogLevel || 'info';

function shouldLog(level: LogLevel): boolean {
  return LEVELS[level] >= LEVELS[minLevel];
}

function log(level: LogLevel, tag: string, message: string, meta?: unknown): void {
  if (!shouldLog(level)) return;
  const ts = new Date().toISOString();
  const entry = `${ts} [${level.toUpperCase()}] [${tag}] ${message}`;
  if (meta) {
    console[level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log'](entry, meta);
  } else {
    console[level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log'](entry);
  }
}

export const logger = {
  debug: (tag: string, msg: string, meta?: unknown) => log('debug', tag, msg, meta),
  info: (tag: string, msg: string, meta?: unknown) => log('info', tag, msg, meta),
  warn: (tag: string, msg: string, meta?: unknown) => log('warn', tag, msg, meta),
  error: (tag: string, msg: string, meta?: unknown) => log('error', tag, msg, meta),
};
```

**Step 2: Replace console.error/warn calls in route handlers**

Pattern:
```typescript
// Before:
console.error('[Admin] List finances error:', err);
// After:
import { logger } from '../lib/logger.js';
logger.error('Admin', 'List finances error', err);
```

Apply across all ~50 backend console.error/warn instances.

**Step 3: Commit**

```bash
git add backend/src/lib/logger.ts backend/src/routes/ backend/src/services/ backend/src/index.ts
git commit -m "refactor: replace raw console calls with structured logger"
```

---

## Phase 6: Polish

### Task 17: Update MEMORY.md

**Files:**
- Modify: `C:\Users\scade\.claude\projects\C--Users-scade-Documents-SMA-ACARS\memory\MEMORY.md`

**Step 1: Remove outdated .NET architecture references**

The project is now 100% TypeScript. Remove or archive sections about C#/WPF/.NET, SimConnect DLLs, Assembly resolution, etc. Keep the "Web Stack" and "Aviation Design System" sections as they're current.

**Step 2: Add audit completion notes**

Add a section:
```markdown
## Audit Completed (Feb 2026)
- Secrets removed from Git, .env.example template created
- 48 `as any` casts replaced with typed interfaces
- Toast notification system added for error visibility
- AbortController on navigation-sensitive fetches
- React.memo + useCallback on expensive components
- useSocketSubscription hook extracted (DRY)
- Structured logger replaces raw console calls
- Electron build no longer bundles .env secrets
```

**Step 3: Commit**

```bash
git add "C:\Users\scade\.claude\projects\C--Users-scade-Documents-SMA-ACARS\memory\MEMORY.md"
git commit -m "docs: update MEMORY.md to reflect current TypeScript architecture"
```

---

## Verification Checklist

After all tasks are complete, verify:

1. **Build clean**: `cd backend && npx tsc --noEmit` — 0 errors
2. **Build clean**: `cd frontend && npx tsc --noEmit` — 0 errors
3. **No `as any` in routes**: `grep -r "as any" backend/src/routes/` — 0 matches
4. **No committed secrets**: `git show HEAD:backend/.env` — should fail (file untracked)
5. **Electron clean**: `backend/.env` not in `electron/package.json` extraResources
6. **Frontend runs**: `npm run dev:all` — app loads, no console errors
7. **Bundle size**: `cd frontend && npm run build` — main chunk < 800 KB
