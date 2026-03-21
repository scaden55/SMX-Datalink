import { type CSSProperties, useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  BarChart3,
  Calendar,
  RotateCcw,
  Download,
  Printer,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
} from 'recharts';
import { api, ApiError } from '@/lib/api';
import { toast } from '@/stores/toastStore';
import { pageVariants, staggerContainer, staggerItem, fadeUp, cardHover } from '@/lib/motion';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

// ── Types ───────────────────────────────────────────────────────

interface FlightHoursEntry {
  callsign: string;
  name: string;
  hours: number;
  flights: number;
}

interface LandingRateData {
  distribution: Array<{ range: string; count: number }>;
  average: number;
  best: number;
  worst: number;
}

interface FuelEfficiencyEntry {
  flightNumber: string;
  fuelPlanned: number;
  fuelUsed: number;
  efficiency: number;
}

interface OnTimeData {
  onTimeCount: number;
  lateCount: number;
  totalFlights: number;
  percentage: number;
}

interface RoutePopularityEntry {
  route: string;
  depIcao: string;
  arrIcao: string;
  count: number;
  avgLandingRate: number;
}

interface FleetUtilizationEntry {
  registration: string;
  aircraftType: string;
  months: Array<{ month: string; hours: number }>;
  totalHours: number;
}

// ── Chart Colors ────────────────────────────────────────────────

const ACCENT_BLUE = 'var(--accent-blue)';
const ACCENT_EMERALD = 'var(--accent-emerald)';
const ACCENT_AMBER = 'var(--accent-amber)';
const ACCENT_RED = 'var(--accent-red)';
const ACCENT_CYAN = 'var(--accent-cyan)';

// ── Tooltip style constant ──────────────────────────────────────

const TOOLTIP_STYLE: CSSProperties = {
  backgroundColor: 'var(--surface-2)',
  border: '1px solid var(--border-primary)',
  borderRadius: '6px',
  color: 'var(--text-primary)',
  fontSize: 12,
};

// ── Helpers ─────────────────────────────────────────────────────

function defaultDateRange(): { from: string; to: string } {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 30);
  return {
    from: from.toISOString().split('T')[0],
    to: to.toISOString().split('T')[0],
  };
}

function getLandingRateColor(range: string): string {
  const lower = parseInt(range.split('-')[0], 10);
  if (isNaN(lower)) return ACCENT_BLUE;
  if (lower < 200) return ACCENT_EMERALD;
  if (lower < 400) return ACCENT_AMBER;
  return ACCENT_RED;
}

// ── Card wrapper ────────────────────────────────────────────────

function ChartCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        background: 'transparent',
        border: '1px solid var(--panel-border)',
        borderRadius: 6,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Card header */}
      <div
        style={{
          padding: '12px 16px',
          borderBottom: '1px solid var(--border-primary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <span className="text-body" style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 13 }}>
          {title}
        </span>
        <span className="data-xs" style={{ color: 'var(--text-tertiary)' }}>
          Last 12 Months
        </span>
      </div>
      {/* Card body */}
      <div style={{ padding: 16, flex: 1, minHeight: 0 }}>{children}</div>
    </div>
  );
}

// ── Skeleton ────────────────────────────────────────────────────

function ReportsPageSkeleton() {
  return (
    <div style={{ padding: '0 24px 24px 24px' }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 16,
        }}
      >
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            style={{
              height: 340,
              background: 'transparent',
              borderRadius: 6,
              border: '1px solid var(--panel-border)',
            }}
            className="animate-pulse"
          />
        ))}
      </div>
    </div>
  );
}

// ── 1. Flight Hours by Pilot — horizontal bar ───────────────────

function FlightHoursChart({ data }: { data: FlightHoursEntry[] }) {
  const chartData = useMemo(
    () =>
      data
        .sort((a, b) => b.hours - a.hours)
        .slice(0, 10)
        .map((d) => ({
          name: d.callsign || d.name,
          hours: Math.round(d.hours * 10) / 10,
          flights: d.flights,
        })),
    [data],
  );

  if (chartData.length === 0) {
    return (
      <p className="text-caption" style={{ textAlign: 'center', padding: '40px 0' }}>
        No data for this period
      </p>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart
        data={chartData}
        layout="vertical"
        margin={{ top: 0, right: 16, left: 0, bottom: 0 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-primary)" horizontal={false} />
        <XAxis
          type="number"
          tick={{ fill: 'var(--text-tertiary)', fontSize: 11 }}
          tickLine={false}
          axisLine={{ stroke: 'var(--border-primary)' }}
        />
        <YAxis
          type="category"
          dataKey="name"
          tick={{ fill: 'var(--text-primary)', fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          width={80}
        />
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          cursor={{ fill: 'rgba(79,108,205,0.08)' }}
          content={({ active, payload, label }) => {
            if (!active || !payload?.length) return null;
            const d = payload[0].payload as { hours: number; flights: number };
            return (
              <div style={TOOLTIP_STYLE} className="px-3 py-2">
                <p style={{ fontWeight: 500, color: 'var(--text-primary)', marginBottom: 4 }}>{label}</p>
                <p style={{ color: 'var(--text-tertiary)' }}>
                  Hours: <span className="font-mono" style={{ color: 'var(--text-primary)' }}>{d.hours.toFixed(1)}</span>
                </p>
                <p style={{ color: 'var(--text-tertiary)' }}>
                  Flights: <span className="font-mono" style={{ color: 'var(--text-primary)' }}>{d.flights}</span>
                </p>
              </div>
            );
          }}
        />
        <Bar dataKey="hours" fill={ACCENT_BLUE} radius={[0, 4, 4, 0]} maxBarSize={24} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── 2. Landing Rate Distribution — vertical bar (green/amber/red) ──

function LandingRateChart({ data }: { data: LandingRateData }) {
  const chartData = useMemo(
    () => data.distribution.map((d) => ({ ...d, fill: getLandingRateColor(d.range) })),
    [data.distribution],
  );

  if (chartData.length === 0) {
    return (
      <p className="text-caption" style={{ textAlign: 'center', padding: '40px 0' }}>
        No data for this period
      </p>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={chartData} margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-primary)" />
        <XAxis
          dataKey="range"
          tick={{ fill: 'var(--text-tertiary)', fontSize: 10 }}
          tickLine={false}
          axisLine={{ stroke: 'var(--border-primary)' }}
        />
        <YAxis
          tick={{ fill: 'var(--text-tertiary)', fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          allowDecimals={false}
        />
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          formatter={(value: number | string | undefined) => [`${value ?? 0} landings`, 'Count']}
          labelStyle={{ color: 'var(--text-tertiary)' }}
          cursor={{ fill: 'rgba(79,108,205,0.08)' }}
        />
        <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={36}>
          {chartData.map((entry, idx) => (
            <Cell key={idx} fill={entry.fill} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── 3. On-Time Performance — donut/ring chart ───────────────────

function OnTimeChart({ data }: { data: OnTimeData }) {
  const cancelled = data.totalFlights - data.onTimeCount - data.lateCount;
  const pieData = useMemo(
    () => [
      { name: 'On Time', value: data.onTimeCount, fill: ACCENT_EMERALD },
      { name: 'Delayed', value: data.lateCount, fill: ACCENT_AMBER },
      ...(cancelled > 0 ? [{ name: 'Cancelled', value: cancelled, fill: ACCENT_RED }] : []),
    ],
    [data.onTimeCount, data.lateCount, cancelled],
  );

  if (data.totalFlights === 0) {
    return (
      <p className="text-caption" style={{ textAlign: 'center', padding: '40px 0' }}>
        No data for this period
      </p>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      <ResponsiveContainer width="100%" height={180}>
        <PieChart>
          <Pie
            data={pieData}
            cx="50%"
            cy="50%"
            innerRadius={50}
            outerRadius={75}
            dataKey="value"
            nameKey="name"
            startAngle={90}
            endAngle={-270}
            stroke="transparent"
          >
            {pieData.map((entry, idx) => (
              <Cell key={idx} fill={entry.fill} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            formatter={(value: number | string | undefined) => [`${value ?? 0} flights`]}
          />
        </PieChart>
      </ResponsiveContainer>
      {/* Legend row */}
      <div style={{ display: 'flex', gap: 16, justifyContent: 'center' }}>
        {pieData.map((d) => (
          <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: d.fill }} />
            <span className="text-caption" style={{ fontSize: 11 }}>
              {d.name} ({d.value})
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── 4. Fuel Efficiency by Route — horizontal stacked bar ────────

function FuelEfficiencyChart({ data }: { data: FuelEfficiencyEntry[] }) {
  const chartData = useMemo(
    () =>
      data.slice(0, 10).map((d) => ({
        flight: d.flightNumber,
        planned: Math.round(d.fuelPlanned),
        actual: Math.round(d.fuelUsed),
      })),
    [data],
  );

  if (chartData.length === 0) {
    return (
      <p className="text-caption" style={{ textAlign: 'center', padding: '40px 0' }}>
        No data for this period
      </p>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart
        data={chartData}
        layout="vertical"
        margin={{ top: 0, right: 16, left: 0, bottom: 0 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-primary)" horizontal={false} />
        <XAxis
          type="number"
          tick={{ fill: 'var(--text-tertiary)', fontSize: 11 }}
          tickLine={false}
          axisLine={{ stroke: 'var(--border-primary)' }}
          tickFormatter={(v: number) =>
            v >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${v}`
          }
        />
        <YAxis
          type="category"
          dataKey="flight"
          tick={{ fill: 'var(--text-primary)', fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          width={80}
        />
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          cursor={{ fill: 'rgba(79,108,205,0.08)' }}
          content={({ active, payload, label }) => {
            if (!active || !payload?.length) return null;
            const d = payload[0].payload as { planned: number; actual: number };
            return (
              <div style={TOOLTIP_STYLE} className="px-3 py-2">
                <p style={{ fontWeight: 500, color: 'var(--text-primary)', marginBottom: 4 }}>{label}</p>
                <p style={{ color: 'var(--text-tertiary)' }}>
                  Planned: <span className="font-mono" style={{ color: ACCENT_BLUE }}>{d.planned.toLocaleString()} lbs</span>
                </p>
                <p style={{ color: 'var(--text-tertiary)' }}>
                  Actual: <span className="font-mono" style={{ color: ACCENT_AMBER }}>{d.actual.toLocaleString()} lbs</span>
                </p>
              </div>
            );
          }}
        />
        <Bar dataKey="planned" name="Planned" fill={ACCENT_BLUE} radius={[0, 4, 4, 0]} maxBarSize={12} stackId="fuel" />
        <Bar dataKey="actual" name="Actual" fill={ACCENT_AMBER} radius={[0, 4, 4, 0]} maxBarSize={12} stackId="fuel2" />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── 5. Route Popularity — bar chart ─────────────────────────────

function RoutePopularityChart({ data }: { data: RoutePopularityEntry[] }) {
  const chartData = useMemo(
    () =>
      data
        .sort((a, b) => b.count - a.count)
        .slice(0, 10)
        .map((d) => ({
          route: `${d.depIcao}-${d.arrIcao}`,
          count: d.count,
        })),
    [data],
  );

  if (chartData.length === 0) {
    return (
      <p className="text-caption" style={{ textAlign: 'center', padding: '40px 0' }}>
        No data for this period
      </p>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={chartData} margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-primary)" />
        <XAxis
          dataKey="route"
          tick={{ fill: 'var(--text-tertiary)', fontSize: 10 }}
          tickLine={false}
          axisLine={{ stroke: 'var(--border-primary)' }}
          angle={-45}
          textAnchor="end"
          height={50}
        />
        <YAxis
          tick={{ fill: 'var(--text-tertiary)', fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          allowDecimals={false}
        />
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          formatter={(value: number | string | undefined) => [`${value ?? 0} flights`, 'Count']}
          labelStyle={{ color: 'var(--text-tertiary)' }}
          cursor={{ fill: 'rgba(79,108,205,0.08)' }}
        />
        <Bar dataKey="count" fill={ACCENT_BLUE} radius={[4, 4, 0, 0]} maxBarSize={36} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── 6. Fleet Utilization — stacked horizontal bar (Flying vs Ground) ──

function FleetUtilizationChart({ data }: { data: FleetUtilizationEntry[] }) {
  const chartData = useMemo(() => {
    // Max possible hours per month: ~720 (30*24). Use a simpler approach:
    // totalHours = flying time, ground = (months.length * 200) - totalHours (capped at 0)
    return data
      .sort((a, b) => b.totalHours - a.totalHours)
      .slice(0, 10)
      .map((ac) => {
        const maxHours = Math.max(ac.months.length, 1) * 200;
        const flying = Math.round(ac.totalHours * 10) / 10;
        const ground = Math.max(0, Math.round((maxHours - ac.totalHours) * 10) / 10);
        return {
          name: ac.registration,
          type: ac.aircraftType,
          flying,
          ground,
        };
      });
  }, [data]);

  if (chartData.length === 0) {
    return (
      <p className="text-caption" style={{ textAlign: 'center', padding: '40px 0' }}>
        No data for this period
      </p>
    );
  }

  return (
    <div>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ top: 0, right: 16, left: 0, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-primary)" horizontal={false} />
          <XAxis
            type="number"
            tick={{ fill: 'var(--text-tertiary)', fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: 'var(--border-primary)' }}
          />
          <YAxis
            type="category"
            dataKey="name"
            tick={{ fill: 'var(--text-primary)', fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={80}
          />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            cursor={{ fill: 'rgba(79,108,205,0.08)' }}
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              const d = payload[0].payload as { flying: number; ground: number; type: string };
              return (
                <div style={TOOLTIP_STYLE} className="px-3 py-2">
                  <p style={{ fontWeight: 500, color: 'var(--text-primary)', marginBottom: 4 }}>{label}</p>
                  <p style={{ color: 'var(--text-tertiary)', fontSize: 11, marginBottom: 2 }}>{d.type}</p>
                  <p style={{ color: 'var(--text-tertiary)' }}>
                    Flying: <span className="font-mono" style={{ color: ACCENT_EMERALD }}>{d.flying} hrs</span>
                  </p>
                  <p style={{ color: 'var(--text-tertiary)' }}>
                    Ground: <span className="font-mono" style={{ color: 'var(--text-tertiary)' }}>{d.ground} hrs</span>
                  </p>
                </div>
              );
            }}
          />
          <Bar dataKey="flying" name="Flying" fill={ACCENT_EMERALD} stackId="util" radius={[0, 0, 0, 0]} maxBarSize={20} />
          <Bar dataKey="ground" name="Ground" fill="var(--border-primary)" stackId="util" radius={[0, 4, 4, 0]} maxBarSize={20} />
        </BarChart>
      </ResponsiveContainer>
      {/* Legend */}
      <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginTop: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 10, height: 10, borderRadius: 2, background: ACCENT_EMERALD }} />
          <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Flying</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 10, height: 10, borderRadius: 2, background: 'var(--border-primary)' }} />
          <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Ground</span>
        </div>
      </div>
    </div>
  );
}

// ── Print Styles ─────────────────────────────────────────────────

const PRINT_STYLES = `
@media print {
  [data-sidebar],
  nav,
  header,
  [data-topbar],
  .no-print {
    display: none !important;
  }
  [data-sidebar-inset],
  main,
  .flex-1 {
    margin: 0 !important;
    padding: 0 !important;
    width: 100% !important;
    max-width: 100% !important;
  }
  body, html, * {
    background: white !important;
    color: black !important;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .recharts-bar-rectangle,
  .recharts-pie-sector,
  .recharts-cell {
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
}
`;

// ── CSV Export ───────────────────────────────────────────────────

function buildCsv(
  flightHours: FlightHoursEntry[],
  landingRates: LandingRateData | null,
  fuelEfficiency: FuelEfficiencyEntry[],
  onTime: OnTimeData | null,
  routePopularity: RoutePopularityEntry[],
  fleetUtilization: FleetUtilizationEntry[],
): string {
  const lines: string[] = [];

  lines.push('=== Flight Hours by Pilot ===');
  lines.push('Callsign,Name,Hours,Flights');
  for (const r of flightHours) {
    lines.push(`${r.callsign},${r.name},${r.hours.toFixed(1)},${r.flights}`);
  }
  lines.push('');

  if (landingRates) {
    lines.push('=== Landing Rate Distribution ===');
    lines.push('Range,Count');
    for (const r of landingRates.distribution) {
      lines.push(`${r.range},${r.count}`);
    }
    lines.push(`Average,${landingRates.average}`);
    lines.push(`Best,${landingRates.best}`);
    lines.push(`Worst,${landingRates.worst}`);
    lines.push('');
  }

  lines.push('=== Fuel Efficiency ===');
  lines.push('Flight Number,Fuel Planned,Fuel Used,Efficiency %');
  for (const r of fuelEfficiency) {
    lines.push(`${r.flightNumber},${r.fuelPlanned},${r.fuelUsed},${r.efficiency.toFixed(1)}`);
  }
  lines.push('');

  if (onTime) {
    lines.push('=== On-Time Performance ===');
    lines.push('Metric,Value');
    lines.push(`On-Time Count,${onTime.onTimeCount}`);
    lines.push(`Late Count,${onTime.lateCount}`);
    lines.push(`Total Flights,${onTime.totalFlights}`);
    lines.push(`Percentage,${onTime.percentage.toFixed(1)}%`);
    lines.push('');
  }

  lines.push('=== Route Popularity ===');
  lines.push('Route,Departure,Arrival,Count,Avg Landing Rate');
  for (const r of routePopularity) {
    lines.push(
      `${r.depIcao}-${r.arrIcao},${r.depIcao},${r.arrIcao},${r.count},${Math.round(r.avgLandingRate)}`,
    );
  }
  lines.push('');

  lines.push('=== Fleet Utilization ===');
  lines.push('Registration,Aircraft Type,Total Hours');
  for (const r of fleetUtilization) {
    lines.push(`${r.registration},${r.aircraftType},${r.totalHours}`);
  }

  return lines.join('\n');
}

function downloadCsv(csv: string, filename: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

// ── Page ────────────────────────────────────────────────────────

export function ReportsPage() {
  const defaults = useMemo(() => defaultDateRange(), []);
  const [dateFrom, setDateFrom] = useState(defaults.from);
  const [dateTo, setDateTo] = useState(defaults.to);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Report data
  const [flightHours, setFlightHours] = useState<FlightHoursEntry[]>([]);
  const [landingRates, setLandingRates] = useState<LandingRateData | null>(null);
  const [fuelEfficiency, setFuelEfficiency] = useState<FuelEfficiencyEntry[]>([]);
  const [onTime, setOnTime] = useState<OnTimeData | null>(null);
  const [routePopularity, setRoutePopularity] = useState<RoutePopularityEntry[]>([]);
  const [fleetUtilization, setFleetUtilization] = useState<FleetUtilizationEntry[]>([]);

  const fetchReports = useCallback(async (from: string, to: string) => {
    setLoading(true);
    setError(null);
    try {
      const qs = `from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
      const [fh, lr, fe, ot, rp, fu] = await Promise.all([
        api.get<FlightHoursEntry[]>(`/api/admin/reports/flight-hours?${qs}`),
        api.get<LandingRateData>(`/api/admin/reports/landing-rates?${qs}`),
        api.get<FuelEfficiencyEntry[]>(`/api/admin/reports/fuel-efficiency?${qs}`),
        api.get<OnTimeData>(`/api/admin/reports/on-time?${qs}`),
        api.get<RoutePopularityEntry[]>(`/api/admin/reports/route-popularity?${qs}`),
        api.get<FleetUtilizationEntry[]>(`/api/admin/reports/fleet-utilization?${qs}`),
      ]);
      setFlightHours(Array.isArray(fh) ? fh : []);
      setLandingRates(lr);
      setFuelEfficiency(Array.isArray(fe) ? fe : []);
      setOnTime(ot);
      setRoutePopularity(Array.isArray(rp) ? rp : []);
      setFleetUtilization(Array.isArray(fu) ? fu : []);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to load reports';
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReports(dateFrom, dateTo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleApply() {
    if (!dateFrom || !dateTo) {
      toast.warning('Please select both From and To dates');
      return;
    }
    if (dateFrom > dateTo) {
      toast.warning('From date must be before To date');
      return;
    }
    fetchReports(dateFrom, dateTo);
  }

  function handleReset() {
    const d = defaultDateRange();
    setDateFrom(d.from);
    setDateTo(d.to);
    fetchReports(d.from, d.to);
  }

  function handleExportCsv() {
    const csv = buildCsv(
      flightHours,
      landingRates,
      fuelEfficiency,
      onTime,
      routePopularity,
      fleetUtilization,
    );
    const filename = `sma-reports_${dateFrom}_${dateTo}.csv`;
    downloadCsv(csv, filename);
    toast.success('CSV exported');
  }

  function handlePrint() {
    window.print();
  }

  if (loading) {
    return (
      <div>
        {/* Header */}
        <div style={{ padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <BarChart3 size={20} style={{ color: ACCENT_BLUE }} />
              <span className="text-heading" style={{ fontSize: 20, fontWeight: 700 }}>Reports &amp; Analytics</span>
            </div>
            <span className="text-caption">Real-time and historical analytics</span>
          </div>
        </div>
        <ReportsPageSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <div style={{ padding: '16px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <BarChart3 size={20} style={{ color: ACCENT_BLUE }} />
            <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>Reports &amp; Analytics</span>
          </div>
          <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Real-time and historical analytics</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px 0', color: 'var(--text-tertiary)' }}>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <motion.div variants={pageVariants} initial="hidden" animate="visible">
      <style dangerouslySetInnerHTML={{ __html: PRINT_STYLES }} />

      {/* ── Header ─────────────────────────────────────────────── */}
      <motion.div
        variants={fadeUp}
        style={{
          padding: '16px 24px',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 16,
        }}
      >
        {/* Left: title + subtitle */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <BarChart3 size={20} style={{ color: ACCENT_BLUE }} />
            <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>
              Reports &amp; Analytics
            </span>
          </div>
          <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
            Real-time and historical analytics
          </span>
        </div>

        {/* Right: date range + actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }} className="no-print">
          <Calendar size={14} style={{ color: 'var(--text-tertiary)' }} />
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="w-[140px] input-glow"
            style={{ height: 32, fontSize: 12 }}
          />
          <span className="text-caption">to</span>
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="w-[140px] input-glow"
            style={{ height: 32, fontSize: 12 }}
          />
          <Button size="sm" onClick={handleApply} className="btn-glow" style={{ height: 32 }}>
            Apply
          </Button>
          <Button variant="ghost" size="sm" onClick={handleReset} style={{ height: 32 }}>
            <RotateCcw size={14} />
          </Button>
          <div style={{ width: 1, height: 20, background: 'var(--border-primary)' }} />
          <Button variant="outline" size="sm" onClick={handleExportCsv} className="btn-glow" style={{ height: 32, gap: 6 }}>
            <Download size={14} />
            Export CSV
          </Button>
          <Button variant="outline" size="sm" onClick={handlePrint} className="btn-glow" style={{ height: 32, gap: 6 }}>
            <Printer size={14} />
            Print
          </Button>
        </div>
      </motion.div>

      {/* Print-only date range header */}
      <div className="hidden print:block text-caption" style={{ padding: '0 24px', marginBottom: 12 }}>
        Report period: {dateFrom} to {dateTo}
      </div>

      {/* ── 2x3 Chart Grid ─────────────────────────────────────── */}
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
        style={{
          padding: '0 24px 24px 24px',
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 16,
        }}
      >
        {/* 1. Flight Hours by Pilot */}
        <motion.div variants={staggerItem}>
          <ChartCard title="Flight Hours by Pilot">
            <FlightHoursChart data={flightHours} />
          </ChartCard>
        </motion.div>

        {/* 2. Landing Rate Distribution */}
        <motion.div variants={staggerItem}>
          <ChartCard title="Landing Rate Distribution">
            {landingRates ? (
              <LandingRateChart data={landingRates} />
            ) : (
              <p style={{ fontSize: 12, color: 'var(--text-tertiary)', textAlign: 'center', padding: '40px 0' }}>
                No data for this period
              </p>
            )}
          </ChartCard>
        </motion.div>

        {/* 3. On-Time Performance */}
        <motion.div variants={staggerItem}>
          <ChartCard title="On-Time Performance">
            {onTime ? (
              <OnTimeChart data={onTime} />
            ) : (
              <p style={{ fontSize: 12, color: 'var(--text-tertiary)', textAlign: 'center', padding: '40px 0' }}>
                No data for this period
              </p>
            )}
          </ChartCard>
        </motion.div>

        {/* 4. Fuel Efficiency by Route */}
        <motion.div variants={staggerItem}>
          <ChartCard title="Fuel Efficiency by Route">
            <FuelEfficiencyChart data={fuelEfficiency} />
          </ChartCard>
        </motion.div>

        {/* 5. Route Popularity */}
        <motion.div variants={staggerItem}>
          <ChartCard title="Route Popularity">
            <RoutePopularityChart data={routePopularity} />
          </ChartCard>
        </motion.div>

        {/* 6. Fleet Utilization */}
        <motion.div variants={staggerItem}>
          <ChartCard title="Fleet Utilization">
            <FleetUtilizationChart data={fleetUtilization} />
          </ChartCard>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
