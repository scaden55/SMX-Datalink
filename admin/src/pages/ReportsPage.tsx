import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CalendarBlank,
  ArrowCounterClockwise,
  DownloadSimple,
} from '@phosphor-icons/react';
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
  Legend,
} from 'recharts';
import { api, ApiError } from '@/lib/api';
import { toast } from '@/stores/toastStore';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

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

// ── Tooltip style constant ──────────────────────────────────────

const TOOLTIP_STYLE = {
  backgroundColor: '#1a1d2e',
  border: '1px solid #2a2e3f',
  borderRadius: '6px',
  color: '#e8eaed',
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
  // Green for soft landings, amber for medium, red for hard
  const lower = parseInt(range.split('-')[0], 10);
  if (isNaN(lower)) return '#3b82f6';
  if (lower < 200) return '#22c55e';  // soft / good
  if (lower < 400) return '#f59e0b';  // medium
  return '#ef4444';                    // hard
}

function getOnTimeColor(pct: number): string {
  if (pct >= 90) return '#22c55e';
  if (pct >= 70) return '#f59e0b';
  return '#ef4444';
}

// ── Skeleton ────────────────────────────────────────────────────

function ReportsPageSkeleton() {
  return (
    <div className="space-y-6">
      {/* Date range bar skeleton */}
      <Skeleton className="h-12 w-full rounded-md" />
      {/* Chart grid skeleton */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-[360px] rounded-md" />
        ))}
      </div>
    </div>
  );
}

// ── Flight Hours Chart ──────────────────────────────────────────

function FlightHoursChart({ data }: { data: FlightHoursEntry[] }) {
  const chartData = useMemo(
    () =>
      data
        .sort((a, b) => b.hours - a.hours)
        .slice(0, 20)
        .map((d) => ({
          name: d.callsign || d.name,
          hours: Math.round(d.hours * 10) / 10,
          flights: d.flights,
        })),
    [data],
  );

  if (chartData.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-10 text-center">
        No data for this period
      </p>
    );
  }

  const chartHeight = Math.max(260, chartData.length * 32);

  return (
    <ResponsiveContainer width="100%" height={chartHeight}>
      <BarChart
        data={chartData}
        layout="vertical"
        margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#2a2e3f" horizontal={false} />
        <XAxis
          type="number"
          tick={{ fill: '#8b8fa3', fontSize: 12 }}
          tickLine={false}
          axisLine={{ stroke: '#2a2e3f' }}
          label={{
            value: 'Hours',
            position: 'insideBottomRight',
            offset: -5,
            fill: '#8b8fa3',
            fontSize: 11,
          }}
        />
        <YAxis
          type="category"
          dataKey="name"
          tick={{ fill: '#e8eaed', fontSize: 12 }}
          tickLine={false}
          axisLine={false}
          width={90}
        />
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          labelStyle={{ color: '#8b8fa3' }}
          cursor={{ fill: 'rgba(59,130,246,0.08)' }}
          content={({ active, payload, label }) => {
            if (!active || !payload?.length) return null;
            const d = payload[0].payload as { hours: number; flights: number };
            return (
              <div style={TOOLTIP_STYLE} className="px-3 py-2">
                <p className="font-medium text-[#e8eaed] mb-1">{label}</p>
                <p className="text-[#8b8fa3]">
                  Hours: <span className="font-mono text-[#e8eaed]">{d.hours.toFixed(1)}</span>
                </p>
                <p className="text-[#8b8fa3]">
                  Flights: <span className="font-mono text-[#e8eaed]">{d.flights}</span>
                </p>
              </div>
            );
          }}
        />
        <Bar dataKey="hours" fill="#3b82f6" radius={[0, 4, 4, 0]} maxBarSize={28} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── Landing Rate Distribution ───────────────────────────────────

function LandingRateChart({ data }: { data: LandingRateData }) {
  const chartData = useMemo(
    () => data.distribution.map((d) => ({ ...d, fill: getLandingRateColor(d.range) })),
    [data.distribution],
  );

  if (chartData.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-10 text-center">
        No data for this period
      </p>
    );
  }

  return (
    <div>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#2a2e3f" />
          <XAxis
            dataKey="range"
            tick={{ fill: '#8b8fa3', fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: '#2a2e3f' }}
            label={{
              value: 'ft/min',
              position: 'insideBottomRight',
              offset: -5,
              fill: '#8b8fa3',
              fontSize: 11,
            }}
          />
          <YAxis
            tick={{ fill: '#8b8fa3', fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
            label={{
              value: 'Landings',
              angle: -90,
              position: 'insideLeft',
              fill: '#8b8fa3',
              fontSize: 11,
            }}
          />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            formatter={(value: number | string | undefined) => [`${value ?? 0} landings`, 'Count']}
            labelStyle={{ color: '#8b8fa3' }}
            cursor={{ fill: 'rgba(59,130,246,0.08)' }}
          />
          <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={40}>
            {chartData.map((entry, idx) => (
              <Cell key={idx} fill={entry.fill} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-border/50">
        <div className="text-center">
          <p className="text-xs text-muted-foreground mb-1">Average</p>
          <p className="font-mono text-sm font-semibold text-[#e8eaed]">
            {Math.round(data.average)} ft/min
          </p>
        </div>
        <div className="text-center">
          <p className="text-xs text-muted-foreground mb-1">Best</p>
          <p className="font-mono text-sm font-semibold text-emerald-400">
            {Math.round(data.best)} ft/min
          </p>
        </div>
        <div className="text-center">
          <p className="text-xs text-muted-foreground mb-1">Worst</p>
          <p className="font-mono text-sm font-semibold text-red-400">
            {Math.round(data.worst)} ft/min
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Fuel Efficiency Chart ───────────────────────────────────────

function FuelEfficiencyChart({ data }: { data: FuelEfficiencyEntry[] }) {
  const chartData = useMemo(
    () =>
      data.slice(-20).map((d) => ({
        flight: d.flightNumber,
        planned: Math.round(d.fuelPlanned),
        actual: Math.round(d.fuelUsed),
        efficiency: d.efficiency,
      })),
    [data],
  );

  if (chartData.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-10 text-center">
        No data for this period
      </p>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#2a2e3f" />
        <XAxis
          dataKey="flight"
          tick={{ fill: '#8b8fa3', fontSize: 11 }}
          tickLine={false}
          axisLine={{ stroke: '#2a2e3f' }}
          angle={-45}
          textAnchor="end"
          height={60}
        />
        <YAxis
          tick={{ fill: '#8b8fa3', fontSize: 12 }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v: number) =>
            v >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${v}`
          }
          label={{
            value: 'lbs',
            angle: -90,
            position: 'insideLeft',
            fill: '#8b8fa3',
            fontSize: 11,
          }}
        />
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          labelStyle={{ color: '#8b8fa3' }}
          content={({ active, payload, label }) => {
            if (!active || !payload?.length) return null;
            const d = payload[0].payload as {
              planned: number;
              actual: number;
              efficiency: number;
            };
            return (
              <div style={TOOLTIP_STYLE} className="px-3 py-2">
                <p className="font-medium text-[#e8eaed] mb-1">{label}</p>
                <p className="text-[#8b8fa3]">
                  Planned: <span className="font-mono text-blue-400">{d.planned.toLocaleString()} lbs</span>
                </p>
                <p className="text-[#8b8fa3]">
                  Actual: <span className="font-mono text-amber-400">{d.actual.toLocaleString()} lbs</span>
                </p>
                <p className="text-[#8b8fa3]">
                  Efficiency: <span className="font-mono text-[#e8eaed]">{d.efficiency.toFixed(1)}%</span>
                </p>
              </div>
            );
          }}
        />
        <Legend wrapperStyle={{ fontSize: 12, color: '#8b8fa3' }} />
        <Bar dataKey="planned" name="Planned" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={20} />
        <Bar dataKey="actual" name="Actual" fill="#f59e0b" radius={[4, 4, 0, 0]} maxBarSize={20} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── On-Time Performance ─────────────────────────────────────────

function OnTimeCard({ data }: { data: OnTimeData }) {
  const color = getOnTimeColor(data.percentage);

  const pieData = useMemo(
    () => [
      { name: 'On Time', value: data.onTimeCount },
      { name: 'Late', value: data.lateCount },
    ],
    [data.onTimeCount, data.lateCount],
  );

  const PIE_COLORS = ['#22c55e', '#ef4444'];

  if (data.totalFlights === 0) {
    return (
      <p className="text-sm text-muted-foreground py-10 text-center">
        No data for this period
      </p>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Donut chart */}
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie
            data={pieData}
            cx="50%"
            cy="50%"
            innerRadius={55}
            outerRadius={80}
            dataKey="value"
            nameKey="name"
            startAngle={90}
            endAngle={-270}
            stroke="transparent"
          >
            {pieData.map((_, idx) => (
              <Cell key={idx} fill={PIE_COLORS[idx]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            formatter={(value: number | string | undefined) => [`${value ?? 0} flights`]}
          />
          <Legend wrapperStyle={{ fontSize: 12, color: '#8b8fa3' }} />
        </PieChart>
      </ResponsiveContainer>

      {/* Big percentage */}
      <div className="text-center -mt-2">
        <p className="font-mono text-4xl font-bold" style={{ color }}>
          {data.percentage.toFixed(1)}%
        </p>
        <p className="text-xs text-muted-foreground mt-1">On-Time Rate</p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4 w-full pt-4 border-t border-border/50">
        <div className="text-center">
          <p className="text-xs text-muted-foreground mb-1">On Time</p>
          <p className="font-mono text-sm font-semibold text-emerald-400">
            {data.onTimeCount}
          </p>
        </div>
        <div className="text-center">
          <p className="text-xs text-muted-foreground mb-1">Late</p>
          <p className="font-mono text-sm font-semibold text-red-400">
            {data.lateCount}
          </p>
        </div>
        <div className="text-center">
          <p className="text-xs text-muted-foreground mb-1">Total</p>
          <p className="font-mono text-sm font-semibold text-[#e8eaed]">
            {data.totalFlights}
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Route Popularity Chart ──────────────────────────────────────

function RoutePopularityChart({ data }: { data: RoutePopularityEntry[] }) {
  const chartData = useMemo(
    () =>
      data
        .sort((a, b) => b.count - a.count)
        .slice(0, 15)
        .map((d) => ({
          route: `${d.depIcao} → ${d.arrIcao}`,
          count: d.count,
          avgLandingRate: d.avgLandingRate,
        })),
    [data],
  );

  if (chartData.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-10 text-center">
        No data for this period
      </p>
    );
  }

  const chartHeight = Math.max(260, chartData.length * 32);

  return (
    <ResponsiveContainer width="100%" height={chartHeight}>
      <BarChart
        data={chartData}
        layout="vertical"
        margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#2a2e3f" horizontal={false} />
        <XAxis
          type="number"
          tick={{ fill: '#8b8fa3', fontSize: 12 }}
          tickLine={false}
          axisLine={{ stroke: '#2a2e3f' }}
          allowDecimals={false}
          label={{
            value: 'Flights',
            position: 'insideBottomRight',
            offset: -5,
            fill: '#8b8fa3',
            fontSize: 11,
          }}
        />
        <YAxis
          type="category"
          dataKey="route"
          tick={{ fill: '#e8eaed', fontSize: 12 }}
          tickLine={false}
          axisLine={false}
          width={110}
        />
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          labelStyle={{ color: '#8b8fa3' }}
          cursor={{ fill: 'rgba(59,130,246,0.08)' }}
          content={({ active, payload, label }) => {
            if (!active || !payload?.length) return null;
            const d = payload[0].payload as { count: number; avgLandingRate: number };
            return (
              <div style={TOOLTIP_STYLE} className="px-3 py-2">
                <p className="font-medium text-[#e8eaed] mb-1">{label}</p>
                <p className="text-[#8b8fa3]">
                  Flights: <span className="font-mono text-[#e8eaed]">{d.count}</span>
                </p>
                <p className="text-[#8b8fa3]">
                  Avg Landing Rate:{' '}
                  <span className="font-mono text-[#e8eaed]">
                    {Math.round(d.avgLandingRate)} ft/min
                  </span>
                </p>
              </div>
            );
          }}
        />
        <Bar dataKey="count" fill="#3b82f6" radius={[0, 4, 4, 0]} maxBarSize={28} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── CSV Export ───────────────────────────────────────────────────

function buildCsv(
  flightHours: FlightHoursEntry[],
  landingRates: LandingRateData | null,
  fuelEfficiency: FuelEfficiencyEntry[],
  onTime: OnTimeData | null,
  routePopularity: RoutePopularityEntry[],
): string {
  const lines: string[] = [];

  // Flight Hours
  lines.push('=== Flight Hours by Pilot ===');
  lines.push('Callsign,Name,Hours,Flights');
  for (const r of flightHours) {
    lines.push(`${r.callsign},${r.name},${r.hours.toFixed(1)},${r.flights}`);
  }
  lines.push('');

  // Landing Rates
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

  // Fuel Efficiency
  lines.push('=== Fuel Efficiency ===');
  lines.push('Flight Number,Fuel Planned,Fuel Used,Efficiency %');
  for (const r of fuelEfficiency) {
    lines.push(`${r.flightNumber},${r.fuelPlanned},${r.fuelUsed},${r.efficiency.toFixed(1)}`);
  }
  lines.push('');

  // On-Time
  if (onTime) {
    lines.push('=== On-Time Performance ===');
    lines.push('Metric,Value');
    lines.push(`On-Time Count,${onTime.onTimeCount}`);
    lines.push(`Late Count,${onTime.lateCount}`);
    lines.push(`Total Flights,${onTime.totalFlights}`);
    lines.push(`Percentage,${onTime.percentage.toFixed(1)}%`);
    lines.push('');
  }

  // Route Popularity
  lines.push('=== Route Popularity ===');
  lines.push('Route,Departure,Arrival,Count,Avg Landing Rate');
  for (const r of routePopularity) {
    lines.push(
      `${r.depIcao}-${r.arrIcao},${r.depIcao},${r.arrIcao},${r.count},${Math.round(r.avgLandingRate)}`,
    );
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

  const fetchReports = useCallback(async (from: string, to: string) => {
    setLoading(true);
    setError(null);
    try {
      const qs = `from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
      const [fh, lr, fe, ot, rp] = await Promise.all([
        api.get<FlightHoursEntry[]>(`/api/admin/reports/flight-hours?${qs}`),
        api.get<LandingRateData>(`/api/admin/reports/landing-rates?${qs}`),
        api.get<FuelEfficiencyEntry[]>(`/api/admin/reports/fuel-efficiency?${qs}`),
        api.get<OnTimeData>(`/api/admin/reports/on-time?${qs}`),
        api.get<RoutePopularityEntry[]>(`/api/admin/reports/route-popularity?${qs}`),
      ]);
      setFlightHours(Array.isArray(fh) ? fh : []);
      setLandingRates(lr);
      setFuelEfficiency(Array.isArray(fe) ? fe : []);
      setOnTime(ot);
      setRoutePopularity(Array.isArray(rp) ? rp : []);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to load reports';
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch
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
    const csv = buildCsv(flightHours, landingRates, fuelEfficiency, onTime, routePopularity);
    const filename = `sma-reports_${dateFrom}_${dateTo}.csv`;
    downloadCsv(csv, filename);
    toast.success('CSV exported');
  }

  if (loading) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-semibold mb-6">Reports</h1>
        <ReportsPageSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-semibold mb-6">Reports</h1>
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
        <h1 className="text-2xl font-semibold">Reports</h1>
        <Button variant="outline" onClick={handleExportCsv} className="gap-2">
          <DownloadSimple size={16} weight="bold" />
          Export CSV
        </Button>
      </div>

      {/* Date Range Picker */}
      <Card className="border-border/50 mb-6">
        <CardContent className="py-4">
          <div className="flex flex-wrap items-center gap-3">
            <CalendarBlank size={18} className="text-muted-foreground" />
            <Label className="text-muted-foreground text-sm">From</Label>
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-[160px]"
            />
            <Label className="text-muted-foreground text-sm">To</Label>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-[160px]"
            />
            <Button onClick={handleApply} size="sm">
              Apply
            </Button>
            <Button variant="ghost" size="sm" onClick={handleReset} className="gap-1">
              <ArrowCounterClockwise size={14} />
              Reset
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Chart Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* 1. Flight Hours by Pilot */}
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Flight Hours by Pilot</CardTitle>
          </CardHeader>
          <CardContent>
            <FlightHoursChart data={flightHours} />
          </CardContent>
        </Card>

        {/* 2. Landing Rate Distribution */}
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Landing Rate Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            {landingRates ? (
              <LandingRateChart data={landingRates} />
            ) : (
              <p className="text-sm text-muted-foreground py-10 text-center">
                No data for this period
              </p>
            )}
          </CardContent>
        </Card>

        {/* 3. Fuel Efficiency */}
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Fuel Efficiency</CardTitle>
          </CardHeader>
          <CardContent>
            <FuelEfficiencyChart data={fuelEfficiency} />
          </CardContent>
        </Card>

        {/* 4. On-Time Performance */}
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">On-Time Performance</CardTitle>
          </CardHeader>
          <CardContent>
            {onTime ? (
              <OnTimeCard data={onTime} />
            ) : (
              <p className="text-sm text-muted-foreground py-10 text-center">
                No data for this period
              </p>
            )}
          </CardContent>
        </Card>

        {/* 5. Route Popularity — full width */}
        <Card className="border-border/50 lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Route Popularity</CardTitle>
          </CardHeader>
          <CardContent>
            <RoutePopularityChart data={routePopularity} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
