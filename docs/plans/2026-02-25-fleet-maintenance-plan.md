# Fleet Maintenance Tracking — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add full fleet maintenance lifecycle tracking to the admin panel — A/B/C/D checks, ADs, MEL deferrals, component tracking, and operational enforcement.

**Architecture:** 6 new DB tables via SQLite migrations. Single service class handles all maintenance business logic. One Express route file with ~25 endpoints. Tabbed React page with 6 tabs following existing AdminFinancesPage patterns. PIREP approval hook for auto hour accumulation.

**Tech Stack:** SQLite (better-sqlite3), Express 4, React 19, Zustand, Tailwind CSS, shadcn/ui patterns, TypeScript throughout.

**Design Doc:** `docs/plans/2026-02-25-fleet-maintenance-design.md`

---

## Task 1: Database Migration — Create Tables

**Files:**
- Create: `backend/src/db/migrations/025-maintenance.sql`

**Step 1: Write migration SQL**

```sql
-- 025-maintenance.sql: Fleet maintenance tracking tables

-- Aircraft cumulative hours/cycles (one row per aircraft)
CREATE TABLE IF NOT EXISTS aircraft_hours (
  aircraft_id       INTEGER PRIMARY KEY REFERENCES fleet(id) ON DELETE CASCADE,
  total_hours       REAL    NOT NULL DEFAULT 0,
  total_cycles      INTEGER NOT NULL DEFAULT 0,
  hours_at_last_a   REAL    DEFAULT 0,
  hours_at_last_b   REAL    DEFAULT 0,
  hours_at_last_c   REAL    DEFAULT 0,
  cycles_at_last_c  INTEGER DEFAULT 0,
  last_d_check_date TEXT,
  updated_at        TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- Check interval definitions per aircraft type
CREATE TABLE IF NOT EXISTS maintenance_checks (
  id                       INTEGER PRIMARY KEY AUTOINCREMENT,
  icao_type                TEXT    NOT NULL,
  check_type               TEXT    NOT NULL CHECK(check_type IN ('A','B','C','D')),
  interval_hours           REAL,
  interval_cycles          INTEGER,
  interval_months          INTEGER,
  overflight_pct           REAL    NOT NULL DEFAULT 0,
  estimated_duration_hours INTEGER,
  description              TEXT,
  UNIQUE(icao_type, check_type)
);

CREATE INDEX IF NOT EXISTS idx_maint_checks_type ON maintenance_checks(icao_type);

-- Maintenance log entries
CREATE TABLE IF NOT EXISTS maintenance_log (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  aircraft_id     INTEGER NOT NULL REFERENCES fleet(id) ON DELETE CASCADE,
  check_type      TEXT    NOT NULL CHECK(check_type IN ('A','B','C','D','LINE','UNSCHEDULED','AD','MEL','SFP')),
  title           TEXT    NOT NULL,
  description     TEXT,
  performed_by    TEXT,
  performed_at    TEXT,
  hours_at_check  REAL,
  cycles_at_check INTEGER,
  cost            REAL,
  status          TEXT    NOT NULL DEFAULT 'scheduled' CHECK(status IN ('scheduled','in_progress','completed','deferred')),
  sfp_destination TEXT,
  sfp_expiry      TEXT,
  created_by      INTEGER REFERENCES users(id),
  created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_maint_log_aircraft ON maintenance_log(aircraft_id);
CREATE INDEX IF NOT EXISTS idx_maint_log_status   ON maintenance_log(status);
CREATE INDEX IF NOT EXISTS idx_maint_log_type     ON maintenance_log(check_type);

-- Airworthiness Directives
CREATE TABLE IF NOT EXISTS airworthiness_directives (
  id                       INTEGER PRIMARY KEY AUTOINCREMENT,
  aircraft_id              INTEGER NOT NULL REFERENCES fleet(id) ON DELETE CASCADE,
  ad_number                TEXT    NOT NULL,
  title                    TEXT    NOT NULL,
  description              TEXT,
  compliance_status        TEXT    NOT NULL DEFAULT 'open' CHECK(compliance_status IN ('open','complied','recurring','not_applicable')),
  compliance_date          TEXT,
  compliance_method        TEXT,
  recurring_interval_hours REAL,
  next_due_hours           REAL,
  next_due_date            TEXT,
  created_by               INTEGER REFERENCES users(id),
  created_at               TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at               TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_ad_aircraft ON airworthiness_directives(aircraft_id);
CREATE INDEX IF NOT EXISTS idx_ad_status   ON airworthiness_directives(compliance_status);

-- MEL Deferrals
CREATE TABLE IF NOT EXISTS mel_deferrals (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  aircraft_id     INTEGER NOT NULL REFERENCES fleet(id) ON DELETE CASCADE,
  item_number     TEXT    NOT NULL,
  title           TEXT    NOT NULL,
  category        TEXT    NOT NULL CHECK(category IN ('A','B','C','D')),
  deferral_date   TEXT    NOT NULL,
  expiry_date     TEXT    NOT NULL,
  rectified_date  TEXT,
  status          TEXT    NOT NULL DEFAULT 'open' CHECK(status IN ('open','rectified','expired')),
  remarks         TEXT,
  created_by      INTEGER REFERENCES users(id),
  created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_mel_aircraft ON mel_deferrals(aircraft_id);
CREATE INDEX IF NOT EXISTS idx_mel_status   ON mel_deferrals(status);

-- Aircraft Components (engines, APU, landing gear, etc.)
CREATE TABLE IF NOT EXISTS aircraft_components (
  id                       INTEGER PRIMARY KEY AUTOINCREMENT,
  aircraft_id              INTEGER NOT NULL REFERENCES fleet(id) ON DELETE CASCADE,
  component_type           TEXT    NOT NULL CHECK(component_type IN ('ENGINE','APU','LANDING_GEAR','PROP','AVIONICS','OTHER')),
  position                 TEXT,
  serial_number            TEXT,
  part_number              TEXT,
  hours_since_new          REAL    NOT NULL DEFAULT 0,
  cycles_since_new         INTEGER NOT NULL DEFAULT 0,
  hours_since_overhaul     REAL    NOT NULL DEFAULT 0,
  cycles_since_overhaul    INTEGER NOT NULL DEFAULT 0,
  overhaul_interval_hours  REAL,
  installed_date           TEXT,
  status                   TEXT    NOT NULL DEFAULT 'installed' CHECK(status IN ('installed','removed','in_shop','scrapped')),
  remarks                  TEXT,
  created_at               TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at               TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_comp_aircraft ON aircraft_components(aircraft_id);
CREATE INDEX IF NOT EXISTS idx_comp_status   ON aircraft_components(status);
```

**Step 2: Verify migration loads**

Run: `cd backend && npm run build && node -e "require('./dist/db/database.js')"`
Expected: No errors, tables created.

**Step 3: Commit**

```bash
git add backend/src/db/migrations/025-maintenance.sql
git commit -m "feat(db): add maintenance tracking tables (migration 025)

Six tables: aircraft_hours, maintenance_checks, maintenance_log,
airworthiness_directives, mel_deferrals, aircraft_components"
```

---

## Task 2: Shared Types

**Files:**
- Create: `shared/src/types/maintenance.ts`
- Modify: `shared/src/index.ts` (add exports)

**Step 1: Create shared maintenance types**

Create `shared/src/types/maintenance.ts` with all request/response types:

- `MaintenanceCheckType` = `'A' | 'B' | 'C' | 'D'`
- `MaintenanceLogType` = `'A' | 'B' | 'C' | 'D' | 'LINE' | 'UNSCHEDULED' | 'AD' | 'MEL' | 'SFP'`
- `MaintenanceLogStatus` = `'scheduled' | 'in_progress' | 'completed' | 'deferred'`
- `ADComplianceStatus` = `'open' | 'complied' | 'recurring' | 'not_applicable'`
- `MELCategory` = `'A' | 'B' | 'C' | 'D'`
- `MELStatus` = `'open' | 'rectified' | 'expired'`
- `ComponentType` = `'ENGINE' | 'APU' | 'LANDING_GEAR' | 'PROP' | 'AVIONICS' | 'OTHER'`
- `ComponentStatus` = `'installed' | 'removed' | 'in_shop' | 'scrapped'`
- `AircraftHours` interface (matches DB row, camelCase)
- `MaintenanceCheckSchedule` interface
- `MaintenanceLogEntry` interface
- `AirworthinessDirective` interface
- `MELDeferral` interface
- `AircraftComponent` interface
- `FleetMaintenanceStatus` interface (joined view: aircraft + hours + next-due checks + overdue flags)
- `CheckDueStatus` interface (`{ checkType, dueAtHours, dueAtCycles, dueAtDate, currentHours, currentCycles, isOverdue, isInOverflight, remainingHours, remainingCycles }`)
- Create/Update request types for each resource
- `AdjustHoursRequest` = `{ totalHours?: number, totalCycles?: number, reason: string }`

**Step 2: Export from barrel**

Add to `shared/src/index.ts`:
```typescript
// Maintenance
export type { AircraftHours, MaintenanceCheckSchedule, MaintenanceLogEntry, ... } from './types/maintenance.js';
export type { MaintenanceCheckType, MaintenanceLogType, ... } from './types/maintenance.js';
```

**Step 3: Build shared**

Run: `cd shared && npx tsc`
Expected: Clean compile, no errors.

**Step 4: Commit**

```bash
git add shared/src/types/maintenance.ts shared/src/index.ts
git commit -m "feat(shared): add maintenance tracking types"
```

---

## Task 3: Backend DB Row Types

**Files:**
- Modify: `backend/src/types/db-rows.ts`

**Step 1: Add maintenance DB row interfaces**

Add to `backend/src/types/db-rows.ts`:

- `AircraftHoursRow` — matches `aircraft_hours` table columns (snake_case)
- `MaintenanceCheckRow` — matches `maintenance_checks` table
- `MaintenanceLogRow` — matches `maintenance_log` table
- `AirworthinessDirectiveRow` — matches `airworthiness_directives` table
- `MELDeferralRow` — matches `mel_deferrals` table
- `AircraftComponentRow` — matches `aircraft_components` table
- `FleetMaintenanceStatusRow` — joined query result: fleet + aircraft_hours columns

**Step 2: Commit**

```bash
git add backend/src/types/db-rows.ts
git commit -m "feat(backend): add maintenance DB row type interfaces"
```

---

## Task 4: Maintenance Service — Core CRUD

**Files:**
- Create: `backend/src/services/maintenance.ts`

**Step 1: Create service with fleet status and check-due logic**

Follow `UserAdminService` patterns from `backend/src/services/user-admin.ts`:

```typescript
export class MaintenanceService {
  // ─── Fleet Status ───
  getFleetStatus(): FleetMaintenanceStatus[]
  // Joins fleet + aircraft_hours + maintenance_checks
  // Computes next-due for each check type
  // Flags overdue (with overflight tolerance for A/B, hard limit for C/D)

  getAircraftStatus(aircraftId: number): FleetMaintenanceStatus | undefined

  adjustHours(aircraftId: number, data: AdjustHoursRequest, actorId: number): AircraftHours | undefined
  // Updates aircraft_hours, audit logs the reason

  ensureAircraftHours(aircraftId: number): void
  // Creates aircraft_hours row with zeros if not exists (upsert)

  // ─── Check Due Calculation ───
  computeChecksDue(hours: AircraftHoursRow, checks: MaintenanceCheckRow[]): CheckDueStatus[]
  // Pure function: given current hours and check intervals, compute due status
  // A/B: overdue only after overflight_pct exceeded
  // C/D: overdue immediately when interval reached

  checkAndGroundAircraft(aircraftId: number): void
  // Called after PIREP approval or manual hour adjust
  // If any check overdue OR AD past due OR MEL expired → fleet.status = 'maintenance'

  returnToService(aircraftId: number, actorId: number): boolean
  // Verify no outstanding items, set fleet.status = 'active'

  // ─── Maintenance Log CRUD ───
  findAllLog(filters, page, pageSize): { entries: MaintenanceLogEntry[], total: number }
  createLog(data, actorId): MaintenanceLogEntry
  updateLog(id, data, actorId): MaintenanceLogEntry | undefined
  completeCheck(id, actorId): MaintenanceLogEntry | undefined
  // Marks completed, updates aircraft_hours snapshot (hours_at_last_a, etc.)
  // Calls returnToService check
  deleteLog(id, actorId): boolean

  // ─── Check Schedules CRUD ───
  findAllCheckSchedules(): MaintenanceCheckSchedule[]
  createCheckSchedule(data, actorId): MaintenanceCheckSchedule
  updateCheckSchedule(id, data, actorId): MaintenanceCheckSchedule | undefined
  deleteCheckSchedule(id, actorId): boolean

  // ─── Airworthiness Directives CRUD ───
  findAllADs(filters, page, pageSize): { directives: AirworthinessDirective[], total: number }
  createAD(data, actorId): AirworthinessDirective
  updateAD(id, data, actorId): AirworthinessDirective | undefined
  deleteAD(id, actorId): boolean

  // ─── MEL Deferrals CRUD ───
  findAllMEL(filters, page, pageSize): { deferrals: MELDeferral[], total: number }
  createMEL(data, actorId): MELDeferral
  updateMEL(id, data, actorId): MELDeferral | undefined
  deleteMEL(id, actorId): boolean

  // ─── Components CRUD ───
  findAllComponents(filters): AircraftComponent[]
  createComponent(data, actorId): AircraftComponent
  updateComponent(id, data, actorId): AircraftComponent | undefined
  deleteComponent(id, actorId): boolean

  // ─── PIREP Hook ───
  accumulateFlightHours(aircraftRegistration: string, flightTimeMin: number): void
  // Looks up fleet by registration
  // Upserts aircraft_hours
  // Adds hours + 1 cycle
  // Updates installed component hours/cycles
  // Calls checkAndGroundAircraft
}
```

Key implementation details:
- Use `getDb()` from `../db/database.js`
- Use `logger` from `../lib/logger.js` (tag: `'Maintenance'`)
- Use `auditService.log()` for all mutations
- Use `db.transaction()` for multi-table operations
- Row-to-DTO converters: private methods like `private toLogEntry(row: MaintenanceLogRow): MaintenanceLogEntry`
- Pagination: same pattern as `UserAdminService.findAll()` (COUNT + LIMIT/OFFSET)

**Step 2: Verify build**

Run: `cd backend && npm run build`
Expected: Clean compile.

**Step 3: Commit**

```bash
git add backend/src/services/maintenance.ts
git commit -m "feat(backend): add MaintenanceService with full CRUD and check-due logic"
```

---

## Task 5: Backend Routes

**Files:**
- Create: `backend/src/routes/admin-maintenance.ts`
- Modify: `backend/src/index.ts` (register route)

**Step 1: Create route file**

Follow pattern from `backend/src/routes/admin-pireps.ts`:

```typescript
import { Router } from 'express';
import { authMiddleware, adminMiddleware } from '../middleware/auth.js';
import { MaintenanceService } from '../services/maintenance.js';
import { logger } from '../lib/logger.js';

export function adminMaintenanceRouter(): Router {
  const router = Router();
  const service = new MaintenanceService();

  // Fleet Status
  router.get('/admin/maintenance/fleet-status', authMiddleware, adminMiddleware, (req, res) => { ... });
  router.patch('/admin/maintenance/aircraft/:id/hours', authMiddleware, adminMiddleware, (req, res) => { ... });

  // Maintenance Log (6 endpoints)
  router.get('/admin/maintenance/log', authMiddleware, adminMiddleware, (req, res) => { ... });
  router.get('/admin/maintenance/log/:id', authMiddleware, adminMiddleware, (req, res) => { ... });
  router.post('/admin/maintenance/log', authMiddleware, adminMiddleware, (req, res) => { ... });
  router.patch('/admin/maintenance/log/:id', authMiddleware, adminMiddleware, (req, res) => { ... });
  router.post('/admin/maintenance/log/:id/complete', authMiddleware, adminMiddleware, (req, res) => { ... });
  router.delete('/admin/maintenance/log/:id', authMiddleware, adminMiddleware, (req, res) => { ... });

  // Check Schedules (4 endpoints)
  router.get('/admin/maintenance/check-schedules', ...);
  router.post('/admin/maintenance/check-schedules', ...);
  router.patch('/admin/maintenance/check-schedules/:id', ...);
  router.delete('/admin/maintenance/check-schedules/:id', ...);

  // Airworthiness Directives (4 endpoints)
  router.get('/admin/maintenance/ads', ...);
  router.post('/admin/maintenance/ads', ...);
  router.patch('/admin/maintenance/ads/:id', ...);
  router.delete('/admin/maintenance/ads/:id', ...);

  // MEL Deferrals (4 endpoints)
  router.get('/admin/maintenance/mel', ...);
  router.post('/admin/maintenance/mel', ...);
  router.patch('/admin/maintenance/mel/:id', ...);
  router.delete('/admin/maintenance/mel/:id', ...);

  // Components (4 endpoints)
  router.get('/admin/maintenance/components', ...);
  router.post('/admin/maintenance/components', ...);
  router.patch('/admin/maintenance/components/:id', ...);
  router.delete('/admin/maintenance/components/:id', ...);

  // Return to service
  router.post('/admin/maintenance/aircraft/:id/return-to-service', authMiddleware, adminMiddleware, (req, res) => { ... });

  return router;
}
```

Each handler follows: try/catch → parse params/body → validate → call service → respond with JSON/status.

**Step 2: Register in backend/src/index.ts**

Add import and `app.use('/api', adminMaintenanceRouter());` alongside other admin routes (around line 131).

**Step 3: Verify build**

Run: `cd backend && npm run build`
Expected: Clean compile.

**Step 4: Commit**

```bash
git add backend/src/routes/admin-maintenance.ts backend/src/index.ts
git commit -m "feat(backend): add maintenance admin API routes (~25 endpoints)"
```

---

## Task 6: PIREP Approval Hook

**Files:**
- Modify: `backend/src/services/pirep-admin.ts`

**Step 1: Add hour accumulation to PIREP approval flow**

In `pirep-admin.ts`, inside the `review()` method's `if (status === 'approved')` block (around line 119), after the finance entry creation:

```typescript
// After financeService.create(...) and before the notification:

// Accumulate aircraft hours
if (pirep.aircraft_registration) {
  maintenanceService.accumulateFlightHours(
    pirep.aircraft_registration,
    pirep.flight_time_min
  );
}
```

Import `MaintenanceService` at top of file and instantiate alongside other services.

The `accumulateFlightHours` method (in Task 4) handles:
1. Look up `fleet.id` by registration
2. Upsert `aircraft_hours` (add hours + 1 cycle)
3. Update installed component hours
4. Run `checkAndGroundAircraft()` to enforce limits

**Step 2: Verify build**

Run: `cd backend && npm run build`
Expected: Clean compile.

**Step 3: Manual test**

Start backend, approve a PIREP via API, verify `aircraft_hours` row is created/updated.

**Step 4: Commit**

```bash
git add backend/src/services/pirep-admin.ts
git commit -m "feat(backend): hook maintenance hour accumulation into PIREP approval"
```

---

## Task 7: Frontend — Page Shell, Route, and Sidebar

**Files:**
- Create: `frontend/src/pages/admin/AdminMaintenancePage.tsx`
- Modify: `frontend/src/App.tsx` (add route)
- Modify: `frontend/src/components/navigation/NavSidebar.tsx` (add sidebar item)

**Step 1: Create page shell with tab structure**

Follow `AdminFinancesPage.tsx` tab pattern exactly:

```typescript
import { useState } from 'react';
import { Wrench } from '@phosphor-icons/react';
import { AdminPageHeader } from '../../components/admin/AdminPageHeader';

type Tab = 'fleet-status' | 'log' | 'schedules' | 'ads' | 'mel' | 'components';

export function AdminMaintenancePage() {
  const [activeTab, setActiveTab] = useState<Tab>('fleet-status');

  const tabs: { key: Tab; label: string }[] = [
    { key: 'fleet-status', label: 'Fleet Status' },
    { key: 'log', label: 'Maintenance Log' },
    { key: 'schedules', label: 'Check Schedules' },
    { key: 'ads', label: 'Airworthiness Directives' },
    { key: 'mel', label: 'MEL Deferrals' },
    { key: 'components', label: 'Components' },
  ];

  return (
    <div className="h-full flex flex-col overflow-hidden p-6">
      <AdminPageHeader
        icon={Wrench}
        title="Fleet Maintenance"
        subtitle="Maintenance tracking, inspections, and airworthiness management"
      />

      {/* Tab bar — same styling as AdminFinancesPage */}
      <div className="flex-none flex items-center gap-6 mt-5 border-b border-acars-border">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`pb-2.5 text-xs font-medium transition-colors relative ${
              activeTab === tab.key
                ? 'text-blue-400'
                : 'text-acars-muted hover:text-acars-text'
            }`}
          >
            {tab.label}
            {activeTab === tab.key && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500 rounded-full" />
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 flex flex-col overflow-hidden mt-4">
        {activeTab === 'fleet-status' && <div className="text-acars-muted text-sm">Fleet Status tab — coming next</div>}
        {activeTab === 'log' && <div className="text-acars-muted text-sm">Maintenance Log tab</div>}
        {activeTab === 'schedules' && <div className="text-acars-muted text-sm">Check Schedules tab</div>}
        {activeTab === 'ads' && <div className="text-acars-muted text-sm">Airworthiness Directives tab</div>}
        {activeTab === 'mel' && <div className="text-acars-muted text-sm">MEL Deferrals tab</div>}
        {activeTab === 'components' && <div className="text-acars-muted text-sm">Components tab</div>}
      </div>
    </div>
  );
}
```

**Step 2: Add route to App.tsx**

In the admin-only `<Route>` group (around line 77), add:
```typescript
<Route path="/admin/maintenance" element={<AdminMaintenancePage />} />
```

**Step 3: Add sidebar item to NavSidebar.tsx**

In the `adminOnlyItems` array, add (import `Wrench` from `@phosphor-icons/react`):
```typescript
{ to: '/admin/maintenance', label: 'Maintenance', icon: Wrench },
```

Position it as the first item in `adminOnlyItems` (before Users) since it's fleet-related.

**Step 4: Verify dev build**

Run: `npm run dev:all`
Expected: App loads, Maintenance appears in admin sidebar, clicking it shows the tabbed page shell.

**Step 5: Commit**

```bash
git add frontend/src/pages/admin/AdminMaintenancePage.tsx frontend/src/App.tsx frontend/src/components/navigation/NavSidebar.tsx
git commit -m "feat(frontend): add maintenance page shell with tabs, route, and sidebar entry"
```

---

## Task 8: Frontend — Fleet Status Tab

**Files:**
- Create: `frontend/src/components/admin/maintenance/FleetStatusTab.tsx`
- Modify: `frontend/src/pages/admin/AdminMaintenancePage.tsx` (wire in)

**Step 1: Build Fleet Status tab**

This is the default/overview tab. Shows:
- Stats bar: Total Fleet | Operational | In Maintenance | Overdue
- Table with columns: Registration, Type, Total Hours, Total Cycles, Next Check Due, Status
- Row color: green background for OK, amber for within-overflight, red for overdue/grounded
- Expandable row detail showing all check due statuses for that aircraft
- "Adjust Hours" button per row opens modal
- "Return to Service" button for grounded aircraft
- "Issue SFP" button for C/D overdue aircraft

Fetch: `GET /api/admin/maintenance/fleet-status`

Follow `LedgerTab` pattern from `AdminFinancesPage.tsx` — state, fetch with useCallback + useEffect, loading/error states, AdminTable.

**Step 2: Wire into page**

Replace placeholder in `AdminMaintenancePage.tsx`:
```typescript
{activeTab === 'fleet-status' && <FleetStatusTab />}
```

**Step 3: Verify**

Run dev, navigate to Maintenance → Fleet Status tab. Should show table (empty or with fleet data).

**Step 4: Commit**

```bash
git add frontend/src/components/admin/maintenance/FleetStatusTab.tsx frontend/src/pages/admin/AdminMaintenancePage.tsx
git commit -m "feat(frontend): add Fleet Status tab with check-due overview"
```

---

## Task 9: Frontend — Maintenance Log Tab

**Files:**
- Create: `frontend/src/components/admin/maintenance/MaintenanceLogTab.tsx`
- Modify: `frontend/src/pages/admin/AdminMaintenancePage.tsx` (wire in)

**Step 1: Build Maintenance Log tab**

Standard CRUD table:
- Filters: aircraft dropdown, check type multi-select, status dropdown, date range
- Table columns: Date, Aircraft, Check Type, Title, Performed By, Status, Cost
- Status badges: scheduled (blue), in_progress (amber), completed (green), deferred (red)
- "New Entry" button → modal form
- Row actions: Edit, Complete (marks completed + updates snapshots), Delete (with confirm)

Modal form fields: aircraft (dropdown from fleet), check type, title, description, performed by, date, cost, status. For SFP type: show destination ICAO and expiry fields.

Fetch: `GET /api/admin/maintenance/log?aircraftId=&checkType=&status=&page=&pageSize=`

**Step 2: Wire into page, verify, commit**

```bash
git add frontend/src/components/admin/maintenance/MaintenanceLogTab.tsx frontend/src/pages/admin/AdminMaintenancePage.tsx
git commit -m "feat(frontend): add Maintenance Log tab with CRUD"
```

---

## Task 10: Frontend — Check Schedules Tab

**Files:**
- Create: `frontend/src/components/admin/maintenance/CheckSchedulesTab.tsx`
- Modify: `frontend/src/pages/admin/AdminMaintenancePage.tsx` (wire in)

**Step 1: Build Check Schedules tab**

Table grouped by aircraft type:
- Columns: Check Type (A/B/C/D), Interval Hours, Interval Cycles, Interval Months, Overflight %, Est. Duration, Description
- "Add Schedule" button → modal form
- Row actions: Edit, Delete
- Display overflight_pct as percentage (e.g., "10%")
- C/D rows should show "No overflight" badge instead of percentage

Fetch: `GET /api/admin/maintenance/check-schedules`

**Step 2: Wire into page, verify, commit**

```bash
git add frontend/src/components/admin/maintenance/CheckSchedulesTab.tsx frontend/src/pages/admin/AdminMaintenancePage.tsx
git commit -m "feat(frontend): add Check Schedules tab"
```

---

## Task 11: Frontend — Airworthiness Directives Tab

**Files:**
- Create: `frontend/src/components/admin/maintenance/AirworthinessDirectivesTab.tsx`
- Modify: `frontend/src/pages/admin/AdminMaintenancePage.tsx` (wire in)

**Step 1: Build AD tab**

CRUD table:
- Filters: aircraft dropdown, compliance status
- Columns: AD Number, Aircraft, Title, Status, Compliance Date, Next Due (hours or date)
- Status badges: open (red), recurring (amber), complied (green), not_applicable (gray)
- Modal form: aircraft, AD number, title, description, compliance status, compliance date/method, recurring interval, next due

Fetch: `GET /api/admin/maintenance/ads?aircraftId=&status=&page=&pageSize=`

**Step 2: Wire into page, verify, commit**

```bash
git add frontend/src/components/admin/maintenance/AirworthinessDirectivesTab.tsx frontend/src/pages/admin/AdminMaintenancePage.tsx
git commit -m "feat(frontend): add Airworthiness Directives tab"
```

---

## Task 12: Frontend — MEL Deferrals Tab

**Files:**
- Create: `frontend/src/components/admin/maintenance/MELDeferralsTab.tsx`
- Modify: `frontend/src/pages/admin/AdminMaintenancePage.tsx` (wire in)

**Step 1: Build MEL tab**

CRUD table:
- Filters: aircraft dropdown, status, category
- Columns: Item Number, Aircraft, Title, Category, Deferral Date, Expiry, Status
- Category badges: A (red), B (amber), C (blue), D (green) — matching MEL repair timeframes
- Expired items: red row highlight
- Modal form: aircraft, item number, title, category, deferral date, expiry date, remarks
- "Rectify" action button (sets rectified_date + status)

Fetch: `GET /api/admin/maintenance/mel?aircraftId=&status=&category=&page=&pageSize=`

**Step 2: Wire into page, verify, commit**

```bash
git add frontend/src/components/admin/maintenance/MELDeferralsTab.tsx frontend/src/pages/admin/AdminMaintenancePage.tsx
git commit -m "feat(frontend): add MEL Deferrals tab"
```

---

## Task 13: Frontend — Components Tab

**Files:**
- Create: `frontend/src/components/admin/maintenance/ComponentsTab.tsx`
- Modify: `frontend/src/pages/admin/AdminMaintenancePage.tsx` (wire in)

**Step 1: Build Components tab**

CRUD table:
- Filters: aircraft dropdown, component type, status
- Columns: Aircraft, Type, Position, Serial Number, TSN Hours, CSN Cycles, TSO Hours, Overhaul Due, Status
- Progress bar in "Overhaul Due" column: shows % of overhaul life consumed (TSO / overhaul_interval)
- Status badges: installed (green), removed (gray), in_shop (amber), scrapped (red)
- Modal form: aircraft, type, position, serial/part numbers, hours/cycles fields, overhaul interval, installed date, status

Fetch: `GET /api/admin/maintenance/components?aircraftId=&componentType=&status=`

**Step 2: Wire into page, verify, commit**

```bash
git add frontend/src/components/admin/maintenance/ComponentsTab.tsx frontend/src/pages/admin/AdminMaintenancePage.tsx
git commit -m "feat(frontend): add Components tab with overhaul life tracking"
```

---

## Task 14: Integration Testing & Polish

**Files:**
- All previously created files (bug fixes as needed)

**Step 1: End-to-end test of the PIREP → grounding flow**

1. Create a fleet aircraft with check schedule (A-check every 100 hours)
2. Set aircraft_hours to 95 hours
3. Approve a PIREP with 6+ flight hours on that aircraft
4. Verify aircraft_hours updated to 101+ hours
5. Verify fleet.status changed to `'maintenance'` (within overflight tolerance, so actually amber)
6. Approve another PIREP to push past overflight tolerance (110+ hours)
7. Verify aircraft is grounded
8. Create maintenance log entry, complete it
9. Verify aircraft returns to active

**Step 2: Test SFP flow**

1. Set up C-check overdue aircraft
2. Verify grounded
3. Issue SFP via maintenance log
4. Verify aircraft status reflects SFP

**Step 3: Verify bid guard**

1. With grounded aircraft, attempt to bid on flight
2. Verify rejection with clear error message

**Step 4: Build check**

Run: `cd shared && npx tsc && cd ../backend && npm run build && cd ../frontend && npx vite build`
Expected: All clean.

**Step 5: Commit any fixes**

```bash
git add -A
git commit -m "fix: integration fixes for maintenance tracking system"
```

---

## Task Summary

| Task | Description | Depends On |
|------|-------------|------------|
| 1 | Database migration (6 tables) | — |
| 2 | Shared TypeScript types | — |
| 3 | Backend DB row types | 2 |
| 4 | MaintenanceService (full CRUD + business logic) | 1, 3 |
| 5 | Backend API routes (~25 endpoints) | 4 |
| 6 | PIREP approval hook | 4 |
| 7 | Frontend page shell + route + sidebar | 2 |
| 8 | Fleet Status tab | 5, 7 |
| 9 | Maintenance Log tab | 5, 7 |
| 10 | Check Schedules tab | 5, 7 |
| 11 | Airworthiness Directives tab | 5, 7 |
| 12 | MEL Deferrals tab | 5, 7 |
| 13 | Components tab | 5, 7 |
| 14 | Integration testing & polish | 8-13 |

Tasks 1-2 can run in parallel. Tasks 8-13 can run in parallel. Task 14 is the final validation.
