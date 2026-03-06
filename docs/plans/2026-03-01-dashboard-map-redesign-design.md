# Admin Dashboard Map Redesign — Design Doc

**Date**: 2026-03-01
**Status**: Approved

## Summary

Redesign the admin dashboard page to use a full-viewport live map as the background with consolidated dashboard widgets overlaying it. Reduces 8 separate components (4 stat cards + 4 widgets) down to 4 dense panels that each combine a key stat with its related detail view.

## Architecture

### Layout

DashboardLayout conditionally removes its `p-6` padding and `overflow-y-auto` scroll wrapper when rendering the dashboard route (`/`). All other pages remain unchanged.

DashboardPage renders two layers:
1. **Map layer** (z-index 0): Full-viewport Leaflet map with CartoDB dark tiles and live flight markers
2. **Widget overlay** (z-index 10): Scrollable absolute overlay with `pointer-events-none` container, `pointer-events-auto` on each panel

### Map Layer — DashboardMap component

- Tile layer: CartoDB dark_all (`https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png`)
- Center: `[30, -10]`, zoom 3 (Atlantic world view)
- No zoom controls or attribution (clean background)
- Live flight markers from `flights:active` Socket.io event via `livemap:subscribe`
- Aircraft markers: blue SVG plane icons (28px), rotated by heading, same pattern as dispatch FlightMap.tsx
- Clicking a flight marker navigates to `/dispatch`
- Socket lifecycle: connect on mount, subscribe, disconnect on unmount

### Widget Panels (4 consolidated)

All panels use `bg-[#1c2033]/90` (90% opacity, no blur), `rounded-md`, inner shadow. Each follows a header-stat + content pattern.

#### OperationsPanel
- **Header**: "Operations" title + Active Flights count badge + Pending PIREPs count badge
- **Content**: Recent flights table (flight #, route DEP→ARR, pilot callsign, landing rate, status badge)
- **Data**: `activeFlights`, `pendingPireps`, `recentFlights` from DashboardData

#### FinancePanel
- **Header**: "Finance" title + Monthly Revenue formatted badge ($42.1k)
- **Content**: 6-month area chart (income blue, costs red, profit green) using Recharts
- **Data**: `monthlyRevenue`, `financialSummary` from DashboardData

#### FleetPanel
- **Header**: "Fleet" title + Fleet Health % badge
- **Content**: Maintenance alerts list (severity border, aircraft reg + type, description)
- **Data**: `fleetHealthPct`, `maintenanceAlerts` from DashboardData

#### PilotsPanel
- **Header**: "Pilots" title
- **Content**: Horizontal bar chart of top 10 pilots by hours this month using Recharts
- **Data**: `pilotActivity` from DashboardData

### Widget Grid Layout

```
Row 1: OperationsPanel (2/3 width) + FinancePanel (1/3 width)
Row 2: FleetPanel (1/2 width) + PilotsPanel (1/2 width)
```

Responsive: stacks to single column on small viewports.

### Data Flow

- **Dashboard REST**: `GET /api/admin/dashboard` on mount (same endpoint, no backend changes)
- **Live flights**: Socket.io `livemap:subscribe` / `livemap:unsubscribe`, listen for `flights:active`
- **Socket init**: Reuse admin's `useSocketStore.connect(token)` — initialize on DashboardPage mount

### Pointer Events

- Overlay container: `pointer-events-none` (map interactions pass through)
- Each panel: `pointer-events-auto` (panels are interactive)
- Map remains pannable/zoomable in gaps between panels

## Files

| File | Action |
|------|--------|
| `admin/src/components/layout/DashboardLayout.tsx` | Modify — conditional no-padding for dashboard route |
| `admin/src/pages/DashboardPage.tsx` | Rewrite — map background + 4 overlay panels |
| `admin/src/components/dashboard/DashboardMap.tsx` | Create — Leaflet map with live flight markers |
| `admin/src/components/dashboard/OperationsPanel.tsx` | Create — active flights + PIREPs + recent flights |
| `admin/src/components/dashboard/FinancePanel.tsx` | Create — revenue stat + area chart |
| `admin/src/components/dashboard/FleetPanel.tsx` | Create — fleet health + maintenance alerts |
| `admin/src/components/dashboard/PilotsPanel.tsx` | Create — pilot activity bar chart |

Old widget files (`StatCard.tsx`, `RecentFlightsWidget.tsx`, `FinancialOverviewWidget.tsx`, `MaintenanceAlertsWidget.tsx`, `PilotActivityWidget.tsx`) become unused by the dashboard. They can be removed if not used elsewhere.

## Design System Compliance

- Accent blue `#3b82f6` for markers, chart elements, badges
- Panel backgrounds: `#1c2033` at 90% opacity (relaxed for map overlay, no blur)
- `rounded-md`, inner shadow on panels
- `IBM Plex Mono` (`font-mono`) for data values
- No glassmorphism, no `backdrop-blur`, no `rounded-xl`, no purple
- Phosphor icons for panel header icons

## No Backend Changes

The existing `/api/admin/dashboard` endpoint and `flights:active` Socket.io event provide all needed data. No new API endpoints or migrations required.
