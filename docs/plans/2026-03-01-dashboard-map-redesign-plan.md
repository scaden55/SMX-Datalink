# Dashboard Map Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the admin dashboard's static widget grid with a full-viewport live map background and 4 consolidated overlay panels.

**Architecture:** DashboardLayout conditionally drops padding for the dashboard route. DashboardPage renders a Leaflet map layer (z-index 0) with live flight markers from Socket.io, plus a scrollable overlay (z-index 10) with 4 consolidated panels (Operations, Finance, Fleet, Pilots) using 90% opacity backgrounds.

**Tech Stack:** React 19, react-leaflet, Leaflet, Recharts, Zustand, Socket.io-client, Tailwind CSS, shadcn/ui, Phosphor icons

**Design doc:** `docs/plans/2026-03-01-dashboard-map-redesign-design.md`

---

### Task 1: Modify DashboardLayout for conditional padding

**Files:**
- Modify: `admin/src/components/layout/DashboardLayout.tsx`

**Step 1: Add route detection and conditional wrapper**

Replace the entire file content with:

```tsx
import { Outlet, useLocation } from 'react-router-dom';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { AppSidebar } from './AppSidebar';
import { TopBar } from './TopBar';

export function DashboardLayout() {
  const { pathname } = useLocation();
  const isFullBleed = pathname === '/';

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <TopBar />
        {isFullBleed ? (
          <div className="flex-1 relative overflow-hidden">
            <Outlet />
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-6">
            <Outlet />
          </div>
        )}
      </SidebarInset>
    </SidebarProvider>
  );
}
```

**Step 2: Verify other pages still work**

Run: `npm run dev -w admin`
Navigate to `/admin/users`, `/admin/schedules`, etc. — they should look identical (padded, scrollable). Navigate to `/admin/` — it should now render the Outlet with no padding and `overflow-hidden`.

**Step 3: Commit**

```bash
git add admin/src/components/layout/DashboardLayout.tsx
git commit -m "feat(admin): conditional full-bleed layout for dashboard route"
```

---

### Task 2: Create DashboardMap component

**Files:**
- Create: `admin/src/components/dashboard/DashboardMap.tsx`

**Step 1: Create the dashboard map component**

This reuses the same aircraft marker pattern from `admin/src/components/dispatch/FlightMap.tsx` but simplified — no trail, no selection, no click handler beyond navigation.

```tsx
import { useEffect, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import { useNavigate } from 'react-router-dom';
import L from 'leaflet';
import type { ActiveFlightHeartbeat } from '@acars/shared';
import 'leaflet/dist/leaflet.css';

const ACCENT = '#3b82f6';

function makeAircraftSvg(color: string) {
  return `<svg viewBox="0 0 64 64" width="28" height="28" xmlns="http://www.w3.org/2000/svg">
    <path d="M32 2C33.2 2 34 3.5 34 5.5L34 22L52 31C53.5 31.8 53.5 33.5 52 34L34 32.5V48L41 53.5C42 54.3 41.8 55.5 41 56L34 54L32.5 58C32.2 59 31.8 59 31.5 58L30 54L23 56C22.2 55.5 22 54.3 23 53.5L30 48V32.5L12 34C10.5 33.5 10.5 31.8 12 31L30 22V5.5C30 3.5 30.8 2 32 2Z" fill="${color}"/>
  </svg>`;
}

function makeIcon(heading: number) {
  return L.divIcon({
    html: `<div style="transform: rotate(${heading}deg); filter: drop-shadow(0 1px 4px rgba(0,0,0,0.7)); width: 28px; height: 28px; line-height: 0;">
      ${makeAircraftSvg(ACCENT)}
    </div>`,
    className: '',
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

interface MarkersProps {
  flights: ActiveFlightHeartbeat[];
}

function AircraftMarkers({ flights }: MarkersProps) {
  const map = useMap();
  const navigate = useNavigate();
  const markersRef = useRef<Map<string, L.Marker>>(new Map());

  const handleClick = useCallback(() => {
    navigate('/dispatch');
  }, [navigate]);

  useEffect(() => {
    const existing = markersRef.current;
    const currentCallsigns = new Set(flights.map((f) => f.callsign));

    for (const [cs, marker] of existing) {
      if (!currentCallsigns.has(cs)) {
        marker.remove();
        existing.delete(cs);
      }
    }

    for (const flight of flights) {
      if (flight.latitude === 0 && flight.longitude === 0) continue;
      const icon = makeIcon(flight.heading);

      const existingMarker = existing.get(flight.callsign);
      if (existingMarker) {
        existingMarker.setLatLng([flight.latitude, flight.longitude]);
        existingMarker.setIcon(icon);
      } else {
        const marker = L.marker([flight.latitude, flight.longitude], { icon })
          .addTo(map)
          .bindTooltip(flight.callsign, {
            permanent: false,
            direction: 'top',
            offset: [0, -14],
            className: 'aircraft-tooltip',
          });
        marker.on('click', handleClick);
        existing.set(flight.callsign, marker);
      }
    }
  }, [flights, map, handleClick]);

  useEffect(() => {
    return () => {
      for (const marker of markersRef.current.values()) {
        marker.remove();
      }
      markersRef.current.clear();
    };
  }, []);

  return null;
}

interface DashboardMapProps {
  flights: ActiveFlightHeartbeat[];
}

export function DashboardMap({ flights }: DashboardMapProps) {
  return (
    <MapContainer
      center={[30, -10]}
      zoom={3}
      className="h-full w-full"
      zoomControl={false}
      attributionControl={false}
    >
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        subdomains="abcd"
        maxZoom={19}
      />
      <AircraftMarkers flights={flights} />
    </MapContainer>
  );
}
```

**Step 2: Commit**

```bash
git add admin/src/components/dashboard/DashboardMap.tsx
git commit -m "feat(admin): add DashboardMap component with live flight markers"
```

---

### Task 3: Create OperationsPanel component

**Files:**
- Create: `admin/src/components/dashboard/OperationsPanel.tsx`

**Step 1: Create the consolidated operations panel**

Combines active flights count + pending PIREPs count (header badges) + recent flights table (body).

```tsx
import { Airplane, ClipboardText } from '@phosphor-icons/react';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from '@/components/ui/table';

interface RecentFlight {
  id: number;
  flightNumber: string;
  depIcao: string;
  arrIcao: string;
  status: string;
  pilotCallsign: string;
  landingRate: number | null;
  createdAt: string;
}

interface OperationsPanelProps {
  activeFlights: number;
  pendingPireps: number;
  recentFlights: RecentFlight[];
}

function statusBadge(status: string) {
  switch (status) {
    case 'approved':
      return (
        <Badge className="bg-emerald-500/15 text-emerald-500 border-emerald-500/25 hover:bg-emerald-500/20">
          Approved
        </Badge>
      );
    case 'pending':
      return (
        <Badge className="bg-amber-500/15 text-amber-500 border-amber-500/25 hover:bg-amber-500/20">
          Pending
        </Badge>
      );
    case 'rejected':
      return (
        <Badge className="bg-red-500/15 text-red-500 border-red-500/25 hover:bg-red-500/20">
          Rejected
        </Badge>
      );
    default:
      return (
        <Badge variant="secondary">
          {status.charAt(0).toUpperCase() + status.slice(1)}
        </Badge>
      );
  }
}

export function OperationsPanel({ activeFlights, pendingPireps, recentFlights }: OperationsPanelProps) {
  return (
    <div className="rounded-md bg-[#1c2033]/90 border border-border/50 shadow-inner">
      {/* Header */}
      <div className="flex items-center justify-between p-4 pb-3">
        <h2 className="text-sm font-semibold">Operations</h2>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Airplane size={14} weight="duotone" />
            <span className="font-mono font-medium text-foreground">{activeFlights}</span>
            <span>active</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <ClipboardText size={14} weight="duotone" />
            <span className="font-mono font-medium text-foreground">{pendingPireps}</span>
            <span>pending</span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 pb-4">
        {recentFlights.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No recent flights
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent border-border/50">
                <TableHead className="text-xs">Flight</TableHead>
                <TableHead className="text-xs">Route</TableHead>
                <TableHead className="text-xs">Pilot</TableHead>
                <TableHead className="text-xs text-right">Ldg Rate</TableHead>
                <TableHead className="text-xs text-right">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentFlights.map((f) => (
                <TableRow key={f.id} className="border-border/30">
                  <TableCell className="font-mono font-medium text-xs py-2">
                    {f.flightNumber}
                  </TableCell>
                  <TableCell className="text-xs py-2">
                    <span className="font-mono">{f.depIcao}</span>
                    <span className="text-muted-foreground mx-1">&rarr;</span>
                    <span className="font-mono">{f.arrIcao}</span>
                  </TableCell>
                  <TableCell className="text-xs py-2">{f.pilotCallsign}</TableCell>
                  <TableCell className="text-right font-mono text-xs py-2">
                    {f.landingRate !== null ? `${f.landingRate} fpm` : '--'}
                  </TableCell>
                  <TableCell className="text-right py-2">
                    {statusBadge(f.status)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add admin/src/components/dashboard/OperationsPanel.tsx
git commit -m "feat(admin): add consolidated OperationsPanel for dashboard"
```

---

### Task 4: Create FinancePanel component

**Files:**
- Create: `admin/src/components/dashboard/FinancePanel.tsx`

**Step 1: Create the consolidated finance panel**

Combines monthly revenue stat (header badge) + 6-month area chart (body). Reuses the exact Recharts config from `FinancialOverviewWidget.tsx`.

```tsx
import { CurrencyDollar } from '@phosphor-icons/react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface FinancialSummary {
  months: string[];
  income: number[];
  costs: number[];
  profit: number[];
}

interface FinancePanelProps {
  monthlyRevenue: number;
  financialSummary: FinancialSummary;
}

function formatRevenue(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}k`;
  return `$${value.toLocaleString()}`;
}

export function FinancePanel({ monthlyRevenue, financialSummary }: FinancePanelProps) {
  const chartData = financialSummary.months.map((month, i) => ({
    month,
    income: financialSummary.income[i] ?? 0,
    costs: financialSummary.costs[i] ?? 0,
    profit: financialSummary.profit[i] ?? 0,
  }));

  return (
    <div className="rounded-md bg-[#1c2033]/90 border border-border/50 shadow-inner">
      {/* Header */}
      <div className="flex items-center justify-between p-4 pb-3">
        <h2 className="text-sm font-semibold">Finance</h2>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <CurrencyDollar size={14} weight="duotone" />
          <span className="font-mono font-medium text-foreground">{formatRevenue(monthlyRevenue)}</span>
          <span>this month</span>
        </div>
      </div>

      {/* Content */}
      <div className="px-2 pb-4">
        {chartData.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No financial data available
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="dashFillIncome" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="dashFillCosts" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="dashFillProfit" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2e3f" />
              <XAxis
                dataKey="month"
                tick={{ fill: '#8b8fa3', fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: '#2a2e3f' }}
              />
              <YAxis
                tick={{ fill: '#8b8fa3', fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v: number) => (v >= 1000 ? `$${(v / 1000).toFixed(0)}k` : `$${v}`)}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1a1d2e',
                  border: '1px solid #2a2e3f',
                  borderRadius: '6px',
                  color: '#e8eaed',
                  fontSize: 12,
                }}
                formatter={(value: number | string | undefined) => [
                  `$${Number(value ?? 0).toLocaleString()}`,
                ]}
                labelStyle={{ color: '#8b8fa3' }}
              />
              <Area type="monotone" dataKey="income" stroke="#3b82f6" fill="url(#dashFillIncome)" strokeWidth={2} name="Income" />
              <Area type="monotone" dataKey="costs" stroke="#ef4444" fill="url(#dashFillCosts)" strokeWidth={2} name="Costs" />
              <Area type="monotone" dataKey="profit" stroke="#22c55e" fill="url(#dashFillProfit)" strokeWidth={2} name="Profit" />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add admin/src/components/dashboard/FinancePanel.tsx
git commit -m "feat(admin): add consolidated FinancePanel for dashboard"
```

---

### Task 5: Create FleetPanel component

**Files:**
- Create: `admin/src/components/dashboard/FleetPanel.tsx`

**Step 1: Create the consolidated fleet panel**

Combines fleet health % (header badge) + maintenance alerts list (body). Reuses severity patterns from `MaintenanceAlertsWidget.tsx`.

```tsx
import { Heartbeat, Warning, WarningCircle, CheckCircle } from '@phosphor-icons/react';

interface MaintenanceAlert {
  type: string;
  aircraftReg: string;
  description: string;
  severity: string;
}

interface FleetPanelProps {
  fleetHealthPct: number;
  maintenanceAlerts: MaintenanceAlert[];
}

function severityIcon(severity: string) {
  switch (severity) {
    case 'critical':
      return <WarningCircle weight="fill" className="h-4 w-4 text-red-500 shrink-0" />;
    case 'warning':
      return <Warning weight="fill" className="h-4 w-4 text-amber-500 shrink-0" />;
    default:
      return <Warning weight="fill" className="h-4 w-4 text-muted-foreground shrink-0" />;
  }
}

function severityBorder(severity: string) {
  switch (severity) {
    case 'critical':
      return 'border-l-red-500';
    case 'warning':
      return 'border-l-amber-500';
    default:
      return 'border-l-muted-foreground';
  }
}

export function FleetPanel({ fleetHealthPct, maintenanceAlerts }: FleetPanelProps) {
  return (
    <div className="rounded-md bg-[#1c2033]/90 border border-border/50 shadow-inner">
      {/* Header */}
      <div className="flex items-center justify-between p-4 pb-3">
        <h2 className="text-sm font-semibold">Fleet</h2>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Heartbeat size={14} weight="duotone" />
          <span className="font-mono font-medium text-foreground">{fleetHealthPct}%</span>
          <span>healthy</span>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 pb-4">
        {maintenanceAlerts.length === 0 ? (
          <div className="flex items-center gap-2 py-3 justify-center text-muted-foreground">
            <CheckCircle weight="fill" className="h-4 w-4 text-emerald-500" />
            <span className="text-xs">No active alerts</span>
          </div>
        ) : (
          <div className="space-y-1.5">
            {maintenanceAlerts.map((alert, i) => (
              <div
                key={i}
                className={`flex items-start gap-2.5 rounded border-l-2 bg-white/5 p-2.5 ${severityBorder(alert.severity)}`}
              >
                {severityIcon(alert.severity)}
                <div className="min-w-0">
                  <p className="text-xs font-medium font-mono">
                    {alert.aircraftReg}
                    <span className="ml-2 text-muted-foreground font-sans font-normal">
                      {alert.type}
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-tight">
                    {alert.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add admin/src/components/dashboard/FleetPanel.tsx
git commit -m "feat(admin): add consolidated FleetPanel for dashboard"
```

---

### Task 6: Create PilotsPanel component

**Files:**
- Create: `admin/src/components/dashboard/PilotsPanel.tsx`

**Step 1: Create the pilots panel**

Horizontal bar chart of top 10 pilots by hours. Reuses exact Recharts config from `PilotActivityWidget.tsx`.

```tsx
import { Users } from '@phosphor-icons/react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface PilotActivity {
  callsign: string;
  firstName: string;
  lastName: string;
  hoursThisMonth: number;
}

interface PilotsPanelProps {
  pilotActivity: PilotActivity[];
}

export function PilotsPanel({ pilotActivity }: PilotsPanelProps) {
  const chartData = pilotActivity.map((p) => ({
    name: p.callsign || `${p.firstName} ${p.lastName}`,
    hours: p.hoursThisMonth,
  }));

  return (
    <div className="rounded-md bg-[#1c2033]/90 border border-border/50 shadow-inner">
      {/* Header */}
      <div className="flex items-center justify-between p-4 pb-3">
        <h2 className="text-sm font-semibold">Pilots</h2>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Users size={14} weight="duotone" />
          <span>hours this month</span>
        </div>
      </div>

      {/* Content */}
      <div className="px-2 pb-4">
        {chartData.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No pilot activity data
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2e3f" horizontal={false} />
              <XAxis
                type="number"
                tick={{ fill: '#8b8fa3', fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: '#2a2e3f' }}
              />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fill: '#e8eaed', fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                width={70}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1a1d2e',
                  border: '1px solid #2a2e3f',
                  borderRadius: '6px',
                  color: '#e8eaed',
                  fontSize: 12,
                }}
                formatter={(value: number | string | undefined) => [`${Number(value ?? 0).toFixed(1)} hrs`, 'Hours']}
                labelStyle={{ color: '#8b8fa3' }}
                cursor={{ fill: 'rgba(59,130,246,0.08)' }}
              />
              <Bar dataKey="hours" fill="#3b82f6" radius={[0, 4, 4, 0]} maxBarSize={24} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add admin/src/components/dashboard/PilotsPanel.tsx
git commit -m "feat(admin): add PilotsPanel for dashboard"
```

---

### Task 7: Rewrite DashboardPage with map + overlay panels

**Files:**
- Modify: `admin/src/pages/DashboardPage.tsx`

**Step 1: Rewrite the full DashboardPage**

Replace the entire file with the new implementation that layers map + overlay panels.

```tsx
import { useEffect, useState } from 'react';
import type { ActiveFlightHeartbeat } from '@acars/shared';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { useSocketStore } from '@/stores/socketStore';
import { useSocket } from '@/hooks/useSocket';
import { Skeleton } from '@/components/ui/skeleton';
import { DashboardMap } from '@/components/dashboard/DashboardMap';
import { OperationsPanel } from '@/components/dashboard/OperationsPanel';
import { FinancePanel } from '@/components/dashboard/FinancePanel';
import { FleetPanel } from '@/components/dashboard/FleetPanel';
import { PilotsPanel } from '@/components/dashboard/PilotsPanel';

interface DashboardData {
  activeFlights: number;
  pendingPireps: number;
  fleetHealthPct: number;
  monthlyRevenue: number;
  recentFlights: Array<{
    id: number;
    flightNumber: string;
    depIcao: string;
    arrIcao: string;
    status: string;
    pilotCallsign: string;
    landingRate: number | null;
    createdAt: string;
  }>;
  maintenanceAlerts: Array<{
    type: string;
    aircraftReg: string;
    description: string;
    severity: string;
  }>;
  pilotActivity: Array<{
    callsign: string;
    firstName: string;
    lastName: string;
    hoursThisMonth: number;
  }>;
  financialSummary: {
    months: string[];
    income: number[];
    costs: number[];
    profit: number[];
  };
}

function DashboardSkeleton() {
  return (
    <div className="absolute inset-0 z-10 p-6 space-y-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Skeleton className="h-[320px] rounded-md lg:col-span-2 bg-[#1c2033]/60" />
        <Skeleton className="h-[320px] rounded-md bg-[#1c2033]/60" />
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Skeleton className="h-[280px] rounded-md bg-[#1c2033]/60" />
        <Skeleton className="h-[280px] rounded-md bg-[#1c2033]/60" />
      </div>
    </div>
  );
}

export function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [flights, setFlights] = useState<ActiveFlightHeartbeat[]>([]);

  const accessToken = useAuthStore((s) => s.accessToken);
  const { connect, connected } = useSocketStore();

  // Fetch dashboard data
  useEffect(() => {
    let cancelled = false;

    api
      .get<DashboardData>('/api/admin/dashboard')
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message ?? 'Failed to load dashboard');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Connect socket for live map
  useEffect(() => {
    if (accessToken && !connected) {
      connect(accessToken);
    }
  }, [accessToken, connected, connect]);

  // Subscribe to live flights
  useSocket<ActiveFlightHeartbeat[]>('flights:active', (data) => {
    setFlights(data);
  }, {
    subscribeEvent: 'livemap:subscribe',
    unsubscribeEvent: 'livemap:unsubscribe',
  });

  return (
    <div className="absolute inset-0">
      {/* Map layer */}
      <div className="absolute inset-0 z-0">
        <DashboardMap flights={flights} />
      </div>

      {/* Widget overlay */}
      <div className="absolute inset-0 z-10 pointer-events-none overflow-y-auto">
        <div className="p-6 space-y-4 pointer-events-none">
          {loading ? (
            <DashboardSkeleton />
          ) : error || !data ? (
            <div className="pointer-events-auto rounded-md bg-[#1c2033]/90 border border-border/50 p-8 text-center text-muted-foreground">
              {error ?? 'Unable to load dashboard data'}
            </div>
          ) : (
            <>
              {/* Row 1: Operations (2/3) + Finance (1/3) */}
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                <div className="lg:col-span-2 pointer-events-auto">
                  <OperationsPanel
                    activeFlights={data.activeFlights}
                    pendingPireps={data.pendingPireps}
                    recentFlights={data.recentFlights}
                  />
                </div>
                <div className="pointer-events-auto">
                  <FinancePanel
                    monthlyRevenue={data.monthlyRevenue}
                    financialSummary={data.financialSummary}
                  />
                </div>
              </div>

              {/* Row 2: Fleet (1/2) + Pilots (1/2) */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="pointer-events-auto">
                  <FleetPanel
                    fleetHealthPct={data.fleetHealthPct}
                    maintenanceAlerts={data.maintenanceAlerts}
                  />
                </div>
                <div className="pointer-events-auto">
                  <PilotsPanel pilotActivity={data.pilotActivity} />
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Verify the page renders**

Run: `npm run dev -w admin` (if not already running)
Navigate to `http://localhost:5174/admin/` — should see:
1. Full-viewport dark map in background
2. Four consolidated overlay panels with 90% opacity backgrounds
3. Map visible between and through panels
4. Panels scrollable, map interactive in gaps

**Step 3: Commit**

```bash
git add admin/src/pages/DashboardPage.tsx
git commit -m "feat(admin): rewrite dashboard with map backdrop and consolidated panels"
```

---

### Task 8: Delete old unused widget files

**Files:**
- Delete: `admin/src/components/widgets/StatCard.tsx`
- Delete: `admin/src/components/widgets/RecentFlightsWidget.tsx`
- Delete: `admin/src/components/widgets/FinancialOverviewWidget.tsx`
- Delete: `admin/src/components/widgets/MaintenanceAlertsWidget.tsx`
- Delete: `admin/src/components/widgets/PilotActivityWidget.tsx`

**Step 1: Verify no other files import the old widgets**

Search the codebase for imports from `@/components/widgets/` in any file other than `DashboardPage.tsx` (which we already rewrote). If any other file imports these, keep those specific files.

Run: `grep -r "components/widgets/" admin/src/ --include="*.tsx" --include="*.ts"`

Expected: Only references should be in the old widget files themselves (if self-referencing) or none at all. If `DashboardPage.tsx` was fully rewritten, there should be zero references.

**Step 2: Delete the files**

```bash
rm admin/src/components/widgets/StatCard.tsx
rm admin/src/components/widgets/RecentFlightsWidget.tsx
rm admin/src/components/widgets/FinancialOverviewWidget.tsx
rm admin/src/components/widgets/MaintenanceAlertsWidget.tsx
rm admin/src/components/widgets/PilotActivityWidget.tsx
rmdir admin/src/components/widgets 2>/dev/null || true
```

**Step 3: Commit**

```bash
git add -A admin/src/components/widgets/
git commit -m "chore(admin): remove old dashboard widget files replaced by consolidated panels"
```

---

### Task 9: Visual QA and polish

**Step 1: Test responsive behavior**

1. Open `http://localhost:5174/admin/` at full desktop width — panels should be 2-column grid
2. Resize to tablet width — row 1 should collapse to single column, row 2 same
3. Check that map is pannable/zoomable in gaps between panels
4. Check that panel content (tables, charts) is interactive
5. Check that panel tooltips (Recharts, Leaflet) render correctly

**Step 2: Test navigation**

1. Click sidebar links (Users, Schedules, etc.) — they should still have padded layout
2. Click back to Dashboard — map + overlays should restore
3. If any live flights are active, verify aircraft markers render and tooltip shows callsign

**Step 3: Test the skeleton loading state**

Temporarily throttle network in browser dev tools to see skeleton state renders over the map background correctly.

**Step 4: Fix any visual issues found**

Adjust spacing, opacity, font sizes as needed. Common issues to watch for:
- Recharts gradient IDs conflicting with dispatch page (already handled: prefixed with `dash`)
- Leaflet map not filling viewport (needs parent `absolute inset-0`)
- Pointer events not passing through to map (needs `pointer-events-none` on overlay container)

**Step 5: Final commit if any polish changes were needed**

```bash
git add -A
git commit -m "fix(admin): dashboard map overlay visual polish"
```
