import { useState, useEffect, useCallback, useMemo, Suspense, lazy } from 'react';
import type { ActiveFlightHeartbeat, Airport } from '@acars/shared';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { useSocketStore } from '@/stores/socketStore';
import { useSocket } from '@/hooks/useSocket';
import type {
  FinancialKPIs,
  MaintenanceSummary,
  FlightActivity,
  PilotActivityEntry,
  FleetUtilizationEntry,
  VatsimPilotSummary,
  AcarsMessage,
  HubWeather,
  PeriodPnlEntry,
  RouteMarginEntry,
} from '@/types/dashboard';
import { FinanceCard } from '@/components/dashboard/FinanceCard';
import { MaintenanceCard } from '@/components/dashboard/MaintenanceCard';
import { SchedulesCard } from '@/components/dashboard/SchedulesCard';
import { FlightsCard } from '@/components/dashboard/FlightsCard';

const WorldMap = lazy(() =>
  import('@/components/map/WorldMap').then((m) => ({ default: m.WorldMap })),
);

// ── Empty initial state ──────────────────────────────────────

const EMPTY_KPIS: FinancialKPIs = {
  balance: { totalIncome: 0, totalExpenses: 0, netBalance: 0, months: [] },
  revenue: { totalRtm: 0, totalFlights: 0, yieldByRoute: [], fleetAvgLoadFactor: 0, charterRevenue: 0, charterFlights: 0, fuelSurchargeRecovery: 0 },
  costs: { fuelPerBlockHour: 0, costPerRtm: 0, crewPerBlockHour: 0, maintByTail: [] },
  profitability: { ratm: 0, catm: 0, ratmCatmSpread: 0, ratmTrend: [], catmTrend: [], marginByRoute: [], marginByType: [] },
  network: { revenueByStation: [], hubLoadFactor: 0, outstationLoadFactor: 0, hubs: [], yieldTrend: [] },
};

const EMPTY_MAINTENANCE: MaintenanceSummary = {
  fleetStatus: { airworthy: 0, melDispatch: 0, inCheck: 0, aog: 0 },
  criticalMel: [],
  nextChecks: [],
  openDiscrepancies: { open: 0, inReview: 0, deferred: 0 },
};

const EMPTY_ACTIVITY: FlightActivity = { scheduled: [], completed: [] };

// ── Page ─────────────────────────────────────────────────────

export function DashboardPage() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const { acquire } = useSocketStore();

  // ── Data state ──────────────────────────────────────────
  const [kpis, setKpis] = useState<FinancialKPIs>(EMPTY_KPIS);
  const [maintenance, setMaintenance] = useState<MaintenanceSummary>(EMPTY_MAINTENANCE);
  const [activity, setActivity] = useState<FlightActivity>(EMPTY_ACTIVITY);
  const [liveFlights, setLiveFlights] = useState<ActiveFlightHeartbeat[]>([]);
  const [pendingPireps, setPendingPireps] = useState(0);
  const [onTimePct, setOnTimePct] = useState(0);
  const [pilotActivity, setPilotActivity] = useState<PilotActivityEntry[]>([]);
  const [fleetUtilization, setFleetUtilization] = useState<FleetUtilizationEntry[]>([]);
  const [vatsimPilots, setVatsimPilots] = useState<VatsimPilotSummary[]>([]);
  const [acarsMessages, setAcarsMessages] = useState<AcarsMessage[]>([]);
  const [hubWeather, setHubWeather] = useState<HubWeather[]>([]);
  const [periodPnl, setPeriodPnl] = useState<PeriodPnlEntry[]>([]);
  const [routeMargins, setRouteMargins] = useState<RouteMarginEntry[]>([]);
  const [hubs, setHubs] = useState<{ lat: number; lon: number }[]>([
    { lat: 35.04, lon: -89.98 }, // KMEM
    { lat: 61.17, lon: -149.99 }, // PANC
  ]);
  const [dbFlights, setDbFlights] = useState<Array<{
    bid_id: number; user_id: number; callsign: string; flight_number: string;
    dep_icao: string; arr_icao: string; aircraft_type: string;
    dep_lat: number | null; dep_lon: number | null; arr_lat: number | null; arr_lon: number | null;
  }>>([]);

  // ── Socket ──────────────────────────────────────────────
  useEffect(() => {
    if (accessToken) return acquire(accessToken);
  }, [accessToken, acquire]);

  useSocket<ActiveFlightHeartbeat[]>('flights:active', setLiveFlights, {
    subscribeEvent: 'livemap:subscribe',
    unsubscribeEvent: 'livemap:unsubscribe',
  });

  // ── Fetch data ──────────────────────────────────────────
  const fetchKpis = useCallback(async () => {
    try {
      const data = await api.get<FinancialKPIs>('/api/admin/dashboard/financial-kpis');
      setKpis(data);
    } catch { /* ignore */ }
  }, []);

  const fetchMaintenance = useCallback(async () => {
    try {
      const data = await api.get<MaintenanceSummary>('/api/admin/dashboard/maintenance-summary');
      setMaintenance(data);
    } catch { /* ignore */ }
  }, []);

  const fetchHubs = useCallback(async () => {
    try {
      const res = await api.get<{ airports: Airport[] }>('/api/admin/airports');
      const apiHubs = res.airports.filter((a: any) => a.isHub).map((a) => ({ lat: a.lat, lon: a.lon }));
      if (apiHubs.length > 0) setHubs(apiHubs);
    } catch { /* ignore */ }
  }, []);

  const fetchActiveFlights = useCallback(async () => {
    try {
      const data = await api.get<typeof dbFlights>('/api/admin/dashboard/active-flights');
      if (Array.isArray(data)) setDbFlights(data);
    } catch { /* ignore */ }
  }, []);

  const fetchDashboard = useCallback(async () => {
    try {
      const data = await api.get<{
        pilotActivity: PilotActivityEntry[];
        periodPnl?: PeriodPnlEntry[];
        routeMargins?: RouteMarginEntry[];
      }>('/api/admin/dashboard');
      if (data.pilotActivity) setPilotActivity(data.pilotActivity);
      if (data.periodPnl) setPeriodPnl(data.periodPnl);
      if (data.routeMargins) setRouteMargins(data.routeMargins);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    fetchKpis();
    fetchMaintenance();
    fetchHubs();
    fetchActiveFlights();
    fetchDashboard();
  }, [fetchKpis, fetchMaintenance, fetchHubs, fetchActiveFlights, fetchDashboard]);

  // Merge live socket flights with DB fallback for map
  const mapFlights = useMemo(() => {
    if (liveFlights.length > 0) {
      return liveFlights.map((f) => ({
        latitude: f.latitude,
        longitude: f.longitude,
        heading: f.heading,
        callsign: f.callsign,
        flightNumber: f.flightNumber,
        aircraftType: f.aircraftType,
        depIcao: f.depIcao,
        arrIcao: f.arrIcao,
        depLat: f.depLat,
        depLon: f.depLon,
        arrLat: f.arrLat,
        arrLon: f.arrLon,
      }));
    }
    if (dbFlights.length > 0) {
      return dbFlights.map((f) => ({
        latitude: f.dep_lat ?? 0,
        longitude: f.dep_lon ?? 0,
        heading: 0,
        callsign: f.callsign,
        flightNumber: f.flight_number,
        aircraftType: f.aircraft_type,
        depIcao: f.dep_icao,
        arrIcao: f.arr_icao,
        depLat: f.dep_lat ?? undefined,
        depLon: f.dep_lon ?? undefined,
        arrLat: f.arr_lat ?? undefined,
        arrLon: f.arr_lon ?? undefined,
      }));
    }
    return [];
  }, [liveFlights, dbFlights]);

  // ── Selection state (shared between map & flights table) ──
  const [selectedCallsign, setSelectedCallsign] = useState<string | null>(null);

  return (
    <div className="h-full overflow-auto p-5">
      <div
        className="grid gap-3 h-full"
        style={{
          gridTemplateColumns: '30% 1fr',
          gridTemplateRows: '1fr 1fr',
        }}
      >
        {/* ── Left column: Finance / Maintenance / Schedules ── */}
        <div className="row-span-2 flex flex-col gap-3 min-h-0 overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
          {/* Finance Card */}
          <FinanceCard data={kpis} periodPnl={periodPnl} />

          {/* Maintenance Card */}
          <MaintenanceCard data={maintenance} />

          {/* Schedules Card */}
          <SchedulesCard />
        </div>

        {/* ── Right column: Map (50%) ── */}
        <div className="rounded-lg border border-[var(--border-primary)] overflow-hidden relative">
          <Suspense fallback={null}>
            <WorldMap
              hubs={hubs}
              flights={mapFlights}
              selectedCallsign={selectedCallsign}
              onSelectCallsign={setSelectedCallsign}
            />
          </Suspense>
        </div>

        {/* ── Right column: Live / Recent Flights (50%) ── */}
        <FlightsCard
          liveFlights={liveFlights}
          selectedCallsign={selectedCallsign}
          onSelectFlight={setSelectedCallsign}
        />
      </div>
    </div>
  );
}

export default DashboardPage;
