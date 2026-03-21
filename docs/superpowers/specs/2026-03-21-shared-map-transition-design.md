# Shared Persistent Map — Overview ↔ Dispatch Transition

**Date:** 2026-03-21
**Status:** Design approved

## Problem

The admin dashboard (Overview) and dispatch pages each render their own independent map. The Overview uses `react-simple-maps` (SVG WorldMap) while the dispatch page uses `react-leaflet`. Navigating between them causes a full page unmount/mount cycle with no visual continuity — the map disappears and reappears.

## Goals

- Unify both pages under a single persistent map instance (WorldMap / react-simple-maps)
- Animate the transition between Overview and Dispatch modes seamlessly — map stays still, UI panels slide in/out
- Maintain bookmarkable URLs (`/admin/` for Overview, `/admin/dispatch` for Dispatch)
- Keep the FlightDetailsPage (`/admin/dispatch/:bidId`) as a separate full page (no map transition)

## Design

### Architecture: Layout-Level Persistent Map

The WorldMap component is lifted from DashboardPage into the `DashboardLayout` so it persists across route changes. Page-specific UI (overview cards, dispatch overlays) renders on top of the map as animated panels.

```
DashboardLayout
├── TopBar (navigation)
├── SharedMapContainer (always rendered, never unmounts)
│   └── WorldMap (react-simple-maps)
│       ├── Geographies (countries)
│       ├── Flight markers (mode-aware: overview vs dispatch styling)
│       ├── Hub markers (overview mode only)
│       └── Route visualization (selected flight)
├── OverviewPanels (animated, visible when route = /)
│   ├── LeftColumn (Finance, Maintenance cards) — slides from left
│   └── RightColumn (Schedules card) — slides from right
└── DispatchOverlays (animated, visible when route = /dispatch)
    ├── FilterBar — fades in from top
    ├── FlightStrip — slides up from bottom
    └── FloatingFlightCard — appears on marker click
```

### Shared Map Container

A new component that wraps WorldMap and lives inside DashboardLayout. It renders for Overview and Dispatch routes only — other pages (Fleet, Schedules, etc.) do not show the map.

```typescript
// Pseudocode in DashboardLayout
const isMapRoute = pathname === '/' || pathname === '/dispatch';

return (
  <div className="flex flex-col h-full">
    <TopBar />
    <div className="flex-1 relative overflow-hidden">
      {isMapRoute && <SharedMapContainer />}
      <Outlet /> {/* Page-specific content renders on top */}
    </div>
  </div>
);
```

The SharedMapContainer:
- Manages flight data (socket subscription for `flights:active`, API polling for dispatch flights)
- Manages hub data (fetched once on mount)
- Exposes current mode ('overview' | 'dispatch') derived from the URL
- Passes mode-appropriate props to WorldMap
- Handles selected flight state (shared between map and overlay panels)

### Mode-Aware Map Behavior

The WorldMap already accepts `flights`, `hubs`, `selectedCallsign`, and `onSelectCallsign` as props. The SharedMapContainer varies these by mode:

**Overview mode:**
- `flights`: Active flights from socket heartbeats (current behavior)
- `hubs`: Hub airports with coverage percentages
- Selected flight shows planned route, actual track, and right-side detail panel
- Flight markers: standard styling (all same color)

**Dispatch mode:**
- `flights`: All flights (flying + planning + completed) merged from heartbeats + API
- `hubs`: empty (hidden)
- Selected flight shows floating card (not right-side panel)
- Flight markers: phase-colored (green=flying, amber=planning, gray=completed)
- Planning flights positioned at departure airport, completed at arrival airport

New WorldMap props to support dispatch mode:
```typescript
interface WorldMapProps {
  // Existing
  flights?: FlightData[];
  hubs?: HubData[];
  selectedCallsign?: string | null;
  onSelectCallsign?: (callsign: string | null) => void;
  // New
  mode?: 'overview' | 'dispatch';
  onFlightClick?: (flight: FlightData) => void;
}
```

When `mode === 'dispatch'`:
- Markers get phase-based coloring (uses `flight.phase` field)
- Hub markers are hidden
- Right-side detail panel is hidden (floating card handles this instead)
- Planning/completed flights are rendered at their airport positions

### Animated Transitions

When the URL changes between `/admin/` and `/admin/dispatch`:

**Overview → Dispatch (entering dispatch):**
1. Left column cards slide left + fade out (300ms, ease-out)
2. Right column cards slide right + fade out (300ms, ease-out)
3. After 150ms stagger: Filter bar fades in from top, flight strip slides up from bottom (300ms, ease-out)
4. Map stays completely still — zero re-renders related to navigation

**Dispatch → Overview (entering overview):**
1. Filter bar fades out upward, flight strip slides down (300ms, ease-out)
2. After 150ms stagger: Left column slides in from left, right column slides in from right (300ms, ease-out)
3. Map stays still

**Implementation approach:** Use CSS transitions with conditional classes. Each panel component receives an `active` boolean prop. When `active` transitions from false→true, the panel animates in. When true→false, it animates out.

```css
.panel-left {
  transform: translateX(-100%);
  opacity: 0;
  transition: transform 300ms ease-out, opacity 300ms ease-out;
}
.panel-left.active {
  transform: translateX(0);
  opacity: 1;
}
```

The stagger delay is achieved via `transition-delay` on the incoming panels.

### Data Flow

**Flight data unification:**

Both modes need flight data from the same sources. A shared context provides:

```typescript
interface SharedMapContextValue {
  // All flights (heartbeats merged with dispatch API data)
  allFlights: FlightData[];
  // Filtered to just active (for overview)
  activeFlights: FlightData[];
  // Hubs
  hubs: HubData[];
  // Selection
  selectedCallsign: string | null;
  setSelectedCallsign: (callsign: string | null) => void;
  // Selected flight's full DispatchFlight data (for floating card / detail panel)
  selectedDispatchFlight: DispatchFlight | null;
}
```

The context:
- Subscribes to `livemap:subscribe` for heartbeat data (both modes need this)
- Polls `GET /api/dispatch/flights?phase=all` every 30s (dispatch mode needs planning/completed)
- Fetches hubs once on mount
- Merges heartbeat data with API data into a unified `FlightData[]` array

### Page Components After Refactor

**DashboardPage** becomes a thin overlay component (no longer fetches its own flights or renders a map):
- Renders overview cards (Finance, Maintenance, Schedules) with animation classes
- Reads flight data from SharedMapContext
- Still fetches its own KPI data (financial, maintenance summary, etc.)

**DispatchMapPage** becomes a thin overlay component (no longer renders its own map):
- Renders FilterBar, FlightStrip, FloatingFlightCard with animation classes
- Reads flight data from SharedMapContext
- Manages dispatch-specific state (phase filter, search query)

**FlightDetailsPage** stays unchanged — a full separate page. When navigating to it, the map unmounts (it's not a map route). The "← Back to Map" link returns to `/admin/dispatch` where the map remounts.

### WorldMap Changes Required

1. **Add `mode` prop** — Controls whether to show dispatch-style or overview-style markers
2. **Phase-colored markers in dispatch mode** — Green/amber/gray based on `flight.phase`
3. **Hide hubs in dispatch mode** — Skip hub marker rendering when `mode === 'dispatch'`
4. **Hide right-side detail panel in dispatch mode** — The floating card replaces it
5. **Support planning/completed flight positions** — Planning flights at departure airport coords, completed at arrival airport coords (use `depLat/depLon` or `arrLat/arrLon` fallbacks)
6. **Click handler** — In dispatch mode, `onFlightClick` is called with the full flight data for the floating card

### FloatingFlightCard on SVG Map

The FloatingFlightCard (currently using Leaflet Popup) needs to be repositioned for the SVG-based WorldMap. Two options:

**Approach:** Render the card as an absolutely-positioned div outside the SVG, positioned using the map's projection to convert lat/lon to pixel coordinates. The WorldMap already uses `useZoomableGroup` or similar — we can expose the current projection function and use it to calculate screen position.

Simpler alternative: Position the card relative to the click event's screen coordinates, similar to a context menu. This avoids coupling to the map's internal projection.

### Component Structure

```
admin/src/
  components/
    layout/
      DashboardLayout.tsx          — Modified: add SharedMapContainer
      SharedMapContainer.tsx       — New: persistent map + data context
      SharedMapContext.tsx          — New: flight data context
    map/
      WorldMap.tsx                  — Modified: add mode prop, dispatch markers
    dispatch/
      FilterBar.tsx                — Unchanged
      FlightStrip.tsx              — Unchanged
      FloatingFlightCard.tsx       — Modified: position via screen coords instead of Leaflet Popup
      FlightMarker.tsx             — Deleted (was Leaflet-specific)
    dashboard/
      (existing card components)   — Unchanged
  pages/
    DashboardPage.tsx              — Simplified: overlay-only, reads from context
    DispatchMapPage.tsx            — Simplified: overlay-only, reads from context
    FlightDetailsPage.tsx          — Unchanged
```

### Routing Considerations

React Router's `<Outlet />` renders the matched page component. For the map to persist, the SharedMapContainer must render **outside** of `<Outlet />` in the layout, not inside a page component. The page components become overlay-only.

For non-map routes (Fleet, Schedules, etc.), the SharedMapContainer conditionally doesn't render, and `<Outlet />` renders the full page as before.

### Animation Timing

| Element | Enter | Exit | Delay (enter) |
|---------|-------|------|---------------|
| Overview left cards | slideInLeft 300ms | slideOutLeft 300ms | 150ms (after dispatch exits) |
| Overview right cards | slideInRight 300ms | slideOutRight 300ms | 150ms |
| Dispatch filter bar | fadeInDown 300ms | fadeOutUp 200ms | 150ms (after overview exits) |
| Dispatch flight strip | slideInUp 300ms | slideOutDown 200ms | 200ms |
| Dispatch floating card | fadeIn 200ms | fadeOut 150ms | 0ms (immediate on click) |
