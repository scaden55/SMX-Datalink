# Maintenance Aircraft Profile Tabs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build out the 3 empty tabs (MEL Deferrals, Checks, Components) on the maintenance aircraft profile page, integrate configuration that was previously in the now-unused ConfigurationTab, and move Repair Estimates into the Settings page.

**Architecture:** The aircraft profile already has 3 working tabs (Logbook, Discrepancies, ADs) as patterns. MEL Deferrals tab already exists as a system-wide component — we add an `aircraftId` prop to scope it. Checks and Components tabs are new per-aircraft views using existing backend APIs that already support `?aircraftId=X` filtering. Check schedule and MEL master configuration (previously in ConfigurationTab) get folded into their respective aircraft profile tabs. Repair Estimates move to Settings under a renamed "Maintenance Simulation" section.

**Tech Stack:** React 19, TypeScript, Zustand, Vite 6, shadcn/ui, Lucide icons, motion/react, existing admin design system tokens

---

## File Map

| Action | File | Responsibility |
|--------|------|---------------|
| Modify | `admin/src/pages/maintenance/AircraftProfile.tsx` | Import new tabs, replace TabPlaceholder |
| Modify | `admin/src/pages/maintenance/MelDeferralsTab.tsx` | Add optional `aircraftId` prop, thread to ActiveDeferralsView fetch |
| Create | `admin/src/pages/maintenance/ChecksTab.tsx` | Check status cards + history table + interval config |
| Create | `admin/src/pages/maintenance/ComponentsTab.tsx` | Per-aircraft component CRUD table |
| Modify | `admin/src/pages/SettingsPage.tsx` | Rename Simulation → Maintenance Simulation, embed RepairEstimatesSection |

---

### Task 1: Wire MEL Deferrals Tab into Aircraft Profile

The `MelDeferralsTab` component exists but takes no props. We need to add an optional `aircraftId` prop so it filters to a single aircraft when used from the profile, while still working system-wide when used without it.

**Files:**
- Modify: `admin/src/pages/maintenance/MelDeferralsTab.tsx`
- Modify: `admin/src/pages/maintenance/AircraftProfile.tsx`

- [ ] **Step 1: Add `aircraftId` prop to MelDeferralsTab**

In `MelDeferralsTab.tsx`, change the export signature and thread the prop:

```tsx
// Line ~1311: Change from
export function MelDeferralsTab() {
// To
export function MelDeferralsTab({ aircraftId }: { aircraftId?: number } = {}) {
```

Then pass `aircraftId` to `ActiveDeferralsView`:

```tsx
// Line ~1411: Change from
{view === 'deferrals' && <ActiveDeferralsView refreshKey={refreshKey} />}
// To
{view === 'deferrals' && <ActiveDeferralsView refreshKey={refreshKey} aircraftId={aircraftId} />}
```

- [ ] **Step 2: Thread `aircraftId` into ActiveDeferralsView's fetch**

In `ActiveDeferralsView` (~line 486), add the prop and include it in the API query:

```tsx
// Change from
function ActiveDeferralsView({ refreshKey }: { refreshKey: number }) {
// To
function ActiveDeferralsView({ refreshKey, aircraftId }: { refreshKey: number; aircraftId?: number }) {
```

In `fetchDeferrals` (~line 496), add:

```tsx
if (aircraftId) params.set('aircraftId', aircraftId.toString());
```

right after `params.set('pageSize', ...)` and add `aircraftId` to the `useCallback` dependency array.

- [ ] **Step 3: Also pass `aircraftId` to MelMasterListView for type-scoped master**

The `MelMasterListView` needs to know the aircraft's ICAO type to filter the master list. We'll pass `aircraftId` context through. First, find the `MelMasterListView` component and check if it accepts props. If it uses a fleet dropdown for aircraft type selection, when `aircraftId` is provided we can pre-filter.

For now, pass `aircraftId` to allow future scoping:

```tsx
// Line ~1412: Change from
{view === 'master' && <MelMasterListView />}
// To
{view === 'master' && <MelMasterListView aircraftId={aircraftId} />}
```

Update `MelMasterListView` signature similarly. If it currently fetches all aircraft types, when `aircraftId` is provided, it should auto-select that aircraft's type from the fleet data (the fleet-status endpoint returns `icaoType` per aircraft).

- [ ] **Step 4: Import and wire into AircraftProfile**

In `AircraftProfile.tsx`, add the import:

```tsx
import { MelDeferralsTab } from './MelDeferralsTab';
```

Replace the MEL placeholder (~line 276-277):

```tsx
// From
{activeTab === 'mel' && (
  <TabPlaceholder tab="MEL Deferrals" aircraftId={aircraftId} />
)}
// To
{activeTab === 'mel' && (
  <MelDeferralsTab aircraftId={aircraftId} />
)}
```

- [ ] **Step 5: Verify in browser**

Run: `npm run dev:all`
Navigate to admin panel → Maintenance → click any aircraft → MEL Deferrals tab.
Expected: Shows deferrals filtered to that aircraft. Stats row shows system-wide counts (the `/mel/stats` endpoint does not support per-aircraft filtering — this is acceptable, the stats provide useful context). MEL Master sub-view shows the master list with that aircraft's type pre-selected if `aircraftId` was threaded through.

- [ ] **Step 6: Commit**

```bash
git add admin/src/pages/maintenance/MelDeferralsTab.tsx admin/src/pages/maintenance/AircraftProfile.tsx
git commit -m "feat(admin): wire MEL Deferrals tab into aircraft profile with aircraftId filtering"
```

---

### Task 2: Build Checks Tab

New component showing check status overview (A/B/C/D cards with progress bars) and a completed checks history table. Includes an "Edit Intervals" section for configuring check schedules for that aircraft's ICAO type.

**Files:**
- Create: `admin/src/pages/maintenance/ChecksTab.tsx`
- Modify: `admin/src/pages/maintenance/AircraftProfile.tsx`

**Data sources:**
- `GET /api/admin/maintenance/fleet-status` → find aircraft by ID → `checksDue[]` array of `CheckDueStatus` objects (has `checkType`, `dueAtHours`, `remainingHours`, `remainingCycles`, `isOverdue`, `isInOverflight`, `overflightPct`, `currentHours`)
- `GET /api/admin/maintenance/log?aircraftId=X&page=1&pageSize=25` → maintenance log entries (filter client-side to check types A/B/C/D)
- `GET /api/admin/maintenance/check-schedules` → for the "Edit Intervals" config section
- `PATCH /api/admin/maintenance/check-schedules/:id` → update intervals
- `POST /api/admin/maintenance/check-schedules` → create new schedule

- [ ] **Step 1: Create ChecksTab.tsx with types and constants**

Create `admin/src/pages/maintenance/ChecksTab.tsx`. Define:

```tsx
interface ChecksTabProps {
  aircraftId: number;
  icaoType: string;  // needed for check schedule config
}

// Re-use CheckDueStatus shape from fleet-status response
interface CheckDueStatus {
  checkType: 'A' | 'B' | 'C' | 'D';
  dueAtHours: number | null;
  dueAtCycles: number | null;
  dueAtDate: string | null;
  currentHours: number;
  currentCycles: number;
  isOverdue: boolean;
  isInOverflight: boolean;
  remainingHours: number | null;
  remainingCycles: number | null;
  overflightPct: number;
}

interface MaintenanceLogEntry {
  id: number;
  aircraftId: number;
  checkType: string;
  title: string;
  description: string | null;
  performedBy: string | null;
  performedAt: string | null;
  hoursAtCheck: number | null;
  cyclesAtCheck: number | null;
  cost: number | null;
  status: string;
}

interface CheckSchedule {
  id: number;
  icaoType: string;
  checkType: 'A' | 'B' | 'C' | 'D';
  intervalHours: number | null;
  intervalCycles: number | null;
  intervalMonths: number | null;
  overflightPct: number;
  estimatedDurationHours: number | null;
  description: string | null;
}
```

Badge colors for check types (match existing pattern from `CheckSchedulesSection.tsx`):

```tsx
const CHECK_COLORS: Record<string, { bg: string; text: string; bar: string }> = {
  A: { bg: 'var(--accent-blue-bg)', text: 'var(--accent-blue-bright)', bar: 'var(--accent-blue)' },
  B: { bg: 'var(--accent-emerald-bg)', text: 'var(--accent-emerald)', bar: 'var(--accent-emerald)' },
  C: { bg: 'var(--accent-amber-bg)', text: 'var(--accent-amber)', bar: 'var(--accent-amber)' },
  D: { bg: 'var(--accent-cyan-bg)', text: 'var(--accent-cyan)', bar: 'var(--accent-cyan)' },
};
```

- [ ] **Step 2: Build CheckStatusCard component**

A card for each check type showing:
- Check type badge (e.g. "A Check")
- Interval info (e.g. "every 600h")
- Remaining hours/cycles in monospace
- Horizontal progress bar: full width = interval, filled portion = hours used since last check. Color transitions: green (>20% remaining) → amber (5-20%) → red (<5% or overdue)
- Last performed date
- "Not configured" muted state when no schedule exists for that type

```tsx
function CheckStatusCard({ check, schedule }: { check: CheckDueStatus | null; schedule: CheckSchedule | null }) {
  // If no schedule configured for this type, show muted card
  // Progress = 1 - (remainingHours / intervalHours), clamped 0-1
  // Color: overdue → red, inOverflight → amber, else → check type color
}
```

Layout: 4 cards in a flex row with `gap: 12`, `padding: '16px 24px'`, matching the StatCard pattern from MelDeferralsTab.

- [ ] **Step 3: Build ChecksHistory table**

Table showing maintenance log entries filtered to check types (A/B/C/D). Follows AdsTab table pattern:

Columns: Type (badge), Title, Performed, Hours, Cycles, Cost, Status (badge)

- Fetch: `GET /api/admin/maintenance/log?aircraftId={aircraftId}&page={page}&pageSize=25` → response shape: `{ entries: MaintenanceLogEntry[], total: number, page: number, pageSize: number }`
- Client-side filter: only show entries where `checkType` is A, B, C, or D
- Pagination footer matching existing pattern (prev/next buttons, "X–Y of Z" label)
- Row hover state via `hoveredId` pattern
- Sort by `performedAt` descending (API returns this order)

Status badge colors:
```tsx
const LOG_STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  scheduled: { bg: 'var(--accent-blue-bg)', text: 'var(--accent-blue-bright)' },
  in_progress: { bg: 'var(--accent-amber-bg)', text: 'var(--accent-amber)' },
  completed: { bg: 'var(--accent-emerald-bg)', text: 'var(--accent-emerald)' },
  deferred: { bg: 'var(--accent-cyan-bg)', text: 'var(--accent-cyan)' },
};
```

- [ ] **Step 4: Build CheckIntervalsConfig section**

An inline config area toggled by a "Configure Intervals" button (Settings icon from Lucide). When open, shows an editable card for each A/B/C/D check for the aircraft's ICAO type.

Each card has inline-editable fields: interval hours, interval cycles, interval months, overflight %, estimated duration. Save button per card. Uses existing `PATCH /api/admin/maintenance/check-schedules/:id` and `POST /api/admin/maintenance/check-schedules` endpoints.

Show a note: "These intervals apply to all {icaoType} aircraft."

- [ ] **Step 5: Compose ChecksTab export**

```tsx
export function ChecksTab({ aircraftId, icaoType }: ChecksTabProps) {
  // Fetch fleet-status to get checksDue for this aircraft
  // Fetch check-schedules filtered by icaoType
  // Fetch maintenance log for history

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Check Status Cards row */}
      {/* Configure Intervals toggle */}
      {/* Checks History table */}
    </div>
  );
}
```

- [ ] **Step 6: Wire into AircraftProfile**

Import `ChecksTab` and replace the placeholder. Note: we need to pass `icaoType` which is on the `aircraft` object:

```tsx
import { ChecksTab } from './ChecksTab';

// Replace line 279-280:
{activeTab === 'checks' && (
  <ChecksTab aircraftId={aircraftId} icaoType={aircraft.icaoType} />
)}
```

- [ ] **Step 7: Verify in browser**

Navigate to admin → Maintenance → click aircraft → Checks tab.
Expected: 4 status cards showing A/B/C/D check status with progress bars. History table below shows completed checks. "Configure Intervals" toggle opens inline editor.

- [ ] **Step 8: Commit**

```bash
git add admin/src/pages/maintenance/ChecksTab.tsx admin/src/pages/maintenance/AircraftProfile.tsx
git commit -m "feat(admin): build Checks tab with status cards, history, and interval config"
```

---

### Task 3: Build Components Tab

Per-aircraft component CRUD table. Adapts the existing `ComponentsSection` pattern but scoped to a single aircraft (no aircraft dropdown filter needed).

**Files:**
- Create: `admin/src/pages/maintenance/ComponentsTab.tsx`
- Modify: `admin/src/pages/maintenance/AircraftProfile.tsx`

**Data sources:**
- `GET /api/admin/maintenance/components?aircraftId=X` → `{ components: AircraftComponent[] }`
- `POST /api/admin/maintenance/components` → create (body includes `aircraftId`)
- `PATCH /api/admin/maintenance/components/:id` → update
- `POST /api/admin/maintenance/components/:id/overhaul` → reset overhaul hours/cycles
- `DELETE /api/admin/maintenance/components/:id` → delete

- [ ] **Step 1: Create ComponentsTab.tsx with types and constants**

Create `admin/src/pages/maintenance/ComponentsTab.tsx`. Types follow the existing `ComponentsSection.tsx` local conventions (note: admin frontend uses `installDate`/`notes` while shared types use `installedDate`/`remarks` — follow the admin convention since the API camelCase mapping already handles this):

```tsx
interface ComponentsTabProps {
  aircraftId: number;
}

interface AircraftComponent {
  id: number;
  aircraftId: number;
  registration?: string;
  componentType: ComponentType;
  partNumber: string;
  serialNumber: string;
  position: string | null;
  hoursSinceNew: number | null;
  cyclesSinceNew: number | null;
  hoursSinceOverhaul: number | null;
  cyclesSinceOverhaul: number | null;
  overhaulIntervalHours: number | null;
  status: ComponentStatus;
  installDate: string | null;
  notes: string | null;
}

type ComponentType = 'ENGINE' | 'APU' | 'LANDING_GEAR' | 'PROP' | 'AVIONICS' | 'OTHER';
type ComponentStatus = 'installed' | 'removed' | 'in_shop' | 'scrapped';
```

Reuse same badge colors, labels, and helpers as `ComponentsSection.tsx` (TypeBadge, StatusBadge, TYPE_BADGE_COLORS, STATUS_BADGE_COLORS, TYPE_LABELS, STATUS_LABELS).

- [ ] **Step 2: Build filter bar and table**

Filter bar: type dropdown + status dropdown + "Add Component" button (no aircraft dropdown — we're already scoped).

Table columns (matching ComponentsSection): Type badge, Position, Part #, Serial #, Hrs Since New, Cyc Since New, Hrs Since Overhaul, Overhaul Int., Status badge, Actions (edit/overhaul/delete).

For overhaul progress: if `overhaulIntervalHours` is set and `hoursSinceOverhaul` is not null, show a small inline bar under the hours value. Color logic: `>80%` of interval = amber, `>95%` = red.

- [ ] **Step 3: Build Create/Edit dialog**

Dialog with fields: Component Type (select), Position (text), Part Number (text), Serial Number (text), Hours Since New (number), Cycles Since New (number), Hours Since Overhaul (number), Cycles Since Overhaul (number), Overhaul Interval Hours (number), Status (select), Install Date (date input), Notes (textarea).

On create: `POST /api/admin/maintenance/components` with `aircraftId` included.
On edit: `PATCH /api/admin/maintenance/components/:id`.

Follow the existing Dialog pattern from AdsTab/ComponentsSection (shadcn Dialog, Label, Input, Select components).

- [ ] **Step 4: Build Overhaul Reset action and Delete confirmation**

Overhaul Reset: in the actions dropdown, "Reset Overhaul" triggers `POST /api/admin/maintenance/components/:id/overhaul`. Show a confirmation dialog first: "Reset overhaul counters for {partNumber}? This records a shop visit and zeroes hours/cycles since overhaul."

Delete: standard confirmation dialog matching ComponentsSection pattern.

- [ ] **Step 5: Build pagination and empty state**

Same pagination pattern as other tabs (25 per page). Empty state: "No components found. Add a component to get started."

Client-side filtering and pagination (the API returns all components for the aircraft at once — no server pagination for components).

- [ ] **Step 6: Compose and export ComponentsTab**

```tsx
export function ComponentsTab({ aircraftId }: ComponentsTabProps) {
  // State: items, filters, pagination, dialogs
  // Fetch components on mount and after CRUD operations
  // Render: filter bar → table → pagination → dialogs
}
```

- [ ] **Step 7: Wire into AircraftProfile**

```tsx
import { ComponentsTab } from './ComponentsTab';

// Replace line 285-286:
{activeTab === 'components' && (
  <ComponentsTab aircraftId={aircraftId} />
)}
```

- [ ] **Step 8: Verify in browser**

Navigate to admin → Maintenance → click aircraft → Components tab.
Expected: Components table filtered to that aircraft. Can add/edit/delete/overhaul-reset. Filters work.

- [ ] **Step 9: Commit**

```bash
git add admin/src/pages/maintenance/ComponentsTab.tsx admin/src/pages/maintenance/AircraftProfile.tsx
git commit -m "feat(admin): build Components tab with per-aircraft CRUD and overhaul tracking"
```

---

### Task 4: Move Repair Estimates to Settings Page

Rename the "Simulation" settings section to "Maintenance Simulation" and embed the `RepairEstimatesSection` component below the existing timer speed field.

**Files:**
- Modify: `admin/src/pages/SettingsPage.tsx`

**Context:** Repair estimates are not actual aircraft maintenance — they're admin-configured values that simulate shop repair bills for immersion. This belongs in Settings, not on the aircraft profile.

- [ ] **Step 1: Rename section and add summary text**

In `SettingsPage.tsx`, find the `simulation` section definition (~line 138-155) and update:

```tsx
{
  id: 'simulation',
  title: 'Maintenance Simulation',
  summary: 'Timer speed, repair cost estimates',
  icon: Timer,
  fields: [
    // existing maintenance_timer_speed field stays
  ],
}
```

- [ ] **Step 2: Import RepairEstimatesSection**

```tsx
import { RepairEstimatesSection } from './maintenance/RepairEstimatesSection';
```

- [ ] **Step 3: Embed RepairEstimatesSection in the simulation accordion**

The `AccordionSection` component (defined in SettingsPage.tsx ~line 190) renders section fields in its expanded body. To embed `RepairEstimatesSection` below the fields grid, add an optional `extraContent` prop to `AccordionSection`:

```tsx
// In AccordionSectionProps interface (~line 181), add:
extraContent?: React.ReactNode;

// In AccordionSection function signature (~line 190), destructure it:
function AccordionSection({ section, expanded, onToggle, values, localValues, onFieldChange, extraContent }: AccordionSectionProps) {
```

Then render `extraContent` after the fields grid div closes (~line 357, after the `</div>` that closes the fields grid):

```tsx
          </div>
          {/* ↑ end of fields grid */}
          {extraContent}
        </div>
```

In the main render where `AccordionSection` is mapped (~line where SECTIONS are iterated), pass `extraContent` for the simulation section:

```tsx
<AccordionSection
  key={section.id}
  section={section}
  expanded={...}
  onToggle={...}
  values={values}
  localValues={localValues}
  onFieldChange={handleFieldChange}
  extraContent={section.id === 'simulation' ? (
    <div style={{ marginTop: 16, borderTop: '1px solid var(--border-primary)', paddingTop: 16 }}>
      <div className="text-subheading" style={{ marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        Repair Cost Estimates
      </div>
      <div className="text-caption" style={{ color: 'var(--text-tertiary)', marginBottom: 12 }}>
        Configure simulated repair costs per ATA chapter. These values appear on work order invoices for immersion.
      </div>
      <RepairEstimatesSection refreshKey={0} />
    </div>
  ) : undefined}
/>
```

`RepairEstimatesSection` takes `{ refreshKey: number }` — pass `0` since it manages its own fetch cycle internally.

- [ ] **Step 4: Verify in browser**

Navigate to admin → Settings → expand "Maintenance Simulation".
Expected: Timer speed field at top. Below it, separated by a border, the "Repair Cost Estimates" section with the inline-editable ATA chapter table.

- [ ] **Step 5: Commit**

```bash
git add admin/src/pages/SettingsPage.tsx
git commit -m "feat(admin): move Repair Estimates into Settings under Maintenance Simulation"
```

---

### Task 5: Clean Up and Remove TabPlaceholder

After all 3 tabs are wired, remove the `TabPlaceholder` component from `AircraftProfile.tsx` since it's no longer used.

**Files:**
- Modify: `admin/src/pages/maintenance/AircraftProfile.tsx`

- [ ] **Step 1: Remove TabPlaceholder function**

Delete the `TabPlaceholder` component (~lines 295-307) from `AircraftProfile.tsx`.

- [ ] **Step 2: Verify no remaining references**

Search for `TabPlaceholder` in the file — there should be none after tasks 1-3 replaced all 3 usages.

- [ ] **Step 3: Verify full profile works**

Navigate through all 6 tabs on an aircraft profile: Logbook, Discrepancies, MEL Deferrals, Checks, ADs, Components. All should render without errors.

- [ ] **Step 4: Commit**

```bash
git add admin/src/pages/maintenance/AircraftProfile.tsx
git commit -m "chore(admin): remove unused TabPlaceholder from aircraft profile"
```
