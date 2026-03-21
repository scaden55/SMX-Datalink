# Shared Persistent Map — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unify the admin Overview and Dispatch pages under a single persistent WorldMap with animated panel transitions.

**Architecture:** Lift the WorldMap out of DashboardPage into DashboardLayout so it persists across route changes. DashboardPage and DispatchMapPage become thin overlay components that render animated panels on top. A SharedMapContext provides unified flight/hub data. WorldMap gains a `mode` prop to switch between overview and dispatch rendering behavior.

**Tech Stack:** React 19, react-simple-maps, CSS transitions, React Router v6, Socket.io

**Spec:** `docs/superpowers/specs/2026-03-21-shared-map-transition-design.md`

**No test framework configured** — verification is manual.

---

## File Structure

### New Files
- **Create:** `admin/src/components/layout/SharedMapContext.tsx` — Context providing unified flight data, hubs, selection state, and current mode
- **Create:** `admin/src/components/layout/SharedMapContainer.tsx` — Persistent map wrapper that renders WorldMap + subscribes to data

### Modified Files
- **Modify:** `admin/src/components/layout/DashboardLayout.tsx` — Add SharedMapContainer outside Outlet for map routes
- **Modify:** `admin/src/components/map/WorldMap.tsx` — Add `mode` prop, dispatch-style phase coloring, hide hubs/detail panel in dispatch mode
- **Modify:** `admin/src/pages/DashboardPage.tsx` — Remove WorldMap rendering, read data from SharedMapContext, add enter/exit animation classes
- **Modify:** `admin/src/pages/DispatchMapPage.tsx` — Remove Leaflet map, read data from SharedMapContext, render only overlay panels with animations
- **Modify:** `admin/src/components/dispatch/FloatingFlightCard.tsx` — Switch from Leaflet Popup to absolutely-positioned div using click coordinates
- **Modify:** `admin/src/styles/globals.css` — Add transition animation classes

### Deleted Files
- **Delete:** `admin/src/components/dispatch/FlightMarker.tsx` — Was Leaflet-specific, no longer needed (WorldMap handles markers)

---

## Task 1: SharedMapContext

**Files:**
- Create: `admin/src/components/layout/SharedMapContext.tsx`

- [ ] **Step 1: Create the context**

This context provides unified flight data consumed by both Overview and Dispatch overlays, plus the WorldMap.

```typescript
// SharedMapContext.tsx
import { createContext, useContext, useState, useEffect, useMemo, useCallback, useRef, type ReactNode } from 'react';
import type { ActiveFlightHeartbeat, DispatchFlightsResponse, DispatchFlight } from '@acars/shared';
import { useLocation } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { useSocketStore } from '@/stores/socketStore';
import { useSocket } from '@/hooks/useSocket';
import { api } from '@/lib/api';

type MapMode = 'overview' | 'dispatch';

interface SharedMapContextValue {
  mode: MapMode;
  // Heartbeat flights (all active, used by overview)
  liveFlights: ActiveFlightHeartbeat[];
  // All dispatch flights (planning + active + completed, used by dispatch)
  dispatchFlights: DispatchFlight[];
  // Hubs
  hubs: Array<{ lat: number; lon: number; icao?: string; coverage?: number }>;
  // Selection
  selectedCallsign: string | null;
  setSelectedCallsign: (callsign: string | null) => void;
  selectedBidId: number | null;
  setSelectedBidId: (bidId: number | null) => void;
  // Click position for floating card (screen pixel coordinates from WorldMap marker click)
  clickPosition: { x: number; y: number } | null;
  setClickPosition: (pos: { x: number; y: number } | null) => void;
}
```

The context derives `mode` from `useLocation().pathname`:
- `pathname === '/'` or `pathname === ''` → `'overview'`
- `pathname.startsWith('/dispatch')` → `'dispatch'`

Data fetching:
- Always subscribe to `livemap:subscribe` for heartbeats (both modes use this)
- Always poll `GET /api/dispatch/flights?phase=all` every 30s (dispatch needs planning/completed; overview can ignore them)
- Fetch hubs once on mount via `GET /api/admin/airports`

Socket lifecycle: acquire on mount (when accessToken available), release on unmount. Same pattern as existing pages — use `useSocketStore().acquire(accessToken)`.

- [ ] **Step 2: Verify compilation**

Run: `cd admin && npx tsc --noEmit 2>&1 | grep SharedMapContext`
Expected: No errors (may be unused export warning)

- [ ] **Step 3: Commit**

```bash
git add admin/src/components/layout/SharedMapContext.tsx
git commit -m "feat(admin): add SharedMapContext for unified flight data"
```

---

## Task 2: SharedMapContainer

**Files:**
- Create: `admin/src/components/layout/SharedMapContainer.tsx`

- [ ] **Step 1: Create the container**

This component wraps WorldMap and the SharedMapContext provider. It's rendered by DashboardLayout for map routes only.

```typescript
// SharedMapContainer.tsx
import { Suspense, lazy, useMemo } from 'react';
import { SharedMapProvider, useSharedMap } from './SharedMapContext';

const WorldMap = lazy(() =>
  import('@/components/map/WorldMap').then((m) => ({ default: m.WorldMap })),
);

export function SharedMapContainer({ children }: { children: React.ReactNode }) {
  return (
    <SharedMapProvider>
      <div className="absolute inset-0">
        <Suspense fallback={null}>
          <MapBridge />
        </Suspense>
      </div>
      {/* Page overlays render on top */}
      <div className="relative h-full" style={{ zIndex: 10 }}>
        {children}
      </div>
    </SharedMapProvider>
  );
}
```

`MapBridge` is a small inner component that reads from `useSharedMap()` and passes the right props to WorldMap based on mode:

**Overview mode:**
- `flights`: Convert `liveFlights` (heartbeats) to WorldMap's `FlightData[]` format (same mapping as current DashboardPage `mapFlights` memo)
- `hubs`: Pass through
- `selectedCallsign` / `onSelectCallsign`: Pass through
- `mode`: `'overview'`

**Dispatch mode:**
- `flights`: Merge heartbeats + dispatchFlights into `FlightData[]`, including planning/completed flights with phase info. Add `phase` field to each FlightData.
- `hubs`: Empty array (hidden in dispatch)
- `selectedCallsign`: Derived from `selectedBidId` (find matching flight's callsign)
- `onSelectCallsign`: Maps back to `setSelectedBidId`
- `mode`: `'dispatch'`

- [ ] **Step 2: Verify compilation**

- [ ] **Step 3: Commit**

```bash
git add admin/src/components/layout/SharedMapContainer.tsx
git commit -m "feat(admin): add SharedMapContainer with WorldMap bridge"
```

---

## Task 3: Modify DashboardLayout

**Files:**
- Modify: `admin/src/components/layout/DashboardLayout.tsx`

- [ ] **Step 1: Add conditional SharedMapContainer**

The layout renders SharedMapContainer for map routes only. Use `useLocation()` to check the path.

```typescript
import { Outlet, useLocation } from 'react-router-dom';
import { TopBar } from './TopBar';
import { SharedMapContainer } from './SharedMapContainer';

export function DashboardLayout() {
  const { pathname } = useLocation();
  const isMapRoute = pathname === '/' || pathname === '' || pathname === '/dispatch';

  return (
    <div className="flex flex-col h-screen overflow-hidden" style={{ background: 'var(--surface-0)' }}>
      <TopBar />
      <main className="flex-1 relative overflow-hidden">
        {isMapRoute ? (
          <SharedMapContainer>
            <Outlet />
          </SharedMapContainer>
        ) : (
          <div className="h-full overflow-y-auto">
            <Outlet />
          </div>
        )}
      </main>
    </div>
  );
}
```

Key: When `isMapRoute` is true, the Outlet (page content) renders inside SharedMapContainer. The page overlays render on top of the map. When false, normal page rendering (full-height scrollable).

- [ ] **Step 2: Verify compilation**

- [ ] **Step 3: Commit**

```bash
git add admin/src/components/layout/DashboardLayout.tsx
git commit -m "feat(admin): conditional SharedMapContainer in DashboardLayout"
```

---

## Task 4: WorldMap Dispatch Mode

**Files:**
- Modify: `admin/src/components/map/WorldMap.tsx`

- [ ] **Step 1: Add mode prop and dispatch-specific rendering**

Add to `WorldMapProps`:
```typescript
interface WorldMapProps {
  // ... existing props
  mode?: 'overview' | 'dispatch';
  onFlightClick?: (flight: FlightData) => void;
}
```

Changes based on `mode === 'dispatch'`:

1. **Phase-colored markers**: In the flight marker rendering section, when `mode === 'dispatch'`, use `flight.phase` to determine marker color:
   - `phase === 'active'` or no phase: green (`#4ade80`)
   - `phase === 'planning'`: amber (`#f59e0b`)
   - `phase === 'completed'`: gray (`#6b7280`, opacity 0.6)

   Currently all markers use the same color. Add a color-selection function:
   ```typescript
   function getMarkerColor(flight: FlightData, mode: string): string {
     if (mode !== 'dispatch') return '#e2e8f0'; // default overview color
     switch (flight.phase) {
       case 'planning': return '#f59e0b';
       case 'completed': return '#6b7280';
       default: return '#4ade80'; // flying/active
     }
   }
   ```

2. **Hide hubs in dispatch mode**: Wrap hub marker rendering in `{mode !== 'dispatch' && ( ... )}`.

3. **Hide right-side detail panel in dispatch mode**: The WorldMap has a right-side panel (around lines 443-568) that shows selected flight telemetry. Wrap it in `{mode !== 'dispatch' && ( ... )}`.

4. **Planning/completed flight positions**: Flights with `phase === 'planning'` should use `depLat/depLon` as position. Flights with `phase === 'completed'` should use `arrLat/arrLon`. The FlightData interface already has these optional fields. In the marker rendering, use:
   ```typescript
   const markerLat = flight.latitude || (flight.phase === 'completed' ? flight.arrLat : flight.depLat) || 0;
   const markerLon = flight.longitude || (flight.phase === 'completed' ? flight.arrLon : flight.depLon) || 0;
   ```

5. **Click handler**: In dispatch mode, clicking a flight marker calls `onFlightClick?.(flight)` instead of (or in addition to) `onSelectCallsign`.

- [ ] **Step 2: Verify WorldMap still renders correctly in overview mode**

Run dev server, navigate to Overview. Map should look identical to before.

- [ ] **Step 3: Commit**

```bash
git add admin/src/components/map/WorldMap.tsx
git commit -m "feat(admin): add dispatch mode to WorldMap with phase-colored markers"
```

---

## Task 5: CSS Transition Animations

**Files:**
- Modify: `admin/src/styles/globals.css`

- [ ] **Step 1: Add animation classes**

Add these CSS transition classes to `globals.css`:

```css
/* ── Map panel transitions ─────────────────────────────── */

.map-panel-left {
  transform: translateX(-100%);
  opacity: 0;
  transition: transform 300ms ease-out, opacity 300ms ease-out;
}
.map-panel-left.active {
  transform: translateX(0);
  opacity: 1;
}

.map-panel-right {
  transform: translateX(100%);
  opacity: 0;
  transition: transform 300ms ease-out, opacity 300ms ease-out;
}
.map-panel-right.active {
  transform: translateX(0);
  opacity: 1;
}

.map-panel-top {
  transform: translateY(-20px);
  opacity: 0;
  transition: transform 300ms ease-out, opacity 300ms ease-out;
  transition-delay: 150ms;
}
.map-panel-top.active {
  transform: translateY(0);
  opacity: 1;
}

.map-panel-bottom {
  transform: translateY(100%);
  opacity: 0;
  transition: transform 300ms ease-out, opacity 300ms ease-out;
  transition-delay: 200ms;
}
.map-panel-bottom.active {
  transform: translateY(0);
  opacity: 1;
}
```

- [ ] **Step 2: Commit**

```bash
git add admin/src/styles/globals.css
git commit -m "feat(admin): add CSS transition classes for map panel animations"
```

---

## Task 6: Refactor DashboardPage to Overlay

**Files:**
- Modify: `admin/src/pages/DashboardPage.tsx`

- [ ] **Step 1: Remove map rendering, read from context**

DashboardPage no longer renders WorldMap or manages flight/hub data. It reads from SharedMapContext and renders only the overlay panels.

Remove:
- The `WorldMap` lazy import and `<Suspense>` wrapper
- `liveFlights`, `dbFlights`, `hubs` state and their fetch functions
- Socket subscription (`useSocket` for `flights:active`)
- Socket acquisition (`useSocketStore().acquire()`)
- `mapFlights` memo

Keep:
- KPI fetching (financial, maintenance, dashboard data, pilotActivity, periodPnl, routeMargins)
- FinanceCard, MaintenanceCard, SchedulesCard rendering
- `selectedCallsign` — read from `useSharedMap()` context instead of local state

Add:
- `import { useSharedMap } from '@/components/layout/SharedMapContext'`
- Animation: The outer content div gets `map-panel-left` / `map-panel-right` classes with `active` applied immediately on mount (using a `useEffect` with a short delay or `requestAnimationFrame`):

```typescript
const [mounted, setMounted] = useState(false);
useEffect(() => {
  requestAnimationFrame(() => setMounted(true));
  return () => setMounted(false);
}, []);
```

Left column: `className={`map-panel-left ${mounted ? 'active' : ''}`}`
Right column: `className={`map-panel-right ${mounted ? 'active' : ''}`}`

The page structure becomes:
```tsx
export function DashboardPage() {
  const { selectedCallsign, setSelectedCallsign } = useSharedMap();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setMounted(true));
    return () => setMounted(false);
  }, []);

  // ... KPI fetches (unchanged) ...

  return (
    <div className="h-full flex pointer-events-none">
      {/* Left column */}
      <div className={`map-panel-left ${mounted ? 'active' : ''} pointer-events-auto flex flex-col overflow-y-auto`} style={{ width: 360, ... }}>
        <h1>Welcome, {firstName}</h1>
        <FinanceCard ... />
        <MaintenanceCard ... />
      </div>

      <div className="flex-1 min-w-0 pointer-events-none" />

      {/* Right column */}
      <div className={`map-panel-right ${mounted ? 'active' : ''} pointer-events-auto flex flex-col overflow-y-auto`} style={{ width: 360, ... }}>
        <SchedulesCard />
      </div>
    </div>
  );
}
```

No outer `relative` container with `absolute inset-0` for the map — the map is rendered by SharedMapContainer at the layout level now.

- [ ] **Step 2: Verify Overview page renders correctly**

Run dev server, navigate to Overview. Cards should animate in from left/right. Map visible behind. KPI data loads normally.

- [ ] **Step 3: Commit**

```bash
git add admin/src/pages/DashboardPage.tsx
git commit -m "feat(admin): refactor DashboardPage to overlay-only with animations"
```

---

## Task 7: Refactor FloatingFlightCard for SVG Map

**Files:**
- Modify: `admin/src/components/dispatch/FloatingFlightCard.tsx`

- [ ] **Step 1: Replace Leaflet Popup with positioned div**

The FloatingFlightCard currently uses react-leaflet's `Popup` component. Since we're moving to react-simple-maps (SVG), it needs to be an absolutely-positioned div.

New approach: Position the card based on screen coordinates passed from the click event on the WorldMap marker.

Update the props:
```typescript
interface FloatingFlightCardProps {
  flight: DispatchMapFlight;
  position: { x: number; y: number };  // screen pixel coordinates
  onOpenDetails: () => void;
  onClose: () => void;
}
```

The component renders as:
```tsx
<div
  className="absolute z-50 w-[280px] ..."
  style={{
    left: position.x + 12,
    top: position.y - 20,
    // Ensure card doesn't go off-screen (clamp if needed)
  }}
>
  {/* ... existing card content (keep all the JSX) ... */}
</div>
```

Remove all `react-leaflet` imports (`Popup`). Remove the `.dispatch-popup` CSS class that was added for Leaflet popup styling.

Keep all the existing card content (header, route, telemetry, pilot info, action buttons).

- [ ] **Step 2: Commit**

```bash
git add admin/src/components/dispatch/FloatingFlightCard.tsx admin/src/styles/globals.css
git commit -m "feat(admin): convert FloatingFlightCard from Leaflet Popup to positioned div"
```

---

## Task 8: Refactor DispatchMapPage to Overlay

**Files:**
- Modify: `admin/src/pages/DispatchMapPage.tsx`
- Delete: `admin/src/components/dispatch/FlightMarker.tsx`

- [ ] **Step 1: Remove Leaflet map, read from context**

DispatchMapPage no longer renders a Leaflet map or manages flight data. It reads from SharedMapContext and renders only the overlay panels (FilterBar, FlightStrip, FloatingFlightCard).

Remove:
- All Leaflet imports (`MapContainer`, `TileLayer`, `useMap`, `leaflet/dist/leaflet.css`)
- `FlightMarker` import
- `MapBackground` component
- `apiFlightToMapFlight` function
- `mergeHeartbeats` function
- Socket subscription and acquisition
- API polling
- `apiFlights`, `heartbeats` state

Move `DispatchMapFlight` type to `SharedMapContext.tsx` (it's now shared between context and overlay). Update all consumers (`FlightStrip.tsx`, `FloatingFlightCard.tsx`, and any other files that import `DispatchMapFlight` from `@/pages/DispatchMapPage`) to import from `@/components/layout/SharedMapContext` instead.

Read from context:
```typescript
const { mode, liveFlights, dispatchFlights, selectedBidId, setSelectedBidId } = useSharedMap();
```

Compute `allFlights`, `phaseCounts`, `visibleFlights` from context data (same logic, just sourced from context). Or better: expose these as computed values from SharedMapContext directly.

Keep:
- FilterBar rendering
- FlightStrip rendering
- FloatingFlightCard rendering (now positioned via click coords from WorldMap)
- Phase filter and search state (local to this page)
- `useNavigate` for "Open Details"

For the FloatingFlightCard position: WorldMap needs to report the click coordinates when a flight marker is clicked. Add to SharedMapContext:
```typescript
clickPosition: { x: number; y: number } | null;
setClickPosition: (pos: { x: number; y: number } | null) => void;
```

WorldMap's `onFlightClick` handler passes the mouse event coordinates to the context.

Animation:
```typescript
const [mounted, setMounted] = useState(false);
useEffect(() => {
  requestAnimationFrame(() => setMounted(true));
  return () => setMounted(false);
}, []);
```

FilterBar wrapper: `className={`map-panel-top ${mounted ? 'active' : ''}`}`
FlightStrip wrapper: `className={`map-panel-bottom ${mounted ? 'active' : ''}`}`

Page structure:
```tsx
export default function DispatchMapPage() {
  const navigate = useNavigate();
  const { dispatchFlights, liveFlights, selectedBidId, setSelectedBidId, clickPosition } = useSharedMap();

  const [mounted, setMounted] = useState(false);
  const [phaseFilter, setPhaseFilter] = useState<PhaseFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    requestAnimationFrame(() => setMounted(true));
    return () => setMounted(false);
  }, []);

  // ... compute allFlights, phaseCounts, visibleFlights from context data ...

  return (
    <div className="h-full relative pointer-events-none">
      <div className={`map-panel-top ${mounted ? 'active' : ''} pointer-events-auto`}>
        <FilterBar ... />
      </div>

      {selectedFlight && clickPosition && (
        <div className="pointer-events-auto">
          <FloatingFlightCard
            flight={selectedFlight}
            position={clickPosition}
            onOpenDetails={() => navigate(`/dispatch/${selectedFlight.bidId}`)}
            onClose={() => setSelectedBidId(null)}
          />
        </div>
      )}

      <div className={`map-panel-bottom ${mounted ? 'active' : ''} pointer-events-auto`}>
        <FlightStrip ... />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Delete FlightMarker.tsx**

`admin/src/components/dispatch/FlightMarker.tsx` was Leaflet-specific. WorldMap now handles all marker rendering.

- [ ] **Step 3: Verify dispatch page renders correctly**

Navigate to `/admin/dispatch`. Filter bar should fade in from top, flight strip should slide up from bottom. Map shows flights with phase coloring. Clicking a marker shows the floating card.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(admin): refactor DispatchMapPage to overlay-only with animations"
```

---

## Task 9: Transition Polish + Cleanup

**Files:**
- Various tweaks across modified files

- [ ] **Step 1: Test Overview → Dispatch transition**

Navigate from Overview to Dispatch via the nav:
1. Left/right cards should slide out (left goes left, right goes right)
2. Filter bar and flight strip should slide in (top and bottom)
3. Map should stay perfectly still — no flicker, no unmount, no position change
4. Flight markers should transition from overview style to dispatch style (phase colors)

Fix any issues: timing, flicker, z-index stacking.

- [ ] **Step 2: Test Dispatch → Overview transition**

Navigate back from Dispatch to Overview:
1. Filter bar and flight strip should animate out
2. Left/right cards should slide in
3. Map stays still
4. Markers return to overview styling

- [ ] **Step 3: Test Dispatch → FlightDetailsPage → Back**

1. From dispatch, click "Open Details" → FlightDetailsPage renders (map unmounts, that's expected)
2. Click "← Back to Map" → Dispatch page loads, map remounts, overlays animate in

This will have a brief loading state as the map remounts. Acceptable.

- [ ] **Step 4: Remove Leaflet CSS import**

If `DispatchMapPage` was the only file importing `leaflet/dist/leaflet.css`, remove it. Check if any other component still uses Leaflet (the `RouteMapPanel` on FlightDetailsPage still uses Leaflet — that's fine, it imports its own CSS).

- [ ] **Step 5: Clean up unused Leaflet references**

Check if `FlightMarker.tsx` is deleted. Check for any orphaned imports of Leaflet in dispatch components (except RouteMapPanel which still uses it for the details page route map).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(admin): shared map transition polish and cleanup"
```

---

## Task Summary

| Task | Description | Depends On |
|------|-------------|------------|
| 1 | SharedMapContext | — |
| 2 | SharedMapContainer | Task 1 |
| 3 | DashboardLayout modification | Task 2 |
| 4 | WorldMap dispatch mode | — |
| 5 | CSS transition animations | — |
| 6 | DashboardPage refactor to overlay | Tasks 1, 3, 5 |
| 7 | FloatingFlightCard SVG positioning | — |
| 8 | DispatchMapPage refactor to overlay | Tasks 1, 3, 4, 5, 7 |
| 9 | Transition polish + cleanup | All above |

**Parallelizable:** Tasks 1, 4, 5, 7 have no dependencies and can run in parallel.
