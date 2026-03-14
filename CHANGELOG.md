# Changelog

## v1.3.0 — 2026-03-14

### Admin Panel

#### Dashboard Redesign
- Rewrite dashboard with map-centric 3-column layout (Airline Performance, Operations & Fleet, Network & Flights)
- Add 3D globe visualization with hub points and continent mesh
- Add mini-charts for yield trends, route margins, pilot activity, and utilization
- Add real-time VATSIM pilot tracking, hub weather, fleet status, and discrepancy widgets

#### Maintenance Module
- Add Configuration tab with sub-tabs for Check Schedules, MEL Master List, Components, and Airworthiness Directives
- Full CRUD for A/B/C/D check interval definitions per aircraft type
- Full CRUD for MEL master list items with ATA chapter linking
- Full CRUD for life-limited component tracking (engines, landing gear, APU, etc.)
- Full CRUD for Airworthiness Directives with compliance status tracking
- Discrepancy ATA chapter picker changed from search-input to dropdown select
- Flight phase dropdown now uses proper title case (e.g., "Taxi Out" instead of "taxi out")

#### Design System Refinements
- Desaturate surface colors to reduce blue wash on dark backgrounds (`--surface-1`, `--surface-3`)
- Brighten blue accent tokens for better contrast against dark navy (`#4F6CCD` → `#6384E6`, `#7B94E0` → `#9BB3F0`)
- Reduce `--accent-blue-bg` opacity for subtler badge/card backgrounds
- Dialog popups now use consistent `--surface-1` background across all pages
- Input fields inside dialogs use darker `--surface-0` background for clear visual hierarchy
- Update shadcn/ui HSL variables (`--card`, `--popover`, `--input`, `--primary`, `--ring`) to match token system
- Apply `bg-input` to Input, Textarea, and Select trigger components (replaces `bg-transparent`)
- Brighten primary button gradient to match updated accent blue

#### Revenue Model
- Add revenue model page with fare rate configuration

#### Removed
- Remove cost engine page and finance engine services (replaced by revenue model)
- Remove sidebar component and sidebar store (replaced by top navigation)

### Backend
- Add maintenance summary and flight activity dashboard endpoints
- Add `/admin` → `/admin/` redirect for correct SPA asset resolution
- Add discrepancy and MEL master CRUD routes
- Add ATA chapters reference endpoint
- Add maintenance expansion migrations (discrepancies, MEL master, components, ADs)
- Seed default ATA chapters and check intervals

### Frontend (Pilot App)
- Remove stale debug `console.log` in FlightPlanPanel JSX
- Fix `navlog` variable used before declaration in SimBrief parser

### Electron
- Fix EPIPE crash on Windows when SimConnect retry loop logs after renderer pipe closes
- Add `process.stdout`/`process.stderr` error handlers in main process

### Shared
- Add maintenance types (discrepancy, MEL master)
- Remove finance engine types
