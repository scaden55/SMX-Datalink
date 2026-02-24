import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ChartBar,
  CaretLeft,
  CaretRight,
  CaretDown,
  SpinnerGap,
  AirplaneTilt,
  Clock,
  Ruler,
  GasPump,
  Users,
  Package,
  Target,
  ArrowDown,
  ArrowRight,
  ArrowCounterClockwise,
  Calendar,
  Infinity,
  CurrencyDollar,
  Receipt,
  TrendUp,
  Wrench,
  UserCheck,
  RadioButton,
} from '@phosphor-icons/react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts';
import { api } from '../lib/api';
import type { ReportResponse, FinancialSummary } from '@acars/shared';

// ── Theme colors (match tailwind.config) ────────────────────────

const COLORS = {
  cyan: 'var(--cyan)',
  blue: 'var(--cyan)',
  green: 'var(--status-green)',
  amber: 'var(--status-amber)',
  red: 'var(--status-red)',
  text: 'var(--text-primary)',
  muted: 'var(--text-secondary)',
  panel: 'var(--bg-panel)',
  border: 'var(--border-panel)',
  bg: 'var(--bg-app)',
};

// ── Helpers ─────────────────────────────────────────────────────

function formatDuration(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}h ${String(m).padStart(2, '0')}m`;
}

function formatNumber(n: number): string {
  return n.toLocaleString();
}

function formatCurrency(amount: number): string {
  const abs = Math.abs(amount);
  const sign = amount < 0 ? '-' : '';
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(1)}K`;
  return `${sign}$${abs.toLocaleString()}`;
}

function formatCurrencyFull(amount: number): string {
  const abs = Math.abs(amount);
  const sign = amount < 0 ? '-' : '';
  return `${sign}$${abs.toLocaleString()}`;
}

function monthLabel(month: string): string {
  const [y, m] = month.split('-');
  const date = new Date(Number(y), Number(m) - 1);
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function prevMonth(month: string): string {
  const [y, m] = month.split('-').map(Number);
  if (m === 1) return `${y - 1}-12`;
  return `${y}-${String(m - 1).padStart(2, '0')}`;
}

function nextMonth(month: string): string {
  const [y, m] = month.split('-').map(Number);
  if (m === 12) return `${y + 1}-01`;
  return `${y}-${String(m + 1).padStart(2, '0')}`;
}

function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

// ── Custom Recharts Tooltip ─────────────────────────────────────

function DarkTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-acars-border bg-acars-panel px-3 py-2 text-xs shadow-lg">
      <p className="text-acars-muted mb-1 font-medium">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color }} className="font-semibold">
          {p.name}: {typeof p.value === 'number' ? formatNumber(p.value) : p.value}
        </p>
      ))}
    </div>
  );
}

// ── Stat Card ───────────────────────────────────────────────────

function StatCard({ icon: Icon, label, value, color }: {
  icon: typeof AirplaneTilt;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="rounded-md border border-acars-border bg-acars-panel p-3 flex flex-col gap-1 min-w-0">
      <div className="flex items-center gap-2">
        <Icon className="w-3.5 h-3.5 flex-shrink-0" style={{ color }} />
        <span className="text-[10px] uppercase tracking-wider text-acars-muted font-medium truncate">{label}</span>
      </div>
      <span className="text-lg font-bold text-acars-text font-mono truncate">{value}</span>
    </div>
  );
}

// ── Expense Line Item ───────────────────────────────────────────

function ExpenseRow({ icon: Icon, label, amount, pct, color, description }: {
  icon: typeof GasPump;
  label: string;
  amount: number;
  pct: number;
  color: string;
  description: string;
}) {
  return (
    <div className="group">
      <div className="flex items-center gap-3 py-2.5">
        <div className="flex items-center justify-center w-7 h-7 rounded-md flex-shrink-0" style={{ backgroundColor: `${color}15` }}>
          <Icon className="w-3.5 h-3.5" style={{ color }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-acars-text">{label}</span>
              <span className="text-[10px] text-acars-muted">{description}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-mono text-acars-muted">{pct.toFixed(1)}%</span>
              <span className="text-xs font-mono font-semibold text-acars-text min-w-[80px] text-right">{formatCurrencyFull(amount)}</span>
            </div>
          </div>
          <div className="h-1.5 rounded-full bg-acars-border overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: color }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Aircraft Filter Dropdown ────────────────────────────────────

function AircraftFilter({ options, value, onChange }: {
  options: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="h-7 px-2.5 rounded-md border border-acars-border bg-acars-bg text-xs font-medium text-acars-text hover:border-sky-400/40 transition-colors flex items-center gap-1.5"
      >
        <AirplaneTilt className="w-3 h-3 text-acars-muted" />
        <span>{value === 'all' ? 'All Aircraft' : value}</span>
        <CaretDown className={`w-3 h-3 text-acars-muted transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-20 min-w-[140px] rounded-md border border-acars-border bg-acars-panel shadow-xl py-1">
            <button
              onClick={() => { onChange('all'); setOpen(false); }}
              className={`w-full text-left px-3 py-1.5 text-xs transition-colors ${value === 'all' ? 'text-sky-400 bg-sky-500/5' : 'text-acars-text hover:bg-acars-border'}`}
            >
              All Aircraft
            </button>
            {options.map(type => (
              <button
                key={type}
                onClick={() => { onChange(type); setOpen(false); }}
                className={`w-full text-left px-3 py-1.5 text-xs font-mono transition-colors ${value === type ? 'text-sky-400 bg-sky-500/5' : 'text-acars-text hover:bg-acars-border'}`}
              >
                {type}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ── ReportsPage ─────────────────────────────────────────────────

export function ReportsPage() {
  const [month, setMonth] = useState<string>(currentMonth());
  const [allTime, setAllTime] = useState(false);
  const [report, setReport] = useState<ReportResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [aircraftFilter, setAircraftFilter] = useState('all');

  const fetchReport = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = allTime ? '' : `?month=${month}`;
      const data = await api.get<ReportResponse>(`/api/reports${params}`);
      setReport(data);
    } catch (err: any) {
      setError(err?.message || 'Failed to load report');
    } finally {
      setLoading(false);
    }
  }, [month, allTime]);

  useEffect(() => { fetchReport(); }, [fetchReport]);

  // Reset aircraft filter when period changes
  useEffect(() => { setAircraftFilter('all'); }, [month, allTime]);

  const handleAllTimeToggle = () => {
    setAllTime(v => !v);
  };

  const s = report?.summary;

  // Derive the active financial data based on filter
  const aircraftTypes = useMemo(() =>
    report?.financialsByAircraft.map(a => a.aircraftType) ?? [],
    [report?.financialsByAircraft]
  );

  const activeFin: FinancialSummary | null = useMemo(() => {
    if (!report) return null;
    if (aircraftFilter === 'all') return report.financials;
    const match = report.financialsByAircraft.find(a => a.aircraftType === aircraftFilter);
    return match?.financials ?? null;
  }, [report, aircraftFilter]);

  const activeFlightInfo = useMemo(() => {
    if (!report || aircraftFilter === 'all') return null;
    const match = report.financialsByAircraft.find(a => a.aircraftType === aircraftFilter);
    return match ? { flights: match.flights, hoursMin: match.hoursMin } : null;
  }, [report, aircraftFilter]);

  // ── Render ──────────────────────────────────────────────────

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* ── Header ────────────────────────────────────────────── */}
      <div className="flex-none border-b border-acars-border bg-acars-bg/50 px-5 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-9 h-9 rounded-md bg-sky-500/10 border border-sky-400/20">
              <ChartBar className="w-5 h-5 text-sky-400" />
            </div>
            <div>
              <h1 className="text-base font-semibold text-acars-text">Reports</h1>
              <p className="text-xs text-acars-muted">VA-wide analytics and performance metrics</p>
            </div>
          </div>

          {/* Month selector */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 rounded-md border border-acars-border bg-acars-panel h-8">
              <button
                onClick={() => { setAllTime(false); setMonth(m => prevMonth(m)); }}
                disabled={allTime}
                className="h-full px-1.5 text-acars-muted hover:text-acars-text disabled:opacity-30 transition-colors"
              >
                <CaretLeft className="w-3.5 h-3.5" />
              </button>
              <span className="text-xs text-acars-text font-medium px-1 min-w-[120px] text-center select-none">
                {allTime ? 'All Time' : monthLabel(month)}
              </span>
              <button
                onClick={() => { setAllTime(false); setMonth(m => nextMonth(m)); }}
                disabled={allTime}
                className="h-full px-1.5 text-acars-muted hover:text-acars-text disabled:opacity-30 transition-colors"
              >
                <CaretRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <button
              onClick={handleAllTimeToggle}
              className={`h-8 px-3 rounded-md border text-xs font-medium transition-colors flex items-center gap-1.5 ${
                allTime
                  ? 'border-sky-400/40 bg-sky-500/10 text-sky-400'
                  : 'border-acars-border bg-acars-panel text-acars-muted hover:text-acars-text'
              }`}
            >
              <Infinity className="w-3.5 h-3.5" />
              All Time
            </button>

            <button
              onClick={() => { setMonth(currentMonth()); setAllTime(false); }}
              className="h-8 px-2 rounded-md border border-acars-border bg-acars-panel text-acars-muted hover:text-acars-text flex items-center gap-1.5 transition-colors"
              title="Current month"
            >
              <Calendar className="w-3.5 h-3.5" />
              <span className="text-xs">Today</span>
            </button>

            <button
              onClick={fetchReport}
              className="h-8 w-8 rounded-md border border-acars-border bg-acars-panel text-acars-muted hover:text-acars-text flex items-center justify-center transition-colors"
              title="Refresh"
            >
              <ArrowCounterClockwise className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* ── Content ───────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <SpinnerGap className="w-6 h-6 text-sky-400 animate-spin" />
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-64 text-sm text-red-400">{error}</div>
        ) : !report || !s || s.totalFlights === 0 ? (
          <div className="empty-state h-64">
            <ChartBar className="empty-state-icon" />
            <p className="empty-state-title">No Flight Data</p>
            <p className="empty-state-desc">No flights recorded for this period</p>
          </div>
        ) : (
          <div className="p-5 space-y-5">
            {/* ── Stats Row 1 ──────────────────────────────────── */}
            <div className="grid grid-cols-4 gap-3">
              <StatCard icon={AirplaneTilt}  label="Total Flights" value={formatNumber(s.totalFlights)} color={COLORS.cyan} />
              <StatCard icon={Clock}  label="Flight Hours"  value={formatDuration(s.totalHoursMin)} color={COLORS.green} />
              <StatCard icon={Ruler}  label="Distance"      value={`${formatNumber(s.totalDistanceNm)} nm`} color={COLORS.amber} />
              <StatCard icon={GasPump}   label="Fuel Used"     value={`${formatNumber(s.totalFuelLbs)} lbs`} color={COLORS.red} />
            </div>

            {/* ── Stats Row 2 ──────────────────────────────────── */}
            <div className="grid grid-cols-4 gap-3">
              <StatCard icon={Package} label="Cargo"        value={`${formatNumber(s.totalCargoLbs)} lbs`} color={COLORS.amber} />
              <StatCard icon={Users}   label="Passengers"   value={formatNumber(s.totalPax)} color={COLORS.blue} />
              <StatCard icon={Target}  label="Avg Score"    value={s.avgScore != null ? String(s.avgScore) : '—'} color={COLORS.green} />
              <StatCard icon={ArrowDown} label="Avg Landing" value={s.avgLandingRate != null ? `${s.avgLandingRate} fpm` : '—'} color={COLORS.cyan} />
            </div>

            {/* ── Financial Section Header ─────────────────────── */}
            {activeFin && (
              <>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h2 className="text-xs font-semibold text-acars-text uppercase tracking-wider">Financial Overview</h2>
                    {aircraftFilter !== 'all' && activeFlightInfo && (
                      <span className="text-[10px] text-acars-muted px-2 py-0.5 rounded-full border border-acars-border bg-acars-bg">
                        {activeFlightInfo.flights} flights · {formatDuration(activeFlightInfo.hoursMin)}
                      </span>
                    )}
                  </div>
                  {aircraftTypes.length > 0 && (
                    <AircraftFilter options={aircraftTypes} value={aircraftFilter} onChange={setAircraftFilter} />
                  )}
                </div>

                {/* ── Financial Stats Row ───────────────────────── */}
                <div className="grid grid-cols-3 gap-3">
                  <StatCard icon={CurrencyDollar} label="Revenue"     value={formatCurrency(activeFin.revenue.totalRevenue)} color={COLORS.green} />
                  <StatCard icon={Receipt}    label="Expenses"    value={formatCurrency(activeFin.expenses.totalExpenses)} color={COLORS.amber} />
                  <StatCard icon={TrendUp} label="Net Profit"  value={formatCurrency(activeFin.netProfit)} color={activeFin.netProfit >= 0 ? COLORS.green : COLORS.red} />
                </div>

                {/* ── Financial Detail Row ──────────────────────── */}
                <div className="grid grid-cols-2 gap-3">
                  {/* Expense Breakdown Detail */}
                  <div className="rounded-md border border-acars-border bg-acars-panel p-4">
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="text-xs font-semibold text-acars-text uppercase tracking-wider">Expense Breakdown</h3>
                      <span className="text-xs font-mono font-semibold text-amber-400">{formatCurrencyFull(activeFin.expenses.totalExpenses)}</span>
                    </div>
                    <p className="text-[10px] text-acars-muted mb-3">Operating costs for completed flights</p>

                    <div className="divide-y divide-acars-border">
                      <ExpenseRow
                        icon={GasPump}
                        label="Fuel"
                        amount={activeFin.expenses.fuelCost}
                        pct={activeFin.expenses.totalExpenses > 0 ? (activeFin.expenses.fuelCost / activeFin.expenses.totalExpenses) * 100 : 0}
                        color={COLORS.red}
                        description="$0.85/lb"
                      />
                      <ExpenseRow
                        icon={UserCheck}
                        label="Crew"
                        amount={activeFin.expenses.crewCost}
                        pct={activeFin.expenses.totalExpenses > 0 ? (activeFin.expenses.crewCost / activeFin.expenses.totalExpenses) * 100 : 0}
                        color={COLORS.blue}
                        description="per flight hour"
                      />
                      <ExpenseRow
                        icon={RadioButton}
                        label="Landing Fees"
                        amount={activeFin.expenses.landingFees}
                        pct={activeFin.expenses.totalExpenses > 0 ? (activeFin.expenses.landingFees / activeFin.expenses.totalExpenses) * 100 : 0}
                        color={COLORS.amber}
                        description="per flight"
                      />
                      <ExpenseRow
                        icon={Wrench}
                        label="Maintenance"
                        amount={activeFin.expenses.maintenanceCost}
                        pct={activeFin.expenses.totalExpenses > 0 ? (activeFin.expenses.maintenanceCost / activeFin.expenses.totalExpenses) * 100 : 0}
                        color={COLORS.cyan}
                        description="per flight hour"
                      />
                    </div>
                  </div>

                  {/* Revenue & Profit Summary */}
                  <div className="rounded-md border border-acars-border bg-acars-panel p-4">
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="text-xs font-semibold text-acars-text uppercase tracking-wider">Revenue &amp; Profit</h3>
                      <span className="text-xs font-mono font-semibold" style={{ color: COLORS.green }}>{formatCurrencyFull(activeFin.revenue.totalRevenue)}</span>
                    </div>
                    <p className="text-[10px] text-acars-muted mb-4">Revenue sources and margin analysis</p>

                    <div className="flex flex-col items-center gap-5">
                      {/* Profit Margin */}
                      <div className="text-center">
                        <div className="text-2xl font-bold font-mono" style={{ color: activeFin.netProfit >= 0 ? COLORS.green : COLORS.red }}>
                          {activeFin.profitMargin > 0 ? '+' : ''}{activeFin.profitMargin}%
                        </div>
                        <div className="text-[10px] uppercase tracking-wider text-acars-muted mt-1">Profit Margin</div>
                      </div>

                      {/* Revenue Breakdown Bars */}
                      <div className="w-full space-y-3 px-1">
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                              <Package className="w-3 h-3" style={{ color: COLORS.amber }} />
                              <span className="text-[10px] text-acars-muted uppercase tracking-wider">Cargo Revenue</span>
                            </div>
                            <span className="text-xs font-mono font-semibold text-acars-text">{formatCurrencyFull(activeFin.revenue.cargoRevenue)}</span>
                          </div>
                          <div className="h-2 rounded-full bg-acars-border overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-700"
                              style={{
                                width: activeFin.revenue.totalRevenue > 0
                                  ? `${(activeFin.revenue.cargoRevenue / activeFin.revenue.totalRevenue) * 100}%`
                                  : '0%',
                                backgroundColor: COLORS.amber,
                              }}
                            />
                          </div>
                        </div>
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                              <Users className="w-3 h-3" style={{ color: COLORS.cyan }} />
                              <span className="text-[10px] text-acars-muted uppercase tracking-wider">Passenger Revenue</span>
                            </div>
                            <span className="text-xs font-mono font-semibold text-acars-text">{formatCurrencyFull(activeFin.revenue.passengerRevenue)}</span>
                          </div>
                          <div className="h-2 rounded-full bg-acars-border overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-700"
                              style={{
                                width: activeFin.revenue.totalRevenue > 0
                                  ? `${(activeFin.revenue.passengerRevenue / activeFin.revenue.totalRevenue) * 100}%`
                                  : '0%',
                                backgroundColor: COLORS.cyan,
                              }}
                            />
                          </div>
                        </div>

                        {/* P&L Summary Line */}
                        <div className="pt-2 border-t border-acars-border space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] text-acars-muted uppercase tracking-wider">Total Revenue</span>
                            <span className="text-xs font-mono font-semibold" style={{ color: COLORS.green }}>{formatCurrencyFull(activeFin.revenue.totalRevenue)}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] text-acars-muted uppercase tracking-wider">Total Expenses</span>
                            <span className="text-xs font-mono font-semibold" style={{ color: COLORS.amber }}>-{formatCurrencyFull(activeFin.expenses.totalExpenses)}</span>
                          </div>
                          <div className="flex items-center justify-between pt-1.5 border-t border-acars-border">
                            <span className="text-[10px] text-acars-text font-semibold uppercase tracking-wider">Net Profit</span>
                            <span className="text-xs font-mono font-bold" style={{ color: activeFin.netProfit >= 0 ? COLORS.green : COLORS.red }}>
                              {formatCurrencyFull(activeFin.netProfit)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* ── Volume Chart ─────────────────────────────────── */}
            {report.volume.length > 0 && (
              <div className="rounded-md border border-acars-border bg-acars-panel p-4">
                <h3 className="text-xs font-semibold text-acars-text mb-4 uppercase tracking-wider flex items-center gap-2">
                  <ChartBar className="w-3.5 h-3.5 text-sky-400" />
                  {allTime ? 'Monthly Flight Volume' : 'Daily Flight Volume'}
                </h3>
                <ResponsiveContainer width="100%" height={180}>
                  <AreaChart data={report.volume} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="volumeGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={COLORS.cyan} stopOpacity={0.3} />
                        <stop offset="100%" stopColor={COLORS.cyan} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="date" tick={{ fill: COLORS.muted, fontSize: 10 }} axisLine={{ stroke: COLORS.border }} tickLine={false} />
                    <YAxis tick={{ fill: COLORS.muted, fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip content={<DarkTooltip />} />
                    <Area
                      type="monotone"
                      dataKey="flights"
                      name="Flights"
                      stroke={COLORS.cyan}
                      strokeWidth={2}
                      fill="url(#volumeGrad)"
                      animationDuration={800}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* ── Tables Row ───────────────────────────────────── */}
            <div className="grid grid-cols-2 gap-3">
              {/* Top Routes */}
              <div className="rounded-md border border-acars-border bg-acars-panel p-4">
                <h3 className="text-xs font-semibold text-acars-text mb-3 uppercase tracking-wider">Top Routes</h3>
                {report.topRoutes.length === 0 ? (
                  <p className="text-xs text-acars-muted">No route data</p>
                ) : (
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-acars-border">
                        <th className="text-left pb-2 text-[10px] uppercase tracking-wider text-acars-muted font-medium">#</th>
                        <th className="text-left pb-2 text-[10px] uppercase tracking-wider text-acars-muted font-medium">Path</th>
                        <th className="text-right pb-2 text-[10px] uppercase tracking-wider text-acars-muted font-medium">Flights</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.topRoutes.map((r, i) => (
                        <tr key={`${r.depIcao}-${r.arrIcao}`} className="border-b border-acars-border">
                          <td className="py-1.5 text-acars-muted">{i + 1}</td>
                          <td className="py-1.5">
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono font-semibold text-acars-text">{r.depIcao}</span>
                              <ArrowRight className="w-3 h-3 text-sky-400/40" />
                              <span className="font-mono font-semibold text-acars-text">{r.arrIcao}</span>
                            </div>
                            {(r.depName || r.arrName) && (
                              <div className="text-[10px] text-acars-muted truncate max-w-[240px]">
                                {r.depName ?? r.depIcao} — {r.arrName ?? r.arrIcao}
                              </div>
                            )}
                          </td>
                          <td className="py-1.5 text-right font-mono font-semibold text-acars-text">{r.flights}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Pilot Leaderboard */}
              <div className="rounded-md border border-acars-border bg-acars-panel p-4">
                <h3 className="text-xs font-semibold text-acars-text mb-3 uppercase tracking-wider">Pilot Leaderboard</h3>
                {report.byPilot.length === 0 ? (
                  <p className="text-xs text-acars-muted">No pilot data</p>
                ) : (
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-acars-border">
                        <th className="text-left pb-2 text-[10px] uppercase tracking-wider text-acars-muted font-medium">#</th>
                        <th className="text-left pb-2 text-[10px] uppercase tracking-wider text-acars-muted font-medium">Pilot</th>
                        <th className="text-right pb-2 text-[10px] uppercase tracking-wider text-acars-muted font-medium">Flights</th>
                        <th className="text-right pb-2 text-[10px] uppercase tracking-wider text-acars-muted font-medium">Hours</th>
                        <th className="text-right pb-2 text-[10px] uppercase tracking-wider text-acars-muted font-medium">Avg Score</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.byPilot.map((p, i) => (
                        <tr key={p.callsign} className="border-b border-acars-border">
                          <td className="py-1.5 text-acars-muted">{i + 1}</td>
                          <td className="py-1.5">
                            <div className="font-semibold text-acars-text">{p.callsign}</div>
                            <div className="text-[10px] text-acars-muted">{p.pilotName}</div>
                          </td>
                          <td className="py-1.5 text-right font-mono font-semibold text-acars-text">{p.flights}</td>
                          <td className="py-1.5 text-right font-mono text-acars-text">{formatDuration(p.hoursMin)}</td>
                          <td className="py-1.5 text-right font-mono font-semibold" style={{
                            color: p.avgScore == null ? COLORS.muted : p.avgScore >= 90 ? COLORS.green : p.avgScore >= 75 ? COLORS.amber : COLORS.red,
                          }}>
                            {p.avgScore ?? '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
