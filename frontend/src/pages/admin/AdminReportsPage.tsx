import { useState, useEffect } from 'react';
import { BarChart3, Plane, Clock, AlertCircle, DollarSign, Users, MapPin, Trophy, Loader2, RefreshCw } from 'lucide-react';
import { AdminPageHeader } from '../../components/admin/AdminPageHeader';
import { api } from '../../lib/api';
import type { ReportResponse, FinanceSummary } from '@acars/shared';

// ── Local response types for admin endpoints ────────────────────

interface PirepListResponse {
  pendingCount: number;
}

interface UserListResponse {
  total: number;
}

// ── Helpers ─────────────────────────────────────────────────────

function fmtNum(n: number): string {
  return n.toLocaleString('en-US');
}

function fmtHours(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${fmtNum(h)}h ${m}m`;
}

function fmtCurrency(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

function fmtCurrencyFull(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);
}

// ── Component ───────────────────────────────────────────────────

export function AdminReportsPage() {
  const [report, setReport] = useState<ReportResponse | null>(null);
  const [pendingPireps, setPendingPireps] = useState<number>(0);
  const [financeSummary, setFinanceSummary] = useState<FinanceSummary | null>(null);
  const [totalUsers, setTotalUsers] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [reportData, pirepData, financeData, userData] = await Promise.all([
        api.get<ReportResponse>('/api/reports'),
        api.get<PirepListResponse>('/api/admin/pireps?pageSize=1'),
        api.get<FinanceSummary>('/api/admin/finances/summary'),
        api.get<UserListResponse>('/api/admin/users?pageSize=1'),
      ]);
      setReport(reportData);
      setPendingPireps(pirepData.pendingCount ?? 0);
      setFinanceSummary(financeData);
      setTotalUsers(userData.total ?? 0);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load report data';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // ── Loading / Error states ──────────────────────────────────

  if (loading) {
    return (
      <div className="p-6">
        <AdminPageHeader icon={BarChart3} title="Admin Reports" subtitle="Operational overview and analytics" />
        <div className="flex items-center justify-center gap-2 mt-12 text-acars-muted text-sm">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading report data...
        </div>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="p-6">
        <AdminPageHeader icon={BarChart3} title="Admin Reports" subtitle="Operational overview and analytics" />
        <div className="panel mt-6 p-8 flex flex-col items-center gap-3">
          <AlertCircle className="w-6 h-6 text-acars-red" />
          <p className="text-sm text-acars-red">{error ?? 'No data available'}</p>
          <button
            onClick={fetchData}
            className="mt-2 px-4 py-1.5 text-xs rounded bg-acars-blue/20 text-acars-blue hover:bg-acars-blue/30 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const { summary, financials, topRoutes, byPilot, volume } = report;
  const maxRouteCount = topRoutes.length > 0 ? Math.max(...topRoutes.map(r => r.flights)) : 1;
  const maxVolumeFlights = volume.length > 0 ? Math.max(...volume.map(v => v.flights)) : 1;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <AdminPageHeader
        icon={BarChart3}
        title="Admin Reports"
        subtitle="Operational overview and analytics"
        actions={
          <button
            onClick={fetchData}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded bg-acars-panel border border-acars-border text-acars-muted hover:text-acars-text transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
        }
      />

      {/* ── Overview Stat Cards ─────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          icon={Plane}
          label="Total Flights"
          value={fmtNum(summary.totalFlights)}
          color="text-acars-blue"
          iconBg="bg-acars-blue/10"
        />
        <StatCard
          icon={Clock}
          label="Total Hours"
          value={fmtHours(summary.totalHoursMin)}
          color="text-acars-green"
          iconBg="bg-acars-green/10"
        />
        <StatCard
          icon={AlertCircle}
          label="Pending PIREPs"
          value={fmtNum(pendingPireps)}
          color={pendingPireps > 0 ? 'text-acars-amber' : 'text-acars-muted'}
          iconBg={pendingPireps > 0 ? 'bg-acars-amber/10' : 'bg-acars-panel'}
          highlight={pendingPireps > 0}
        />
        <StatCard
          icon={DollarSign}
          label="Net Revenue"
          value={fmtCurrency(financials.netProfit)}
          color={financials.netProfit >= 0 ? 'text-acars-green' : 'text-acars-red'}
          iconBg={financials.netProfit >= 0 ? 'bg-acars-green/10' : 'bg-acars-red/10'}
        />
      </div>

      {/* ── Two-column grid for main sections ──────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* ── Top Routes ────────────────────────────────────────── */}
        <div className="panel p-0 overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-acars-border">
            <MapPin className="w-4 h-4 text-acars-blue" />
            <h2 className="text-sm font-semibold text-acars-text">Top Routes</h2>
            <span className="ml-auto text-[10px] text-acars-muted uppercase tracking-wider">
              {topRoutes.length} route{topRoutes.length !== 1 ? 's' : ''}
            </span>
          </div>
          {topRoutes.length === 0 ? (
            <div className="p-6 text-center text-xs text-acars-muted">No route data available</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-acars-border text-[10px] uppercase tracking-wider text-acars-muted">
                    <th className="px-4 py-2 text-left w-8">#</th>
                    <th className="px-4 py-2 text-left">Route</th>
                    <th className="px-4 py-2 text-right w-16">Flights</th>
                    <th className="px-4 py-2 text-left min-w-[120px]"></th>
                  </tr>
                </thead>
                <tbody>
                  {topRoutes.map((route, i) => {
                    const pct = (route.flights / maxRouteCount) * 100;
                    return (
                      <tr key={`${route.depIcao}-${route.arrIcao}`} className="border-b border-acars-border/50 hover:bg-white/[0.02] transition-colors">
                        <td className="px-4 py-2 text-acars-muted font-mono">{i + 1}</td>
                        <td className="px-4 py-2">
                          <span className="text-acars-text font-medium">{route.depIcao}</span>
                          <span className="text-acars-muted mx-1.5">&rarr;</span>
                          <span className="text-acars-text font-medium">{route.arrIcao}</span>
                        </td>
                        <td className="px-4 py-2 text-right text-acars-text font-mono">{route.flights}</td>
                        <td className="px-4 py-2">
                          <div className="h-1.5 rounded-full bg-acars-blue/20 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-acars-blue transition-all duration-500"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── Top Pilots ────────────────────────────────────────── */}
        <div className="panel p-0 overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-acars-border">
            <Trophy className="w-4 h-4 text-acars-amber" />
            <h2 className="text-sm font-semibold text-acars-text">Top Pilots</h2>
            <span className="ml-auto text-[10px] text-acars-muted uppercase tracking-wider">
              {byPilot.length} pilot{byPilot.length !== 1 ? 's' : ''}
            </span>
          </div>
          {byPilot.length === 0 ? (
            <div className="p-6 text-center text-xs text-acars-muted">No pilot data available</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-acars-border text-[10px] uppercase tracking-wider text-acars-muted">
                    <th className="px-4 py-2 text-left w-8">#</th>
                    <th className="px-4 py-2 text-left">Callsign</th>
                    <th className="px-4 py-2 text-left">Name</th>
                    <th className="px-4 py-2 text-right">Flights</th>
                    <th className="px-4 py-2 text-right">Hours</th>
                    <th className="px-4 py-2 text-right">Avg Score</th>
                  </tr>
                </thead>
                <tbody>
                  {byPilot.slice(0, 10).map((pilot, i) => (
                    <tr key={pilot.callsign} className="border-b border-acars-border/50 hover:bg-white/[0.02] transition-colors">
                      <td className="px-4 py-2 text-acars-muted font-mono">{i + 1}</td>
                      <td className="px-4 py-2 text-acars-blue font-medium font-mono">{pilot.callsign}</td>
                      <td className="px-4 py-2 text-acars-text">{pilot.pilotName}</td>
                      <td className="px-4 py-2 text-right text-acars-text font-mono">{pilot.flights}</td>
                      <td className="px-4 py-2 text-right text-acars-muted font-mono">{fmtHours(pilot.hoursMin)}</td>
                      <td className="px-4 py-2 text-right">
                        {pilot.avgScore != null ? (
                          <span className={pilot.avgScore >= 80 ? 'text-acars-green' : pilot.avgScore >= 60 ? 'text-acars-amber' : 'text-acars-red'}>
                            {pilot.avgScore}%
                          </span>
                        ) : (
                          <span className="text-acars-muted">--</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ── Financial Summary ───────────────────────────────────── */}
      {financeSummary && (
        <div className="panel p-0 overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-acars-border">
            <DollarSign className="w-4 h-4 text-acars-green" />
            <h2 className="text-sm font-semibold text-acars-text">Financial Summary</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-px bg-acars-border/30">
            <FinanceCard label="Total Pay" value={financeSummary.totalPay} color="text-acars-blue" />
            <FinanceCard label="Bonuses" value={financeSummary.totalBonuses} color="text-acars-green" />
            <FinanceCard label="Deductions" value={financeSummary.totalDeductions} color="text-acars-red" negative />
            <FinanceCard label="Expenses" value={financeSummary.totalExpenses} color="text-acars-red" negative />
            <FinanceCard label="Income" value={financeSummary.totalIncome} color="text-acars-green" />
            <FinanceCard label="Net Total" value={financeSummary.netTotal} color={financeSummary.netTotal >= 0 ? 'text-acars-green' : 'text-acars-red'} />
          </div>
        </div>
      )}

      {/* ── Bottom two-column: Flight Volume + Additional Stats ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* ── Flight Volume ──────────────────────────────────────── */}
        <div className="panel p-0 overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-acars-border">
            <BarChart3 className="w-4 h-4 text-acars-blue" />
            <h2 className="text-sm font-semibold text-acars-text">Flight Volume</h2>
            <span className="ml-auto text-[10px] text-acars-muted uppercase tracking-wider">
              {report.period === 'all-time' ? 'All Time (Monthly)' : report.period}
            </span>
          </div>
          {volume.length === 0 ? (
            <div className="p-6 text-center text-xs text-acars-muted">No volume data available</div>
          ) : (
            <div className="p-4">
              <div className="flex items-end gap-1" style={{ height: 120 }}>
                {volume.map((v) => {
                  const pct = (v.flights / maxVolumeFlights) * 100;
                  return (
                    <div
                      key={v.date}
                      className="flex-1 group relative flex flex-col items-center justify-end"
                      style={{ height: '100%' }}
                    >
                      <div className="absolute -top-5 left-1/2 -translate-x-1/2 hidden group-hover:block bg-acars-panel border border-acars-border rounded px-1.5 py-0.5 text-[9px] text-acars-text whitespace-nowrap z-10 shadow-lg">
                        {v.date}: {v.flights}
                      </div>
                      <div
                        className="w-full rounded-t bg-acars-blue/80 hover:bg-acars-blue transition-colors min-h-[2px]"
                        style={{ height: `${Math.max(pct, 2)}%` }}
                      />
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-between mt-2 text-[9px] text-acars-muted font-mono">
                <span>{volume[0]?.date}</span>
                <span>{volume[volume.length - 1]?.date}</span>
              </div>
            </div>
          )}
        </div>

        {/* ── Additional Stats ────────────────────────────────────── */}
        <div className="panel p-0 overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-acars-border">
            <Users className="w-4 h-4 text-acars-blue" />
            <h2 className="text-sm font-semibold text-acars-text">Additional Stats</h2>
          </div>
          <div className="p-4 space-y-3">
            <MiniStat label="Total Pilots" value={fmtNum(totalUsers)} />
            <MiniStat label="Total Distance" value={`${fmtNum(summary.totalDistanceNm)} nm`} />
            <MiniStat label="Total Fuel Used" value={`${fmtNum(summary.totalFuelLbs)} lbs`} />
            <MiniStat label="Total Passengers" value={fmtNum(summary.totalPax)} />
            <MiniStat label="Total Cargo" value={`${fmtNum(summary.totalCargoLbs)} lbs`} />
            <MiniStat label="Avg Score" value={summary.avgScore != null ? `${summary.avgScore}%` : '--'} />
            <MiniStat label="Avg Landing Rate" value={summary.avgLandingRate != null ? `${summary.avgLandingRate} fpm` : '--'} />
            <MiniStat label="Profit Margin" value={`${financials.profitMargin}%`} color={financials.profitMargin >= 0 ? 'text-acars-green' : 'text-acars-red'} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────

function StatCard({
  icon: Icon,
  label,
  value,
  color,
  iconBg,
  highlight,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  color: string;
  iconBg: string;
  highlight?: boolean;
}) {
  return (
    <div className={`panel px-4 py-3 flex items-center gap-3 ${highlight ? 'ring-1 ring-acars-amber/40' : ''}`}>
      <div className={`flex items-center justify-center w-9 h-9 rounded-lg ${iconBg} shrink-0`}>
        <Icon className={`w-4 h-4 ${color}`} />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wider text-acars-muted mb-0.5">{label}</p>
        <p className={`text-lg font-semibold ${color} truncate`}>{value}</p>
      </div>
    </div>
  );
}

function FinanceCard({
  label,
  value,
  color,
  negative,
}: {
  label: string;
  value: number;
  color: string;
  negative?: boolean;
}) {
  return (
    <div className="bg-acars-panel px-4 py-3">
      <p className="text-[10px] uppercase tracking-wider text-acars-muted mb-1">{label}</p>
      <p className={`text-sm font-semibold ${color}`}>
        {negative && value > 0 ? '-' : ''}{fmtCurrencyFull(Math.abs(value))}
      </p>
    </div>
  );
}

function MiniStat({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-acars-border/30 last:border-0">
      <span className="text-xs text-acars-muted">{label}</span>
      <span className={`text-xs font-medium font-mono ${color ?? 'text-acars-text'}`}>{value}</span>
    </div>
  );
}
