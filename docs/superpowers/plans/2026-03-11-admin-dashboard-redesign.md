# Admin Dashboard Redesign — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the admin dashboard as a map-centric command center with symmetric finance/maintenance columns and a dynamic flight strip overlay.

**Architecture:** Three-column CSS Grid layout (220px | 1fr | 220px). Left column = finance widgets, center = world map with bottom flight strip overlay, right column = maintenance + network widgets. Three independent API fetches + one Socket.io subscription. Each column loads independently with shimmer states.

**Tech Stack:** React 19, Tailwind CSS, shadcn/ui tokens, react-simple-maps, Socket.io client, Express 4, better-sqlite3

**Spec:** `docs/superpowers/specs/2026-03-11-admin-dashboard-redesign-design.md`

---

## File Map

### Backend (new/modified)
| Action | File | Responsibility |
|--------|------|----------------|
| **Modify** | `backend/src/routes/admin-financial-kpis.ts` | Add monthly RATM/CATM trend arrays to response |
| **Create** | `backend/src/routes/admin-maintenance-summary.ts` | Fleet status, critical MEL, next checks endpoint |
| **Create** | `backend/src/routes/admin-flight-activity.ts` | Scheduled flights + recently completed endpoint |
| **Modify** | `backend/src/index.ts` | Register new route modules |

### Frontend (new/modified)
| Action | File | Responsibility |
|--------|------|----------------|
| **Rewrite** | `admin/src/pages/DashboardPage.tsx` | Grid shell, data fetching, socket subscription |
| **Create** | `admin/src/components/dashboard/FinanceColumn.tsx` | Left column: all finance widgets stacked |
| **Create** | `admin/src/components/dashboard/MaintenanceColumn.tsx` | Right column: fleet status, MEL, checks, network |
| **Create** | `admin/src/components/dashboard/FlightStrip.tsx` | Bottom map overlay: live/scheduled/completed |
| **Create** | `admin/src/components/dashboard/MiniCharts.tsx` | Shared SVG chart primitives: AreaChart, BarTrend, Sparkline |
| **Keep** | `admin/src/components/map/WorldMap.tsx` | Existing map component (unchanged) |
| **Delete** | `admin/src/components/dashboard/FinancePanel.tsx` | Replaced by FinanceColumn |
| **Delete** | `admin/src/components/dashboard/OperationsPanel.tsx` | Unused, replaced by FlightStrip |
| **Delete** | `admin/src/components/dashboard/PilotsPanel.tsx` | Unused, not in new design |
| **Delete** | `admin/src/components/dashboard/FleetPanel.tsx` | Replaced by MaintenanceColumn |
| **Delete** | `admin/src/components/dashboard/BottomDock.tsx` | Replaced by new layout |

### Types
| Action | File | Responsibility |
|--------|------|----------------|
| **Create** | `admin/src/types/dashboard.ts` | TypeScript interfaces for all dashboard API responses |

---

## Chunk 1: Backend — New Endpoints

### Task 1: Add dashboard type definitions

**Files:**
- Create: `admin/src/types/dashboard.ts`

- [ ] **Step 1: Create the types file**

```typescript
// admin/src/types/dashboard.ts

// ── Financial KPIs (existing endpoint, extended) ─────────────
export interface MonthData {
  label: string;
  income: number;
  expenses: number;
}

export interface FinancialKPIs {
  balance: {
    totalIncome: number;
    totalExpenses: number;
    netBalance: number;
    months: MonthData[];
  };
  revenue: {
    totalRtm: number;
    totalFlights: number;
    yieldByRoute: { route: string; flights: number; revenue: number; rtm: number; yieldPerRtm: number }[];
    fleetAvgLoadFactor: number;
    charterRevenue: number;
    charterFlights: number;
    fuelSurchargeRecovery: number;
  };
  costs: {
    fuelPerBlockHour: number;
    costPerRtm: number;
    crewPerBlockHour: number;
    maintByTail: { tail: string; cycles: number; costPerCycle: number }[];
  };
  profitability: {
    ratm: number;
    catm: number;
    ratmCatmSpread: number;
    ratmTrend: number[];   // NEW: 6 monthly values
    catmTrend: number[];   // NEW: 6 monthly values
    marginByRoute: { route: string; flights: number; revenue: number; profit: number; marginPct: number }[];
    marginByType: { type: string; flights: number; revenue: number; contribution: number; marginPct: number }[];
  };
  network: {
    revenueByStation: { station: string; departures: number; revenuePerDeparture: number }[];
    hubLoadFactor: number;
    outstationLoadFactor: number;
    hubs: string[];
    yieldTrend: { label: string; yield: number }[];
  };
}

// ── Maintenance Summary (new endpoint) ───────────────────────
export interface MaintenanceSummary {
  fleetStatus: {
    airworthy: number;
    melDispatch: number;
    inCheck: number;
    aog: number;
  };
  criticalMel: {
    registration: string;
    category: string;
    title: string;
    expiryDate: string;
    hoursRemaining: number;
  }[];
  nextChecks: {
    registration: string;
    checkType: string;
    hoursRemaining: number;
    intervalHours: number;
    pctRemaining: number;
  }[];
}

// ── Flight Activity (new endpoint) ───────────────────────────
export interface FlightActivity {
  scheduled: {
    flightNumber: string;
    callsign: string;
    depIcao: string;
    arrIcao: string;
    depTime: string;
  }[];
  completed: {
    flightNumber: string;
    callsign: string;
    depIcao: string;
    arrIcao: string;
    completedAt: string;
  }[];
}
```

- [ ] **Step 2: Commit**

```bash
git add admin/src/types/dashboard.ts
git commit -m "feat(admin): add dashboard TypeScript interfaces"
```

---

### Task 2: Extend financial KPIs with monthly RATM/CATM trend

**Files:**
- Modify: `backend/src/routes/admin-financial-kpis.ts`

The existing endpoint returns aggregate `ratm`, `catm`, `ratmCatmSpread`. We need to add `ratmTrend` and `catmTrend` arrays (6 monthly values).

- [ ] **Step 1: Add monthly RATM/CATM trend computation**

In `backend/src/routes/admin-financial-kpis.ts`, after the existing `ratmCatmRow` query (around line 177), add a loop that computes RATM and CATM per month for the last 6 months, using the same loop pattern as the existing `months` balance trend (lines 34-52):

```typescript
// Monthly RATM/CATM trend (6 months) — per-ton-mile rates
const ratmTrend: number[] = [];
const catmTrend: number[] = [];
for (let i = 5; i >= 0; i--) {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  const start = `${y}-${String(m + 1).padStart(2, '0')}-01`;
  const next = new Date(Date.UTC(y, m + 1, 1));
  const end = `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, '0')}-01`;

  const monthRow = db.prepare(`
    SELECT
      COALESCE(SUM(CAST(l.cargo_lbs AS REAL) / 2000.0 * l.distance_nm), 0) AS rtm,
      COALESCE(SUM(CAST(f.cargo_capacity_lbs AS REAL) / 2000.0 * l.distance_nm), 0) AS atm
    FROM logbook l
    LEFT JOIN fleet f ON f.registration = l.aircraft_registration
    WHERE l.status IN ('completed', 'approved')
      AND l.actual_dep >= ? AND l.actual_dep < ?
  `).get(start, end) as { rtm: number; atm: number };

  // Use the monthly income/expense already computed in the months array
  const monthBalance = months[5 - i]; // months[0] = oldest, months[5] = current
  ratmTrend.push(monthRow.rtm > 0 ? Math.round((monthBalance.income / monthRow.rtm) * 100) / 100 : 0);
  catmTrend.push(monthRow.atm > 0 ? Math.round((monthBalance.expenses / monthRow.atm) * 100) / 100 : 0);
}
```

Note: This loop reuses the `now` variable and `months` array already computed earlier in the same function. Place this block after the `months` loop AND after the `ratmCatmRow` query.

- [ ] **Step 2: Add trend arrays to response**

In the response object's `profitability` section (around line 288), add:

```typescript
ratmTrend,
catmTrend,
```

- [ ] **Step 3: Verify endpoint returns new fields**

Run the dev server and test:
```bash
curl -s http://localhost:3001/api/admin/dashboard/financial-kpis -H "Authorization: Bearer <token>" | jq '.profitability | {ratmTrend, catmTrend}'
```

Expected: Two arrays of ~6 numbers each.

- [ ] **Step 4: Commit**

```bash
git add backend/src/routes/admin-financial-kpis.ts
git commit -m "feat(backend): add monthly RATM/CATM trend to financial KPIs"
```

---

### Task 3: Create maintenance summary endpoint

**Files:**
- Create: `backend/src/routes/admin-maintenance-summary.ts`
- Modify: `backend/src/index.ts` (register route)

- [ ] **Step 1: Create the route file**

Create `backend/src/routes/admin-maintenance-summary.ts`. Follow the existing pattern from `admin-financial-kpis.ts`: export a factory function returning an Express Router, use `authMiddleware` + `dispatcherMiddleware`, and use `getDb()` for database access.

```typescript
import { Router } from 'express';
import { getDb } from '../db/index.js';
import { authMiddleware, dispatcherMiddleware } from '../middleware/auth.js';
import { logger } from '../lib/logger.js';

export function adminMaintenanceSummaryRouter(): Router {
  const router = Router();

  router.get('/admin/dashboard/maintenance-summary', authMiddleware, dispatcherMiddleware, (_req, res) => {
    try {
      const db = getDb();

      // Fleet status counts
      const activeCount = (db.prepare(`SELECT COUNT(*) as c FROM fleet WHERE status = 'active'`).get() as { c: number }).c;
      const melAircraftIds = db.prepare(`SELECT DISTINCT aircraft_id FROM mel_deferrals WHERE status = 'open'`).all() as { aircraft_id: number }[];
      const melIdSet = new Set(melAircraftIds.map(r => r.aircraft_id));
      const inCheckCount = (db.prepare(`SELECT COUNT(DISTINCT aircraft_id) as c FROM maintenance_log WHERE status = 'in_progress'`).get() as { c: number }).c;
      const aogCount = (db.prepare(`SELECT COUNT(*) as c FROM fleet WHERE status = 'maintenance'`).get() as { c: number }).c;

      // To compute airworthy vs melDispatch, we need active aircraft that have/don't have open MELs
      const activeAircraft = db.prepare(`SELECT id FROM fleet WHERE status = 'active'`).all() as { id: number }[];
      let airworthy = 0;
      let melDispatch = 0;
      for (const ac of activeAircraft) {
        if (melIdSet.has(ac.id)) {
          melDispatch++;
        } else {
          airworthy++;
        }
      }

      // Critical MEL deferrals expiring within 48 hours
      const criticalMel = db.prepare(`
        SELECT
          f.registration,
          m.category,
          m.title,
          m.expiry_date AS expiryDate,
          ROUND((julianday(m.expiry_date) - julianday('now')) * 24, 1) AS hoursRemaining
        FROM mel_deferrals m
        JOIN fleet f ON f.id = m.aircraft_id
        WHERE m.status = 'open'
          AND m.expiry_date < datetime('now', '+48 hours')
          AND m.expiry_date > datetime('now')
        ORDER BY m.expiry_date ASC
      `).all();

      // Next scheduled checks — compute hours remaining per check type per aircraft
      const nextChecks = db.prepare(`
        SELECT
          f.registration,
          mc.check_type AS checkType,
          mc.interval_hours AS intervalHours,
          CASE mc.check_type
            WHEN 'A' THEN mc.interval_hours - (ah.total_hours - ah.hours_at_last_a)
            WHEN 'B' THEN mc.interval_hours - (ah.total_hours - ah.hours_at_last_b)
            WHEN 'C' THEN mc.interval_hours - (ah.total_hours - ah.hours_at_last_c)
            ELSE NULL
          END AS hoursRemaining,
          CASE mc.check_type
            WHEN 'A' THEN ROUND((mc.interval_hours - (ah.total_hours - ah.hours_at_last_a)) / mc.interval_hours * 100, 1)
            WHEN 'B' THEN ROUND((mc.interval_hours - (ah.total_hours - ah.hours_at_last_b)) / mc.interval_hours * 100, 1)
            WHEN 'C' THEN ROUND((mc.interval_hours - (ah.total_hours - ah.hours_at_last_c)) / mc.interval_hours * 100, 1)
            ELSE NULL
          END AS pctRemaining
        FROM aircraft_hours ah
        JOIN fleet f ON f.id = ah.aircraft_id
        JOIN maintenance_checks mc ON mc.icao_type = f.icao_type
        WHERE f.status IN ('active', 'maintenance')
          AND mc.interval_hours IS NOT NULL
        ORDER BY hoursRemaining ASC
        LIMIT 10
      `).all();

      res.json({
        fleetStatus: { airworthy, melDispatch, inCheck: inCheckCount, aog: aogCount },
        criticalMel,
        nextChecks,
      });
    } catch (err) {
      logger.error('Admin', 'Failed to fetch maintenance summary', err);
      res.status(500).json({ error: 'Failed to fetch maintenance summary' });
    }
  });

  return router;
}
```

- [ ] **Step 2: Register the route in index.ts**

In `backend/src/index.ts`, add the import and registration following the existing pattern:

```typescript
import { adminMaintenanceSummaryRouter } from './routes/admin-maintenance-summary.js';
```

Then in the route registration block (around line 180), add:

```typescript
app.use('/api', adminMaintenanceSummaryRouter());
```

- [ ] **Step 3: Verify endpoint**

```bash
curl -s http://localhost:3001/api/admin/dashboard/maintenance-summary -H "Authorization: Bearer <token>" | jq .
```

Expected: JSON with `fleetStatus`, `criticalMel`, `nextChecks` keys.

- [ ] **Step 4: Commit**

```bash
git add backend/src/routes/admin-maintenance-summary.ts backend/src/index.ts
git commit -m "feat(backend): add maintenance summary dashboard endpoint"
```

---

### Task 4: Create flight activity endpoint

**Files:**
- Create: `backend/src/routes/admin-flight-activity.ts`
- Modify: `backend/src/index.ts` (register route)

- [ ] **Step 1: Create the route file**

```typescript
import { Router } from 'express';
import { getDb } from '../db/index.js';
import { authMiddleware, dispatcherMiddleware } from '../middleware/auth.js';
import { logger } from '../lib/logger.js';

export function adminFlightActivityRouter(): Router {
  const router = Router();

  router.get('/admin/dashboard/flight-activity', authMiddleware, dispatcherMiddleware, (_req, res) => {
    try {
      const db = getDb();

      // Scheduled flights (active bids) — next upcoming departures
      const scheduled = db.prepare(`
        SELECT
          sf.flight_number AS flightNumber,
          u.callsign,
          sf.dep_icao AS depIcao,
          sf.arr_icao AS arrIcao,
          sf.dep_time AS depTime
        FROM active_bids ab
        JOIN scheduled_flights sf ON sf.id = ab.schedule_id
        JOIN users u ON u.id = ab.user_id
        WHERE sf.is_active = 1
        ORDER BY sf.dep_time ASC
        LIMIT 5
      `).all();

      // Recently completed flights (last 24 hours)
      const completed = db.prepare(`
        SELECT
          l.flight_number AS flightNumber,
          u.callsign,
          l.dep_icao AS depIcao,
          l.arr_icao AS arrIcao,
          l.actual_arr AS completedAt
        FROM logbook l
        JOIN users u ON u.id = l.user_id
        WHERE l.created_at > datetime('now', '-24 hours')
          AND l.status IN ('completed', 'approved')
        ORDER BY l.actual_arr DESC
        LIMIT 5
      `).all();

      res.json({ scheduled, completed });
    } catch (err) {
      logger.error('Admin', 'Failed to fetch flight activity', err);
      res.status(500).json({ error: 'Failed to fetch flight activity' });
    }
  });

  return router;
}
```

- [ ] **Step 2: Register in index.ts**

```typescript
import { adminFlightActivityRouter } from './routes/admin-flight-activity.js';
```

Add to route registration:
```typescript
app.use('/api', adminFlightActivityRouter());
```

- [ ] **Step 3: Verify endpoint**

```bash
curl -s http://localhost:3001/api/admin/dashboard/flight-activity -H "Authorization: Bearer <token>" | jq .
```

Expected: JSON with `scheduled` and `completed` arrays.

- [ ] **Step 4: Commit**

```bash
git add backend/src/routes/admin-flight-activity.ts backend/src/index.ts
git commit -m "feat(backend): add flight activity dashboard endpoint"
```

---

## Chunk 2: Frontend — Shared Components & Charts

### Task 5: Create MiniCharts component

**Files:**
- Create: `admin/src/components/dashboard/MiniCharts.tsx`

Small SVG chart primitives used by both columns. Three components: `AreaChart`, `BarTrend`, `Sparkline`.

- [ ] **Step 1: Create the charts file**

```tsx
// admin/src/components/dashboard/MiniCharts.tsx
import { memo } from 'react';

/** Filled area chart (balance history) */
export const AreaChart = memo(function AreaChart({
  data,
  height = 36,
  color = 'rgba(74,222,128,0.18)',
}: {
  data: number[];
  height?: number;
  color?: string;
}) {
  if (!data.length) return null;
  const max = Math.max(...data, 1);
  const w = 100;
  const points = data.map((v, i) => `${(i / (data.length - 1)) * w},${height - (v / max) * height}`).join(' ');
  const fillPoints = `0,${height} ${points} ${w},${height}`;

  return (
    <svg width="100%" height={height} viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" style={{ display: 'block' }}>
      <polygon fill={color} points={fillPoints} />
      <polyline fill="none" stroke={color.replace(/[\d.]+\)$/, '0.6)')} strokeWidth="1.5" points={points} />
    </svg>
  );
});

/** 6-bar trend chart (RATM/CATM monthly) */
export const BarTrend = memo(function BarTrend({
  data,
  height = 24,
  color = '#4ade80',
}: {
  data: number[];
  height?: number;
  color?: string;
}) {
  if (!data.length) return null;
  const max = Math.max(...data, 0.01);
  const gap = 2;
  const barCount = data.length;

  return (
    <div style={{ display: 'flex', gap: `${gap}px`, alignItems: 'end', height }}>
      {data.map((v, i) => (
        <div
          key={i}
          style={{
            flex: 1,
            height: `${(v / max) * 100}%`,
            background: color,
            opacity: i === barCount - 1 ? 0.7 : 0.25,
            borderRadius: 2,
            minHeight: 2,
          }}
        />
      ))}
    </div>
  );
});

/** Polyline sparkline */
export const Sparkline = memo(function Sparkline({
  data,
  height = 18,
  color = '#3b5bdb',
  strokeWidth = 1.5,
}: {
  data: number[];
  height?: number;
  color?: string;
  strokeWidth?: number;
}) {
  if (!data.length) return null;
  const max = Math.max(...data, 0.01);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const w = 100;
  const points = data.map((v, i) => `${(i / (data.length - 1)) * w},${height - ((v - min) / range) * (height - 2) - 1}`).join(' ');

  return (
    <svg width="100%" height={height} viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" style={{ display: 'block' }}>
      <polyline fill="none" stroke={color} strokeWidth={strokeWidth} points={points} />
    </svg>
  );
});
```

- [ ] **Step 2: Commit**

```bash
git add admin/src/components/dashboard/MiniCharts.tsx
git commit -m "feat(admin): add MiniCharts SVG primitives (AreaChart, BarTrend, Sparkline)"
```

---

### Task 6: Create FinanceColumn component

**Files:**
- Create: `admin/src/components/dashboard/FinanceColumn.tsx`

- [ ] **Step 1: Create the component**

This component receives `FinancialKPIs` data as a prop and renders all finance widgets vertically. It does NOT fetch data — the parent (DashboardPage) passes it.

```tsx
// admin/src/components/dashboard/FinanceColumn.tsx
import { memo } from 'react';
import type { FinancialKPIs } from '../../types/dashboard';
import { AreaChart, BarTrend, Sparkline } from './MiniCharts';

const Divider = () => <div style={{ height: 1, background: 'rgba(255,255,255,0.04)' }} />;

function fmt(n: number, prefix = '$'): string {
  if (Math.abs(n) >= 1_000_000) return `${prefix}${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `${prefix}${(n / 1_000).toFixed(1)}K`;
  return `${prefix}${n.toFixed(n % 1 === 0 ? 0 : 2)}`;
}

function fmtPct(n: number): string {
  return `${Math.round(n)}%`;
}

export const FinanceColumn = memo(function FinanceColumn({ data }: { data: FinancialKPIs }) {
  const { balance, revenue, costs, profitability, network } = data;

  // Per-unit rates: revenue per RTM and cost per ATM (in $/ton-mile)
  const revenuePerRtm = profitability.ratm > 0 ? balance.totalIncome / profitability.ratm : 0;
  const costPerAtm = profitability.catm > 0 ? balance.totalExpenses / profitability.catm : 0;
  const spread = revenuePerRtm - costPerAtm;
  const spreadPct = revenuePerRtm > 0 ? (spread / revenuePerRtm) * 100 : 0;

  // Route margins: top 2 best + bottom 2 worst
  const sorted = [...profitability.marginByRoute].sort((a, b) => b.marginPct - a.marginPct);
  const routeMargins = [...sorted.slice(0, 2), ...sorted.slice(-2)].slice(0, 4);

  const yieldData = network.yieldTrend.map(y => y.yield);
  const yieldLabels = network.yieldTrend.length > 0
    ? [network.yieldTrend[0].label, network.yieldTrend[network.yieldTrend.length - 1].label]
    : [];

  return (
    <div className="flex flex-col gap-2.5 overflow-hidden pt-0.5">
      {/* Header */}
      <div>
        <div className="text-sm font-semibold" style={{ color: '#f0f0f0', lineHeight: 1.15 }}>
          Airline<br />Performance
        </div>
        <div className="mt-0.5" style={{ color: '#3a3a3a', fontSize: 9 }}>
          {new Date().toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: '2-digit' })}
        </div>
      </div>

      {/* Balance */}
      <div>
        <AreaChart data={balance.months.map(m => m.income - m.expenses)} />
        <div className="mt-1" style={{ color: '#4a4a4a', fontSize: 8 }}>Balance</div>
        <div className="font-mono font-semibold" style={{ color: '#f0f0f0', fontSize: 17, lineHeight: 1 }}>
          {fmt(balance.netBalance)}
        </div>
        <div className="flex gap-2.5 mt-0.5">
          <div>
            <span style={{ color: '#3a3a3a', fontSize: 7 }}>Income</span>
            <div className="font-mono" style={{ color: '#4ade80', fontSize: 10 }}>+{fmt(balance.totalIncome)}</div>
          </div>
          <div>
            <span style={{ color: '#3a3a3a', fontSize: 7 }}>Expenses</span>
            <div className="font-mono" style={{ color: '#f87171', fontSize: 10 }}>-{fmt(balance.totalExpenses)}</div>
          </div>
        </div>
      </div>

      {/* RATM + CATM side by side */}
      <div className="flex gap-3">
        <div className="flex-1">
          <BarTrend data={profitability.ratmTrend ?? []} color="#4ade80" />
          <div className="mt-1" style={{ color: '#4a4a4a', fontSize: 8 }}>RATM</div>
          <div className="font-mono font-semibold" style={{ color: '#4ade80', fontSize: 15, lineHeight: 1 }}>
            ${revenuePerRtm.toFixed(2)}
          </div>
          <div style={{ color: '#3a3a3a', fontSize: 7 }}>/ton-mi</div>
        </div>
        <div className="flex-1">
          <BarTrend data={profitability.catmTrend ?? []} color="#3b5bdb" />
          <div className="mt-1" style={{ color: '#4a4a4a', fontSize: 8 }}>CATM</div>
          <div className="font-mono font-semibold" style={{ color: '#f0f0f0', fontSize: 15, lineHeight: 1 }}>
            ${costPerAtm.toFixed(2)}
          </div>
          <div style={{ color: '#3a3a3a', fontSize: 7 }}>/ton-mi</div>
        </div>
      </div>

      {/* Spread */}
      <div>
        <div style={{ color: '#4a4a4a', fontSize: 8 }}>Spread</div>
        <div className="font-mono font-semibold" style={{ color: '#4ade80', fontSize: 13, lineHeight: 1 }}>
          +${spread.toFixed(2)}{' '}
          <span style={{ color: '#3a3a3a', fontSize: 8, fontWeight: 400 }}>/tm · {spreadPct.toFixed(1)}%</span>
        </div>
      </div>

      <Divider />

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-3" style={{ gap: '6px 8px' }}>
        {[
          { label: 'RTM', value: fmt(revenue.totalRtm, '') },
          { label: 'Fleet LF', value: fmtPct(revenue.fleetAvgLoadFactor) },
          { label: 'Flights', value: String(revenue.totalFlights) },
          { label: 'Fuel/BH', value: fmt(costs.fuelPerBlockHour) },
          { label: 'Crew/BH', value: fmt(costs.crewPerBlockHour) },
          { label: 'Fuel Srchg', value: fmtPct(revenue.fuelSurchargeRecovery) },
        ].map(m => (
          <div key={m.label}>
            <div style={{ color: '#3a3a3a', fontSize: 7 }}>{m.label}</div>
            <div className="font-mono font-medium" style={{ color: '#f0f0f0', fontSize: 12 }}>{m.value}</div>
          </div>
        ))}
      </div>

      <Divider />

      {/* Route Margins */}
      <div className="flex-1">
        <div className="uppercase" style={{ color: '#3a3a3a', fontSize: 7, letterSpacing: 0.5, marginBottom: 5 }}>Route Margins</div>
        <div className="font-mono flex flex-col gap-0.5" style={{ fontSize: 9 }}>
          {routeMargins.map(r => (
            <div key={r.route} className="flex justify-between">
              <span style={{ color: '#7a7a7a' }}>{r.route}</span>
              <span style={{ color: r.marginPct >= 0 ? '#4ade80' : '#f87171' }}>
                {r.marginPct >= 0 ? '+' : ''}{r.marginPct.toFixed(1)}%
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Yield Trend */}
      <div>
        <div className="uppercase" style={{ color: '#3a3a3a', fontSize: 7, letterSpacing: 0.5 }}>Yield Trend</div>
        <div className="mt-0.5">
          <Sparkline data={yieldData} />
        </div>
        {yieldLabels.length === 2 && (
          <div className="flex justify-between mt-px">
            <span style={{ color: '#3a3a3a', fontSize: 7 }}>{yieldLabels[0]}</span>
            <span style={{ color: '#3a3a3a', fontSize: 7 }}>{yieldLabels[1]}</span>
          </div>
        )}
      </div>
    </div>
  );
});
```

- [ ] **Step 2: Commit**

```bash
git add admin/src/components/dashboard/FinanceColumn.tsx
git commit -m "feat(admin): add FinanceColumn dashboard component"
```

---

### Task 7: Create MaintenanceColumn component

**Files:**
- Create: `admin/src/components/dashboard/MaintenanceColumn.tsx`

- [ ] **Step 1: Create the component**

Receives `MaintenanceSummary` and network LF data as props.

```tsx
// admin/src/components/dashboard/MaintenanceColumn.tsx
import { memo } from 'react';
import type { MaintenanceSummary } from '../../types/dashboard';

const Divider = () => <div style={{ height: 1, background: 'rgba(255,255,255,0.04)' }} />;

interface MaintenanceColumnProps {
  data: MaintenanceSummary;
  network: { hubLoadFactor: number; outstationLoadFactor: number; revenuePerDeparture: number };
}

export const MaintenanceColumn = memo(function MaintenanceColumn({ data, network }: MaintenanceColumnProps) {
  const { fleetStatus, criticalMel, nextChecks } = data;

  return (
    <div className="flex flex-col gap-2.5 overflow-hidden pt-0.5">
      {/* Fleet Status */}
      <div>
        <div className="uppercase" style={{ color: '#3a3a3a', fontSize: 7, letterSpacing: 0.5, marginBottom: 8 }}>
          Fleet Status
        </div>
        <div className="grid grid-cols-2" style={{ gap: '4px 12px' }}>
          {[
            { value: fleetStatus.airworthy, label: 'Airworthy', color: '#4ade80' },
            { value: fleetStatus.melDispatch, label: 'MEL Dispatch', color: '#fbbf24' },
            { value: fleetStatus.inCheck, label: 'In Check', color: '#22d3ee' },
            { value: fleetStatus.aog, label: 'AOG', color: '#f87171' },
          ].map((s, i) => (
            <div key={s.label} style={{ marginTop: i >= 2 ? 4 : 0 }}>
              <div className="font-mono font-semibold" style={{ color: s.color, fontSize: 20, lineHeight: 1 }}>
                {s.value}
              </div>
              <div style={{ color: '#4a4a4a', fontSize: 7 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      <Divider />

      {/* Critical MEL <48h */}
      <div>
        <div className="uppercase" style={{ color: '#3a3a3a', fontSize: 7, letterSpacing: 0.5, marginBottom: 6 }}>
          Critical MEL &lt;48h
        </div>
        {criticalMel.length === 0 ? (
          <div className="font-mono" style={{ color: '#3a3a3a', fontSize: 9 }}>No critical MELs</div>
        ) : (
          <div className="font-mono flex flex-col gap-1" style={{ fontSize: 9 }}>
            {criticalMel.map((mel, i) => (
              <div key={i}>
                <div className="flex justify-between">
                  <span style={{ color: '#f0f0f0' }}>{mel.registration}</span>
                  <span style={{ color: mel.hoursRemaining < 12 ? '#f87171' : '#fbbf24', fontSize: 8 }}>
                    {Math.round(mel.hoursRemaining)}h left
                  </span>
                </div>
                <div style={{ color: '#4a4a4a', fontSize: 7 }}>Cat {mel.category} · {mel.title}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Divider />

      {/* Next Checks */}
      <div>
        <div className="uppercase" style={{ color: '#3a3a3a', fontSize: 7, letterSpacing: 0.5, marginBottom: 6 }}>
          Next Checks
        </div>
        <div className="font-mono flex flex-col gap-0.5" style={{ fontSize: 9 }}>
          {nextChecks.slice(0, 4).map((chk, i) => {
            const color = chk.pctRemaining <= 0 ? '#f87171' : chk.pctRemaining < 20 ? '#fbbf24' : '#f0f0f0';
            const hoursLabel = Math.abs(chk.hoursRemaining) >= 1000
              ? `${(chk.hoursRemaining / 1000).toFixed(1)}Kh`
              : `${Math.round(chk.hoursRemaining)}h`;
            return (
              <div key={i} className="flex justify-between">
                <span style={{ color: '#7a7a7a' }}>{chk.registration}</span>
                <span style={{ color }}>{chk.checkType}-Chk {hoursLabel}</span>
              </div>
            );
          })}
        </div>
      </div>

      <Divider />

      {/* Network Health (pushed to bottom) */}
      <div className="flex-1 flex flex-col justify-end">
        <div className="uppercase" style={{ color: '#3a3a3a', fontSize: 7, letterSpacing: 0.5, marginBottom: 6 }}>
          Network
        </div>
        <div className="font-mono flex flex-col gap-0.5" style={{ fontSize: 9 }}>
          <div className="flex justify-between">
            <span style={{ color: '#4a4a4a' }}>Hub LF</span>
            <span style={{ color: '#f0f0f0' }}>{Math.round(network.hubLoadFactor)}%</span>
          </div>
          <div className="flex justify-between">
            <span style={{ color: '#4a4a4a' }}>Outstation LF</span>
            <span style={{ color: '#f0f0f0' }}>{Math.round(network.outstationLoadFactor)}%</span>
          </div>
          <div className="flex justify-between">
            <span style={{ color: '#4a4a4a' }}>Rev/Dep</span>
            <span style={{ color: '#f0f0f0' }}>
              ${network.revenuePerDeparture >= 1000
                ? `${(network.revenuePerDeparture / 1000).toFixed(1)}K`
                : Math.round(network.revenuePerDeparture)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
});
```

- [ ] **Step 2: Commit**

```bash
git add admin/src/components/dashboard/MaintenanceColumn.tsx
git commit -m "feat(admin): add MaintenanceColumn dashboard component"
```

---

## Chunk 3: Frontend — Flight Strip & Page Assembly

### Task 8: Create FlightStrip component

**Files:**
- Create: `admin/src/components/dashboard/FlightStrip.tsx`

Dynamic flight strip that adapts columns based on available data (the key user requirement).

**Note:** `ActiveFlightHeartbeat` does NOT include `dep_icao`/`arr_icao`, so the Live column shows callsign + FL/speed only (no route). Scheduled and Completed columns get route info from their respective REST endpoints.

- [ ] **Step 1: Create the component**

```tsx
// admin/src/components/dashboard/FlightStrip.tsx
import { memo, useMemo } from 'react';
import type { ActiveFlightHeartbeat } from '@acars/shared';
import type { FlightActivity } from '../../types/dashboard';

const PHASE_COLORS: Record<string, string> = {
  CRUISE: '#4ade80',
  CLIMB: '#fbbf24',
  DESCENT: '#fbbf24',
  APPROACH: '#22d3ee',
  TAKEOFF: '#3b5bdb',
  LANDING: '#22d3ee',
  TAXI_OUT: '#7a7a7a',
  TAXI_IN: '#7a7a7a',
  PREFLIGHT: '#7a7a7a',
  PARKED: '#7a7a7a',
};

function timeAgo(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const hours = Math.floor(diff / 3_600_000);
  if (hours < 1) return '<1h ago';
  return `${hours}h ago`;
}

interface FlightStripProps {
  liveFlights: ActiveFlightHeartbeat[];
  activity: FlightActivity | null;
}

export const FlightStrip = memo(function FlightStrip({ liveFlights, activity }: FlightStripProps) {
  const live = liveFlights.slice(0, 5);
  const scheduled = activity?.scheduled ?? [];
  const completed = activity?.completed ?? [];

  const hasLive = live.length > 0;
  const hasScheduled = scheduled.length > 0;
  const hasCompleted = completed.length > 0;
  const hasAny = hasLive || hasScheduled || hasCompleted;

  // Compute visible columns
  const columns = useMemo(() => {
    const cols: string[] = [];
    if (hasLive) cols.push('live');
    if (hasScheduled) cols.push('scheduled');
    if (hasCompleted) cols.push('completed');
    return cols;
  }, [hasLive, hasScheduled, hasCompleted]);

  return (
    <div className="absolute bottom-0 left-0 right-0" style={{ zIndex: 10 }}>
      {/* Gradient fade */}
      <div style={{ height: 24, background: 'linear-gradient(to bottom, transparent, rgba(5,5,5,0.9))' }} />

      {/* Content */}
      <div style={{ background: 'rgba(5,5,5,0.92)', padding: '8px 12px 10px' }}>
        {!hasAny ? (
          /* Empty state */
          <div className="flex items-center justify-center gap-2 py-1">
            <span className="font-mono" style={{ color: '#3a3a3a', fontSize: 9 }}>No flight activity</span>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${columns.length}, 1fr)`, gap: 12 }}>
            {columns.map((col, idx) => (
              <div key={col} style={idx > 0 ? { borderLeft: '1px solid rgba(255,255,255,0.04)', paddingLeft: 12 } : undefined}>
                {col === 'live' && (
                  <>
                    <div className="flex items-center gap-1 mb-1">
                      <span
                        className="animate-pulse"
                        style={{ width: 4, height: 4, borderRadius: '50%', background: '#4ade80', boxShadow: '0 0 4px rgba(74,222,128,0.6)' }}
                      />
                      <span className="uppercase" style={{ color: '#4a4a4a', fontSize: 7, letterSpacing: 0.5 }}>Live</span>
                    </div>
                    <div className="font-mono flex flex-col gap-0.5" style={{ fontSize: 9 }}>
                      {live.map(f => (
                        <div key={f.callsign} className="flex items-center gap-1">
                          <span style={{ width: 3, height: 3, borderRadius: '50%', background: PHASE_COLORS[f.phase] ?? '#7a7a7a', flexShrink: 0 }} />
                          <span style={{ color: '#f0f0f0' }}>{f.callsign}</span>
                          <span style={{ color: '#4a4a4a', fontSize: 7, marginLeft: 'auto', whiteSpace: 'nowrap' }}>
                            FL{Math.round(f.altitude / 100)} · {Math.round(f.groundSpeed)}kt
                          </span>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {col === 'scheduled' && (
                  <>
                    <div className="flex items-center gap-1 mb-1">
                      <span className="uppercase" style={{ color: '#4a4a4a', fontSize: 7, letterSpacing: 0.5 }}>Scheduled</span>
                      <span className="font-mono" style={{ color: '#3a3a3a', fontSize: 8, marginLeft: 'auto' }}>
                        {scheduled.length} bid{scheduled.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <div className="font-mono flex flex-col gap-0.5" style={{ fontSize: 9 }}>
                      {scheduled.map(f => (
                        <div key={f.flightNumber} className="flex items-center gap-1">
                          <span style={{ color: '#7a7a7a' }}>{f.flightNumber}</span>
                          <span style={{ color: '#4a4a4a', fontSize: 8 }}>{f.depIcao}→{f.arrIcao}</span>
                          <span style={{ color: '#3a3a3a', fontSize: 7, marginLeft: 'auto' }}>{f.depTime}z</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {col === 'completed' && (
                  <>
                    <div className="flex items-center gap-1 mb-1">
                      <span className="uppercase" style={{ color: '#4a4a4a', fontSize: 7, letterSpacing: 0.5 }}>Completed</span>
                    </div>
                    <div className="font-mono flex flex-col gap-0.5" style={{ fontSize: 9 }}>
                      {completed.map(f => (
                        <div key={f.flightNumber} className="flex items-center gap-1">
                          <span style={{ color: '#4ade80', fontSize: 7 }}>✓</span>
                          <span style={{ color: '#7a7a7a' }}>{f.callsign}</span>
                          <span style={{ color: '#4a4a4a', fontSize: 8 }}>{f.depIcao}→{f.arrIcao}</span>
                          <span style={{ color: '#3a3a3a', fontSize: 7, marginLeft: 'auto' }}>{timeAgo(f.completedAt)}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
});
```

- [ ] **Step 2: Commit**

```bash
git add admin/src/components/dashboard/FlightStrip.tsx
git commit -m "feat(admin): add dynamic FlightStrip with adaptive columns"
```

---

### Task 9: Rewrite DashboardPage

**Files:**
- Rewrite: `admin/src/pages/DashboardPage.tsx`
- Delete: `admin/src/components/dashboard/FinancePanel.tsx`
- Delete: `admin/src/components/dashboard/OperationsPanel.tsx`
- Delete: `admin/src/components/dashboard/PilotsPanel.tsx`
- Delete: `admin/src/components/dashboard/FleetPanel.tsx`
- Delete: `admin/src/components/dashboard/BottomDock.tsx`

- [ ] **Step 1: Rewrite DashboardPage.tsx**

Complete rewrite of `admin/src/pages/DashboardPage.tsx`. Three-column grid layout, three independent API fetches, one socket subscription. Each section loads independently.

```tsx
// admin/src/pages/DashboardPage.tsx
import { useEffect, useState, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import type { ActiveFlightHeartbeat } from '@acars/shared';
import { api } from '../lib/api';
import type { FinancialKPIs, MaintenanceSummary, FlightActivity } from '../types/dashboard';
import WorldMap from '../components/map/WorldMap';
import { FinanceColumn } from '../components/dashboard/FinanceColumn';
import { MaintenanceColumn } from '../components/dashboard/MaintenanceColumn';
import { FlightStrip } from '../components/dashboard/FlightStrip';

const SOCKET_URL = import.meta.env.VITE_API_URL || '';

const SHIMMER_WIDTHS = [85, 70, 95, 60, 80, 75, 90, 65];

function Shimmer({ lines = 4 }: { lines?: number }) {
  return (
    <div className="flex flex-col gap-3 p-2 animate-pulse">
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="rounded" style={{ height: 12, background: 'rgba(255,255,255,0.04)', width: `${SHIMMER_WIDTHS[i % SHIMMER_WIDTHS.length]}%` }} />
      ))}
    </div>
  );
}

function ErrorMsg({ msg }: { msg: string }) {
  return <div className="font-mono p-2" style={{ color: '#3a3a3a', fontSize: 9 }}>{msg}</div>;
}

export default function DashboardPage() {
  // ── Data state ──────────────────────────────────────────
  const [kpis, setKpis] = useState<FinancialKPIs | null>(null);
  const [kpiError, setKpiError] = useState(false);
  const [maintenance, setMaintenance] = useState<MaintenanceSummary | null>(null);
  const [maintError, setMaintError] = useState(false);
  const [activity, setActivity] = useState<FlightActivity | null>(null);
  const [activityError, setActivityError] = useState(false);
  const [liveFlights, setLiveFlights] = useState<ActiveFlightHeartbeat[]>([]);

  // ── Fetch data ──────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    api.get<FinancialKPIs>('/api/admin/dashboard/financial-kpis')
      .then(d => { if (!cancelled) setKpis(d); })
      .catch(() => { if (!cancelled) setKpiError(true); });

    api.get<MaintenanceSummary>('/api/admin/dashboard/maintenance-summary')
      .then(d => { if (!cancelled) setMaintenance(d); })
      .catch(() => { if (!cancelled) setMaintError(true); });

    api.get<FlightActivity>('/api/admin/dashboard/flight-activity')
      .then(d => { if (!cancelled) setActivity(d); })
      .catch(() => { if (!cancelled) setActivityError(true); });

    return () => { cancelled = true; };
  }, []);

  // ── Socket subscription for live flights ────────────────
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const token = (() => {
      try { return JSON.parse(localStorage.getItem('admin-auth') || '{}').accessToken; }
      catch { return null; }
    })();

    const socket = io(SOCKET_URL, { auth: { token }, transports: ['websocket'] });
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('livemap:subscribe');
    });

    socket.on('flights:active', (flights: ActiveFlightHeartbeat[]) => {
      setLiveFlights(flights);
    });

    return () => {
      socket.emit('livemap:unsubscribe');
      socket.disconnect();
    };
  }, []);

  // ── Hubs for map markers ────────────────────────────────
  const [hubs, setHubs] = useState<{ lat: number; lon: number }[]>([]);
  useEffect(() => {
    api.get<{ airports: { icao: string; lat: number; lon: number; isHub: boolean }[]; total: number }>('/api/admin/airports')
      .then(res => {
        setHubs(res.airports.filter(a => a.isHub).map(a => ({ lat: a.lat, lon: a.lon })));
      })
      .catch(() => {});
  }, []);

  const mapFlights = liveFlights.map(f => ({ latitude: f.latitude, longitude: f.longitude, callsign: f.callsign }));

  // ── Network stats for right column ──────────────────────
  const networkStats = kpis ? {
    hubLoadFactor: kpis.network.hubLoadFactor,
    outstationLoadFactor: kpis.network.outstationLoadFactor,
    revenuePerDeparture: kpis.network.revenueByStation.length > 0
      ? kpis.network.revenueByStation.reduce((sum, s) => sum + s.revenuePerDeparture, 0) / kpis.network.revenueByStation.length
      : 0,
  } : { hubLoadFactor: 0, outstationLoadFactor: 0, revenuePerDeparture: 0 };

  return (
    <div
      className="h-full"
      style={{
        display: 'grid',
        gridTemplateColumns: '220px 1fr 220px',
        gap: 8,
        padding: 16,
        background: '#050505',
      }}
    >
      {/* ── Left: Finance ─────────────────────────────────── */}
      <div className="overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
        {kpiError ? <ErrorMsg msg="Failed to load financial data" /> :
         kpis ? <FinanceColumn data={kpis} /> : <Shimmer lines={8} />}
      </div>

      {/* ── Center: Map + Flight Strip ────────────────────── */}
      <div className="relative rounded-lg overflow-hidden" style={{ background: '#080808' }}>
        <div className="absolute inset-0">
          <WorldMap hubs={hubs} flights={mapFlights} />
        </div>
        <FlightStrip liveFlights={liveFlights} activity={activityError ? null : activity} />
      </div>

      {/* ── Right: Maintenance ────────────────────────────── */}
      <div className="overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
        {maintError ? <ErrorMsg msg="Failed to load maintenance data" /> :
         maintenance ? <MaintenanceColumn data={maintenance} network={networkStats} /> : <Shimmer lines={8} />}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Delete unused dashboard components**

```bash
rm admin/src/components/dashboard/FinancePanel.tsx
rm admin/src/components/dashboard/OperationsPanel.tsx
rm admin/src/components/dashboard/PilotsPanel.tsx
rm admin/src/components/dashboard/FleetPanel.tsx
rm admin/src/components/dashboard/BottomDock.tsx
```

- [ ] **Step 3: Verify the page loads in the browser**

Open `http://localhost:5174/admin/` and verify:
1. Three-column layout renders
2. Left column shows shimmer → finance data (or error)
3. Center shows the world map
4. Right column shows shimmer → maintenance data (or error)
5. Flight strip appears at bottom of map
6. No console errors

- [ ] **Step 4: Commit**

```bash
git add admin/src/pages/DashboardPage.tsx
git add -u admin/src/components/dashboard/
git commit -m "feat(admin): rewrite dashboard with map-centric 3-column layout

Symmetric finance/maintenance columns with world map center.
Dynamic flight strip overlay adapts based on available data.
Independent loading states per column."
```

---

## Chunk 4: Polish & Visual Refinement

### Task 10: Visual QA and adjustments

After all components are wired up, visually inspect and adjust:

- [ ] **Step 1: Check font-mono rendering**

Verify that `font-mono` class renders as Lufga (from tokens.css). If Tailwind's default monospace is overriding, check that `tailwind.config` maps `fontFamily.mono` to the token. Inspect in browser DevTools.

- [ ] **Step 2: Check column overflow**

If finance or maintenance columns overflow vertically, ensure `overflow-y-auto` with `scrollbarWidth: 'none'` works. The columns should scroll independently without visible scrollbars.

- [ ] **Step 3: Verify flight strip dynamic behavior**

Test the flight strip with different data states:
- No data at all → "No flight activity" message
- Only completed flights → single column
- Scheduled + completed → two columns
- All three → three columns

If no live Socket.io data available in dev, the strip should gracefully show only the REST-fetched columns.

- [ ] **Step 4: Test map interaction**

Verify the map is still zoomable and pannable with the flight strip overlay. The strip should not block map interaction in the areas above it.

- [ ] **Step 5: Commit any adjustments**

```bash
git add -A admin/src/
git commit -m "fix(admin): visual QA adjustments for dashboard redesign"
```
