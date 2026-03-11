# Admin Dashboard Redesign — Design Spec

**Date:** 2026-03-11
**Status:** Approved

## Overview

Redesign the admin dashboard as a map-centric command center with symmetric finance (left) and maintenance (right) columns. No card backgrounds — all data sits seamlessly on the dark surface. A dynamic flight strip overlays the bottom of the map.

## Layout

```
┌─────────────────────────────────────────────────┐
│  TopBar                                         │
├──────────┬──────────────────────┬───────────────┤
│ Finance  │                      │ Maintenance   │
│  220px   │     World Map        │    220px      │
│          │                      │               │
│          │                      │               │
│          │  ┌────────────────┐  │               │
│          │  │  Flight Strip  │  │               │
│          │  │  (overlay)     │  │               │
│          │  └────────────────┘  │               │
└──────────┴──────────────────────┴───────────────┘
```

- CSS Grid: `grid-template-columns: 220px 1fr 220px`
- Full viewport height minus TopBar
- Gap: 8px between columns
- Background: `--surface-1` (`#050505`) — DashboardPage sets this on its root container, overriding the layout default

## Left Column — Finance

All widgets stack vertically with 10px gap. No card backgrounds. Thin `rgba(255,255,255, 0.04)` dividers between logical sections.

### 1. Header
- "Airline Performance" — 14px, weight 600, `#f0f0f0`
- Date below — 9px, `#3a3a3a`

### 2. Balance
- Area chart: 36px tall, emerald gradient fill
- Label "Balance" — 8px, `#4a4a4a`
- Value — 17px `font-mono` (Lufga), weight 600, `#f0f0f0` (e.g. `$4,830,218`)
- Income (emerald) / Expenses (red) — 10px `font-mono`

### 3. RATM + CATM (side by side)
Two flex children, each with:
- 6-bar trend chart (24px tall), oldest→newest left→right — data from monthly RATM/CATM breakdown (new field in financial-kpis response)
- RATM bars: emerald (`#4ade80`), latest bar 70% opacity, others 25%
- CATM bars: blue (`#3b5bdb`), same opacity pattern
- Label — 8px, `#4a4a4a`
- Value — 15px `font-mono`, weight 600 (RATM in emerald, CATM in `#f0f0f0`)
- Unit "/ton-mi" — 7px, `#3a3a3a`

### 4. Spread
- Label "Spread" — 8px, `#4a4a4a`
- Value: `+$X.XX` in emerald, 13px `font-mono` weight 600
- Suffix: `/tm · XX.X%` in `#3a3a3a`, 8px

### 5. Key Metrics Grid
- 3×2 grid, gap `6px 8px`
- Labels — 7px, `#3a3a3a`
- Values — 12px `font-mono`, weight 500, `#f0f0f0`
- Metrics: RTM, Fleet LF, Flights, Fuel/BH, Crew/BH, Fuel Surcharge Recovery (percentage format)

### 6. Route Margins
- Section label "Route Margins" — 7px uppercase, `#3a3a3a`, letter-spacing 0.5px
- Rows: route pair (left, `#7a7a7a`) + margin % (right, emerald if positive, red if negative)
- 9px `font-mono`, 2px gap between rows
- Show top 2 most profitable + bottom 2 least profitable routes (ensures a mix of best and worst)

### 7. Yield Trend
- Label "Yield Trend" — 7px uppercase, `#3a3a3a`
- SVG polyline sparkline, blue (`#3b5bdb`), 1.5px stroke, 18px tall
- X-axis labels: start month + end month, 7px `#3a3a3a`

## Center — World Map

- React Simple Maps with Equal Earth projection
- Land: `#0d0d0d`, stroke `#1a1a1a`, graticule `rgba(255,255,255, 0.03)`
- ZoomableGroup, zoom range 1–8
- Hub markers: blue dots (`#3b5bdb`) with glow
- Live flight markers: phase-colored dots with glow
- Map fills entire center column

## Bottom Flight Strip (map overlay)

Overlays the bottom of the center map area.

### Layout
- Gradient fade: 24px `linear-gradient(to bottom, transparent, rgba(5,5,5,0.9))`
- Content area: `background: rgba(5,5,5,0.92)`, padding `8px 12px 10px`
- 3-column grid separated by thin vertical `rgba(255,255,255, 0.04)` dividers

### Dynamic Visibility Rules

The flight strip adapts based on available data:

1. **All three populated** — show Live | Scheduled | Completed in 3 equal columns
2. **No live flights** — show only Scheduled | Completed in 2 columns, hide Live
3. **No live + no scheduled** — show only Completed in single column
4. **No data at all** — show a minimal splash: centered text "No flight activity" with muted icon, same overlay style

The strip itself is hidden entirely if there is zero data across all three categories (alternative: show the "no flight activity" splash briefly then fade out — implementation can decide).

### Column: Live Flights
- Header: pulsing emerald dot + "LIVE" label (7px uppercase, `#4a4a4a`)
- Rows: phase-colored dot (3px) + callsign (`#f0f0f0`) + route (`#4a4a4a`) + FL/speed (right-aligned, `#4a4a4a` 7px)
- Phase colors: Cruise = emerald, Climb/Descent = amber, Approach = cyan, Takeoff = blue, Ground = `#7a7a7a`

### Column: Scheduled (Active Bids)
- Header: "SCHEDULED" + bid count right-aligned (`#3a3a3a`)
- Rows: flight number (`#7a7a7a`) + route dep→arr (`#4a4a4a`) + departure time Zulu (right-aligned, `#3a3a3a`)
- Data path: `active_bids` → `scheduled_flights` (flight_number, dep_icao, arr_icao, dep_time) → `users` (callsign)

### Column: Recently Completed (last 24h)
- Header: "COMPLETED"
- Rows: emerald checkmark + callsign (`#7a7a7a`) + route (`#4a4a4a`) + relative time (right-aligned, `#3a3a3a`)
- Time format: relative (e.g. "2h ago", "5h ago") — computed client-side from `completedAt` timestamp

## Right Column — Maintenance & Network

Same vertical stack pattern as left column.

### 1. Fleet Status
- Section label "Fleet Status" — 7px uppercase, `#3a3a3a`
- 2×2 grid of large numbers (20px `font-mono`, weight 600):
  - Airworthy: emerald
  - MEL Dispatch: amber
  - In Check: cyan
  - AOG: red
- Sub-labels — 7px, `#4a4a4a`

### 2. Critical MEL <48h
- Section label "Critical MEL <48h"
- Each item: tail number (`#f0f0f0`) + time remaining (amber <24h, red <12h) on first line
- Category + description on second line — 7px, `#4a4a4a`
- Empty state: "No critical MELs" in `#3a3a3a`

### 3. Next Scheduled Checks
- Section label "Next Checks"
- Rows: tail number (`#7a7a7a`, left) + check type + hours remaining (right)
- Color: amber if <20% of interval remaining, red if overdue, default `#f0f0f0`
- Sorted by urgency (least hours remaining first)

### 4. Network Health
- Section label "Network" — pushed to bottom of column (`flex: 1; justify-content: end`)
- Rows: label (`#4a4a4a`) + value (`#f0f0f0`), 9px `font-mono`
- Metrics: Hub LF, Outstation LF, Rev/Dep

## Data Sources & Contracts

### 1. `GET /api/admin/dashboard/financial-kpis` (existing — extend)

Already returns balance, RATM/CATM aggregates, spread, route margins, yield trend, network LF. **Extension needed:** add `ratmTrend` and `catmTrend` arrays (6 monthly values each) for the bar charts. The existing endpoint already does monthly queries for yield — add parallel monthly RATM/CATM breakdown using the same `logbook` + `fleet` JOIN, grouped by `strftime('%Y-%m', l.actual_dep)`.

### 2. `GET /api/admin/dashboard/maintenance-summary` (new)

**Response interface:**
```typescript
interface MaintenanceSummary {
  fleetStatus: {
    airworthy: number;    // fleet.status='active' AND no open MEL deferrals (mel_deferrals.status='open')
    melDispatch: number;  // fleet.status='active' AND has open MEL deferrals
    inCheck: number;      // maintenance_log with status='in_progress' (any check_type)
    aog: number;          // fleet.status='maintenance' (aircraft grounded for maintenance)
  };
  criticalMel: Array<{
    registration: string;       // fleet.registration
    category: string;           // mel_deferrals.category ('A','B','C','D')
    title: string;              // mel_deferrals.title (e.g. "Wx Radar Inop")
    expiryDate: string;         // mel_deferrals.expiry_date (ISO datetime)
    hoursRemaining: number;     // computed: expiry_date - now() in hours
  }>;
  nextChecks: Array<{
    registration: string;       // fleet.registration
    checkType: string;          // 'A','B','C','D'
    hoursRemaining: number;     // interval_hours - (total_hours - hours_at_last_X)
    intervalHours: number;      // maintenance_checks.interval_hours
    pctRemaining: number;       // hoursRemaining / intervalHours * 100
  }>;
}
```

**DB mapping:**
- `fleetStatus.airworthy`: `SELECT COUNT(*) FROM fleet WHERE status='active' AND id NOT IN (SELECT aircraft_id FROM mel_deferrals WHERE status='open')`
- `fleetStatus.melDispatch`: `SELECT COUNT(DISTINCT aircraft_id) FROM mel_deferrals WHERE status='open'` (where fleet.status='active')
- `fleetStatus.inCheck`: `SELECT COUNT(DISTINCT aircraft_id) FROM maintenance_log WHERE status='in_progress'`
- `fleetStatus.aog`: `SELECT COUNT(*) FROM fleet WHERE status='maintenance'`
- `criticalMel`: `SELECT ... FROM mel_deferrals JOIN fleet ... WHERE status='open' AND expiry_date < datetime('now', '+48 hours') ORDER BY expiry_date ASC`
- `nextChecks`: JOIN `aircraft_hours` with `maintenance_checks` on `icao_type`, compute `hours_remaining = interval_hours - (total_hours - hours_at_last_X)` per check type, sorted ascending

### 3. `GET /api/admin/dashboard/flight-activity` (new)

**Response interface:**
```typescript
interface FlightActivity {
  scheduled: Array<{
    flightNumber: string;     // scheduled_flights.flight_number
    callsign: string;         // users.callsign (bid owner)
    depIcao: string;          // scheduled_flights.dep_icao
    arrIcao: string;          // scheduled_flights.arr_icao
    depTime: string;          // scheduled_flights.dep_time (HH:MM Zulu)
  }>;
  completed: Array<{
    flightNumber: string;     // logbook.flight_number
    callsign: string;         // users.callsign
    depIcao: string;          // logbook.dep_icao
    arrIcao: string;          // logbook.arr_icao
    completedAt: string;      // logbook.actual_arr (ISO datetime)
  }>;
}
```

**DB queries:**
- `scheduled`: `SELECT sf.flight_number, u.callsign, sf.dep_icao, sf.arr_icao, sf.dep_time FROM active_bids ab JOIN scheduled_flights sf ON sf.id = ab.schedule_id JOIN users u ON u.id = ab.user_id ORDER BY sf.dep_time ASC LIMIT 5`
- `completed`: `SELECT l.flight_number, u.callsign, l.dep_icao, l.arr_icao, l.actual_arr FROM logbook l JOIN users u ON u.id = l.user_id WHERE l.created_at > datetime('now', '-24 hours') AND l.status IN ('completed','approved') ORDER BY l.actual_arr DESC LIMIT 5`

### 4. Socket.io `flights:active` (existing)

Live flight data from the existing heartbeat system. Each entry has `callsign`, `dep_icao`, `arr_icao`, `altitude`, `ground_speed`, `phase`.

### Row limits
- Live flights: max 5 rows
- Scheduled flights: max 5 rows
- Completed flights: max 5 rows

### Loading States
Three independent fetches (`financial-kpis`, `maintenance-summary`, `flight-activity`) + socket subscription. Each column shows a shimmer/skeleton independently until its data arrives. Flight strip shows skeleton until both `flight-activity` and socket data are available.

### Error States
If an endpoint fails, the corresponding column shows a muted "Failed to load" message. Other columns continue to function independently.

## Design Tokens Used

From `admin/src/styles/tokens.css`:
- Surface: `--surface-0` (#000), `--surface-1` (#050505)
- Accents: `--accent-emerald` (#4ade80), `--accent-blue` (#3b5bdb), `--accent-amber` (#fbbf24), `--accent-red` (#f87171), `--accent-cyan` (#22d3ee)
- Text: `--text-primary` (#f0f0f0), `--text-secondary` (#7a7a7a), `--text-tertiary` (#4a4a4a)
- Dividers: `rgba(255,255,255, 0.04)`
- Font: `--font-mono` resolves to Lufga (geometric sans), not a true monospace — this is intentional for the admin design system. All "font-mono" references in this spec use Tailwind's `font-mono` class which maps to this token.

## Component Structure

```
DashboardPage.tsx
├── FinanceColumn/          (left)
│   ├── BalanceWidget
│   ├── RatmCatmWidget
│   ├── SpreadWidget
│   ├── MetricsGrid
│   ├── RouteMargins
│   └── YieldTrend
├── MapCenter/              (center)
│   ├── WorldMap (existing)
│   └── FlightStrip (overlay)
│       ├── LiveFlights
│       ├── ScheduledFlights
│       └── CompletedFlights
└── MaintenanceColumn/      (right)
    ├── FleetStatus
    ├── CriticalMel
    ├── NextChecks
    └── NetworkHealth
```

Widgets are small, focused components. No shared "card" wrapper — each renders directly on the surface. Thin dividers are inline `<div>` elements between logical groups.

## Non-Goals

- No drill-down or click-through from dashboard widgets (future enhancement)
- No real-time chart animations
- No responsive/mobile layout (admin is desktop-only)
- No dark/light theme toggle (dark only)
