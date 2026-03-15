import { useState, useEffect, useCallback, Suspense, lazy } from 'react';
import { motion } from 'motion/react';
import type { ActiveFlightHeartbeat, Airport } from '@acars/shared';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { useSocketStore } from '@/stores/socketStore';
import { useSocket } from '@/hooks/useSocket';
import { pageVariants } from '@/lib/motion';
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
import { FinanceColumn } from '@/components/dashboard/FinanceColumn';
import { MaintenanceColumn } from '@/components/dashboard/MaintenanceColumn';
import { OpsFleetColumn } from '@/components/dashboard/OpsFleetColumn';
import { NetworkFlightsColumn } from '@/components/dashboard/NetworkFlightsColumn';

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
  const [hubs, setHubs] = useState<{ lat: number; lon: number }[]>([]);
  const [pendingPireps, setPendingPireps] = useState(0);
  const [onTimePct, setOnTimePct] = useState(0);
  const [pilotActivity, setPilotActivity] = useState<PilotActivityEntry[]>([]);
  const [fleetUtilization, setFleetUtilization] = useState<FleetUtilizationEntry[]>([]);
  const [vatsimPilots, setVatsimPilots] = useState<VatsimPilotSummary[]>([]);
  const [acarsMessages, setAcarsMessages] = useState<AcarsMessage[]>([]);
  const [hubWeather, setHubWeather] = useState<HubWeather[]>([]);
  const [periodPnl, setPeriodPnl] = useState<PeriodPnlEntry[]>([]);
  const [routeMargins, setRouteMargins] = useState<RouteMarginEntry[]>([]);

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

  const fetchActivity = useCallback(async () => {
    try {
      const data = await api.get<FlightActivity>('/api/admin/dashboard/flight-activity');
      setActivity(data);
    } catch { /* ignore */ }
  }, []);

  const fetchHubs = useCallback(async () => {
    try {
      const res = await api.get<{ airports: Airport[] }>('/api/admin/airports');
      const apiHubs = res.airports.filter((a: any) => a.isHub).map((a) => ({ lat: a.lat, lon: a.lon }));
      if (apiHubs.length > 0) setHubs(apiHubs);
    } catch { /* keep mock */ }
  }, []);

  const fetchPireps = useCallback(async () => {
    try {
      const data = await api.get<{ pendingCount: number }>('/api/admin/pireps?pageSize=1');
      if (typeof data.pendingCount === 'number') setPendingPireps(data.pendingCount);
    } catch { /* ignore */ }
  }, []);

  const fetchOnTime = useCallback(async () => {
    try {
      const data = await api.get<{ percentage: number }>('/api/admin/reports/on-time');
      if (typeof data.percentage === 'number') setOnTimePct(Math.round(data.percentage));
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

  const fetchFleetUtil = useCallback(async () => {
    try {
      const data = await api.get<FleetUtilizationEntry[]>('/api/admin/reports/fleet-utilization');
      if (Array.isArray(data)) setFleetUtilization(data);
    } catch { /* ignore */ }
  }, []);

  const fetchVatsim = useCallback(async () => {
    try {
      const data = await api.get<Array<{ callsign: string; flight_plan?: { departure: string; arrival: string } }>>('/api/vatsim/pilots');
      const smx = data
        .filter((p) => p.callsign.startsWith('SMX'))
        .map((p) => ({
          callsign: p.callsign,
          departure: p.flight_plan?.departure ?? '????',
          arrival: p.flight_plan?.arrival ?? '????',
        }));
      setVatsimPilots(smx); // Always update — zero pilots is valid state
    } catch { /* keep mock */ }
  }, []);

  const fetchAcars = useCallback(async () => {
    try {
      const data = await api.get<AcarsMessage[]>('/api/admin/dashboard/acars/recent');
      if (Array.isArray(data)) setAcarsMessages(data); // Always update — empty is valid
    } catch { /* keep mock */ }
  }, []);

  const fetchWeather = useCallback(async (hubs: string[]) => {
    if (hubs.length === 0) return;
    try {
      const data = await api.get<Array<{ icaoId: string; temp: number; visib: string; fltcat: string }>>(
        `/api/weather/metar?ids=${hubs.join(',')}`
      );
      if (Array.isArray(data) && data.length > 0) {
        setHubWeather(
          data.map((m) => ({
            icao: m.icaoId,
            flightRules: (['VFR', 'MVFR', 'IFR'].includes(m.fltcat) ? m.fltcat : 'VFR') as HubWeather['flightRules'],
            tempC: Math.round(m.temp),
            visibility: m.visib || '10SM',
          }))
        );
      }
    } catch { /* keep mock */ }
  }, []);

  useEffect(() => {
    fetchKpis();
    fetchMaintenance();
    fetchActivity();
    fetchHubs();
    fetchPireps();
    fetchOnTime();
    fetchDashboard();
    fetchFleetUtil();
    fetchVatsim();
    fetchAcars();
  }, [fetchKpis, fetchMaintenance, fetchActivity, fetchHubs, fetchPireps, fetchOnTime, fetchDashboard, fetchFleetUtil, fetchVatsim, fetchAcars]);

  useEffect(() => {
    if (kpis.network.hubs.length > 0) fetchWeather(kpis.network.hubs);
  }, [kpis.network.hubs, fetchWeather]);

  // ── Derived ─────────────────────────────────────────────
  const mapFlights = liveFlights.map((f) => ({
    latitude: f.latitude,
    longitude: f.longitude,
    callsign: f.callsign,
  }));

  const networkStats = {
    hubLoadFactor: kpis.network.hubLoadFactor,
    outstationLoadFactor: kpis.network.outstationLoadFactor,
    revenuePerDeparture:
      kpis.network.revenueByStation.length > 0
        ? kpis.network.revenueByStation.reduce((sum, s) => sum + s.revenuePerDeparture, 0) /
          kpis.network.revenueByStation.length
        : 0,
  };

  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      className="relative h-full overflow-hidden"
    >
      {/* ── Full-bleed map background ─────────────────────── */}
      <div className="absolute inset-0">
        <Suspense fallback={null}>
          <WorldMap hubs={hubs} flights={mapFlights} />
        </Suspense>
      </div>

      {/* ── 3-column overlay grid ─────────────────────────── */}
      <div
        className="relative h-full"
        style={{
          display: 'grid',
          gridTemplateColumns: '280px 1fr 280px',
          padding: '16px 20px',
          gap: '0 8px',
        }}
      >
        {/* Col 1: Finance + Ops & Fleet (stacked) */}
        <div className="min-h-0 overflow-y-auto" style={{ scrollbarWidth: 'none', maxHeight: '100%' }}>
          <div className="flex flex-col gap-2">
            <div className="rounded-lg p-4" style={{ background: 'rgba(0, 0, 0, 0.45)' }}>
              <FinanceColumn data={kpis} periodPnl={periodPnl} routeMargins={routeMargins} />
            </div>
            <div className="rounded-lg p-4" style={{ background: 'rgba(0, 0, 0, 0.45)' }}>
              <OpsFleetColumn
                pendingPireps={pendingPireps}
                onTimePct={onTimePct}
                pilotsOnline={liveFlights.length}
                pilotActivity={pilotActivity}
                fleetUtilization={fleetUtilization}
                kpis={kpis}
              />
            </div>
          </div>
        </div>

        {/* Col 2: Map (transparent center) */}
        <div />

        {/* Col 4: Network & Flights + Fleet Status (stacked) */}
        <div className="min-h-0 overflow-y-auto" style={{ scrollbarWidth: 'none', maxHeight: '100%' }}>
          <div className="flex flex-col gap-2">
            <div className="rounded-lg p-4" style={{ background: 'rgba(0, 0, 0, 0.45)' }}>
              <NetworkFlightsColumn
                liveFlights={liveFlights}
                activity={activity}
                vatsimPilots={vatsimPilots}
                acarsMessages={acarsMessages}
                hubWeather={hubWeather}
              />
            </div>
            <div className="rounded-lg p-4" style={{ background: 'rgba(0, 0, 0, 0.45)' }}>
              <MaintenanceColumn data={maintenance} network={networkStats} />
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export default DashboardPage;
