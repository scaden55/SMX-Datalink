import { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { motion } from 'motion/react';
import type { ActiveFlightHeartbeat, Airport } from '@acars/shared';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { useSocketStore } from '@/stores/socketStore';
import { useSocket } from '@/hooks/useSocket';
import { pageVariants } from '@/lib/motion';
import type { FinancialKPIs, MaintenanceSummary, FlightActivity } from '@/types/dashboard';
import { FinanceColumn } from '@/components/dashboard/FinanceColumn';
import { MaintenanceColumn } from '@/components/dashboard/MaintenanceColumn';
import { FlightStrip } from '@/components/dashboard/FlightStrip';

const WorldMap = lazy(() =>
  import('@/components/map/WorldMap').then((m) => ({ default: m.WorldMap })),
);

// ── Shimmer / Error ──────────────────────────────────────────

const SHIMMER_WIDTHS = [85, 70, 95, 60, 80, 75, 90, 65];

function Shimmer({ lines = 4 }: { lines?: number }) {
  return (
    <div className="flex flex-col gap-3 p-2 animate-pulse">
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="rounded"
          style={{
            height: 12,
            background: 'rgba(255,255,255,0.04)',
            width: `${SHIMMER_WIDTHS[i % SHIMMER_WIDTHS.length]}%`,
          }}
        />
      ))}
    </div>
  );
}

function ErrorMsg({ msg }: { msg: string }) {
  return <div className="font-mono p-2" style={{ color: '#3a3a3a', fontSize: 9 }}>{msg}</div>;
}

// ── Page ─────────────────────────────────────────────────────

export function DashboardPage() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const { acquire } = useSocketStore();

  // ── Data state ──────────────────────────────────────────
  const [kpis, setKpis] = useState<FinancialKPIs | null>(null);
  const [kpiError, setKpiError] = useState(false);
  const [maintenance, setMaintenance] = useState<MaintenanceSummary | null>(null);
  const [maintError, setMaintError] = useState(false);
  const [activity, setActivity] = useState<FlightActivity | null>(null);
  const [activityError, setActivityError] = useState(false);
  const [liveFlights, setLiveFlights] = useState<ActiveFlightHeartbeat[]>([]);
  const [hubs, setHubs] = useState<{ lat: number; lon: number }[]>([]);

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
    } catch {
      setKpiError(true);
    }
  }, []);

  const fetchMaintenance = useCallback(async () => {
    try {
      const data = await api.get<MaintenanceSummary>('/api/admin/dashboard/maintenance-summary');
      setMaintenance(data);
    } catch {
      setMaintError(true);
    }
  }, []);

  const fetchActivity = useCallback(async () => {
    try {
      const data = await api.get<FlightActivity>('/api/admin/dashboard/flight-activity');
      setActivity(data);
    } catch {
      setActivityError(true);
    }
  }, []);

  const fetchHubs = useCallback(async () => {
    try {
      const res = await api.get<{ airports: Airport[] }>('/api/admin/airports');
      setHubs(res.airports.filter((a: any) => a.isHub).map((a) => ({ lat: a.lat, lon: a.lon })));
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    fetchKpis();
    fetchMaintenance();
    fetchActivity();
    fetchHubs();
  }, [fetchKpis, fetchMaintenance, fetchActivity, fetchHubs]);

  // ── Derived ─────────────────────────────────────────────
  const mapFlights = liveFlights.map((f) => ({
    latitude: f.latitude,
    longitude: f.longitude,
    callsign: f.callsign,
  }));

  const networkStats = kpis
    ? {
        hubLoadFactor: kpis.network.hubLoadFactor,
        outstationLoadFactor: kpis.network.outstationLoadFactor,
        revenuePerDeparture:
          kpis.network.revenueByStation.length > 0
            ? kpis.network.revenueByStation.reduce((sum, s) => sum + s.revenuePerDeparture, 0) /
              kpis.network.revenueByStation.length
            : 0,
      }
    : { hubLoadFactor: 0, outstationLoadFactor: 0, revenuePerDeparture: 0 };

  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
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
        {kpiError ? (
          <ErrorMsg msg="Failed to load financial data" />
        ) : kpis ? (
          <FinanceColumn data={kpis} />
        ) : (
          <Shimmer lines={8} />
        )}
      </div>

      {/* ── Center: Map + Flight Strip ────────────────────── */}
      <div className="relative rounded-lg overflow-hidden" style={{ background: '#080808' }}>
        <div className="absolute inset-0">
          <Suspense fallback={null}>
            <WorldMap hubs={hubs} flights={mapFlights} />
          </Suspense>
        </div>
        <FlightStrip liveFlights={liveFlights} activity={activityError ? null : activity} />
      </div>

      {/* ── Right: Maintenance ────────────────────────────── */}
      <div className="overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
        {maintError ? (
          <ErrorMsg msg="Failed to load maintenance data" />
        ) : maintenance ? (
          <MaintenanceColumn data={maintenance} network={networkStats} />
        ) : (
          <Shimmer lines={8} />
        )}
      </div>
    </motion.div>
  );
}

export default DashboardPage;
