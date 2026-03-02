import { useEffect, useState } from 'react';
import type { ActiveFlightHeartbeat } from '@acars/shared';
import { AirplaneTilt, ClipboardText, Heartbeat, CurrencyDollar } from '@phosphor-icons/react';
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

  // --- MOCK DATA (remove this block to restore live data) ---
  useEffect(() => {
    const mock: DashboardData = {
      activeFlights: 4,
      pendingPireps: 7,
      fleetHealthPct: 91,
      monthlyRevenue: 284600,
      flightsPerDay: [
        { day: 1, count: 12 }, { day: 2, count: 9 }, { day: 3, count: 15 },
        { day: 4, count: 11 }, { day: 5, count: 14 }, { day: 6, count: 8 },
        { day: 7, count: 13 },
      ],
      recentFlights: [
        { id: 1, flightNumber: 'SMA401', depIcao: 'KMIA', arrIcao: 'KJFK', status: 'approved', pilotCallsign: 'SMA041', landingRate: -142, createdAt: '2026-03-02T11:22:00Z' },
        { id: 2, flightNumber: 'SMA118', depIcao: 'PANC', arrIcao: 'KSEA', status: 'pending', pilotCallsign: 'SMA007', landingRate: -198, createdAt: '2026-03-02T09:45:00Z' },
        { id: 3, flightNumber: 'SMA762', depIcao: 'KMEM', arrIcao: 'KORD', status: 'approved', pilotCallsign: 'SMA023', landingRate: -88, createdAt: '2026-03-02T07:30:00Z' },
        { id: 4, flightNumber: 'SMA205', depIcao: 'KLAX', arrIcao: 'PHNL', status: 'rejected', pilotCallsign: 'SMA012', landingRate: -387, createdAt: '2026-03-01T22:15:00Z' },
        { id: 5, flightNumber: 'SMA550', depIcao: 'KATL', arrIcao: 'KDFW', status: 'approved', pilotCallsign: 'SMA055', landingRate: -112, createdAt: '2026-03-01T18:00:00Z' },
      ],
      maintenanceAlerts: [
        { type: 'Engine Inspection', aircraftReg: 'N401SM', description: 'Left engine overdue for 500hr inspection by 12 cycles', severity: 'warning' },
        { type: 'APU Fault', aircraftReg: 'N118SM', description: 'APU auto-shutdown reported on last 3 flights', severity: 'critical' },
        { type: 'Tire Replacement', aircraftReg: 'N762SM', description: 'Main gear tires at 85% wear — schedule swap', severity: 'warning' },
      ],
      pilotActivity: [
        { callsign: 'SMA041', firstName: 'James', lastName: 'Carter', hoursThisMonth: 47.2 },
        { callsign: 'SMA007', firstName: 'Elena', lastName: 'Voss', hoursThisMonth: 38.8 },
        { callsign: 'SMA023', firstName: 'Marcus', lastName: 'Chen', hoursThisMonth: 33.1 },
        { callsign: 'SMA012', firstName: 'Sarah', lastName: 'Blake', hoursThisMonth: 28.5 },
        { callsign: 'SMA055', firstName: 'David', lastName: 'Okafor', hoursThisMonth: 21.7 },
      ],
      financialSummary: {
        months: ['Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb'],
        income:  [195000, 210000, 248000, 231000, 267000, 284600],
        costs:   [142000, 155000, 168000, 162000, 171000, 178400],
        profit:  [ 53000,  55000,  80000,  69000,  96000, 106200],
      },
    };

    const mockFlights: ActiveFlightHeartbeat[] = [
      { userId: 1, callsign: 'SMA041', aircraftType: 'B763F', latitude: 35.8, longitude: -78.4, altitude: 36000, heading: 42, groundSpeed: 480, phase: 'CRUISE', timestamp: new Date().toISOString() },
      { userId: 2, callsign: 'SMA007', aircraftType: 'B744F', latitude: 55.2, longitude: -148.6, altitude: 34000, heading: 155, groundSpeed: 465, phase: 'CRUISE', timestamp: new Date().toISOString() },
      { userId: 3, callsign: 'SMA023', aircraftType: 'A306F', latitude: 39.1, longitude: -89.2, altitude: 28000, heading: 18, groundSpeed: 420, phase: 'CLIMB', timestamp: new Date().toISOString() },
      { userId: 4, callsign: 'SMA055', aircraftType: 'B77LF', latitude: 32.9, longitude: -97.1, altitude: 4200, heading: 265, groundSpeed: 165, phase: 'APPROACH', timestamp: new Date().toISOString() },
    ];

    setData(mock);
    setFlights(mockFlights);
    setLoading(false);
  }, []);
  // --- END MOCK DATA ---

  // Connect socket for live map (disabled during mock)
  // useEffect(() => {
  //   if (accessToken && !connected) {
  //     connect(accessToken);
  //   }
  // }, [accessToken, connected, connect]);

  // Subscribe to live flights (disabled during mock)
  // useSocket<ActiveFlightHeartbeat[]>('flights:active', (data) => {
  //   setFlights(data);
  // }, {
  //   subscribeEvent: 'livemap:subscribe',
  //   unsubscribeEvent: 'livemap:unsubscribe',
  // });

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
