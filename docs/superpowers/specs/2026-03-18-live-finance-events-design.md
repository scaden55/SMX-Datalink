# Live Finance Events — Design Spec

**Date:** 2026-03-18
**Status:** Draft

## Problem

The admin panel's financial views (Dashboard FinanceColumn, FinancesPage) are entirely REST-based. Data only updates on page load or manual refresh. When a PIREP is filed, an aircraft purchased, or a maintenance task completed, the admin has no visibility until they reload. This makes the simulation feel disconnected — financial consequences of operational events should be immediately visible.

## Goals

1. **Event-driven finance updates** — PIREPs, aircraft purchases, and maintenance events push financial data to the admin panel in real time via WebSocket.
2. **Granular UI updates** — append new ledger rows, update KPI cards, and show toast notifications without full page refetches.
3. **Complete audit trail** — aircraft purchases and maintenance completions create proper `finances` ledger entries (currently they don't).
4. **Admin-only visibility** — only sockets authenticated with `role === 'admin'` receive finance events.
5. **Fixed costs stay monthly** — leases, insurance, and depreciation remain in `MonthlyCloseService`. Everything else is event-driven.

## Non-Goals

- Real-time updates to period P&L (monthly close data)
- Live lane rate / supply-demand curve updates
- Pilot-facing finance notifications
- Dispatcher access to finance events

---

## Architecture

### 1. Backend Event Bus

**File:** `backend/src/services/finance-events.ts`

A singleton `FinanceEventBus` built on Node's `EventEmitter`. Services emit typed events after creating finance entries; the WebSocket handler relays them to admin clients.

```typescript
import { EventEmitter } from 'events';

export interface PirepPnlEvent {
  eventId: number;
  flightPnl: {
    pirepId: number;
    flightNumber: string;
    depIcao: string;
    arrIcao: string;
    totalRevenue: number;
    totalDoc: number;
    margin: number;
    marginPct: number;
    blockHours: number;
    payloadLbs: number;
  };
  ledgerEntries: {
    id: number;
    type: string;
    category: string;
    amount: number;
    description: string;
  }[];
  kpiSnapshot: FinanceKpiSnapshot;
}

export interface AircraftPurchaseEvent {
  eventId: number;
  ledgerEntry: {
    id: number;
    type: string;
    category: string;
    amount: number;
    description: string;
  };
  aircraft: {
    id: number;
    registration: string;
    icaoType: string;
    acquisitionCost: number;
    acquisitionType: string;
  };
  kpiSnapshot: FinanceKpiSnapshot;
}

export interface AircraftFinanceUpdateEvent {
  eventId: number;
  aircraftId: number;
  registration: string;
  changes: Record<string, unknown>;
}

export interface MaintenanceFinanceEvent {
  eventId: number;
  ledgerEntry: {
    id: number;
    type: string;
    category: string;
    amount: number;
    description: string;
  };
  aircraft: {
    id: number;
    registration: string;
  };
  workType: 'a_check' | 'b_check' | 'c_check' | 'd_check' | 'component' | 'ad_compliance' | 'unscheduled';
  workDescription: string;
  reserveBalance: number;
  kpiSnapshot: FinanceKpiSnapshot;
}

export interface FinanceKpiSnapshot {
  monthKey: string;          // e.g., "2026-03"
  totalRevenue: number;      // current month
  totalExpenses: number;     // current month
  netIncome: number;         // revenue - expenses
  flightCount: number;       // current month
  maintenanceReserve: number; // total accumulated reserve
  maintenanceActual: number;  // total actual maintenance spend
  capitalExpenses: number;   // current month aircraft acquisitions
}

type FinanceEventMap = {
  'pirep:pnl': PirepPnlEvent;
  'aircraft:purchase': AircraftPurchaseEvent;
  'aircraft:finance-update': AircraftFinanceUpdateEvent;
  'maintenance:work-order': MaintenanceFinanceEvent;
  'maintenance:unscheduled': MaintenanceFinanceEvent;
};

class FinanceEventBus extends EventEmitter {
  private eventCounter = 0;

  nextEventId(): number {
    return ++this.eventCounter;
  }

  emitFinance<K extends keyof FinanceEventMap>(event: K, data: FinanceEventMap[K]): void {
    this.emit(event, data);
  }

  onFinance<K extends keyof FinanceEventMap>(event: K, handler: (data: FinanceEventMap[K]) => void): void {
    this.on(event, handler);
  }
}

export const financeEvents = new FinanceEventBus();
```

### 2. KPI Snapshot Query

**File:** `backend/src/services/finance-events.ts` (exported helper)

A lightweight aggregation query that runs after each finance event to provide current-month totals:

```typescript
export function getFinanceKpiSnapshot(db: Database): FinanceKpiSnapshot {
  const now = new Date();
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const monthStart = `${monthKey}-01`;

  // Single query: aggregate current month finances by category
  const row = db.prepare(`
    SELECT
      COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) AS totalRevenue,
      COALESCE(SUM(CASE WHEN type IN ('expense','deduction') THEN ABS(amount) ELSE 0 END), 0) AS totalExpenses,
      COALESCE(SUM(CASE WHEN category = 'capital' THEN ABS(amount) ELSE 0 END), 0) AS capitalExpenses
    FROM finances
    WHERE created_at >= ? AND is_draft = 0 AND voided_by IS NULL
  `).get(monthStart);

  const flightCount = db.prepare(`
    SELECT COUNT(*) AS cnt FROM finance_flight_pnl
    WHERE computed_at >= ?
  `).get(monthStart);

  // Maintenance reserve: sum from aircraft_hours table
  const reserve = db.prepare(`
    SELECT
      COALESCE(SUM(maintenance_reserve_balance), 0) AS reserveTotal
    FROM aircraft_hours
  `).get();

  // Actual maintenance spend: sum of maintenance-category expenses all time
  const maintActual = db.prepare(`
    SELECT COALESCE(SUM(ABS(amount)), 0) AS total
    FROM finances
    WHERE category = 'maintenance' AND is_draft = 0 AND voided_by IS NULL
  `).get();

  return {
    monthKey,
    totalRevenue: row.totalRevenue,
    totalExpenses: row.totalExpenses,
    netIncome: row.totalRevenue - row.totalExpenses,
    flightCount: flightCount.cnt,
    maintenanceReserve: reserve.reserveTotal,
    maintenanceActual: maintActual.total,
    capitalExpenses: row.capitalExpenses,
  };
}
```

### 3. Event Emitters (Service Integration Points)

#### 3a. PIREP Filing / Approval

**File:** `backend/src/services/flight-pnl.ts` — `calculateAndRecord()`

After the existing logic that creates the 3 finance entries (pilot pay, cargo revenue, DOC expense) and inserts into `finance_flight_pnl`:

```typescript
import { financeEvents, getFinanceKpiSnapshot } from './finance-events.js';

// ... after existing finance entry creation and flight_pnl insert ...

financeEvents.emitFinance('pirep:pnl', {
  eventId: financeEvents.nextEventId(),
  flightPnl: {
    pirepId,
    flightNumber: schedule.flight_number,
    depIcao, arrIcao,
    totalRevenue, totalDoc: costs.totalDoc,
    margin: totalRevenue - costs.totalDoc,
    marginPct: ((totalRevenue - costs.totalDoc) / totalRevenue) * 100,
    blockHours, payloadLbs: cargoLbs,
  },
  ledgerEntries: [payEntry, revenueEntry, expenseEntry].map(e => ({
    id: e.id, type: e.type, category: e.category,
    amount: e.amount, description: e.description,
  })),
  kpiSnapshot: getFinanceKpiSnapshot(db),
});
```

#### 3b. Aircraft Purchase

**File:** `backend/src/routes/fleet.ts` — `POST /api/fleet/manage`

After the existing aircraft INSERT, create a new finance ledger entry and emit:

```typescript
import { financeEvents, getFinanceKpiSnapshot } from '../services/finance-events.js';

// ... after existing fleet INSERT ...

// Create acquisition expense ledger entry
const ledgerEntry = db.prepare(`
  INSERT INTO finances (pilot_id, type, amount, description, created_by, category, created_at)
  VALUES (NULL, 'expense', ?, ?, ?, 'capital', datetime('now'))
`).run(-acquisitionCost, `Aircraft acquisition: ${registration} (${icaoType})`, req.user.userId);

financeEvents.emitFinance('aircraft:purchase', {
  eventId: financeEvents.nextEventId(),
  ledgerEntry: {
    id: ledgerEntry.lastInsertRowid,
    type: 'expense', category: 'capital',
    amount: -acquisitionCost,
    description: `Aircraft acquisition: ${registration} (${icaoType})`,
  },
  aircraft: { id: aircraftId, registration, icaoType, acquisitionCost, acquisitionType },
  kpiSnapshot: getFinanceKpiSnapshot(db),
});
```

#### 3c. Fleet Financial Terms Update

**File:** `backend/src/routes/admin-economics.ts` — `PATCH /api/admin/economics/fleet-financials/:id`

After the existing UPDATE:

```typescript
financeEvents.emitFinance('aircraft:finance-update', {
  eventId: financeEvents.nextEventId(),
  aircraftId: id,
  registration: aircraft.registration,
  changes: req.body,
});
```

#### 3d. Maintenance Events

**File:** Maintenance service/routes (wherever work orders are completed)

> **Note:** The code below is illustrative pseudocode showing the event contract. Actual variable names and sources depend on the maintenance CRUD implementation (not yet built). The key requirement is: when a maintenance task completes, emit an event matching this shape.

When a maintenance task is marked complete:

```typescript
import { financeEvents, getFinanceKpiSnapshot } from '../services/finance-events.js';

// Create maintenance expense ledger entry
const ledgerEntry = db.prepare(`
  INSERT INTO finances (pilot_id, type, amount, description, created_by, category, created_at)
  VALUES (NULL, 'expense', ?, ?, ?, 'maintenance', datetime('now'))
`).run(-totalCost, `${workType}: ${registration} — ${workDescription}`, req.user.userId);

// Get current reserve balance for this aircraft
const reserveRow = db.prepare(`
  SELECT COALESCE(maintenance_reserve_balance, 0) AS reserve FROM aircraft_hours WHERE aircraft_id = ?
`).get(aircraftId);

financeEvents.emitFinance(isUnscheduled ? 'maintenance:unscheduled' : 'maintenance:work-order', {
  eventId: financeEvents.nextEventId(),
  ledgerEntry: {
    id: ledgerEntry.lastInsertRowid,
    type: 'expense', category: 'maintenance',
    amount: -totalCost,
    description: `${workType}: ${registration} — ${workDescription}`,
  },
  aircraft: { id: aircraftId, registration },
  workType,
  workDescription,
  reserveBalance: reserveRow?.reserve ?? 0,
  kpiSnapshot: getFinanceKpiSnapshot(db),
});
```

### 4. WebSocket Handler — Admin Finance Room

**File:** `backend/src/websocket/handler.ts`

Changes to the existing handler:

```typescript
import { financeEvents } from '../services/finance-events.js';

// Inside setupWebSocket(), after existing setup:

// ── Admin Finance Room ──────────────────────────────────────────
// Relay finance events to admin-only room
const financeSocketEvents = [
  ['pirep:pnl', 'finance:pirep-pnl'],
  ['aircraft:purchase', 'finance:aircraft-purchase'],
  ['aircraft:finance-update', 'finance:aircraft-update'],
  ['maintenance:work-order', 'finance:maintenance'],
  ['maintenance:unscheduled', 'finance:maintenance'],
] as const;

for (const [busEvent, socketEvent] of financeSocketEvents) {
  financeEvents.onFinance(busEvent, (data) => {
    io.to('admin-finance').emit(socketEvent, data);
  });
}

// Inside io.on('connection'), after the socket is cast to AcarsSocket:
// The handler's auth middleware sets (socket as AcarsSocket).user = payload via
// socket.handshake.auth.token → authService.verifyAccessToken(). Match that pattern:
if (socket.user?.role === 'admin') {
  socket.join('admin-finance');
}
```

### 5. Shared Types

**File:** `shared/src/types/finance-events.ts` (new)

Export the event payload interfaces so both backend and admin frontend can import them:

```typescript
export interface FinanceKpiSnapshot {
  monthKey: string;
  totalRevenue: number;
  totalExpenses: number;
  netIncome: number;
  flightCount: number;
  maintenanceReserve: number;
  maintenanceActual: number;
  capitalExpenses: number;
}

export interface FinanceLedgerEntry {
  id: number;
  type: string;
  category: string;
  amount: number;
  description: string;
}

export interface FinancePirepPnlEvent {
  eventId: number;
  flightPnl: {
    pirepId: number;
    flightNumber: string;
    depIcao: string;
    arrIcao: string;
    totalRevenue: number;
    totalDoc: number;
    margin: number;
    marginPct: number;
    blockHours: number;
    payloadLbs: number;
  };
  ledgerEntries: FinanceLedgerEntry[];
  kpiSnapshot: FinanceKpiSnapshot;
}

export interface FinanceAircraftPurchaseEvent {
  eventId: number;
  ledgerEntry: FinanceLedgerEntry;
  aircraft: {
    id: number;
    registration: string;
    icaoType: string;
    acquisitionCost: number;
    acquisitionType: string;
  };
  kpiSnapshot: FinanceKpiSnapshot;
}

// Note: This event intentionally omits kpiSnapshot — editing financial terms
// (lease rate, insurance) does not create a ledger entry or change current-month KPIs.
// The effect is deferred to the next MonthlyCloseService cycle.
export interface FinanceAircraftUpdateEvent {
  eventId: number;
  aircraftId: number;
  registration: string;
  changes: Record<string, unknown>;
}

export interface FinanceMaintenanceEvent {
  eventId: number;
  ledgerEntry: FinanceLedgerEntry;
  aircraft: {
    id: number;
    registration: string;
  };
  workType: 'a_check' | 'b_check' | 'c_check' | 'd_check' | 'component' | 'ad_compliance' | 'unscheduled';
  workDescription: string;
  reserveBalance: number;
  kpiSnapshot: FinanceKpiSnapshot;
}
```

### 6. Admin Frontend — Socket Hook

**File:** `admin/src/hooks/useFinanceSocket.ts` (new)

```typescript
import { useEffect, useRef } from 'react';
import { useSocketStore } from '../stores/socketStore';
import type {
  FinancePirepPnlEvent,
  FinanceAircraftPurchaseEvent,
  FinanceAircraftUpdateEvent,
  FinanceMaintenanceEvent,
} from '@acars/shared';

interface UseFinanceSocketOptions {
  onPirepPnl?: (data: FinancePirepPnlEvent) => void;
  onAircraftPurchase?: (data: FinanceAircraftPurchaseEvent) => void;
  onAircraftUpdate?: (data: FinanceAircraftUpdateEvent) => void;
  onMaintenance?: (data: FinanceMaintenanceEvent) => void;
}

export function useFinanceSocket(options: UseFinanceSocketOptions) {
  const socket = useSocketStore((s) => s.socket);
  const lastEventId = useRef(0);
  // Use refs for handlers to avoid re-subscribing on every render
  const handlersRef = useRef(options);
  handlersRef.current = options;

  useEffect(() => {
    if (!socket) return;

    function dedup<T extends { eventId: number }>(data: T, handler?: (data: T) => void) {
      if (data.eventId <= lastEventId.current) return;
      lastEventId.current = data.eventId;
      handler?.(data);
    }

    const listeners = {
      'finance:pirep-pnl': (d: FinancePirepPnlEvent) => dedup(d, handlersRef.current.onPirepPnl),
      'finance:aircraft-purchase': (d: FinanceAircraftPurchaseEvent) => dedup(d, handlersRef.current.onAircraftPurchase),
      'finance:aircraft-update': (d: FinanceAircraftUpdateEvent) => dedup(d, handlersRef.current.onAircraftUpdate),
      'finance:maintenance': (d: FinanceMaintenanceEvent) => dedup(d, handlersRef.current.onMaintenance),
    };

    for (const [event, handler] of Object.entries(listeners)) {
      socket.on(event, handler as any);
    }

    return () => {
      for (const [event, handler] of Object.entries(listeners)) {
        socket.off(event, handler as any);
      }
    };
  }, [socket]);
}
```

### 7. Admin Frontend — Component Integration

#### 7a. Dashboard FinanceColumn

**File:** `admin/src/components/dashboard/FinanceColumn.tsx`

Add `useFinanceSocket` to update KPI state in-place:

```typescript
useFinanceSocket({
  onPirepPnl: (data) => {
    setKpis(prev => mergeKpiSnapshot(prev, data.kpiSnapshot));
    toast.success(`${data.flightPnl.flightNumber} ${data.flightPnl.depIcao}→${data.flightPnl.arrIcao} — +$${fmt(data.flightPnl.totalRevenue)} revenue`);
  },
  onAircraftPurchase: (data) => {
    setKpis(prev => mergeKpiSnapshot(prev, data.kpiSnapshot));
    toast.info(`Aircraft acquired: ${data.aircraft.registration} (${data.aircraft.icaoType}) — $${fmt(data.aircraft.acquisitionCost)}`);
  },
  onMaintenance: (data) => {
    setKpis(prev => mergeKpiSnapshot(prev, data.kpiSnapshot));
    toast.info(`${data.workType}: ${data.aircraft.registration} — $${fmt(Math.abs(data.ledgerEntry.amount))}`);
  },
});
```

`mergeKpiSnapshot` helper (used by both FinanceColumn and FinancesPage):

```typescript
function mergeKpiSnapshot(
  prev: DashboardFinanceData,
  snapshot: FinanceKpiSnapshot
): DashboardFinanceData {
  return {
    ...prev,
    monthlyRevenue: snapshot.totalRevenue,
    monthlyExpenses: snapshot.totalExpenses,
    netIncome: snapshot.netIncome,
    flightCount: snapshot.flightCount,
    maintenanceReserve: snapshot.maintenanceReserve,
    maintenanceActual: snapshot.maintenanceActual,
    // Append to sparkline trend if same month, otherwise start new series point
    revenueTrend: prev.revenueTrend.map((pt) =>
      pt.month === snapshot.monthKey
        ? { ...pt, value: snapshot.totalRevenue }
        : pt
    ),
  };
}
```

#### 7b. FinancesPage

**File:** `admin/src/pages/FinancesPage.tsx`

Per-tab handling:

- **Overview tab:** KPI cards merge from `kpiSnapshot`. Cost breakdown chart data updated.
- **Ledger tab:** New `ledgerEntries[]` prepended to the table state. New rows get a CSS class (`animate-fade-in`) that fades from `--accent-blue` background to transparent over 2 seconds.
- **Revenue tab:** `pirep:pnl` events append a new revenue row to the table.
- **Fleet Performance tab:** `aircraft:purchase` and `maintenance` events trigger a targeted refetch of fleet utilization data (single lightweight GET).
- **Route Analysis tab:** `pirep:pnl` events with matching visible routes update margin data in-place.

### 8. Ledger Entry Creation — New Event Sources

#### New `category` values

The `finances.category` column is TEXT. No migration needed — just new conventions:

| Category | Use |
|---|---|
| `payroll` | Pilot pay, bonuses, deductions |
| `revenue` | Cargo revenue, fuel surcharge |
| `expense` | Operating costs (fuel, landing, handling, nav) |
| `capital` | Aircraft acquisitions, disposals |
| `maintenance` | Work orders, repairs, component replacements |
| `admin` | Manual admin adjustments |

#### Aircraft purchase ledger entry

**Trigger:** `POST /api/fleet/manage` when `acquisitionCost > 0`

- Type: `expense`
- Category: `capital`
- Amount: `-acquisitionCost` (negative = outflow)
- Description: `"Aircraft acquisition: {registration} ({icaoType})"`
- `pilot_id`: NULL (airline-level)
- `created_by`: admin userId from JWT

#### Maintenance completion ledger entry

**Trigger:** Maintenance work order marked complete (route TBD — depends on maintenance CRUD implementation)

- Type: `expense`
- Category: `maintenance`
- Amount: `-totalCost` (parts + labor)
- Description: `"{workType}: {registration} — {summary}"`
- `pilot_id`: NULL (airline-level)
- `created_by`: admin userId

### 9. What Stays Monthly (No Change)

These remain in `MonthlyCloseService.closeMonth()`:

- Lease payments per aircraft (`fleet.lease_monthly`)
- Insurance premiums per aircraft (`fleet.insurance_monthly`)
- Depreciation per aircraft (`fleet.depreciation_monthly`)
- Period P&L aggregation into `finance_period_pnl`

---

## Files Changed

### New Files
| File | Purpose |
|---|---|
| `backend/src/services/finance-events.ts` | FinanceEventBus singleton + KPI snapshot query |
| `shared/src/types/finance-events.ts` | Shared event payload types |
| `admin/src/hooks/useFinanceSocket.ts` | React hook for finance socket events |

### Modified Files
| File | Change |
|---|---|
| `backend/src/services/flight-pnl.ts` | Emit `pirep:pnl` after P&L calculation |
| `backend/src/routes/fleet.ts` | Create capital expense entry + emit `aircraft:purchase` |
| `backend/src/routes/admin-economics.ts` | Emit `aircraft:finance-update` on fleet financial edit |
| `backend/src/websocket/handler.ts` | Join admin sockets to `admin-finance` room, relay finance events |
| `admin/src/components/dashboard/FinanceColumn.tsx` | Subscribe to finance events, update KPIs, show toasts |
| `admin/src/pages/FinancesPage.tsx` | Subscribe to finance events, append rows, update charts |
| `shared/src/index.ts` | Re-export finance event types |

### Maintenance Integration (dependent on maintenance CRUD)
| File | Change |
|---|---|
| Maintenance service/routes (TBD) | Create maintenance expense entry + emit `maintenance:work-order` / `maintenance:unscheduled` |

---

## Data Flow Diagram

```
PIREP Filed ──► FlightPnLService.calculateAndRecord()
                  ├── Creates 3 finance entries (pay, revenue, expense)
                  ├── Inserts finance_flight_pnl row
                  ├── Runs getFinanceKpiSnapshot()
                  └── financeEvents.emit('pirep:pnl', { pnl, entries, kpi })
                        └── WebSocket handler relays to 'admin-finance' room
                              ├── FinanceColumn: merges KPI, shows toast
                              └── FinancesPage: prepends ledger rows, updates charts

Aircraft Purchased ──► POST /api/fleet/manage
                         ├── Creates fleet record
                         ├── Creates capital expense entry
                         ├── Runs getFinanceKpiSnapshot()
                         └── financeEvents.emit('aircraft:purchase', { entry, aircraft, kpi })
                               └── WebSocket handler relays to 'admin-finance' room

Maintenance Completed ──► Maintenance route/service
                            ├── Creates maintenance expense entry
                            ├── Reads aircraft reserve balance
                            ├── Runs getFinanceKpiSnapshot()
                            └── financeEvents.emit('maintenance:*', { entry, aircraft, kpi })
                                  └── WebSocket handler relays to 'admin-finance' room

Monthly Close (unchanged) ──► MonthlyCloseService.closeMonth()
                                ├── Processes lease, insurance, depreciation
                                └── Aggregates period P&L
```

## Edge Cases

1. **Multiple admins online:** All admin sockets in the `admin-finance` room receive the same events. KPI snapshots are identical — no conflict.
2. **Admin disconnects/reconnects:** On reconnect, the admin socket re-joins the room. They miss events during disconnect. The next full page load (or tab switch) catches up via REST.
3. **Rapid PIREP filing:** Each event carries its own `kpiSnapshot` computed after the transaction. Events arrive in order (single-threaded Node). No race condition.
4. **No admin online:** Events fire and hit an empty room — zero cost. No queueing needed.
5. **Maintenance CRUD not yet built:** The maintenance event emitters are integration points. They activate once maintenance completion routes exist. The bus, handler, and frontend hook are ready regardless.
6. **Event deduplication:** Frontend tracks `lastEventId` (monotonic counter). Socket.io reconnects that replay events are filtered out.
