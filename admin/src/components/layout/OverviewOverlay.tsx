import { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { useSharedMap } from './SharedMapContext';
import { OverviewFlightCard } from './OverviewFlightCard';
import type {
  FinancialKPIs,
  MaintenanceSummary,
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

// ── Component ────────────────────────────────────────────────

interface OverviewOverlayProps {
  active: boolean;
}

export function OverviewOverlay({ active }: OverviewOverlayProps) {
  const firstName = useAuthStore((s) => s.user?.firstName);
  const { selectedCallsign, setSelectedCallsign, dispatchFlights, liveFlights } = useSharedMap();

  // Find the selected flight data for the overview card
  const selectedFlightData = useMemo(() => {
    if (!selectedCallsign) return null;

    // Try dispatch flights first
    const df = dispatchFlights.find((f) => f.pilot.callsign === selectedCallsign);
    if (df) {
      // Find matching heartbeat for live telemetry
      const hb = liveFlights.find((h) => h.callsign === selectedCallsign);
      return {
        callsign: df.pilot.callsign,
        flightNumber: df.bid.flightNumber,
        depIcao: df.bid.depIcao,
        arrIcao: df.bid.arrIcao,
        aircraftType: df.bid.aircraftType ?? undefined,
        phase: df.phase,
        altitude: hb?.altitude,
        groundSpeed: hb?.groundSpeed,
        bidId: df.bid.id,
      };
    }

    // Fall back to heartbeat-only
    const hb = liveFlights.find((h) => h.callsign === selectedCallsign);
    if (hb) {
      return {
        callsign: hb.callsign,
        flightNumber: hb.flightNumber,
        depIcao: hb.depIcao,
        arrIcao: hb.arrIcao,
        aircraftType: hb.aircraftType,
        altitude: hb.altitude,
        groundSpeed: hb.groundSpeed,
        bidId: hb.bidId,
      };
    }

    return null;
  }, [selectedCallsign, dispatchFlights, liveFlights]);

  // ── Data state ──────────────────────────────────────────
  const [kpis, setKpis] = useState<FinancialKPIs>(EMPTY_KPIS);
  const [maintenance, setMaintenance] = useState<MaintenanceSummary>(EMPTY_MAINTENANCE);
  const [periodPnl, setPeriodPnl] = useState<PeriodPnlEntry[]>([]);

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
      if (data.periodPnl) setPeriodPnl(data.periodPnl);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    fetchKpis();
    fetchMaintenance();
    fetchDashboard();
  }, [fetchKpis, fetchMaintenance, fetchDashboard]);

  return (
    <div className="absolute inset-0 flex pointer-events-none">
      {/* ── Left: Welcome + Finance + Maintenance ── */}
      <div
        className={`map-panel-left ${active ? 'active' : ''} pointer-events-auto flex flex-col overflow-y-auto`}
        style={{ width: 360, flexShrink: 0, padding: '24px 0 24px 24px', scrollbarWidth: 'none' }}
      >
        {/* Welcome greeting */}
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
        className={`map-panel-right ${active ? 'active' : ''} pointer-events-auto flex flex-col overflow-y-auto`}
        style={{ width: 360, flexShrink: 0, padding: '24px 24px 24px 0', scrollbarWidth: 'none' }}
      >
        <div className="glass-panel">
          <SchedulesCard />
        </div>
      </div>

      {/* ── Overview flight info card (bottom-left) ── */}
      {active && selectedFlightData && (
        <OverviewFlightCard
          {...selectedFlightData}
          onClose={() => setSelectedCallsign(null)}
        />
      )}
    </div>
  );
}
