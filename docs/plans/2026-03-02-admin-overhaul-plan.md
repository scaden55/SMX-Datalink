# Admin Panel Overhaul — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform the admin panel from a surface-level dashboard into a professional airline management system with proper data tables, split-view layouts, full airline economics, and polished design.

**Architecture:** Install TanStack Table, React Hook Form + Zod, Sonner, and cmdk. Build shared DataTable/PageShell/DetailPanel components. Rewrite all core pages to use split-view pattern. Add backend finance auto-posting, search endpoint, and component tracking migration.

**Tech Stack:** React 19, TanStack Table v8, React Hook Form + Zod, Sonner, cmdk, Recharts, Tailwind CSS, Express 4, better-sqlite3

**Project context:** No test framework exists. Verification is manual (check the page, verify API responses). The project uses `npm run dev:all` for development (backend + frontend + electron). Admin dev server is `npm run dev -w admin` on port 5174. Backend is port 3001.

**IMPORTANT conventions:**
- Backend imports use `.js` extensions (Node16 resolution)
- Backend logging: `logger.info/warn/error(tag, msg, meta?)` — never `console.log`
- Admin auth: `admin-auth` localStorage key, separate from pilot frontend
- DB naming: snake_case columns, interfaces in `backend/src/types/db-rows.ts`
- Design: accent `#3b82f6`, panels `#1c2033`, `rounded-md`, IBM Plex Mono for data, Phosphor icons, NO purple/glassmorphism/rounded-xl/backdrop-blur
- Admin base URL: `/admin/` in Vite config
- This is a cargo airline — cargo first in all UI ordering

---

## Phase 1: Foundation

### Task 1: Install new dependencies

**Files:**
- Modify: `admin/package.json`

**Step 1:** Install packages in the admin workspace:

```bash
cd "C:\Users\scade\Documents\SMA ACARS"
npm install -w admin @tanstack/react-table react-hook-form zod @hookform/resolvers sonner cmdk
```

**Step 2:** Verify installation — `node_modules/@tanstack/react-table` should exist.

**Step 3:** Commit:
```bash
git add admin/package.json package-lock.json
git commit -m "chore(admin): add TanStack Table, React Hook Form, Zod, Sonner, cmdk"
```

---

### Task 2: Design system overhaul — CSS variables and global styles

Update the color palette to create visual depth between sidebar and content area.

**Files:**
- Modify: `admin/src/styles/globals.css`
- Modify: `admin/tailwind.config.ts`

**Step 1:** Update CSS variables in `globals.css`. Change the `:root` / dark mode variables:

```css
/* Key changes to existing variables: */
--background: 220 20% 7%;          /* #141820 — content bg, slightly lighter than sidebar */
--card: 224 22% 15%;               /* #1c2033 — panels/cards (unchanged) */
--popover: 226 24% 13%;            /* #1a1d2e (unchanged) */
--muted: 224 18% 16%;              /* #232838 */
--accent: 217 91% 60%;             /* #3b82f6 (unchanged) */

/* NEW: sidebar is darker than content for depth */
--sidebar-background: 222 25% 5%;  /* #0f1219 — near-black */
```

**Step 2:** Add table-specific utility classes to `globals.css`:

```css
/* Table row alternating stripe */
.table-row-stripe:nth-child(even) {
  background-color: hsl(224 18% 11%); /* #181d2b */
}
.table-row-stripe:hover {
  background-color: hsl(224 18% 14%); /* #1f2538 */
}
```

**Step 3:** Verify: run admin dev server, check that sidebar is visibly darker than the content background.

**Step 4:** Commit:
```bash
git add admin/src/styles/globals.css admin/tailwind.config.ts
git commit -m "style(admin): update design system colors for sidebar/content depth"
```

---

### Task 3: Backend migration 035 — Finance enhancements

Add `category` and `voided_by` columns to the finances table to support richer financial tracking.

**Files:**
- Create: `backend/src/db/migrations/035-finance-enhancements.sql`

**Step 1:** Write migration:

```sql
-- Add category for transaction classification
ALTER TABLE finances ADD COLUMN category TEXT DEFAULT 'admin';

-- Track voided transactions (offsetting entry reference)
ALTER TABLE finances ADD COLUMN voided_by INTEGER REFERENCES finances(id);

-- Track draft status for payroll generation
ALTER TABLE finances ADD COLUMN is_draft INTEGER DEFAULT 0;

-- Backfill existing categories based on type
UPDATE finances SET category = 'payroll' WHERE type IN ('pay', 'bonus', 'deduction');
UPDATE finances SET category = 'revenue' WHERE type = 'income';
UPDATE finances SET category = 'expense' WHERE type = 'expense';
```

**Step 2:** Verify: restart backend (`npm run dev -w backend`), check logs for migration applied.

**Step 3:** Commit:
```bash
git add backend/src/db/migrations/035-finance-enhancements.sql
git commit -m "feat(backend): migration 035 — finance category, voided_by, is_draft columns"
```

---

### Task 4: Backend migration 036 — Component tracking

Add `aircraft_components` table for Maintenance tab 6.

**Files:**
- Create: `backend/src/db/migrations/036-component-tracking.sql`

**Step 1:** Write migration:

```sql
CREATE TABLE IF NOT EXISTS aircraft_components (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  aircraft_id INTEGER NOT NULL,
  component_type TEXT NOT NULL CHECK (component_type IN ('engine', 'apu', 'landing_gear', 'propeller', 'avionics', 'other')),
  part_number TEXT,
  serial_number TEXT,
  position TEXT,
  hours_since_new REAL DEFAULT 0,
  cycles_since_new INTEGER DEFAULT 0,
  hours_since_overhaul REAL DEFAULT 0,
  overhaul_limit REAL,
  installed_date TEXT,
  status TEXT DEFAULT 'installed' CHECK (status IN ('installed', 'removed', 'overhauled', 'scrapped')),
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (aircraft_id) REFERENCES aircraft(id)
);

CREATE INDEX IF NOT EXISTS idx_components_aircraft ON aircraft_components(aircraft_id);
CREATE INDEX IF NOT EXISTS idx_components_type ON aircraft_components(component_type);
```

**Step 2:** Verify: restart backend, check migration applies.

**Step 3:** Commit:
```bash
git add backend/src/db/migrations/036-component-tracking.sql
git commit -m "feat(backend): migration 036 — aircraft_components table"
```

---

### Task 5: Replace toast system with Sonner

Replace the custom `toastStore` with Sonner across the entire admin app.

**Files:**
- Modify: `admin/src/App.tsx` — add Sonner `<Toaster />`
- Modify: `admin/src/stores/toastStore.ts` — replace internals with Sonner calls
- Remove usage: Find all `toast.success/error/warning/info` calls — they should still work because we'll make the `toast` export delegate to Sonner

**Step 1:** Add Sonner's `<Toaster />` to `App.tsx`:

```tsx
import { Toaster } from 'sonner';
// Inside the App return, at the top level alongside BrowserRouter:
<Toaster
  position="bottom-right"
  toastOptions={{
    style: { background: '#1c2033', border: '1px solid #2a2e3f', color: '#e8eaed' },
  }}
  richColors
/>
```

**Step 2:** Rewrite `toastStore.ts` to be a thin wrapper around Sonner:

```ts
import { toast as sonnerToast } from 'sonner';

export const toast = {
  success: (msg: string) => sonnerToast.success(msg),
  error: (msg: string) => sonnerToast.error(msg),
  warning: (msg: string) => sonnerToast.warning(msg),
  info: (msg: string) => sonnerToast.info(msg),
};
```

This preserves the existing `toast.success(msg)` API everywhere — no page-level changes needed.

**Step 3:** Remove the old `ToastContainer` component if it's rendered in the layout. Search for `ToastContainer` in admin/ and remove it.

**Step 4:** Verify: trigger a toast (e.g., create a user), confirm Sonner renders at bottom-right with dark styling.

**Step 5:** Commit:
```bash
git add admin/src/App.tsx admin/src/stores/toastStore.ts
git commit -m "feat(admin): replace custom toasts with Sonner"
```

---

### Task 6: Shared PageShell component

Standardize every page's header area: title, subtitle, action buttons, stat cards.

**Files:**
- Create: `admin/src/components/shared/PageShell.tsx`

**Step 1:** Build the component:

```tsx
import type { ReactNode } from 'react';

interface StatCard {
  label: string;
  value: string | number;
  icon?: ReactNode;
  color?: 'blue' | 'emerald' | 'amber' | 'red' | 'cyan';
}

interface PageShellProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  stats?: StatCard[];
  children: ReactNode;
}

export function PageShell({ title, subtitle, actions, stats, children }: PageShellProps) {
  // Renders:
  // 1. Header row: title (left) + actions (right)
  // 2. Optional subtitle below title
  // 3. Optional stat cards row (grid of 2-4 cards with colored left borders, like dashboard KPIs)
  // 4. children (the main content area)
}
```

**Design specs for stat cards:** Same pattern as dashboard KPI cards — `rounded-md bg-[#1c2033] border border-border/50 border-l-[3px] border-l-{color}-500 p-3` with uppercase tracking label, large mono value.

**Step 2:** Verify: import into one page (e.g., UsersPage), confirm layout renders correctly.

**Step 3:** Commit:
```bash
git add admin/src/components/shared/PageShell.tsx
git commit -m "feat(admin): add shared PageShell layout component"
```

---

### Task 7: Shared DataTable component (TanStack Table)

This is the most critical infrastructure piece. Build a reusable table component wrapping TanStack Table with the project's design system.

**Files:**
- Create: `admin/src/components/shared/DataTable.tsx`
- Create: `admin/src/components/shared/DataTablePagination.tsx`
- Create: `admin/src/components/shared/DataTableColumnHeader.tsx`

**Step 1:** Build `DataTable.tsx`:

```tsx
import {
  type ColumnDef,
  type ColumnFiltersState,
  type SortingState,
  type VisibilityState,
  type RowSelectionState,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  useReactTable,
} from '@tanstack/react-table';
```

**Key features to implement:**
- Accept `columns: ColumnDef<T>[]`, `data: T[]`, `onRowClick?: (row: T) => void`
- Sorting state (click column headers)
- Column visibility toggle (dropdown with checkboxes)
- Row selection (optional, via `enableRowSelection` prop)
- Row hover highlight using `table-row-stripe` class
- Striped alternating rows
- Selected row highlighted with blue-left-border accent
- Empty state: centered icon + "No results" message
- Loading state: skeleton rows

**Pagination** is handled server-side (the existing pattern), so the table just renders the current page's data. `DataTablePagination` renders the page controls below.

**Step 2:** Build `DataTableColumnHeader.tsx`:

```tsx
// Renders a sortable column header with sort direction indicator (arrow up/down)
// Clicking toggles sort; shift+click for multi-sort
// Uses the TanStack column.getToggleSortingHandler()
// 11px uppercase tracking-wider text-muted-foreground
```

**Step 3:** Build `DataTablePagination.tsx`:

```tsx
// Renders: "Showing X-Y of Z" + page size selector (25/50/100) + Prev/Next buttons
// Props: page, pageSize, total, onPageChange, onPageSizeChange
// Uses the existing Button component from shadcn
```

**Step 4:** Verify: import DataTable into a page, pass column defs and sample data, confirm rendering.

**Step 5:** Commit:
```bash
git add admin/src/components/shared/DataTable.tsx admin/src/components/shared/DataTablePagination.tsx admin/src/components/shared/DataTableColumnHeader.tsx
git commit -m "feat(admin): add shared DataTable component (TanStack Table)"
```

---

### Task 8: Shared DetailPanel component

The right-side panel in split-view layouts. Slides in when a row is selected.

**Files:**
- Create: `admin/src/components/shared/DetailPanel.tsx`

**Step 1:** Build the component:

```tsx
interface DetailPanelProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  actions?: ReactNode;  // Action buttons in panel header
  children: ReactNode;
}
```

**Design specs:**
- Fixed width: `w-[45%]` of the content area when open
- Background: `bg-[#1c2033]` with `border-l border-border/50`
- Header: title + close button (X icon, top-right) + optional action buttons
- Content: scrollable with `overflow-y-auto`
- Transition: slide in from right (`translate-x` with CSS transition)
- When closed, the DataTable expands to full width

**Step 2:** Verify: render with sample content, confirm slide animation and close behavior.

**Step 3:** Commit:
```bash
git add admin/src/components/shared/DetailPanel.tsx
git commit -m "feat(admin): add shared DetailPanel slide-in component"
```

---

### Task 9: Command palette shell (cmdk)

Set up the command palette UI. Search integration comes later (Task 25).

**Files:**
- Create: `admin/src/components/shared/CommandPalette.tsx`
- Modify: `admin/src/App.tsx` — add keyboard listener and palette component

**Step 1:** Build `CommandPalette.tsx`:

```tsx
import { Command } from 'cmdk';
```

**Features:**
- Opens on Ctrl+K / Cmd+K
- Input field at top for typing
- Groups: "Pages" (links to all admin pages), "Quick Actions" (coming in Task 25)
- Each item has icon + label + optional shortcut hint
- Selecting a page navigates via react-router `useNavigate()`
- Dark styling consistent with design system

**Step 2:** Add to `App.tsx` — render `<CommandPalette />` at root level.

**Step 3:** Verify: press Ctrl+K, type "pir", see "PIREPs" suggestion, click → navigates to PIREPs page.

**Step 4:** Commit:
```bash
git add admin/src/components/shared/CommandPalette.tsx admin/src/App.tsx
git commit -m "feat(admin): add command palette (Ctrl+K) with page navigation"
```

---

## Phase 2: Backend Enhancements

### Task 10: Finance service — Revenue auto-posting on PIREP approval

When a PIREP is approved, auto-create a revenue transaction from cargo weight.

**Files:**
- Modify: `backend/src/services/pirep-admin.ts` — add revenue posting in the `review()` method
- Modify: `backend/src/services/finance.ts` — add `category` field support

**Step 1:** In `pirep-admin.ts`, inside the `review()` transaction, after the existing pilot pay creation (line ~126), add revenue posting:

```ts
// After the existing pay entry (lines 126-137), add:
const cargoRate = parseFloat(settingsService.get('finance.cargo_rate_per_lb') ?? '0.12');
if (pirep.cargo_lbs > 0) {
  const revenue = Math.round(pirep.cargo_lbs * cargoRate * 100) / 100;
  financeService.create({
    pilotId: pirep.user_id,
    type: 'income',
    amount: revenue,
    description: `Cargo revenue: ${pirep.flight_number} (${pirep.cargo_lbs.toLocaleString()} lbs @ $${cargoRate}/lb)`,
    pirepId,
  }, reviewerId);
}
```

**Step 2:** Update `FinanceService.create()` to accept and store the new `category` field:

```ts
create(data: { pilotId: number; type: FinanceType; amount: number; description?: string; pirepId?: number | null; category?: string }, createdBy: number): number {
  const category = data.category ?? (data.type === 'income' ? 'revenue' : data.type === 'pay' ? 'payroll' : 'admin');
  // Update INSERT to include category column
}
```

**Step 3:** Add the `finance.cargo_rate_per_lb` setting to the settings seed or settings page default.

**Step 4:** Verify: approve a PIREP via API, check that both a `pay` and `income` entry are created in the finances table.

**Step 5:** Commit:
```bash
git add backend/src/services/pirep-admin.ts backend/src/services/finance.ts
git commit -m "feat(backend): auto-post cargo revenue on PIREP approval"
```

---

### Task 11: Finance service — Route profitability and payroll

Add new query methods to the finance service for the enhanced Finances page.

**Files:**
- Modify: `backend/src/services/finance.ts`
- Modify: `backend/src/routes/admin-finances.ts`
- Modify: `backend/src/types/db-rows.ts` — add new row types

**Step 1:** Add to `FinanceService`:

```ts
getRouteProfitability(dateFrom?: string, dateTo?: string): RouteProfitability[] {
  // Query: JOIN logbook with finances (via pirep_id)
  // GROUP BY dep_icao, arr_icao
  // SUM revenue (type='income'), SUM costs (type='pay')
  // Calculate margin = (revenue - costs) / revenue * 100
  // ORDER BY profit DESC
  // Return: route, depIcao, arrIcao, flights, revenue, costs, profit, margin
}

getRevenueByFlight(filters, page, pageSize): { entries[], total } {
  // Query: JOIN logbook l with finances f ON f.pirep_id = l.id
  // WHERE f.type = 'income'
  // Return: flight details + revenue amount + cargo weight
}

getPilotPaySummary(dateFrom, dateTo): PilotPaySummary[] {
  // Query: GROUP BY pilot_id
  // SUM by type (pay, bonus, deduction)
  // JOIN users for callsign/name
  // Return: pilot details + basePay + bonuses + deductions + netPay + hours + flights
}
```

**Step 2:** Add new routes to `admin-finances.ts`:

```ts
GET /api/admin/finances/revenue          // Revenue by flight (paginated)
GET /api/admin/finances/route-profit     // Route profitability ranking
GET /api/admin/finances/pilot-pay        // Pilot pay summary
```

**Step 3:** Add row types to `db-rows.ts`:

```ts
export interface RouteProfitabilityRow {
  dep_icao: string;
  arr_icao: string;
  flights: number;
  revenue: number;
  costs: number;
  profit: number;
  margin: number;
}

export interface PilotPaySummaryRow {
  pilot_id: number;
  callsign: string;
  pilot_name: string;
  hours: number;
  flights: number;
  base_pay: number;
  bonuses: number;
  deductions: number;
  net_pay: number;
}
```

**Step 4:** Verify: call new endpoints via curl or browser, check JSON responses.

**Step 5:** Commit:
```bash
git add backend/src/services/finance.ts backend/src/routes/admin-finances.ts backend/src/types/db-rows.ts
git commit -m "feat(backend): add route profitability, revenue-by-flight, pilot pay summary endpoints"
```

---

### Task 12: Backend — Search endpoint for command palette

**Files:**
- Create: `backend/src/routes/admin-search.ts`
- Modify: `backend/src/routes/admin.ts` or wherever admin routes are registered (check `backend/src/index.ts`)

**Step 1:** Build search endpoint:

```ts
// GET /api/admin/search?q=<query>
// Searches across: users (callsign, name, email), logbook (flight_number), aircraft (registration), schedules (flight_number)
// Returns max 5 per category
// Uses LIKE '%query%' on indexed columns
```

Response shape:
```ts
{
  users: { id, callsign, name, role }[],
  flights: { id, flightNumber, route, status }[],
  aircraft: { id, registration, type, status }[],
  schedules: { id, flightNumber, route }[]
}
```

**Step 2:** Register the route in the admin route mounting file.

**Step 3:** Verify: `curl http://localhost:3001/api/admin/search?q=SMA` with auth header.

**Step 4:** Commit:
```bash
git add backend/src/routes/admin-search.ts
git commit -m "feat(backend): add unified search endpoint for command palette"
```

---

### Task 13: Backend — New report endpoints

**Files:**
- Modify: `backend/src/services/admin-reports.ts`
- Modify: `backend/src/routes/admin-reports.ts`

**Step 1:** Add `getRouteProfitability()` to report service:

```ts
// Same as finance route profitability but optimized for chart display
// Returns top 15 routes by profit
// Includes margin percentage
```

**Step 2:** Add `getFleetUtilization()` to report service:

```ts
// Query: JOIN logbook with aircraft, GROUP BY aircraft_registration, month
// Return: aircraft reg, type, hours per month (array of {month, hours})
```

**Step 3:** Add routes:

```ts
GET /api/admin/reports/route-profitability?from=&to=
GET /api/admin/reports/fleet-utilization?from=&to=
```

**Step 4:** Verify: curl both endpoints.

**Step 5:** Commit:
```bash
git add backend/src/services/admin-reports.ts backend/src/routes/admin-reports.ts
git commit -m "feat(backend): add route profitability and fleet utilization report endpoints"
```

---

### Task 14: Backend — Maintenance component tracking CRUD

**Files:**
- Modify: `backend/src/services/maintenance.ts`
- Modify: `backend/src/routes/admin-maintenance.ts`
- Modify: `backend/src/types/db-rows.ts`

**Step 1:** Add component methods to `MaintenanceService`:

```ts
getComponents(aircraftId?: number): ComponentRow[]
getComponent(id: number): ComponentRow | undefined
createComponent(data): number
updateComponent(id, data): boolean
deleteComponent(id): boolean
```

**Step 2:** Add routes:

```ts
GET    /api/admin/maintenance/components?aircraftId=
GET    /api/admin/maintenance/components/:id
POST   /api/admin/maintenance/components
PATCH  /api/admin/maintenance/components/:id
DELETE /api/admin/maintenance/components/:id
```

**Step 3:** Add `ComponentRow` to `db-rows.ts`.

**Step 4:** Verify: CRUD via curl.

**Step 5:** Commit:
```bash
git add backend/src/services/maintenance.ts backend/src/routes/admin-maintenance.ts backend/src/types/db-rows.ts
git commit -m "feat(backend): add aircraft component tracking CRUD"
```

---

## Phase 3: Core Page Rewrites

**IMPORTANT:** Each page rewrite follows the same pattern:
1. Import shared components (PageShell, DataTable, DetailPanel)
2. Define TanStack Table column definitions
3. Replace manual table HTML with DataTable
4. Add split-view: DataTable on left, DetailPanel on right
5. Convert all forms to React Hook Form + Zod
6. Replace any remaining `toast.error/success` calls if needed (should already work via Sonner wrapper)

### Task 15: PIREPs page rewrite

The PIREPs page is the best candidate to migrate first — it already has bulk selection and a detail panel.

**Files:**
- Rewrite: `admin/src/pages/PirepsPage.tsx`
- Keep: `admin/src/components/panels/PirepDetailPanel.tsx` (existing detail panel)

**Step 1:** Define column definitions using TanStack Table `ColumnDef<PirepEntry>[]`:

```ts
const columns: ColumnDef<PirepEntry>[] = [
  { id: 'select', /* checkbox column */ },
  { accessorKey: 'flightNumber', header: 'Flight', /* font-mono */ },
  { accessorKey: 'pilotCallsign', header: 'Pilot' },
  { id: 'route', header: 'Route', /* DEP → ARR cell */ },
  { accessorKey: 'landingRateFpm', header: 'Landing', /* colored value */ },
  { accessorKey: 'flightTimeMin', header: 'Time', /* formatted h:mm */ },
  { accessorKey: 'status', header: 'Status', /* badge cell */ },
  { accessorKey: 'actualDep', header: 'Date', /* formatted */ },
];
```

**Step 2:** Replace the page with the new pattern:

```tsx
<PageShell title="PIREPs" subtitle="Pilot reports" stats={stats} actions={bulkToolbar}>
  <div className="flex flex-1 overflow-hidden">
    <div className={detailOpen ? 'w-[55%]' : 'w-full'}>
      <DataTable columns={columns} data={pireps} onRowClick={setSelected} ... />
      <DataTablePagination page={page} pageSize={50} total={total} ... />
    </div>
    <DetailPanel open={detailOpen} onClose={() => setSelected(null)} title="PIREP Detail">
      <PirepDetailPanel pirep={selected} onReview={handleReview} />
    </DetailPanel>
  </div>
</PageShell>
```

**Step 3:** Keep existing API calls (they're fine), status tab filtering, bulk review logic.

**Step 4:** Verify: all existing functionality works — filters, bulk select, approve/reject, pagination, detail panel.

**Step 5:** Commit:
```bash
git add admin/src/pages/PirepsPage.tsx
git commit -m "feat(admin): rewrite PIREPs page with DataTable + split-view"
```

---

### Task 16: Users page rewrite

**Files:**
- Rewrite: `admin/src/pages/UsersPage.tsx`

**Step 1:** Define columns, add split-view with user detail panel on the right (shows profile, role, hours, last login).

**Step 2:** Convert Create/Edit user forms to React Hook Form + Zod:

```ts
const userSchema = z.object({
  email: z.string().email(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  callsign: z.string().min(3).max(10),
  role: z.enum(['admin', 'dispatcher', 'pilot']),
  password: z.string().min(8).optional(),
});
```

**Step 3:** Move create/edit dialogs into the DetailPanel (instead of separate Dialog components). When "Add User" is clicked, open DetailPanel in "create" mode. When a row is clicked, open in "view" mode with edit button.

**Step 4:** Verify: create user, edit user, suspend, reactivate, delete — all work. Form validation shows inline errors for invalid email, missing fields, short password.

**Step 5:** Commit:
```bash
git add admin/src/pages/UsersPage.tsx
git commit -m "feat(admin): rewrite Users page with DataTable + split-view + form validation"
```

---

### Task 17: Schedules page rewrite

**Files:**
- Rewrite: `admin/src/pages/SchedulesPage.tsx`

**Step 1:** The Schedules page has 3 tabs (Flights, Airports, Charters). Apply DataTable to the Flights tab (the main one). Airports and Charters tabs can remain largely as-is but with updated styling.

**Step 2:** Flights tab: DataTable with columns for flight number, route, aircraft type, departure time, distance, flight time, days of week (badge chips), active status (toggle switch in row).

**Step 3:** Split-view detail panel shows schedule details + edit form (React Hook Form + Zod):

```ts
const scheduleSchema = z.object({
  flightNumber: z.string().min(1),
  depIcao: z.string().length(4),
  arrIcao: z.string().length(4),
  aircraftType: z.string().min(1),
  depTime: z.string(),
  arrTime: z.string(),
  distanceNm: z.number().positive(),
  flightTimeMin: z.number().positive(),
  daysOfWeek: z.string(),
  isActive: z.boolean(),
  flightType: z.enum(['cargo', 'passenger', 'mixed']),
});
```

**Step 4:** Verify: CRUD, clone, toggle active, search/filter all work.

**Step 5:** Commit:
```bash
git add admin/src/pages/SchedulesPage.tsx
git commit -m "feat(admin): rewrite Schedules page with DataTable + split-view"
```

---

### Task 18: Finances page overhaul — 4 tabs

This is the largest single task. The current page has 3 tabs; we're expanding to 4 with significantly richer functionality.

**Files:**
- Rewrite: `admin/src/pages/FinancesPage.tsx`

**Step 1: Tab 1 — Overview (new)**

```tsx
// Monthly P&L card: revenue vs expenses vs profit
// Area chart (6 months) using existing Recharts
// Stat cards: Revenue/flight-hour, Cost/block-hour, Profit margin %, Avg revenue/flight
// Uses: GET /api/admin/finances/summary + GET /api/admin/finances/route-profit
```

**Step 2: Tab 2 — Revenue (new)**

```tsx
// DataTable: Date, Flight#, Route, Aircraft, Cargo (lbs), Revenue ($), Pilot
// Uses: GET /api/admin/finances/revenue
// Split-view: click flight → detail panel with PIREP info + revenue breakdown
// Top section: Route profitability ranking (horizontal bar chart, top 10)
```

**Step 3: Tab 3 — Pilot Pay (new)**

```tsx
// DataTable: Pilot, Hours, Flights, Base Pay, Bonuses, Deductions, Net Pay
// Uses: GET /api/admin/finances/pilot-pay
// Split-view: click pilot → breakdown of each flight + manual adjustments
// Action: "Add Adjustment" button → RHF form (pilot, type=bonus|deduction, amount, description)
```

**Step 4: Tab 4 — Ledger (enhanced existing)**

```tsx
// DataTable with all existing functionality PLUS:
// - Category column (revenue, payroll, maintenance, fuel, admin)
// - Running balance column
// - "Void" action in dropdown (creates offsetting entry, doesn't delete)
// - Category filter in toolbar
// - Color-coded amounts: green positive, red negative
// - Voided entries shown with strikethrough + "VOID" badge
```

**Step 5:** Convert Add Transaction form to React Hook Form + Zod:

```ts
const transactionSchema = z.object({
  pilotId: z.number().positive(),
  type: z.enum(['pay', 'bonus', 'deduction', 'expense', 'income']),
  amount: z.number().positive('Amount must be positive'),
  description: z.string().min(1, 'Description is required'),
  category: z.enum(['revenue', 'payroll', 'maintenance', 'fuel', 'admin']),
});
```

**Step 6:** Verify: all 4 tabs render with data, forms validate, void creates reversal entry, route profitability chart shows data.

**Step 7:** Commit:
```bash
git add admin/src/pages/FinancesPage.tsx
git commit -m "feat(admin): overhaul Finances page — 4 tabs with revenue, pilot pay, ledger"
```

---

### Task 19: Maintenance page — Fleet Status + Log tabs migration

**Files:**
- Modify: `admin/src/pages/MaintenancePage.tsx`

**Step 1:** Apply DataTable to the Maintenance Log tab (tab 2). Columns: Date, Aircraft, Type (badge), Title, Performed By, Cost, Status (badge).

**Step 2:** Split-view: click log entry → detail panel with full description, edit form (RHF + Zod), complete action.

**Step 3:** Fleet Status tab (tab 1): keep the card grid layout (it's already good per the exploration) but add:
- "Last flight" date on each card
- "Put in Maintenance" button on active aircraft
- Click card → opens detail panel with aircraft summary + quick links to maintenance log

**Step 4:** Apply DataTable to Check Schedules (tab 3), ADs (tab 4), MELs (tab 5) tabs similarly.

**Step 5:** Verify: all 5 existing tabs work with new components.

**Step 6:** Commit:
```bash
git add admin/src/pages/MaintenancePage.tsx
git commit -m "feat(admin): migrate Maintenance tabs to DataTable + split-view"
```

---

### Task 20: Maintenance page — Tab 6: Component Tracking

**Files:**
- Modify: `admin/src/pages/MaintenancePage.tsx`

**Step 1:** Implement ComponentsTab:

```tsx
// DataTable grouped by aircraft: Aircraft, Component Type, Part#, Serial#, Position, Hours Since New, Hours Since Overhaul, Status
// Split-view: click component → detail panel with full info + edit form
// Actions: Add Component, Remove (set status=removed), Overhaul (reset hours_since_overhaul)
```

**Step 2:** Zod schema:

```ts
const componentSchema = z.object({
  aircraftId: z.number().positive(),
  componentType: z.enum(['engine', 'apu', 'landing_gear', 'propeller', 'avionics', 'other']),
  partNumber: z.string().optional(),
  serialNumber: z.string().optional(),
  position: z.string().min(1, 'Position is required'),
  hoursSinceNew: z.number().min(0),
  cyclesSinceNew: z.number().int().min(0),
  hoursSinceOverhaul: z.number().min(0),
  overhaulLimit: z.number().positive().optional(),
  status: z.enum(['installed', 'removed', 'overhauled', 'scrapped']),
});
```

**Step 3:** Verify: CRUD components, overhaul action resets hours, removed components show differently.

**Step 4:** Commit:
```bash
git add admin/src/pages/MaintenancePage.tsx
git commit -m "feat(admin): implement Maintenance tab 6 — Component Tracking"
```

---

### Task 21: Reports page enhancements

**Files:**
- Rewrite: `admin/src/pages/ReportsPage.tsx`

**Step 1:** Add 2 new charts:

```tsx
// Route Profitability: horizontal bar chart, top 15, green=profitable, red=unprofitable
// Uses: GET /api/admin/reports/route-profitability
// Fleet Utilization: grouped bar chart, hours per aircraft per month
// Uses: GET /api/admin/reports/fleet-utilization
```

**Step 2:** Make the global date range picker actually filter ALL charts (currently it's decorative). Each chart's fetch should include `from` and `to` params from the shared date state.

**Step 3:** Add drill-down: when clicking a bar in any chart, show a DataTable below the chart with the underlying flights. This requires adding a `drillDown` state and conditionally rendering a flight table.

**Step 4:** Add PDF export: use `window.print()` with `@media print` CSS that hides the sidebar and formats charts for print. Add a "Print Report" button alongside the existing CSV export.

**Step 5:** Verify: all 7 charts render, date filtering works across all, drill-down shows flights, PDF prints cleanly.

**Step 6:** Commit:
```bash
git add admin/src/pages/ReportsPage.tsx admin/src/styles/globals.css
git commit -m "feat(admin): enhance Reports — new charts, drill-down, date filtering, PDF export"
```

---

### Task 22: Layout overhaul — DashboardLayout, AppSidebar, TopBar

Apply the design system changes to the layout shell.

**Files:**
- Modify: `admin/src/components/layout/DashboardLayout.tsx`
- Modify: `admin/src/components/layout/AppSidebar.tsx`
- Modify: `admin/src/components/layout/TopBar.tsx`

**Step 1:** `DashboardLayout.tsx` — update content area background:
- Content area gets `bg-[#141820]` (slightly lighter than sidebar)
- Add consistent padding and overflow handling
- The full-bleed dashboard exception stays

**Step 2:** `AppSidebar.tsx` — visual polish:
- Sidebar background: `bg-[#0f1219]` (near-black, creates depth)
- Active nav item: blue left-border accent + subtle blue bg tint
- Add live badges: pending PIREPs count next to "PIREPs" nav item (fetched once on mount)
- Tighter spacing, consistent icon sizing

**Step 3:** `TopBar.tsx` — add Ctrl+K hint:
- Add a subtle "⌘K" or "Ctrl+K" button/hint in the top bar that opens the command palette
- Style: muted pill with keyboard shortcut text

**Step 4:** Verify: sidebar is darker than content, active states are clear, Ctrl+K hint is visible.

**Step 5:** Commit:
```bash
git add admin/src/components/layout/DashboardLayout.tsx admin/src/components/layout/AppSidebar.tsx admin/src/components/layout/TopBar.tsx
git commit -m "style(admin): overhaul layout shell — sidebar depth, active states, Ctrl+K hint"
```

---

## Phase 4: Polish & Integration

### Task 23: Dashboard — Restore live data

Remove mock data and reconnect to real backend API + Socket.io.

**Files:**
- Modify: `admin/src/pages/DashboardPage.tsx`

**Step 1:** Remove the mock data block (lines with `// --- MOCK DATA ---` comment). Uncomment the real API fetch, socket connection, and `useSocket` subscription.

**Step 2:** Keep all the visual components (KPI cards, panels) exactly as they are — they already accept the same data shape.

**Step 3:** Verify: dashboard loads real data from `/api/admin/dashboard`, live flights appear on map via socket.

**Step 4:** Commit:
```bash
git add admin/src/pages/DashboardPage.tsx
git commit -m "feat(admin): restore live data on dashboard, remove mock data"
```

---

### Task 24: Dispatch Board — Minor polish

**Files:**
- Modify: `admin/src/pages/DispatchBoardPage.tsx`

**Step 1:** Add cargo manifest info to the flight detail panel (if cargo data is available in the telemetry/flight data).

**Step 2:** Better visual states for connection status indicator.

**Step 3:** Verify: dispatch board still works with live flights.

**Step 4:** Commit:
```bash
git add admin/src/pages/DispatchBoardPage.tsx
git commit -m "style(admin): polish Dispatch Board — cargo info, connection states"
```

---

### Task 25: Command palette — Search integration

Wire the command palette to the real search endpoint.

**Files:**
- Modify: `admin/src/components/shared/CommandPalette.tsx`

**Step 1:** Add debounced search (300ms) that calls `GET /api/admin/search?q=<query>`.

**Step 2:** Render results grouped by category:
- **Pages** (always shown, filtered by typed text)
- **Pilots** → navigate to Users page with that user selected
- **Flights** → navigate to PIREPs page with that flight selected
- **Aircraft** → navigate to Maintenance page
- **Schedules** → navigate to Schedules page

**Step 3:** Add quick actions:
- "Approve pending PIREPs" → navigate to PIREPs page filtered to pending
- "Generate payroll" → navigate to Finances > Pilot Pay tab

**Step 4:** Verify: search works, results are clickable, navigation works.

**Step 5:** Commit:
```bash
git add admin/src/components/shared/CommandPalette.tsx
git commit -m "feat(admin): wire command palette to backend search + quick actions"
```

---

## Phase 5: QA Pass

### Task 26: Full QA — Every page, every action

Go through every page systematically and verify:

**Dashboard:**
- [ ] KPI cards show real data
- [ ] Map renders with flight markers
- [ ] Panels show operations, fleet, finance, pilots data
- [ ] Clicking map markers works

**Dispatch Board:**
- [ ] Flight list populates
- [ ] Selecting a flight shows detail panel + map trail
- [ ] ACARS chat sends/receives messages
- [ ] Connection status indicator works

**PIREPs:**
- [ ] DataTable renders with sorting, column visibility
- [ ] Status tab filtering works
- [ ] Search filters results
- [ ] Date range filtering works
- [ ] Clicking a row opens detail panel
- [ ] Approve/reject single PIREP works
- [ ] Bulk select + approve/reject works
- [ ] Pagination works

**Users:**
- [ ] DataTable renders with sorting
- [ ] Search + role/status filters work
- [ ] Create user form validates (inline errors for invalid email, short password)
- [ ] Edit user form validates
- [ ] Suspend/reactivate toggles work
- [ ] Delete user works with confirmation

**Schedules:**
- [ ] Flights tab: DataTable with all columns
- [ ] Create/edit schedule form validates (ICAO codes 4 chars, positive numbers)
- [ ] Clone schedule works
- [ ] Toggle active status works
- [ ] Airports tab still works
- [ ] Charters tab still works

**Maintenance:**
- [ ] Fleet Status cards render with correct status indicators
- [ ] Maintenance Log DataTable with filters
- [ ] Check Schedules CRUD works
- [ ] ADs CRUD works
- [ ] MELs CRUD works
- [ ] Component Tracking (new tab): CRUD, overhaul action, status changes

**Finances:**
- [ ] Overview tab: P&L summary, trend chart, ratio stat cards
- [ ] Revenue tab: flight revenue table, route profitability chart
- [ ] Pilot Pay tab: pay summary table, adjustment form
- [ ] Ledger tab: full transaction log with categories, void action, running balance

**Reports:**
- [ ] All 7 charts render
- [ ] Date range picker filters all charts
- [ ] CSV export works
- [ ] Drill-down: clicking chart bar shows flight table
- [ ] Route profitability chart shows green/red bars
- [ ] Fleet utilization chart shows hours per aircraft

**Command Palette:**
- [ ] Ctrl+K opens palette
- [ ] Typing searches across all categories
- [ ] Page navigation works
- [ ] Pilot/flight/aircraft search results navigate correctly
- [ ] Escape closes palette

**Cross-cutting:**
- [ ] All forms show inline validation errors
- [ ] All toasts render via Sonner (bottom-right, dark styling)
- [ ] Sidebar active states are correct on every page
- [ ] Content area background is lighter than sidebar
- [ ] No console errors on any page
- [ ] Logout works from any page
- [ ] Refreshing any page maintains auth state

**Step 1:** Walk through every checkbox above. Fix any issues found.

**Step 2:** Commit all fixes:
```bash
git add -A
git commit -m "fix(admin): QA pass — fix issues found across all pages"
```

---

## Summary

| Phase | Tasks | Key Deliverable |
|-------|-------|----------------|
| 1: Foundation | 1-9 | Dependencies, migrations, design system, shared components |
| 2: Backend | 10-14 | Finance auto-posting, search, reports, component CRUD |
| 3: Page Rewrites | 15-22 | All core pages on DataTable + split-view + RHF/Zod |
| 4: Polish | 23-25 | Live dashboard, dispatch polish, command palette search |
| 5: QA | 26 | Full verification of every page and action |

**Total: 26 tasks across 5 phases.**

**Dependency order:** Phase 1 → Phase 2 → Phase 3 (tasks within Phase 3 are independent of each other) → Phase 4 → Phase 5.
