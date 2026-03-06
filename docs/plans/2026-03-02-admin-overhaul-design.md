# Admin Panel Overhaul — Design Document

**Date:** 2026-03-02
**Scope:** Fundamental overhaul of the SMA ACARS admin panel — design, features, architecture, QA.

## Guiding Principles

1. **Airline management tool, not a dashboard skin** — every page should let admins take real actions on real data
2. **Data-dense but scannable** — professional tools show a lot of information without feeling cluttered
3. **Split-view as the default pattern** — list + detail side-by-side, like the Dispatch Board already does
4. **Flight sim context** — realistic airline economics without real-world bureaucracy (no crew rest mandates, no FAA paperwork)

## Priority Scope

**Core pages (full overhaul):** Dashboard, Finances, Maintenance, Reports, PIREPs
**Polish pass:** Users, Schedules, Dispatch Board
**Leave as-is:** Settings, Notifications, Audit, Login

---

## 1. New Dependencies

| Package | Purpose | Size |
|---------|---------|------|
| `@tanstack/react-table` | Headless data grid — sorting, filtering, column visibility, row selection, pagination | ~50kb |
| `react-hook-form` | Form state management — dirty tracking, validation, error states | ~25kb |
| `zod` | Schema validation — type-safe, composable, works with RHF | ~14kb |
| `@hookform/resolvers` | Bridges Zod schemas to React Hook Form | ~2kb |
| `sonner` | Toast notifications — stacked, animated, promise toasts, action buttons | ~10kb |
| `cmdk` | Command palette (Cmd+K) — search flights, pilots, aircraft, navigate pages | ~7kb |

**Total added: ~108kb** (gzipped much smaller). All are standard shadcn/ui ecosystem libraries.

---

## 2. Design System Overhaul

### Color Palette

```
Sidebar:            #0f1219  (near-black)
Content background: #141820  (dark charcoal — creates depth vs sidebar)
Cards/panels:       #1c2033  (existing, unchanged)
Table row alt:      #181d2b  (subtle stripe for scanability)
Table row hover:    #1f2538  (visible but not aggressive)
Accent:             #3b82f6  (blue, unchanged)
Status: emerald / amber / red / cyan (unchanged)
```

### Typography Hierarchy

- **Page titles:** 20px, font-weight 600, text-foreground
- **Section headers:** 11px uppercase, tracking-wider, text-muted-foreground (like dashboard panels now)
- **Table headers:** 11px uppercase, tracking-wider, text-muted-foreground
- **Body/table cells:** 13px, font-weight 400
- **Data values:** IBM Plex Mono, font-weight 500
- **Stat card values:** 24px, IBM Plex Mono, font-weight 700

### Page Layout Pattern (standardized)

Every data page follows this structure:

```
┌──────────────────────────────────────────────────────────┐
│  Page Title              [Action Button]  [Cmd+K hint]   │
│  Subtitle / breadcrumb                                   │
├──────────────────────────────────────────────────────────┤
│  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐                       │
│  │ KPI │ │ KPI │ │ KPI │ │ KPI │    ← stat cards        │
│  └─────┘ └─────┘ └─────┘ └─────┘                       │
├────────────────────────┬─────────────────────────────────┤
│                        │                                 │
│   Data Table           │   Detail Panel                  │
│   (left, scrollable)   │   (right, contextual)           │
│                        │                                 │
│   - Sortable columns   │   - Shows selected row details  │
│   - Faceted filters    │   - Edit form / read-only view  │
│   - Row selection      │   - Related data tabs           │
│   - Pagination         │   - Action buttons              │
│                        │                                 │
└────────────────────────┴─────────────────────────────────┘
```

Split-view ratio: 55% list / 45% detail. Detail panel slides in when a row is selected, full-width table when nothing selected.

### Data Table Standard (TanStack Table)

Every table gets:
- Sortable column headers (click to sort, shift+click for multi-sort)
- Column visibility dropdown (toggle columns on/off)
- Faceted filters in a toolbar above the table (dropdowns for categorical, date range for dates)
- Row hover highlight
- Striped rows (alternating bg)
- Sticky header on scroll
- Bottom pagination bar with page size selector (25/50/100)
- Row click → opens detail panel (split-view)
- Checkbox column for bulk actions where applicable
- Empty state with icon + message

### Form Standard (React Hook Form + Zod)

Every form gets:
- Zod schema defining all field validations
- Inline error messages below invalid fields (red text, red ring on input)
- Dirty tracking — save button disabled until changes are made
- Loading state on submit button (spinner)
- Server error display at top of form
- Required field indicators (asterisk)

### Toast Standard (Sonner)

Replace custom `toastStore` with Sonner:
- Success: green check, auto-dismiss 3s
- Error: red X, persists until dismissed, shows error message
- Loading/promise: spinner → success/error (for async operations)
- Action toasts: "PIREP approved" with "Undo" button

### Command Palette (cmdk)

Ctrl+K / Cmd+K opens a search palette:
- **Navigate:** type page name → jump to it
- **Search pilots:** "pilot carter" → shows James Carter, click → Users page with that pilot selected
- **Search flights:** "SMA401" → shows flight, click → PIREPs or Dispatch
- **Search aircraft:** "N401SM" → shows aircraft, click → Maintenance page
- **Quick actions:** "create schedule", "approve pireps", "generate payroll"

The palette fetches from a lightweight `/api/admin/search` endpoint that searches across users, flights, aircraft, and schedules.

---

## 3. Feature Design — Finances (Major Overhaul)

### Tab 1: Overview (P&L Dashboard)

**What it shows:**
- Monthly Profit & Loss summary card: Total Revenue, Total Expenses, Net Profit
- Month-over-month trend area chart (6 months)
- Key ratios in stat cards:
  - Revenue per flight hour
  - Cost per block hour
  - Profit margin %
  - Average revenue per flight

**How revenue is calculated:**
When a PIREP is approved, the backend auto-creates a revenue transaction:
- `cargo_weight_lbs × cargo_rate_per_lb` (from settings)
- Added as a `revenue` category transaction linked to the PIREP

**How costs are estimated:**
- Pilot pay: `block_hours × pay_rate_per_hour` (auto-created on PIREP approval)
- Fuel: `fuel_used_lbs × fuel_cost_per_lb` (from settings, estimated)
- Maintenance: sum of maintenance log costs for the period
- These are estimates — admins can also manually add cost entries

### Tab 2: Revenue

**Split-view: flight revenue table + detail panel**

Table columns: Date, Flight #, Route (DEP→ARR), Aircraft, Cargo (lbs), Revenue ($), Pilot
Detail panel: Full PIREP details, revenue calculation breakdown, route profitability context

Filters: Date range, route, pilot, aircraft type
Sorting: By date, revenue amount, cargo weight

**Route profitability section** at top: ranked list of routes by (total revenue - total estimated costs), showing flight count and margin %.

### Tab 3: Pilot Pay

**Split-view: pilot list + payroll detail**

Table columns: Pilot (callsign + name), Hours, Flights, Base Pay, Bonuses, Deductions, Net Pay
Detail panel: Per-pilot breakdown — each flight with hours and calculated pay, manual adjustments

**Actions:**
- "Generate Payroll" button — calculates pay for all pilots in the selected period, creates draft ledger entries
- "Add Adjustment" — manual bonus or deduction for a specific pilot
- "Finalize Payroll" — marks draft entries as final (prevents double-generation)

### Tab 4: Ledger

Enhanced version of current:
- Add `category` column: revenue, payroll, maintenance, fuel, admin, adjustment
- Add running balance column
- Add "Void" action (creates an offsetting reversal entry, preserves audit trail)
- Better filtering by category, pilot, date range
- Color-coded amounts: green positive, red negative

### Backend Changes

**New migration (035-finance-enhancements.sql):**
```sql
ALTER TABLE transactions ADD COLUMN category TEXT DEFAULT 'admin';
ALTER TABLE transactions ADD COLUMN pirep_id INTEGER REFERENCES pireps(id);
ALTER TABLE transactions ADD COLUMN voided_by INTEGER REFERENCES transactions(id);
ALTER TABLE transactions ADD COLUMN is_draft INTEGER DEFAULT 0;
```

**New service: `backend/src/services/finance.ts`**
- `calculateFlightRevenue(pirep)` — cargo weight × rate
- `calculatePilotPay(pilotId, dateRange)` — hours × rate + bonuses - deductions
- `generatePayroll(dateRange)` — batch creates draft transactions
- `finalizePayroll(dateRange)` — marks drafts as final
- `getRouteProfitability(dateRange)` — aggregates revenue - costs per route

**Auto-posting on PIREP approval:**
In the PIREP review endpoint, after setting status to `approved`:
1. Create revenue transaction (cargo × rate)
2. Create pilot pay transaction (hours × rate)

---

## 4. Feature Design — Maintenance (Moderate Enhancement)

### Tab 6: Components (New Implementation)

Track individual aircraft components:

| Field | Type | Description |
|-------|------|-------------|
| aircraft_id | FK | Which aircraft |
| component_type | enum | engine, apu, landing_gear, propeller, avionics |
| part_number | text | Manufacturer part # |
| serial_number | text | Unique serial |
| position | text | e.g., "Engine #1 (Left)", "Nose Gear" |
| hours_since_new | number | Total hours on this component |
| cycles_since_new | number | Total cycles |
| hours_since_overhaul | number | Hours since last overhaul |
| overhaul_limit | number | Hours between overhauls |
| installed_date | date | When installed on this aircraft |
| status | enum | installed, removed, overhauled, scrapped |

**Split-view:** Component list (grouped by aircraft) + detail panel with service history.

### Fleet Status Enhancements
- Add "last flight" date to each aircraft card
- Add quick-link to filtered maintenance log for that aircraft
- "Put in Maintenance" / "Return to Service" toggle button on each card
- Bulk action: "Schedule check for all [aircraft type]"

### Backend Changes

**New migration (036-component-tracking.sql):**
```sql
CREATE TABLE aircraft_components (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  aircraft_id INTEGER NOT NULL REFERENCES aircraft(id),
  component_type TEXT NOT NULL,
  part_number TEXT,
  serial_number TEXT,
  position TEXT,
  hours_since_new REAL DEFAULT 0,
  cycles_since_new INTEGER DEFAULT 0,
  hours_since_overhaul REAL DEFAULT 0,
  overhaul_limit REAL,
  installed_date TEXT,
  status TEXT DEFAULT 'installed',
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
```

---

## 5. Feature Design — Reports (Significant Enhancement)

### New Charts

**Route Profitability** (new)
- Horizontal bar chart: top 15 routes ranked by profit margin
- Color: green bars for profitable, red for unprofitable
- Shows revenue, costs, margin % in tooltip

**Fleet Utilization** (new)
- Stacked bar chart: hours per aircraft per month
- Shows which aircraft are overworked vs underutilized
- Color intensity by utilization %

### Enhancements to Existing Charts

- **Global date range picker** that actually filters all charts (currently decorative)
- **Click-to-drill-down**: clicking a bar in "Flight Hours by Pilot" filters to show that pilot's flights in a table below the chart
- **Aircraft type filter** on Landing Rates and Fuel Efficiency charts
- **PDF export** button (uses browser print with @media print CSS — no heavy library)

### Backend Changes

**New endpoints:**
- `GET /api/admin/reports/route-profitability` — revenue - costs per route
- `GET /api/admin/reports/fleet-utilization` — hours per aircraft per month

---

## 6. Feature Design — Command Palette Search

### Backend

**New endpoint: `GET /api/admin/search?q=<query>`**

Returns unified results across:
- Users (match on callsign, name, email)
- Flights/PIREPs (match on flight number, route)
- Aircraft (match on registration)
- Schedules (match on flight number, route)

Response shape:
```json
{
  "users": [{ "id": 1, "callsign": "SMA041", "name": "James Carter", "role": "pilot" }],
  "flights": [{ "id": 5, "flightNumber": "SMA401", "route": "KMIA → KJFK", "status": "approved" }],
  "aircraft": [{ "id": 3, "registration": "N401SM", "type": "B763F", "status": "active" }],
  "schedules": [{ "id": 12, "flightNumber": "SMA401", "route": "KMIA → KJFK" }]
}
```

Limited to 5 results per category, fast full-text search on indexed columns.

---

## 7. Architecture Changes

### Frontend

1. **Shared `DataTable` component** — wraps TanStack Table with the standard column sorting, filtering, pagination, row selection, and styling. Every table page imports this instead of building its own.

2. **Shared `PageShell` component** — standardizes page layout: title, subtitle, stat cards row, content area. Ensures visual consistency.

3. **Shared `DetailPanel` component** — the right-side panel in split-view. Handles open/close animation, header with close button, scrollable content area.

4. **Replace `toastStore` with Sonner** — remove custom toast implementation, use Sonner's `toast()` API directly.

5. **Error boundaries** — wrap each page route in a React error boundary with a "Something went wrong" fallback + retry button.

6. **Form schemas** — `admin/src/schemas/` directory with Zod schemas for every form (user, schedule, PIREP review, maintenance entry, financial transaction, payroll adjustment).

### Backend

1. **Finance service** — `backend/src/services/finance.ts` as described above
2. **Search endpoint** — `backend/src/routes/admin-search.ts`
3. **Two new migrations** — 035 (finance enhancements), 036 (component tracking)
4. **Auto-posting** — PIREP approval triggers revenue + pay transactions
5. **Input validation** — Zod on backend for all admin mutation endpoints (not just frontend)

### Security
- Server-side Zod validation on all mutation endpoints
- Rate limiting tightened on admin routes (30 req/min for mutations, 120 req/min for reads)

---

## 8. What We're NOT Doing

- Settings page — leave as-is
- Notifications page — leave as-is
- Audit page — leave as-is (already solid)
- Login page — already polished
- Crew rest mandates, regulatory paperwork — not needed for flight sim
- Real fuel price APIs — use configurable rate in settings
- Document attachments — too much infrastructure for current scope
- Real-time WebSocket on every page — only Dashboard and Dispatch need it

---

## 9. Implementation Order

1. **Dependencies + infrastructure** — install packages, create shared components (DataTable, PageShell, DetailPanel, Sonner, cmdk), new migrations, finance service
2. **Design system** — update colors, typography, layout shell, sidebar
3. **Finances overhaul** — 4 tabs with full implementation
4. **Table migration** — convert all existing tables (Users, Schedules, PIREPs, Maintenance) to TanStack Table + split-view
5. **Reports enhancement** — new charts, drill-down, date filtering
6. **Maintenance tab 6** — component tracking implementation
7. **Command palette** — search endpoint + cmdk integration
8. **Dashboard** — restore live data, final polish
9. **QA pass** — every page, every action, every edge case
