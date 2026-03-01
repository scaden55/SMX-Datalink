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
