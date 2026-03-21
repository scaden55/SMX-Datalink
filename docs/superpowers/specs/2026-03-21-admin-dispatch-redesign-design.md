# Admin Dispatch Page Redesign

**Date:** 2026-03-21
**Status:** Design approved

## Problem

The current admin dispatch board (`admin/src/pages/DispatchBoardPage.tsx`) is limited. It shows live flight positions on a map, a flight list with basic telemetry (altitude, speed, phase), and ACARS chat — but cannot display or edit the actual flight plan, route, cargo manifest, fuel breakdown, weight/balance, or OFP details. All this data exists in the backend but the admin UI never surfaces it.

Additionally, the dispatch board only shows **actively flying** flights (those sending heartbeat data). Flights in the planning phase — where a pilot has filed a plan on the Electron app but hasn't departed — are invisible.

The current dispatch board's functionality overlaps almost entirely with the dashboard page's world map and active flights display, making it redundant.

## Goals

- Transform the admin dispatch page into a **full flight operations center**
- Show flights across the **full lifecycle**: planning, active, and recently completed
- Provide full visibility into every aspect of a flight: OFP, route, weight/balance, cargo manifest, fuel, weather, ACARS
- Enable dispatchers to **review and edit** flight plans with an expanded field set
- Deliver **live telemetry updates** for airborne flights
- Maintain the **release/acknowledge workflow** for dispatcher-pilot collaboration

## Design

### Two-Page Architecture

The dispatch system consists of two pages:

1. **Dispatch Map** (`/admin/dispatch`) — Full-screen map operations center
2. **Flight Details** (`/admin/dispatch/:bidId`) — Dedicated flight details and editing page

Clicking "Open Details" on a flight navigates from the map to the details page. A "Back to Map" link returns to the map.

---

### Page 1: Dispatch Map

A full-screen Leaflet map serving as the primary spatial awareness tool.

#### Flight Markers

Flights are rendered as markers on the map, color-coded by phase:
- **Green** — Actively flying (receiving heartbeat/telemetry data)
- **Amber** — Planning phase (flight plan filed, not yet departed)
- **Gray** — Recently completed

Planning-phase flights are positioned at their departure airport. Completed flights at their arrival airport.

For actively flying flights, the marker uses the aircraft type-specific SVG icon (already exists in `admin/src/lib/aircraft-icons.ts`) rotated to heading. Planning and completed flights use a static dot marker.

#### Top Filter Bar

Overlay at the top of the map containing:
- **Phase count badges**: "3 Flying", "2 Planning", "1 Completed" — each clickable to filter the map to that phase
- **Search input**: Filter flights by callsign, flight number, route, pilot name, or aircraft type

#### Floating Summary Card

When a flight marker is clicked on the map, a floating card appears anchored near the marker:

**Content:**
- **Flight identity**: Callsign (bold), flight number, route (DEP → ARR), aircraft type
- **Phase & status**: Current flight phase badge, VATSIM connection indicator
- **Live telemetry** (airborne flights only): Altitude, ground speed, heading, ETA
- **Time info**: ETD, ETA, elapsed/remaining time
- **Pilot**: Name and callsign
- **Quick actions**:
  - "Open Details" — navigates to `/admin/dispatch/:bidId`
  - "ACARS" — opens a quick-send ACARS message input (inline on the card or a small popover)

Only one floating card is visible at a time. Clicking another flight replaces it. Clicking the map background or the close button dismisses it.

#### Bottom Flight Strip

A horizontal scrollable strip at the bottom of the map showing all flights as compact chips:
- Each chip shows: phase color dot, callsign, route, current altitude or "Planning"/"Completed"
- Selected flight chip has a highlighted border
- Clicking a chip selects that flight on the map (pans/zooms to it) and opens the floating card
- Chips are ordered: flying first, then planning, then completed

#### Data Source

- **Flying flights**: `livemap:subscribe` WebSocket → `flights:active` events (ActiveFlightHeartbeat[])
- **Planning/completed flights**: Polled from `GET /api/dispatch/flights` — this endpoint returns all flights with flight plan data, filtered by phase
- Combined into a single unified flight list with a `source` discriminator

The map auto-refreshes planning/completed flights on a 30-second interval. Flying flights update in real-time via WebSocket.

---

### Page 2: Flight Details

A dedicated page for viewing and editing a single flight's complete data.

#### Top Bar

Fixed bar across the top:
- **Left**: "← Back to Map" link
- **Center**: Flight identity — callsign (large, bold), route (DEP → ARR), phase badge, aircraft type, pilot name
- **Right**: Action buttons:
  - "Release Changes" (blue, enabled when dispatcher has unsaved edits) — triggers the release/acknowledge workflow
  - "Send ACARS" — opens ACARS message compose

Save status indicator ("Saving..." / "Saved") appears near the release button.

#### Two-Column Layout

**Left Column (42% width) — Flight Plan Details**

A scrollable column containing the flight plan data in collapsible accordion sections, mirroring the pilot dispatch page's FlightPlanPanel structure.

**Always-visible sections (not collapsible):**

1. **Flight Header**
   - Origin and destination airport names (full names, small text)
   - ICAO codes (large monospace)
   - Flight number centered on a dashed line between airports
   - ETD, ETA, ETE
   - Departure time is **editable** by dispatcher

2. **Aircraft & Procedures**
   - Aircraft type (read-only)
   - Tail number (read-only)
   - Cruise FL (editable)
   - Cost Index (editable — **new**)
   - Departure runway (editable — **new**)
   - Arrival runway (editable — **new**)
   - PAX count (editable — **new**)

3. **Weights Summary**
   - ZFW, TOW, LDW — each with estimated and max values
   - Margin indicators (green if under max, amber if close, red if over)

**Collapsible accordion sections:**

Each section has a header row with: status indicator (green dot if data present, amber if warnings), section title, summary text, and expand/collapse chevron.

4. **Fuel**
   - Full fuel table matching pilot dispatch page: Trip/Burn, Contingency, Reserve, Alternate, Extra, Plan T/O, Taxi, Plan Gate
   - All fuel fields editable by dispatcher (when phase is 'planning')
   - Shows time column and remarks column

5. **Route**
   - Route string (editable textarea)
   - Alternates 1 & 2 (editable ICAO inputs)
   - Distance and estimated enroute/block times (read-only)

6. **Cargo**
   - Cargo manifest summary: ULD count, total weight, payload utilization %, CG position
   - NOTOC indicator if hazmat present
   - Cargo is **editable** by dispatcher — **new**: dispatcher can modify cargo manifest
   - Expanding shows ULD-level detail

7. **MEL & Restrictions**
   - Editable textarea (one restriction per line)
   - Status: green "None" or amber with count

8. **Remarks**
   - Dispatcher remarks (editable textarea)
   - Auto/fuel remarks (editable textarea)
   - System-generated info (read-only)

**Right Column (58% width) — Map + Tabbed Panels**

Split vertically:

**Top (45%): Route Map**
- Leaflet map showing the flight's route (waypoints from OFP), departure/arrival airports, alternate airports
- Live aircraft position marker with breadcrumb trail (for airborne flights)
- Telemetry overlay at the bottom of the map: ALT, GS, HDG, VS (for airborne flights)
- For planning-phase flights, shows the planned route without a position marker

**Bottom (55%): Tabbed Panels**

Tab bar with the following tabs:

1. **OFP** — Operational Flight Plan text (monospace, read-only). Shows the SimBrief-generated OFP summary with route, fuel, weights, alternates, and step climb profile.

2. **Weather** — METAR/TAF for origin, destination, and alternates. Fetched via existing weather proxy endpoints.

3. **ACARS** — Real-time message thread between dispatcher and pilot. Full message history with send capability. Message types: DSP (blue), PLT (green), SYS (amber). Uses existing `dispatch:subscribe` WebSocket room.

4. **Cargo Detail** — Full ULD breakdown table: ULD ID, position, weight, cargo description, category, temperature control, hazmat flags. NOTOC items listed separately if present.

5. **Exceedances** — Flight exceedance events (hard landings, overspeeds, overweight). Severity-colored. Real-time via `dispatch:exceedance` WebSocket event.

6. **Flight Log** — Chronological flight events: phase transitions with timestamps, OOOI times (Out, Off, On, In), landing rate, total fuel burn. Populated from `flight_track` and phase change events.

---

### Dispatcher Editing Scope

**Existing editable fields** (already supported by `PATCH /api/dispatch/flights/:bidId`):
- route, cruiseFL, alternate1, alternate2
- fuelPlanned, fuelExtra, fuelAlternate, fuelReserve, fuelTaxi, fuelContingency, fuelTotal, fuelBurn
- melRestrictions, dispatcherRemarks, autoRemarks

**New editable fields** (require backend PATCH expansion):
- depTime (departure time)
- depRunway, arrRunway
- costIndex
- paxCount
- Cargo manifest (requires new endpoint or expansion of existing cargo API)

**Editing rules:**
- Fuel fields: editable only when phase is `'planning'`
- Route/alternates/MEL/remarks: editable when phase is not `'completed'`
- New fields (departure time, runways, cost index, PAX): editable when phase is not `'completed'`
- Cargo: editable when phase is `'planning'`

**Release workflow:** Same as existing — dispatcher edits auto-save via debounced PATCH, then clicks "Release Changes" to push `dispatch:released` to the pilot. Changed fields are highlighted amber on the pilot's dispatch view until acknowledged.

---

### Real-Time Updates

The flight details page subscribes to the selected flight's dispatch room (`dispatch:subscribe(bidId)`) and listens for:

- `dispatch:telemetry` — Live position/altitude/speed updates (map marker + telemetry overlay)
- `track:point` — Breadcrumb trail points (map polyline)
- `acars:message` — New ACARS messages (Messages tab)
- `dispatch:exceedance` — Exceedance events (Exceedances tab)
- `flight:phaseChange` — Phase transitions (Flight Log tab + phase badge)
- `flight:completed` — Flight ended (update phase, show completion state)

The dispatch map page subscribes to `livemap:subscribe` for all active flights, and polls `/api/dispatch/flights` every 30 seconds for planning/completed flights.

---

### Backend Changes Required

1. **Expand `GET /api/dispatch/flights`** to return flights in all phases (planning, active, completed) — currently it only returns flights with `flight_plan_phase = 'active'` or those with active heartbeats. Need to include `'planning'` and recently completed (e.g., last 24 hours).

2. **Expand `PATCH /api/dispatch/flights/:bidId`** payload to accept new fields:
   - `depTime` (string, ISO timestamp)
   - `depRunway` (string)
   - `arrRunway` (string)
   - `costIndex` (number)
   - `paxCount` (number)

3. **Cargo editing endpoint** — either expand the existing `PATCH` to accept cargo changes, or add a new `PATCH /api/dispatch/flights/:bidId/cargo` endpoint that allows the dispatcher to modify the cargo manifest.

4. **Flight details endpoint** — Consider adding `GET /api/dispatch/flights/:bidId` for fetching a single flight's full data (including OFP, cargo manifest, flight track, exceedances, messages) in one request, to avoid multiple round-trips when opening the details page.

---

### Admin Routing

Add a new route to the admin React Router:

```
/admin/dispatch          → DispatchMapPage (map overview)
/admin/dispatch/:bidId   → FlightDetailsPage (single flight)
```

The current `DispatchBoardPage.tsx` will be replaced entirely.

---

### Component Structure

```
admin/src/pages/
  DispatchMapPage.tsx              — Map overview (replaces DispatchBoardPage)
  FlightDetailsPage.tsx            — Single flight details

admin/src/components/dispatch/
  FlightMap.tsx                    — Rewritten: full-screen Leaflet map with markers
  FlightMarker.tsx                 — Map marker component (color by phase, icon by type)
  FloatingFlightCard.tsx           — Summary card on marker click
  FlightStrip.tsx                  — Bottom scrollable flight chips
  FilterBar.tsx                    — Top phase filters + search

  FlightHeader.tsx                 — Airport pair, times, flight number
  AircraftSection.tsx              — Aircraft, cruise, CI, runways, PAX
  WeightsSummary.tsx               — ZFW/TOW/LDW with margins
  FuelAccordion.tsx                — Full fuel table (editable)
  RouteAccordion.tsx               — Route string + alternates (editable)
  CargoAccordion.tsx               — Cargo summary + ULD detail (editable)
  MelAccordion.tsx                 — MEL restrictions (editable)
  RemarksAccordion.tsx             — Dispatcher + auto remarks (editable)

  RouteMapPanel.tsx                — Small Leaflet map for flight route + live position
  TabPanel.tsx                     — Tab container for right column
  OfpTab.tsx                       — OFP display
  WeatherTab.tsx                   — METAR/TAF display
  AcarsTab.tsx                     — Message thread + send (reuse existing AcarsChat)
  CargoDetailTab.tsx               — Full ULD table
  ExceedancesTab.tsx               — Exceedance events list
  FlightLogTab.tsx                 — Phase timeline + OOOI times

  DispatchEditContext.tsx           — Editing state, auto-save, release workflow (port from frontend)
```

---

### State Management

**DispatchMapPage state:**
- `flights: DispatchMapFlight[]` — combined list from WebSocket heartbeats + API poll
- `selectedFlightId: number | null` — currently selected flight (floating card open)
- `phaseFilter: 'all' | 'flying' | 'planning' | 'completed'`
- `searchQuery: string`

**FlightDetailsPage state:**
- Flight data fetched via `GET /api/dispatch/flights/:bidId` (or from the list if navigating from map)
- Cargo manifest fetched via `GET /api/cargo/:bidId`
- DispatchEditContext manages all editable field state + auto-save
- WebSocket subscription for live updates

No new Zustand stores needed — page-level state with context for editing is sufficient, matching the pilot app's pattern.
