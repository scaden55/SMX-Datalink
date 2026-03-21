import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { useSharedMap } from '@/components/layout/SharedMapContext';
import type {
  FinancialKPIs,
  MaintenanceSummary,
  FlightActivity,
  PilotActivityEntry,
  PeriodPnlEntry,
  RouteMarginEntry,
} from '@/types/dashboard';
import { FinanceCard } from '@/components/dashboard/FinanceCard';
import { MaintenanceCard } from '@/components/dashboard/MaintenanceCard';
import { SchedulesCard } from '@/components/dashboard/SchedulesCard';

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

// ── Page ─────────────────────────────────────────────────────

export function DashboardPage() {
  const { selectedCallsign, setSelectedCallsign } = useSharedMap();
  const [mounted, setMounted] = useState(false);
  const firstName = useAuthStore((s) => s.firstName);

  useEffect(() => {
    requestAnimationFrame(() => setMounted(true));
    return () => setMounted(false);
  }, []);

  // ── Data state ──────────────────────────────────────────
  const [kpis, setKpis] = useState<FinancialKPIs>(EMPTY_KPIS);
  const [maintenance, setMaintenance] = useState<MaintenanceSummary>(EMPTY_MAINTENANCE);
  const [pilotActivity, setPilotActivity] = useState<PilotActivityEntry[]>([]);
  const [periodPnl, setPeriodPnl] = useState<PeriodPnlEntry[]>([]);
  const [routeMargins, setRouteMargins] = useState<RouteMarginEntry[]>([]);

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
    fetchDashboard();
  }, [fetchKpis, fetchMaintenance, fetchDashboard]);

  return (
    <div className="h-full flex pointer-events-none">

      {/* ── Left: Welcome + Finance + Maintenance ── */}
      <div
        className={`map-panel-left ${mounted ? 'active' : ''} pointer-events-auto flex flex-col overflow-y-auto`}
        style={{ width: 360, flexShrink: 0, padding: '24px 0 24px 24px', scrollbarWidth: 'none' }}
      >
        {/* Welcome greeting — no background */}
        <h1
          className="text-display font-display"
          style={{ fontSize: 32, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 20, lineHeight: 1.1 }}
        >
          Welcome, {firstName || 'Operator'}
        </h1>

        {/* Finance */}
        <div className="glass-panel">
          <FinanceCard data={kpis} periodPnl={periodPnl} />
        </div>

        <div style={{ height: 12 }} />

        {/* Maintenance */}
        <div className="glass-panel">
          <MaintenanceCard data={maintenance} />
        </div>
      </div>

      {/* ── Center spacer (map shows through) ── */}
      <div className="flex-1 min-w-0 pointer-events-none" />

      {/* ── Right: Schedules ── */}
      <div
        className={`map-panel-right ${mounted ? 'active' : ''} pointer-events-auto flex flex-col overflow-y-auto`}
        style={{ width: 360, flexShrink: 0, padding: '24px 24px 24px 0', scrollbarWidth: 'none' }}
      >
        <div className="glass-panel">
          <SchedulesCard />
        </div>
      </div>
    </div>
  );
}

export default DashboardPage;
