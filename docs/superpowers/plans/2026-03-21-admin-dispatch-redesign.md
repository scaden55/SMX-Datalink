# Admin Dispatch Page Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the admin dispatch board with a two-page flight operations center — a full-screen map overview and a dedicated flight details/editing page.

**Architecture:** Two admin pages (`/admin/dispatch` map overview, `/admin/dispatch/:bidId` flight details) backed by expanded backend APIs. The map page shows all flights across the full lifecycle (planning, active, completed). The details page mirrors the pilot dispatch page's layout with a left column of editable flight plan sections and a right column with route map + tabbed panels. Real-time updates via existing WebSocket infrastructure.

**Tech Stack:** React 19, React Router v6, Leaflet (react-leaflet), Zustand (minimal), Socket.io client, Tailwind CSS, shadcn/ui, Phosphor icons

**Spec:** `docs/superpowers/specs/2026-03-21-admin-dispatch-redesign-design.md`

**No test framework configured** — verification is manual (browser + API calls).

---

## File Structure

### Backend Changes
- **Modify:** `shared/src/types/dispatch.ts` — Expand `DispatchEditPayload` with new fields
- **Modify:** `backend/src/routes/dispatch.ts` — Expand PATCH whitelist, add single-flight GET, include planning/completed flights
- **Modify:** `backend/src/routes/cargo.ts` — Add PATCH endpoint for dispatcher cargo editing

### Admin Frontend — Map Page
- **Create:** `admin/src/pages/DispatchMapPage.tsx` — Full-screen map with floating cards
- **Create:** `admin/src/components/dispatch/FlightMarker.tsx` — Leaflet marker by phase/type
- **Create:** `admin/src/components/dispatch/FloatingFlightCard.tsx` — Summary card on click
- **Create:** `admin/src/components/dispatch/FlightStrip.tsx` — Bottom scrollable chips
- **Create:** `admin/src/components/dispatch/FilterBar.tsx` — Top phase filters + search

### Admin Frontend — Details Page
- **Create:** `admin/src/pages/FlightDetailsPage.tsx` — Two-column flight details layout
- **Create:** `admin/src/components/dispatch/DispatchEditContext.tsx` — Editing state, auto-save, release workflow
- **Create:** `admin/src/components/dispatch/FlightHeader.tsx` — Airport pair, times, flight number
- **Create:** `admin/src/components/dispatch/AircraftSection.tsx` — Aircraft info, cruise, CI, runways, PAX
- **Create:** `admin/src/components/dispatch/WeightsSummary.tsx` — ZFW/TOW/LDW with margins
- **Create:** `admin/src/components/dispatch/FuelAccordion.tsx` — Full fuel table (editable)
- **Create:** `admin/src/components/dispatch/RouteAccordion.tsx` — Route + alternates (editable)
- **Create:** `admin/src/components/dispatch/CargoAccordion.tsx` — Cargo summary + ULD detail
- **Create:** `admin/src/components/dispatch/MelAccordion.tsx` — MEL restrictions (editable)
- **Create:** `admin/src/components/dispatch/RemarksAccordion.tsx` — Remarks (editable)
- **Create:** `admin/src/components/dispatch/RouteMapPanel.tsx` — Leaflet map for single flight route
- **Create:** `admin/src/components/dispatch/DetailTabPanel.tsx` — Tab container
- **Create:** `admin/src/components/dispatch/tabs/OfpTab.tsx` — OFP display
- **Create:** `admin/src/components/dispatch/tabs/WeatherTab.tsx` — METAR/TAF
- **Create:** `admin/src/components/dispatch/tabs/AcarsTab.tsx` — Messages (wraps existing AcarsChat)
- **Create:** `admin/src/components/dispatch/tabs/CargoDetailTab.tsx` — Full ULD table
- **Create:** `admin/src/components/dispatch/tabs/ExceedancesTab.tsx` — Exceedance events
- **Create:** `admin/src/components/dispatch/tabs/FlightLogTab.tsx` — Phase timeline + OOOI

### Admin Routing
- **Modify:** `admin/src/App.tsx` — Add `/dispatch/:bidId` route, replace DispatchBoardPage import

---

## Task 1: Expand Shared Types

**Files:**
- Modify: `shared/src/types/dispatch.ts`

- [ ] **Step 1: Add new fields to DispatchEditPayload**

In `shared/src/types/dispatch.ts`, add to the `DispatchEditPayload` interface:

```typescript
export interface DispatchEditPayload {
  // Existing fields
  route?: string;
  cruiseFL?: string;
  alternate1?: string;
  alternate2?: string;
  fuelPlanned?: string;
  fuelExtra?: string;
  fuelAlternate?: string;
  fuelReserve?: string;
  fuelTaxi?: string;
  fuelContingency?: string;
  fuelTotal?: string;
  fuelBurn?: string;
  melRestrictions?: string;
  dispatcherRemarks?: string;
  autoRemarks?: string;
  // New fields
  depTime?: string;
  depRunway?: string;
  arrRunway?: string;
  costIndex?: number;
  paxCount?: number;
}
```

- [ ] **Step 2: Build shared to verify**

Run: `npx tsc -p shared/`
Expected: Clean compilation

- [ ] **Step 3: Commit**

```bash
git add shared/src/types/dispatch.ts
git commit -m "feat(shared): expand DispatchEditPayload with new dispatcher fields"
```

---

## Task 2: Expand Backend Dispatch API

**Files:**
- Modify: `backend/src/routes/dispatch.ts`

- [ ] **Step 1: Expand the PATCH field whitelist**

In `backend/src/routes/dispatch.ts`, find the PATCH handler for `/flights/:bidId`. Add the new fields to the allowed field set and the SQL update logic. The current handler extracts fields from `req.body` and builds a dynamic `SET` clause. Add `depTime`, `depRunway`, `arrRunway`, `costIndex`, `paxCount` to the whitelist.

These new fields are stored in the `flight_plan_data` JSON column on `active_bids`. The PATCH handler needs to:
1. Read the current `flight_plan_data` JSON from the bid
2. Merge the new field values into it
3. Write the updated JSON back

Look at how existing fields like `route` and `cruiseFL` are handled — some update `flight_plan_data` JSON, others update top-level columns. Follow the same pattern for the new fields. Specifically:
- `depTime` → update `flight_plan_data.depDate` and/or `flight_plan_data.etd`
- `depRunway` → update `flight_plan_data.depRunway`
- `arrRunway` → update `flight_plan_data.arrRunway`
- `costIndex` → update `flight_plan_data.costIndex`
- `paxCount` → update `flight_plan_data.paxCount`

- [ ] **Step 2: Expand GET to include planning-phase flights**

In the `findActiveFlights` function (or the GET handler), modify the WHERE clause to include flights where `flight_plan_phase IN ('planning', 'active')` instead of only `'active'`. Also add a `phase` query parameter so the admin map page can filter:

```
GET /api/dispatch/flights?phase=all        → planning + active + completed
GET /api/dispatch/flights?phase=planning   → planning only
GET /api/dispatch/flights?phase=active     → active only (current behavior)
GET /api/dispatch/flights?phase=completed  → recently completed (last 24h from logbook)
```

Default behavior (no `phase` param): return planning + active (backwards compatible for pilot app).

For completed flights, query the `logbook` table joined with `scheduled_flights` and `users` to build a compatible `DispatchFlight` shape. Limit to last 24 hours.

- [ ] **Step 3: Add single-flight detail endpoint**

Add `GET /api/dispatch/flights/:bidId` that returns a single `DispatchFlight` with additional detail fields:

```typescript
// Response shape
{
  flight: DispatchFlight;
  cargo: CargoManifest | null;
  messages: AcarsMessagePayload[];
  exceedances: FlightExceedance[];
  track: TrackPoint[];
}
```

This avoids multiple round-trips when opening the details page. Requires admin or owner auth.

Query patterns:
- `active_bids` joined with schedule/airports/fleet/users for the flight data
- `cargo_manifests` WHERE `flight_id = :bidId`
- `acars_messages` WHERE `bid_id = :bidId` ORDER BY timestamp
- `flight_exceedances` WHERE `bid_id = :bidId`
- `flight_track` WHERE `bid_id = :bidId` ORDER BY recorded_at

- [ ] **Step 4: Verify backend compiles**

Run: `npm run build -w backend`
Expected: Clean compilation

- [ ] **Step 5: Test endpoints manually**

Start the dev server with `npm run dev:all`, then:
- `curl http://localhost:3001/api/dispatch/flights?phase=all` (with auth header) — should return planning + active + completed flights
- Verify the response includes flights in planning phase

- [ ] **Step 6: Commit**

```bash
git add backend/src/routes/dispatch.ts
git commit -m "feat(backend): expand dispatch API — new edit fields, planning phase, single-flight detail"
```

---

## Task 3: Add Cargo Editing Endpoint

**Files:**
- Modify: `backend/src/routes/cargo.ts`

- [ ] **Step 1: Add PATCH endpoint for dispatcher cargo editing**

Add `PATCH /api/cargo/:flightId` with admin auth. Accepts a partial cargo manifest update:

```typescript
// Request body
{
  ulds?: Array<{
    uld_id: string;
    position: string;
    weight: number;
    cargo_description: string;
    category_name?: string;
    temp_controlled?: boolean;
    temp_requirement?: string;
    hazmat?: boolean;
  }>;
  paxCount?: number;
}
```

Handler should:
1. Verify the bid exists and is in 'planning' phase
2. Read the existing `cargo_manifests` row for this flight
3. Update `ulds_json` column with the new ULD array
4. Recalculate `payload_kg` and `cg_position` from the updated ULDs
5. Update `notoc_required` based on whether any ULD has `hazmat: true`
6. Broadcast `dispatch:updated` via Socket.io

- [ ] **Step 2: Verify and commit**

Run: `npm run build -w backend`

```bash
git add backend/src/routes/cargo.ts
git commit -m "feat(backend): add dispatcher cargo editing endpoint"
```

---

## Task 4: Admin Routing Update

**Files:**
- Modify: `admin/src/App.tsx`

- [ ] **Step 1: Add FlightDetailsPage route and lazy import**

In `admin/src/App.tsx`:

1. Add lazy import at the top with the other page imports:
```typescript
const DispatchMapPage = lazy(() => import('@/pages/DispatchMapPage'));
const FlightDetailsPage = lazy(() => import('@/pages/FlightDetailsPage'));
```

2. Replace the existing dispatch route:
```typescript
// Replace:
<Route path="dispatch" element={<Suspense><DispatchBoardPage /></Suspense>} />

// With:
<Route path="dispatch" element={<Suspense><DispatchMapPage /></Suspense>} />
<Route path="dispatch/:bidId" element={<Suspense><FlightDetailsPage /></Suspense>} />
```

3. Remove the old `DispatchBoardPage` import.

- [ ] **Step 2: Commit**

```bash
git add admin/src/App.tsx
git commit -m "feat(admin): update routing for dispatch map + flight details pages"
```

---

## Task 5: DispatchEditContext

**Files:**
- Create: `admin/src/components/dispatch/DispatchEditContext.tsx`

- [ ] **Step 1: Port DispatchEditContext from frontend**

Port `frontend/src/contexts/DispatchEditContext.tsx` to the admin app. This provides:
- `canEdit`, `canEditFuel`, `canEditRoute`, `canEditMEL`, `canEditRemarks` permission flags
- `onFieldChange(key, value)` — marks field dirty, starts debounce timer
- `flush()` — sends `PATCH /api/dispatch/flights/:bidId` with dirty fields
- `releaseChanges()` — sends `POST /api/dispatch/flights/:bidId/release`
- `hasUnreleasedChanges` flag
- `saveStatus` — 'idle' | 'saving' | 'saved' | 'error'

Key differences from the frontend version:
- Admin always has `canEdit = true` (except when phase is 'completed')
- Add the new editable fields: `depTime`, `depRunway`, `arrRunway`, `costIndex`, `paxCount`
- Use `admin/src/lib/api` instead of `frontend/src/lib/api` for API calls

The context should accept props:
```typescript
interface DispatchEditProviderProps {
  bidId: number | null;
  phase: FlightPlanPhase;
  flightPlanData: FlightPlanFormData | null;
  releasedFields: string[] | null;
  children: ReactNode;
}
```

Expose via `useDispatchEdit()` hook.

- [ ] **Step 2: Verify it compiles**

Run: `npm run build -w admin`
Expected: Clean (may warn about unused export until consumed)

- [ ] **Step 3: Commit**

```bash
git add admin/src/components/dispatch/DispatchEditContext.tsx
git commit -m "feat(admin): add DispatchEditContext with auto-save and release workflow"
```

---

## Task 6: Dispatch Map Page — Core Layout

**Files:**
- Create: `admin/src/pages/DispatchMapPage.tsx`
- Create: `admin/src/components/dispatch/FilterBar.tsx`
- Create: `admin/src/components/dispatch/FlightStrip.tsx`

- [ ] **Step 1: Create FilterBar component**

`admin/src/components/dispatch/FilterBar.tsx`:

A horizontal bar overlaid at the top of the map. Props:
```typescript
interface FilterBarProps {
  phaseCounts: { flying: number; planning: number; completed: number };
  activeFilter: 'all' | 'flying' | 'planning' | 'completed';
  onFilterChange: (filter: 'all' | 'flying' | 'planning' | 'completed') => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
}
```

Renders:
- Three phase count badges (clickable to filter): green "N Flying", amber "N Planning", gray "N Completed"
- Each badge has a small colored dot, count, and label
- Clicking a badge toggles that filter (clicking active filter resets to 'all')
- Search input on the right with magnifying glass icon (MagnifyingGlass from Phosphor)

Styling: `position: absolute; top: 12px; left: 12px; right: 12px; z-index: 1000` — transparent dark background with border, matching admin design tokens (`bg-[var(--surface-1)]/90 border border-[var(--surface-3)]`).

- [ ] **Step 2: Create FlightStrip component**

`admin/src/components/dispatch/FlightStrip.tsx`:

A horizontal scrollable strip at the bottom of the map. Props:
```typescript
interface FlightStripProps {
  flights: DispatchMapFlight[];
  selectedBidId: number | null;
  onSelectFlight: (bidId: number) => void;
}
```

Where `DispatchMapFlight` is a union type combining heartbeat data and dispatch flight data:
```typescript
interface DispatchMapFlight {
  bidId: number;
  callsign: string;
  flightNumber: string;
  depIcao: string;
  arrIcao: string;
  aircraftType: string;
  phase: 'flying' | 'planning' | 'completed';
  // Only for flying flights:
  latitude?: number;
  longitude?: number;
  altitude?: number;
  groundSpeed?: number;
  heading?: number;
  // From DispatchFlight:
  pilot?: { callsign: string; name: string };
}
```

Each chip: phase color dot, callsign (bold monospace), route (DEP→ARR), altitude or phase label. Selected chip gets accent border. Ordered: flying first, then planning, then completed.

Styling: `position: absolute; bottom: 0; left: 0; right: 0; z-index: 1000` — horizontal scroll, dark background with top border.

- [ ] **Step 3: Create DispatchMapPage**

`admin/src/pages/DispatchMapPage.tsx`:

Default export. Full-screen page (no PageShell — the map IS the page).

State:
- `flights: DispatchMapFlight[]` — combined list
- `selectedBidId: number | null`
- `phaseFilter: 'all' | 'flying' | 'planning' | 'completed'`
- `searchQuery: string`

Data fetching:
- On mount, subscribe to `livemap:subscribe` for active flight heartbeats via Socket.io
- On mount, fetch `GET /api/dispatch/flights?phase=all` for all flights with plan data
- Poll the GET endpoint every 30 seconds for planning/completed updates
- Merge heartbeat data with API data into unified `DispatchMapFlight[]` list
- Apply phase filter and search query to produce visible flights

Layout:
```
<div className="relative h-full w-full">
  <MapContainer center={[30, 0]} zoom={3} className="h-full w-full" style={{ background: 'var(--surface-0)' }}>
    <TileLayer url="..." />  {/* dark map tiles */}
    {visibleFlights.map(f => <FlightMarker key={f.bidId} flight={f} ... />)}
  </MapContainer>
  <FilterBar ... />
  {selectedFlight && <FloatingFlightCard ... />}
  <FlightStrip ... />
</div>
```

Use the dark Carto tile layer matching existing admin maps: `https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png`

Socket.io setup: Connect on mount, disconnect on unmount. Use the same pattern as the existing `DispatchBoardPage.tsx` (lines 15–95) for socket initialization.

- [ ] **Step 4: Verify page loads**

Run: `npm run dev:all`
Navigate to `http://localhost:5174/admin/dispatch`
Expected: Full-screen dark map with filter bar and bottom strip. May be empty if no flights active.

- [ ] **Step 5: Commit**

```bash
git add admin/src/pages/DispatchMapPage.tsx admin/src/components/dispatch/FilterBar.tsx admin/src/components/dispatch/FlightStrip.tsx
git commit -m "feat(admin): dispatch map page with filter bar and flight strip"
```

---

## Task 7: Flight Markers + Floating Card

**Files:**
- Create: `admin/src/components/dispatch/FlightMarker.tsx`
- Create: `admin/src/components/dispatch/FloatingFlightCard.tsx`

- [ ] **Step 1: Create FlightMarker component**

`admin/src/components/dispatch/FlightMarker.tsx`:

A Leaflet marker for each flight on the map. Uses `react-leaflet` `Marker` component with custom `divIcon`.

Props:
```typescript
interface FlightMarkerProps {
  flight: DispatchMapFlight;
  isSelected: boolean;
  onClick: () => void;
}
```

Marker behavior by phase:
- **Flying**: Use aircraft SVG icon from `admin/src/lib/aircraft-icons.ts` (the `buildAircraftIconUri` function), rotated to heading. Green tint. Larger size (24px).
- **Planning**: Static circle marker at departure airport coordinates. Amber color. Smaller (10px).
- **Completed**: Static circle marker at arrival airport coordinates. Gray color. Smaller (10px). Slightly transparent.

Selected marker: brighter color, larger, blue border ring, higher z-index.

Use Leaflet's `divIcon` with inline SVG/CSS. Reference the existing `FlightMap.tsx` pattern (lines 50–90) for how markers are created.

Planning/completed flights need airport coordinates. These come from the `DispatchFlight` data (bid.depLat/depLon for planning, bid.arrLat/arrLon for completed). If coordinates are missing, skip the marker.

- [ ] **Step 2: Create FloatingFlightCard component**

`admin/src/components/dispatch/FloatingFlightCard.tsx`:

A card that appears near the selected flight marker on the map.

Props:
```typescript
interface FloatingFlightCardProps {
  flight: DispatchMapFlight;
  position: { x: number; y: number };  // pixel position on map
  onClose: () => void;
  onOpenDetails: () => void;
  onSendAcars: () => void;
}
```

Use Leaflet's `Popup` component (from react-leaflet) anchored to the flight's lat/lon, or a custom positioned div using the map's `latLngToContainerPoint`. Prefer `Popup` for simplicity — it auto-positions and follows the map.

Content:
- **Header row**: Callsign (bold, `--accent-blue-bright`), phase badge (colored pill)
- **Route row**: DEP → ARR (monospace), aircraft type
- **Telemetry row** (flying only): ALT, GS, HDG, ETA — 4 mini stat cells
- **Info row**: Pilot name, VATSIM status (green dot + "Connected" or gray "Offline")
- **Time row**: ETD, ETA, elapsed/remaining
- **Actions row** (border-top): "Open Details" button (accent blue, primary), "ACARS" button (surface-3, secondary)

"Open Details" calls `onOpenDetails` which triggers `navigate(\`/admin/dispatch/${flight.bidId}\`)`.

Styling: Dark surface-1 background, surface-3 border, rounded-lg, max-width 280px. Match the mockup from the brainstorming visual.

- [ ] **Step 3: Wire markers and card into DispatchMapPage**

In `DispatchMapPage.tsx`:
- Render `FlightMarker` for each visible flight
- On marker click: set `selectedBidId`, which causes `FloatingFlightCard` to render as a Leaflet Popup at that flight's coordinates
- On card close: clear `selectedBidId`
- On "Open Details": `navigate(\`/admin/dispatch/${flight.bidId}\`)`
- On "ACARS": for now, just navigate to details page with ACARS tab pre-selected (via URL param or state)

For flights without coordinates (planning flights at airports not in the airports table), skip rendering a marker.

- [ ] **Step 4: Verify markers and card**

Run: `npm run dev:all`
Navigate to dispatch map page.
- If there are active flights: should see green markers. Click one → floating card appears.
- Create a test flight plan in the Electron app to see a planning-phase amber marker.

- [ ] **Step 5: Commit**

```bash
git add admin/src/components/dispatch/FlightMarker.tsx admin/src/components/dispatch/FloatingFlightCard.tsx admin/src/pages/DispatchMapPage.tsx
git commit -m "feat(admin): flight markers and floating summary card on dispatch map"
```

---

## Task 8: Flight Details Page — Layout Shell

**Files:**
- Create: `admin/src/pages/FlightDetailsPage.tsx`

- [ ] **Step 1: Create the details page shell**

`admin/src/pages/FlightDetailsPage.tsx`:

Default export. Uses `useParams()` to get `bidId` from URL.

On mount:
1. Fetch `GET /api/dispatch/flights/:bidId` for full flight data (flight, cargo, messages, exceedances, track)
2. Subscribe to `dispatch:subscribe(bidId)` via Socket.io for live updates
3. Set up listeners for `dispatch:telemetry`, `track:point`, `acars:message`, `dispatch:exceedance`, `flight:phaseChange`, `flight:completed`

State:
```typescript
const [flight, setFlight] = useState<DispatchFlight | null>(null);
const [cargo, setCargo] = useState<CargoManifest | null>(null);
const [messages, setMessages] = useState<AcarsMessagePayload[]>([]);
const [exceedances, setExceedances] = useState<FlightExceedance[]>([]);
const [track, setTrack] = useState<TrackPoint[]>([]);
const [activeTab, setActiveTab] = useState<string>('ofp');
const [loading, setLoading] = useState(true);
```

Layout structure:
```tsx
<DispatchEditProvider bidId={bidId} phase={flight.phase} flightPlanData={flight.flightPlanData} releasedFields={flight.releasedFields}>
  <div className="flex flex-col h-full">
    {/* Top bar */}
    <div className="...top bar styles...">
      <Link to="/admin/dispatch">← Back to Map</Link>
      <span>{flight.callsign}</span>
      <span>{flight.depIcao} → {flight.arrIcao}</span>
      <PhaseBadge phase={flight.phase} />
      <span>Pilot: {flight.pilot.name}</span>
      <div className="ml-auto">
        <ReleaseButton />
        <AcarsButton />
      </div>
    </div>

    {/* Two-column layout */}
    <div className="flex flex-1 overflow-hidden">
      {/* Left: Flight Plan Details */}
      <div className="w-[42%] border-r border-[var(--surface-3)] overflow-y-auto p-3">
        <FlightHeader flight={flight} />
        <AircraftSection flight={flight} />
        <WeightsSummary flight={flight} />
        <FuelAccordion flight={flight} />
        <RouteAccordion flight={flight} />
        <CargoAccordion cargo={cargo} />
        <MelAccordion flight={flight} />
        <RemarksAccordion flight={flight} />
      </div>

      {/* Right: Map + Tabs */}
      <div className="flex-1 flex flex-col">
        <RouteMapPanel flight={flight} track={track} />
        <DetailTabPanel
          activeTab={activeTab}
          onTabChange={setActiveTab}
          flight={flight}
          cargo={cargo}
          messages={messages}
          exceedances={exceedances}
        />
      </div>
    </div>
  </div>
</DispatchEditProvider>
```

Handle loading state (spinner) and error state (flight not found).

On unmount: unsubscribe from dispatch room, disconnect socket listeners.

- [ ] **Step 2: Verify page loads with placeholder content**

All child components don't exist yet — use placeholder `<div>` elements for each section showing the component name. The page should render the two-column layout with top bar.

Run: `npm run dev:all`
Navigate to `http://localhost:5174/admin/dispatch/1` (use a real bid ID)
Expected: Two-column layout with top bar, placeholder sections

- [ ] **Step 3: Commit**

```bash
git add admin/src/pages/FlightDetailsPage.tsx
git commit -m "feat(admin): flight details page shell with two-column layout"
```

---

## Task 9: Left Column — Always-Visible Sections

**Files:**
- Create: `admin/src/components/dispatch/FlightHeader.tsx`
- Create: `admin/src/components/dispatch/AircraftSection.tsx`
- Create: `admin/src/components/dispatch/WeightsSummary.tsx`

- [ ] **Step 1: Create FlightHeader**

`admin/src/components/dispatch/FlightHeader.tsx`:

Props: `{ flight: DispatchFlight }`

Renders a card (`bg-[var(--surface-1)] border border-[var(--surface-3)] rounded-md`) containing:
- Row 1: Origin airport full name (left) | Destination airport full name (right) — `text-[9px] text-[var(--text-muted)]`
- Row 2: Origin ICAO (large monospace, 18px) | dashed line with flight number centered | Destination ICAO (large monospace)
- Row 3: ETD (left) | ETE (center, accent color) | ETA (right) — all monospace, 9px

ETD is editable by dispatcher (via `useDispatchEdit().onFieldChange('depTime', value)`). Render as an inline-editable field with a subtle input background when hovered.

Reference the pilot app's `FlightHeader` component for the visual pattern. Use `font-mono tabular-nums` on all time/ICAO values.

- [ ] **Step 2: Create AircraftSection**

`admin/src/components/dispatch/AircraftSection.tsx`:

Props: `{ flight: DispatchFlight }`

Renders a card with a 3×2 grid of labeled fields:
- Aircraft Type (read-only)
- Cruise FL (editable)
- Cost Index (editable — **new field**)
- Dep Runway (editable — **new field**)
- Arr Runway (editable — **new field**)
- PAX Count (editable — **new field**)

Editable fields use `useDispatchEdit()` context. Render as small inputs with `bg-[var(--surface-2)] border border-[var(--surface-3)] rounded px-1 py-0.5 font-mono text-[11px]`.

Label styling: `text-[8px] text-[var(--text-muted)] uppercase tracking-wider`

- [ ] **Step 3: Create WeightsSummary**

`admin/src/components/dispatch/WeightsSummary.tsx`:

Props: `{ flight: DispatchFlight }`

Renders a card with a 3-column centered grid:
- ZFW: estimated | max | (margin implied by color)
- TOW: estimated | max
- LDW: estimated | max

Values from `flight.flightPlanData` (estZfw, estTow, estLdw) and OFP (weights.maxZfw, maxTow, maxLdw).

Color coding:
- Green text: under max by >5%
- Amber text: within 5% of max
- Red text: over max

All values monospace with `tabular-nums`. Format as "130.2K" (divide by 1000, one decimal).

- [ ] **Step 4: Wire into FlightDetailsPage**

Replace the placeholder divs in FlightDetailsPage's left column with the real components.

- [ ] **Step 5: Verify and commit**

Run: `npm run dev:all`, navigate to a flight details page.
Expected: Flight header with ICAO codes and times, aircraft grid, weights summary.

```bash
git add admin/src/components/dispatch/FlightHeader.tsx admin/src/components/dispatch/AircraftSection.tsx admin/src/components/dispatch/WeightsSummary.tsx admin/src/pages/FlightDetailsPage.tsx
git commit -m "feat(admin): flight header, aircraft section, weights summary for details page"
```

---

## Task 10: Left Column — Accordion Sections

**Files:**
- Create: `admin/src/components/dispatch/FuelAccordion.tsx`
- Create: `admin/src/components/dispatch/RouteAccordion.tsx`
- Create: `admin/src/components/dispatch/CargoAccordion.tsx`
- Create: `admin/src/components/dispatch/MelAccordion.tsx`
- Create: `admin/src/components/dispatch/RemarksAccordion.tsx`

- [ ] **Step 1: Create a shared Accordion wrapper**

Each accordion section follows the same pattern. Create a small reusable wrapper either inline or as a helper:

```typescript
// Inline in each file, or extract to a tiny helper
function AccordionSection({ title, summary, status, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-[var(--surface-1)] border border-[var(--surface-3)] rounded-md mb-2">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between px-2.5 py-2">
        <div className="flex items-center gap-1.5">
          <span className={`w-1.5 h-1.5 rounded-full ${status === 'ok' ? 'bg-emerald-500' : status === 'warn' ? 'bg-amber-500' : 'bg-[var(--accent)]'}`} />
          <span className="text-[9px] text-[var(--text-muted)] uppercase tracking-wider">{title}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] text-[var(--text-secondary)]">{summary}</span>
          <CaretRight className={`w-3 h-3 text-[var(--text-muted)] transition-transform ${open ? 'rotate-90' : ''}`} weight="bold" />
        </div>
      </button>
      {open && <div className="px-2.5 pb-2.5 border-t border-[var(--surface-3)]">{children}</div>}
    </div>
  );
}
```

- [ ] **Step 2: Create FuelAccordion**

`admin/src/components/dispatch/FuelAccordion.tsx`:

Props: `{ flight: DispatchFlight }`

Summary: `"{totalFuel} lbs total · {burnFuel} burn"`
Status: `'ok'` (always, unless fuel data missing → neutral)

Expanded content: Fuel table with rows:
- **Trip/Burn**: editable via `useDispatchEdit()`
- **Contingency**: editable, shows "N% of burn" remark
- **Reserve**: editable, "FAA reserve" remark
- **Alternate**: editable
- **Extra**: editable, "Pilot discretionary" remark
- **Plan T/O**: computed (total - taxi), bold, read-only
- **Taxi**: editable
- **Plan Gate**: total fuel, bold, editable

Each row: label (130px) | fuel value (right-aligned, monospace) | remark (italic, muted).
Editable rows get input styling. Read-only rows get plain text.

Reference `frontend/src/components/flight-plan/FlightDetailSections.tsx` for the exact row structure.

- [ ] **Step 3: Create RouteAccordion**

`admin/src/components/dispatch/RouteAccordion.tsx`:

Props: `{ flight: DispatchFlight }`

Summary: `"{distanceNm} nm · {estEnroute}"`
Status: `'ok'` if route present, neutral if not

Expanded content:
- Context row: Origin ICAO → Destination ICAO | Distance | Est Enroute | Est Block (read-only)
- Route textarea: editable, monospace, full-width. Shows route string from `flightPlanData.route` or `ofpJson.route`
- Alternates: Two inline ICAO inputs (Alternate 1, Alternate 2) — editable

- [ ] **Step 4: Create CargoAccordion**

`admin/src/components/dispatch/CargoAccordion.tsx`:

Props: `{ cargo: CargoManifest | null }`

Summary: `"{N} ULDs · {weight} lbs · CG {cg}%"` or "No cargo loaded"
Status: `'ok'` if cargo loaded, `'warn'` if NOTOC required, neutral if empty

Expanded content:
- Manifest number (read-only)
- Total weight + payload utilization %
- CG position (% MAC)
- NOTOC indicator (amber if hazmat)
- ULD list: compact table showing ULD ID, position, weight, description for each ULD

For now, cargo display is read-only in the accordion. The Cargo Detail tab handles editing. This avoids duplicating the edit UI.

- [ ] **Step 5: Create MelAccordion**

`admin/src/components/dispatch/MelAccordion.tsx`:

Props: `{ flight: DispatchFlight }`

Summary: `"None"` (green) or `"{N} restrictions"` (amber)
Status: `'ok'` if no MEL, `'warn'` if MEL present

Expanded content:
- Editable textarea for MEL restrictions (one per line)
- Uses `useDispatchEdit().onFieldChange('melRestrictions', value)`

- [ ] **Step 6: Create RemarksAccordion**

`admin/src/components/dispatch/RemarksAccordion.tsx`:

Props: `{ flight: DispatchFlight }`

Summary: none (just the title)
Status: neutral (accent color dot)

Expanded content:
- Dispatcher Remarks: editable textarea
- Auto/Fuel Remarks: editable textarea
- Both use `useDispatchEdit()`

- [ ] **Step 7: Wire all accordions into FlightDetailsPage**

Replace remaining placeholder divs in left column.

- [ ] **Step 8: Verify and commit**

Run: `npm run dev:all`, navigate to a flight with plan data.
Expected: All accordion sections render with correct data. Expand/collapse works. Editable fields show input styling.

```bash
git add admin/src/components/dispatch/FuelAccordion.tsx admin/src/components/dispatch/RouteAccordion.tsx admin/src/components/dispatch/CargoAccordion.tsx admin/src/components/dispatch/MelAccordion.tsx admin/src/components/dispatch/RemarksAccordion.tsx admin/src/pages/FlightDetailsPage.tsx
git commit -m "feat(admin): accordion sections — fuel, route, cargo, MEL, remarks"
```

---

## Task 11: Right Column — Route Map Panel

**Files:**
- Create: `admin/src/components/dispatch/RouteMapPanel.tsx`

- [ ] **Step 1: Create RouteMapPanel**

`admin/src/components/dispatch/RouteMapPanel.tsx`:

Props:
```typescript
interface RouteMapPanelProps {
  flight: DispatchFlight;
  track: TrackPoint[];
  telemetry?: ActiveFlightHeartbeat | null;
}
```

A Leaflet map occupying the top 45% of the right column. Shows:
- **Route line**: Dashed polyline from origin to destination (via OFP waypoints if available, otherwise great circle). Accent blue color.
- **Airport markers**: Origin and destination as small circles with ICAO labels
- **Flight position**: If telemetry data present, show aircraft marker (green) at current position with heading rotation
- **Breadcrumb trail**: Polyline from track points (emerald, semi-transparent)
- **Telemetry overlay**: Fixed bar at the bottom of the map showing ALT, GS, HDG, VS (for airborne flights only)

Use dark Carto tiles. Auto-fit bounds to show the entire route on mount.

Reference the existing admin `FlightMap.tsx` component for Leaflet patterns in the admin app (tile layer, marker creation, trail polyline).

For OFP waypoints, parse `flight.ofpJson.steps` into `[lat, lon]` arrays for the route polyline.

- [ ] **Step 2: Wire into FlightDetailsPage**

Replace the placeholder in the right column top section with `RouteMapPanel`.

Pass live telemetry data: listen for `dispatch:telemetry` events in FlightDetailsPage and pass the latest heartbeat to RouteMapPanel.

- [ ] **Step 3: Verify and commit**

Run: `npm run dev:all`, navigate to a flight details page.
Expected: Map shows route line, airport markers. If flight is active, live position updates.

```bash
git add admin/src/components/dispatch/RouteMapPanel.tsx admin/src/pages/FlightDetailsPage.tsx
git commit -m "feat(admin): route map panel with live tracking for flight details page"
```

---

## Task 12: Right Column — Tab Panel + Tabs

**Files:**
- Create: `admin/src/components/dispatch/DetailTabPanel.tsx`
- Create: `admin/src/components/dispatch/tabs/OfpTab.tsx`
- Create: `admin/src/components/dispatch/tabs/WeatherTab.tsx`
- Create: `admin/src/components/dispatch/tabs/AcarsTab.tsx`
- Create: `admin/src/components/dispatch/tabs/CargoDetailTab.tsx`
- Create: `admin/src/components/dispatch/tabs/ExceedancesTab.tsx`
- Create: `admin/src/components/dispatch/tabs/FlightLogTab.tsx`

- [ ] **Step 1: Create DetailTabPanel container**

`admin/src/components/dispatch/DetailTabPanel.tsx`:

Props:
```typescript
interface DetailTabPanelProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  flight: DispatchFlight;
  cargo: CargoManifest | null;
  messages: AcarsMessagePayload[];
  exceedances: FlightExceedance[];
  bidId: number;
}
```

Renders:
- Tab bar: horizontal row of tab buttons. Active tab has accent underline (`border-b-2 border-[var(--accent)]`) and bright text. Inactive tabs are muted.
- Tab content area: renders the active tab's component

Tabs: `ofp`, `weather`, `acars`, `cargo`, `exceedances`, `log`

- [ ] **Step 2: Create OfpTab**

`admin/src/components/dispatch/tabs/OfpTab.tsx`:

Props: `{ flight: DispatchFlight }`

Displays the OFP text from `flight.ofpJson`. If `rawText` is available, show it as monospace preformatted text. Otherwise, construct a summary from the OFP fields:

```
OPERATIONAL FLIGHT PLAN — {callsign}
{origin}/{depRwy} {destination}/{arrRwy} CR FL{cruiseAlt} CI{costIndex}
RTE: {route}
FUEL: TRIP {burn} CONT {contingency} ALTN {alternate} RSV {reserve} TAXI {taxi} XTR {extra} TOT {total}
WGT: ZFW {zfw} TOW {tow} LDW {ldw}
ALT1: {alt1Icao} ({distance}nm, {fuel}lbs)
```

Styled: monospace, surface-1 card, 10px font, `--text-secondary` color. OFP header in accent blue.

- [ ] **Step 3: Create WeatherTab**

`admin/src/components/dispatch/tabs/WeatherTab.tsx`:

Props: `{ flight: DispatchFlight }`

On mount, fetch weather data for origin, destination, and alternates:
- `GET /api/weather/metar?ids={icao}`
- `GET /api/weather/taf?ids={icao}`

Display in sections:
- Origin: METAR + TAF
- Destination: METAR + TAF
- Alternate 1 (if set): METAR
- Alternate 2 (if set): METAR

Each weather block: airport ICAO label, monospace weather text, timestamp. "No data" if fetch fails.

- [ ] **Step 4: Create AcarsTab (wrap existing)**

`admin/src/components/dispatch/tabs/AcarsTab.tsx`:

Props: `{ bidId: number; messages: AcarsMessagePayload[] }`

Wraps the existing `admin/src/components/dispatch/AcarsChat.tsx` component. Pass through `bidId` and `messages`. The existing AcarsChat already handles message display and send functionality.

The parent (FlightDetailsPage) handles appending new messages from the `acars:message` WebSocket event to the messages array.

- [ ] **Step 5: Create CargoDetailTab**

`admin/src/components/dispatch/tabs/CargoDetailTab.tsx`:

Props: `{ cargo: CargoManifest | null; bidId: number }`

If no cargo: empty state message ("No cargo manifest loaded").

If cargo present:
- Summary row: manifest number, total weight, payload utilization %, CG position
- ULD table with columns: ULD ID, Position, Weight (lbs), Description, Category, Temp Control, Hazmat
- Hazmat rows highlighted with amber background
- NOTOC section at the bottom if `notocRequired` is true, listing NOTOC items

This is read-only display. Dispatcher editing of cargo will be a future enhancement via the PATCH endpoint (Task 3).

- [ ] **Step 6: Create ExceedancesTab**

`admin/src/components/dispatch/tabs/ExceedancesTab.tsx`:

Props: `{ exceedances: FlightExceedance[] }`

If empty: "No exceedances recorded" message.

If present: list of exceedance cards, each showing:
- Type badge (hard_landing, overspeed, overweight) with severity color
- Value vs threshold (e.g., "-450 fpm vs -300 fpm limit")
- Flight phase when detected
- Timestamp

Severity colors: warning (amber), critical (red).

New exceedances from WebSocket appear at the top of the list.

- [ ] **Step 7: Create FlightLogTab**

`admin/src/components/dispatch/tabs/FlightLogTab.tsx`:

Props: `{ flight: DispatchFlight; track: TrackPoint[] }`

Displays a chronological timeline of flight events:
- Phase transitions with timestamps (derived from track data phase changes)
- OOOI times if available: Out (pushback), Off (takeoff), On (landing), In (gate arrival)
- Landing rate (from the last track point's vertical speed at touchdown, if available)
- Total fuel burn (from flight plan data)

If flight is in planning phase: "Flight has not departed yet" message.

Simple vertical timeline layout with dots and lines connecting events.

- [ ] **Step 8: Wire all tabs into DetailTabPanel and FlightDetailsPage**

Replace placeholder tab content with real components. Wire the `activeTab` state.

- [ ] **Step 9: Verify all tabs**

Run: `npm run dev:all`, navigate to a flight details page.
Test each tab: OFP shows flight plan text, Weather fetches METAR/TAF, ACARS shows messages, Cargo shows manifest, Exceedances list (if any), Flight Log shows timeline.

- [ ] **Step 10: Commit**

```bash
git add admin/src/components/dispatch/DetailTabPanel.tsx admin/src/components/dispatch/tabs/
git commit -m "feat(admin): detail tab panel — OFP, weather, ACARS, cargo, exceedances, flight log"
```

---

## Task 13: Clean Up + Polish

**Files:**
- Delete: `admin/src/pages/DispatchBoardPage.tsx` (replaced by DispatchMapPage)
- Modify: `admin/src/pages/DispatchMapPage.tsx` (polish)
- Modify: `admin/src/pages/FlightDetailsPage.tsx` (polish)

- [ ] **Step 1: Delete old DispatchBoardPage**

Remove `admin/src/pages/DispatchBoardPage.tsx`. The old dispatch components (`FlightListPanel.tsx`, old `FlightDetailPanel.tsx`, old `FlightMap.tsx`) can remain for now — they're not imported anywhere after the routing change.

- [ ] **Step 2: Polish map page interactions**

- Clicking a flight in the bottom strip should pan/zoom the map to that flight's position and open the floating card
- Clicking the map background should close the floating card
- Phase filter badges should visually indicate which filter is active (brighter background/border)
- Search should filter the bottom strip as well as the map markers
- Route line should draw from departure to arrival for the selected flight

- [ ] **Step 3: Polish details page**

- Release button: disabled state when no changes, loading spinner when releasing
- Save status indicator: "Saving..." → "Saved" near the release button
- Released field highlighting: amber left border on fields the dispatcher has changed but not yet released
- Smooth accordion open/close transitions
- Active tab indicator styling matches admin design tokens

- [ ] **Step 4: Verify complete flow**

Full end-to-end test:
1. Open admin dispatch page → see map with flights
2. Click a flight marker → floating card appears
3. Click "Open Details" → navigates to flight details page
4. See flight header, aircraft info, weights, accordion sections
5. Expand fuel accordion → edit a fuel field → see "Saving..." then "Saved"
6. Click "Release Changes" → confirm changes released
7. Check ACARS tab → send a message
8. Click "← Back to Map" → returns to map page

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(admin): dispatch redesign polish — interactions, transitions, cleanup"
```

---

## Task Summary

| Task | Description | Depends On |
|------|-------------|------------|
| 1 | Expand shared types | — |
| 2 | Expand backend dispatch API | Task 1 |
| 3 | Add cargo editing endpoint | Task 1 |
| 4 | Admin routing update | — |
| 5 | DispatchEditContext | Task 1 |
| 6 | Dispatch map page core | Task 2, 4 |
| 7 | Flight markers + floating card | Task 6 |
| 8 | Flight details page shell | Task 2, 4, 5 |
| 9 | Left column — visible sections | Task 8 |
| 10 | Left column — accordions | Task 8, 5 |
| 11 | Right column — route map | Task 8 |
| 12 | Right column — tabs | Task 8 |
| 13 | Clean up + polish | All above |

**Parallelizable groups:**
- Tasks 1, 4 can run in parallel (no deps)
- Tasks 2, 3, 5 can run in parallel after Task 1
- Tasks 6, 8 can run in parallel after Tasks 2, 4
- Tasks 9, 10, 11, 12 can all run in parallel after Task 8
- Task 13 is the final sequential step
