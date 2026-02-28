# Admin Frontend Website — Design Document

**Date:** 2026-02-28
**Status:** Approved
**Reference UI:** [AirlineSim by Phenomenon Studio](https://phenomenonstudio.com/projects/airlinesim-realistic-online-airline-management-simulation/)

---

## Overview

Standalone web application for airline administration and dispatch management. Served at `/admin` on the existing VPS. Targets admin and dispatcher roles only — pilots continue using the Electron desktop client.

The backend already has 47 admin endpoints across 7 domains. This project is primarily a frontend build with a new AirlineSim-inspired dark dashboard design, plus 4 new backend endpoints (dashboard aggregation, notifications, reports).

## Architecture

- **Workspace:** `admin/` added to the npm monorepo alongside shared/backend/frontend/electron
- **Stack:** Vite 6 + React 19 + TypeScript + Zustand 5 + Tailwind CSS + shadcn/ui
- **Charts:** Recharts
- **Maps:** Leaflet + react-leaflet (dispatch board)
- **Icons:** Phosphor Icons
- **Types:** `@acars/shared` (same as all other packages)
- **Auth:** Same JWT + refresh token flow as existing frontend
- **Deployment:** Static files served by Express at `/admin` subpath on VPS (138.197.127.39:3001)

## Design System

### Color Palette

```
Backgrounds:
  --bg-body:     #0f1117    (page background)
  --bg-sidebar:  #151823    (sidebar)
  --bg-card:     #1a1d2e    (widget cards, panels)
  --bg-card-alt: #1e2235    (hover states, alternating rows)
  --bg-input:    #232738    (form inputs)

Borders:
  --border:      #2a2e3f
  --border-hover:#3a3f55

Text:
  --text-primary:   #e8eaed
  --text-secondary: #8b8fa3
  --text-tertiary:  #5c6070

Accent:
  --accent:      #3b82f6
  --accent-hover:#2563eb
  --accent-muted:#3b82f620

Semantic:
  --success:     #22c55e
  --warning:     #f59e0b
  --danger:      #ef4444
  --info:        #06b6d4
```

### Typography

- **Headings/body:** Inter
- **Data values:** IBM Plex Mono (monospace)
- **Sizes:** 11px labels, 13px body, 15px section heads, 20px page titles

### Sidebar Navigation

Collapsible sidebar with icon + label. Grouped sections:

```
OPERATIONS
  Dashboard          LayoutDashboard
  Dispatch Board     Radar

MANAGEMENT
  Schedules          CalendarDots
  PIREPs             ClipboardText
  Users              Users

FLEET
  Maintenance        Wrench

FINANCE
  Finances           CurrencyDollar
  Reports            ChartBar

SYSTEM
  Notifications      Bell (badge: unread count)
  Audit Log          ClockCounterClockwise
  Settings           GearSix
```

### Widget Cards

Dark background (`--bg-card`), 1px border, header row (icon + title + optional menu), content area, 16px padding. Core building block for dashboard and detail pages.

## Pages

### 1. Dashboard (Home)

Widget grid — operations command center:

- **Stat cards (top row):** Active flights, Pending PIREPs, Fleet health %, Monthly revenue
- **Recent Flights:** Last 5-10 with status badges
- **Financial Overview:** Recharts area chart (income/costs/profit, 6 months)
- **Maintenance Alerts:** Upcoming checks, open MEL, overdue ADs
- **Pilot Activity:** Bar chart top 10 pilots by hours this month

### 2. Dispatch Board (NEW)

Live operations center:

- Leaflet map with aircraft markers and trails
- Flight list panel with phase badges and ETA
- Click flight → detail panel: live telemetry, vertical profile, ACARS chat
- Exceedance alerts as toast notifications (severity-colored)
- WebSocket: `dispatch:telemetry`, `dispatch:exceedance`, `acars:message`

### 3. Users Page

shadcn DataTable with search, role/status filters. Row actions: edit, suspend/reactivate, impersonate, delete. Create user modal. Stats row at top.

### 4. Schedules Page

Tabs: Flights (DataTable + create/edit slide-over), Airports (list + add/toggle hub/delete), Charters (VATSIM event integration, generation status).

### 5. PIREPs Page

DataTable with status tabs (All/Pending/Approved/Rejected). Bulk select toolbar. Click → slide-over detail. Review form: approve/reject + notes. Pending count badge in sidebar.

### 6. Maintenance Page

Multi-tab: Fleet Status (cards per aircraft), Maintenance Log (DataTable), Check Schedules (A/B/C/D intervals), ADs (directive tracking), MEL (deferrals), Components (life-limited parts).

### 7. Finances Page

Three tabs: Ledger (transactions DataTable + create), Balances (per-pilot), Summary (Recharts bar/pie charts by type and date range).

### 8. Reports Page (NEW)

Analytics dashboard with date range picker:

- Flight hours (line chart by pilot)
- On-time performance (gauge + trend)
- Landing rates (distribution histogram)
- Fuel efficiency (planned vs actual)
- Route popularity (top 10 bar chart)
- Revenue per route

Export to CSV option.

### 9. Notifications Page (NEW)

- Compose form: type (info/success/warning/error), message, target (all/specific pilot/role)
- History table with sent/read status
- Templates for common notifications

### 10. Audit Log

DataTable with actor/action/target/date filters. Before/after data view.

### 11. Settings

Grouped form sections: Airline Info, Finance, Bookings, System. Per-section save with feedback.

## Data Flow

### API

```typescript
const BASE_URL = import.meta.env.DEV ? 'http://localhost:3001' : '';
```

Same `api.get/post/patch/delete<T>()` pattern with 401 → refresh token rotation.

### Zustand Stores

| Store | Purpose |
|-------|---------|
| authStore | JWT tokens, user profile, login/logout |
| socketStore | Socket.io connection (dispatch board) |
| toastStore | Toast notifications |
| sidebarStore | Sidebar collapsed/expanded |
| dashboardStore | Cached widget data, refresh intervals |

### WebSocket (Dispatch Board only)

```
livemap:subscribe    → flights:active
dispatch:subscribe   → dispatch:telemetry, dispatch:exceedance
acars:sendMessage    → acars:message
```

All other pages are REST-only.

## New Backend Endpoints

### Dashboard Aggregation

```
GET /api/admin/dashboard
→ { activeFlights, pendingPireps, fleetHealth, monthlyRevenue,
    recentFlights, maintenanceAlerts, pilotActivity }
```

### Notifications

```
POST /api/admin/notifications    — Create + push notification
GET  /api/admin/notifications    — List sent notifications
```

### Reports

```
GET /api/admin/reports/flight-hours?from=&to=
GET /api/admin/reports/landing-rates?from=&to=
GET /api/admin/reports/fuel-efficiency?from=&to=
GET /api/admin/reports/on-time?from=&to=
GET /api/admin/reports/route-popularity?from=&to=
```

## Build & Deploy

### Vite Config

```typescript
export default defineConfig({
  base: '/admin/',
  build: { outDir: 'dist' },
  server: {
    port: 5174,
    proxy: {
      '/api': 'http://localhost:3001',
      '/socket.io': { target: 'http://localhost:3001', ws: true },
    },
  },
});
```

### Backend Static Serving

```typescript
app.use('/admin', express.static(path.join(__dirname, '../admin-dist')));
app.get('/admin/*', (req, res) => res.sendFile('index.html', { root: adminDistPath }));
```

### Release Pipeline (10 steps)

```
[1/10]  Bump version
[2/10]  Build shared
[3/10]  Build backend
[4/10]  Build frontend (Electron)
[5/10]  Build admin
[6/10]  Package Electron installer
[7/10]  Deploy backend to VPS
[8/10]  Deploy admin to VPS (scp static files)
[9/10]  Commit, tag, push
[10/10] GitHub Release
```

### Dev Workflow

```bash
npm run dev:all          # backend + frontend + electron
npm run dev -w admin     # admin on :5174 (separate terminal)
```

### Access URLs

- **Production:** https://138.197.127.39:3001/admin/
- **Dev:** http://localhost:5174/admin/

## Project Structure

```
admin/
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── components/
│   │   ├── layout/
│   │   │   ├── AppSidebar.tsx
│   │   │   ├── DashboardLayout.tsx
│   │   │   └── TopBar.tsx
│   │   ├── widgets/
│   │   ├── charts/
│   │   ├── tables/
│   │   └── ui/              (shadcn/ui generated)
│   ├── pages/
│   │   ├── LoginPage.tsx
│   │   ├── DashboardPage.tsx
│   │   ├── DispatchBoardPage.tsx
│   │   ├── UsersPage.tsx
│   │   ├── SchedulesPage.tsx
│   │   ├── PirepsPage.tsx
│   │   ├── MaintenancePage.tsx
│   │   ├── FinancesPage.tsx
│   │   ├── ReportsPage.tsx
│   │   ├── NotificationsPage.tsx
│   │   ├── AuditPage.tsx
│   │   └── SettingsPage.tsx
│   ├── stores/
│   ├── hooks/
│   ├── lib/
│   │   ├── api.ts
│   │   └── utils.ts
│   └── styles/
│       └── globals.css
├── index.html
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── vite.config.ts
└── components.json
```
