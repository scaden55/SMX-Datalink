import { useEffect, useState } from 'react';
import {
  Airplane,
  ClipboardText,
  Heartbeat,
  CurrencyDollar,
} from '@phosphor-icons/react';
import { api } from '@/lib/api';
import { Skeleton } from '@/components/ui/skeleton';
import { StatCard } from '@/components/widgets/StatCard';
import { RecentFlightsWidget } from '@/components/widgets/RecentFlightsWidget';
import { FinancialOverviewWidget } from '@/components/widgets/FinancialOverviewWidget';
import { MaintenanceAlertsWidget } from '@/components/widgets/MaintenanceAlertsWidget';
import { PilotActivityWidget } from '@/components/widgets/PilotActivityWidget';

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

function formatRevenue(value: number): string {
  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(1)}M`;
  }
  if (value >= 1_000) {
    return `$${(value / 1_000).toFixed(1)}k`;
  }
  return `$${value.toLocaleString()}`;
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      {/* Stat cards skeleton */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[110px] rounded-xl" />
        ))}
      </div>
      {/* Row 2 skeleton */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Skeleton className="h-[350px] rounded-xl lg:col-span-2" />
        <Skeleton className="h-[350px] rounded-xl" />
      </div>
      {/* Row 3 skeleton */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Skeleton className="h-[300px] rounded-xl" />
        <Skeleton className="h-[300px] rounded-xl" />
      </div>
    </div>
  );
}

export function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  if (loading) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-semibold mb-6">Dashboard</h1>
        <DashboardSkeleton />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-semibold mb-6">Dashboard</h1>
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <p>{error ?? 'Unable to load dashboard data'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-6">Dashboard</h1>

      <div className="space-y-6">
        {/* Row 1: Stat Cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Active Flights"
            value={data.activeFlights}
            icon={<Airplane size={22} weight="duotone" />}
          />
          <StatCard
            title="Pending PIREPs"
            value={data.pendingPireps}
            icon={<ClipboardText size={22} weight="duotone" />}
          />
          <StatCard
            title="Fleet Health"
            value={`${data.fleetHealthPct}%`}
            icon={<Heartbeat size={22} weight="duotone" />}
          />
          <StatCard
            title="Monthly Revenue"
            value={formatRevenue(data.monthlyRevenue)}
            icon={<CurrencyDollar size={22} weight="duotone" />}
          />
        </div>

        {/* Row 2: Recent Flights + Financial Overview */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <RecentFlightsWidget flights={data.recentFlights} />
          </div>
          <div>
            <FinancialOverviewWidget data={data.financialSummary} />
          </div>
        </div>

        {/* Row 3: Maintenance Alerts + Pilot Activity */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <MaintenanceAlertsWidget alerts={data.maintenanceAlerts} />
          <PilotActivityWidget data={data.pilotActivity} />
        </div>
      </div>
    </div>
  );
}
