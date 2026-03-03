import { useEffect, useState } from 'react';
import type { ActiveFlightHeartbeat } from '@acars/shared';
import { AirplaneTilt, ClipboardText, Heartbeat, CurrencyDollar } from '@phosphor-icons/react';
import { api, ApiError } from '@/lib/api';
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
  flightsPerDay: Array<{ day: number; count: number }>;
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

function formatKpiRevenue(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}k`;
  return `$${value.toLocaleString()}`;
}

function DashboardSkeleton() {
  return (
    <div className="space-y-3 pointer-events-none">
      <div className="grid grid-cols-2 gap-2">
        <Skeleton className="h-[76px] rounded-md bg-[#1c2033]/60" />
        <Skeleton className="h-[76px] rounded-md bg-[#1c2033]/60" />
        <Skeleton className="h-[76px] rounded-md bg-[#1c2033]/60" />
        <Skeleton className="h-[76px] rounded-md bg-[#1c2033]/60" />
      </div>
      <Skeleton className="h-[160px] rounded-md bg-[#1c2033]/60" />
      <Skeleton className="h-[120px] rounded-md bg-[#1c2033]/60" />
      <Skeleton className="h-[180px] rounded-md bg-[#1c2033]/60" />
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

  // Fetch dashboard data from API
  useEffect(() => {
    let cancelled = false;
    async function fetchDashboard() {
      try {
        const res = await api.get<DashboardData>('/api/admin/dashboard');
        if (!cancelled) {
          setData(res);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : 'Failed to load dashboard');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchDashboard();
    return () => { cancelled = true; };
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

      {/* Widget sidebar — pinned left, scrollable, map stays visible */}
      <div className="absolute top-0 left-0 bottom-0 z-10 w-[360px] pointer-events-none overflow-y-auto">
        <div className="p-4 space-y-3 pointer-events-none">
          {loading ? (
            <DashboardSkeleton />
          ) : error || !data ? (
            <div className="pointer-events-auto rounded-md bg-[#1c2033]/90 border border-border/50 p-6 text-center text-muted-foreground text-sm">
              {error ?? 'Unable to load dashboard data'}
            </div>
          ) : (
            <>
              {/* KPI Stat Cards */}
              <div className="grid grid-cols-2 gap-2 pointer-events-auto">
                <div className="rounded-md bg-[#1c2033]/90 border border-border/50 border-l-[3px] border-l-blue-500 p-3">
                  <div className="flex items-center gap-1.5">
                    <AirplaneTilt size={13} weight="duotone" className="text-blue-400" />
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Flights</span>
                  </div>
                  <p className="text-xl font-mono font-bold mt-1 leading-none">{data.activeFlights}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">active now</p>
                </div>

                <div className="rounded-md bg-[#1c2033]/90 border border-border/50 border-l-[3px] border-l-amber-500 p-3">
                  <div className="flex items-center gap-1.5">
                    <ClipboardText size={13} weight="duotone" className="text-amber-400" />
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">PIREPs</span>
                  </div>
                  <p className="text-xl font-mono font-bold mt-1 leading-none">{data.pendingPireps}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">pending review</p>
                </div>

                <div className="rounded-md bg-[#1c2033]/90 border border-border/50 border-l-[3px] border-l-emerald-500 p-3">
                  <div className="flex items-center gap-1.5">
                    <Heartbeat size={13} weight="duotone" className="text-emerald-400" />
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Fleet</span>
                  </div>
                  <p className="text-xl font-mono font-bold mt-1 leading-none">
                    {data.fleetHealthPct}<span className="text-sm text-muted-foreground">%</span>
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-1">operational</p>
                </div>

                <div className="rounded-md bg-[#1c2033]/90 border border-border/50 border-l-[3px] border-l-cyan-500 p-3">
                  <div className="flex items-center gap-1.5">
                    <CurrencyDollar size={13} weight="duotone" className="text-cyan-400" />
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Revenue</span>
                  </div>
                  <p className="text-xl font-mono font-bold mt-1 leading-none">{formatKpiRevenue(data.monthlyRevenue)}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">this month</p>
                </div>
              </div>

              {/* Detail Panels */}
              <div className="pointer-events-auto">
                <OperationsPanel
                  activeFlights={data.activeFlights}
                  pendingPireps={data.pendingPireps}
                  recentFlights={data.recentFlights}
                />
              </div>
              <div className="pointer-events-auto">
                <FleetPanel
                  fleetHealthPct={data.fleetHealthPct}
                  maintenanceAlerts={data.maintenanceAlerts}
                />
              </div>
              <div className="pointer-events-auto">
                <FinancePanel
                  monthlyRevenue={data.monthlyRevenue}
                  financialSummary={data.financialSummary}
                />
              </div>
              <div className="pointer-events-auto">
                <PilotsPanel pilotActivity={data.pilotActivity} />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
