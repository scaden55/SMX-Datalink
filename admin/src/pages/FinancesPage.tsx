import { useCallback, useEffect, useMemo, useState } from 'react';
import { type ColumnDef } from '@tanstack/react-table';
import {
  CurrencyDollar,
  MagnifyingGlass,
  Plus,
  DotsThreeVertical,
  ArrowUp,
  ArrowDown,
  Coins,
  ChartBar,
  Receipt,
  Wallet,
  Prohibit,
  AirplaneTilt,
  TrendUp,
  TrendDown,
  Users as UsersIcon,
  Package,
  MapPin,
} from '@phosphor-icons/react';
import {
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { api, ApiError } from '@/lib/api';
import { toast } from '@/stores/toastStore';
import { StatusBadge, SectionHeader, DataRow, Surface } from '@/components/primitives';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageShell } from '@/components/shared/PageShell';
import { DataTable } from '@/components/shared/DataTable';
import { DataTablePagination } from '@/components/shared/DataTablePagination';
import { DataTableColumnHeader } from '@/components/shared/DataTableColumnHeader';
import { DetailPanel } from '@/components/shared/DetailPanel';

// ── Types ───────────────────────────────────────────────────────

type FinanceType = 'pay' | 'bonus' | 'deduction' | 'expense' | 'income';

interface FinanceEntry {
  id: number;
  pilotId: number;
  pilotCallsign: string;
  pilotName: string;
  pirepId: number | null;
  type: FinanceType;
  amount: number;
  description: string | null;
  createdBy: number | null;
  creatorCallsign: string | null;
  createdAt: string;
  voidedAt?: string | null;
  voidedBy?: number | null;
  reversalId?: number | null;
}

interface FinanceListResponse {
  entries: FinanceEntry[];
  total: number;
  page: number;
  pageSize: number;
}

interface PilotBalance {
  pilotId: number;
  callsign: string;
  pilotName: string;
  balance: number;
  totalPay: number;
  totalBonuses: number;
  totalDeductions: number;
}

interface FinanceSummary {
  totalPay: number;
  totalBonuses: number;
  totalDeductions: number;
  totalExpenses: number;
  totalIncome: number;
  netTotal: number;
}

interface PilotOption {
  id: number;
  callsign: string;
  firstName: string;
  lastName: string;
}

interface RevenueEntry {
  financeId: number;
  pirepId: number;
  flightNumber: string;
  depIcao: string;
  arrIcao: string;
  aircraftType: string;
  cargoLbs: number;
  revenue: number;
  pilotCallsign: string;
  pilotName: string;
  flightDate: string;
}

interface RouteProfitEntry {
  route: string;
  depIcao: string;
  arrIcao: string;
  flights: number;
  revenue: number;
  costs: number;
  profit: number;
  margin: number;
}

interface PilotPayEntry {
  pilotId: number;
  callsign: string;
  pilotName: string;
  hours: number;
  flights: number;
  basePay: number;
  bonuses: number;
  deductions: number;
  netPay: number;
}

// ── Helpers ─────────────────────────────────────────────────────

const fmt = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
});

function formatAmount(amount: number): string {
  return fmt.format(amount);
}

function isPositiveType(type: FinanceType): boolean {
  return type === 'income' || type === 'pay' || type === 'bonus';
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

function formatDateTime(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

function formatMargin(margin: number): string {
  return `${margin.toFixed(1)}%`;
}

function formatNumber(n: number): string {
  return n.toLocaleString('en-US');
}

// ── Chart Styling ───────────────────────────────────────────────

const CHART_COLORS = {
  blue: '#3b82f6',
  emerald: '#10b981',
  amber: '#f59e0b',
  red: '#ef4444',
  cyan: '#06b6d4',
};

const TOOLTIP_STYLE = {
  backgroundColor: 'var(--surface-2)',
  border: '1px solid var(--border-primary)',
  borderRadius: '6px',
  color: 'var(--text-primary)',
  fontSize: 12,
};

const AXIS_TICK = { fill: '#8b8fa3', fontSize: 12 };

// ── Add Transaction Dialog ──────────────────────────────────────

interface AddTransactionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
  pilots: PilotOption[];
}

function AddTransactionDialog({ open, onOpenChange, onCreated, pilots }: AddTransactionDialogProps) {
  const [type, setType] = useState<FinanceType>('income');
  const [amount, setAmount] = useState('');
  const [pilotId, setPilotId] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  function reset() {
    setType('income');
    setAmount('');
    setPilotId('');
    setDescription('');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!pilotId || !amount) {
      toast.error('Pilot and amount are required');
      return;
    }
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || !isFinite(parsedAmount) || parsedAmount <= 0) {
      toast.error('Amount must be a positive number');
      return;
    }

    setSaving(true);
    try {
      await api.post('/api/admin/finances', {
        pilotId: parseInt(pilotId),
        type,
        amount: parsedAmount,
        description: description.trim() || undefined,
      });
      toast.success('Transaction created');
      reset();
      onOpenChange(false);
      onCreated();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to create transaction');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add Transaction</DialogTitle>
          <DialogDescription>
            Create a manual financial entry for a pilot.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Type</Label>
            <Select value={type} onValueChange={(v) => setType(v as FinanceType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="income">Income</SelectItem>
                <SelectItem value="pay">Pay</SelectItem>
                <SelectItem value="bonus">Bonus</SelectItem>
                <SelectItem value="expense">Expense</SelectItem>
                <SelectItem value="deduction">Deduction</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Pilot</Label>
            <Select value={pilotId} onValueChange={setPilotId}>
              <SelectTrigger>
                <SelectValue placeholder="Select pilot..." />
              </SelectTrigger>
              <SelectContent>
                {pilots.map((p) => (
                  <SelectItem key={p.id} value={String(p.id)}>
                    {p.callsign} - {p.firstName} {p.lastName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Amount ($)</Label>
            <Input
              type="number"
              min="0.01"
              step="0.01"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="font-mono"
            />
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea
              placeholder="Optional description..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Creating...' : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Void Transaction Dialog ─────────────────────────────────────

interface VoidTransactionDialogProps {
  entry: FinanceEntry | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onVoided: () => void;
}

function VoidTransactionDialog({ entry, open, onOpenChange, onVoided }: VoidTransactionDialogProps) {
  const [voiding, setVoiding] = useState(false);

  async function handleVoid() {
    if (!entry) return;
    setVoiding(true);
    try {
      await api.post(`/api/admin/finances/${entry.id}/void`);
      toast.success('Transaction voided');
      onOpenChange(false);
      onVoided();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to void transaction');
    } finally {
      setVoiding(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Void Transaction</DialogTitle>
          <DialogDescription>
            Are you sure you want to void this{' '}
            <span className="font-semibold text-[var(--text-primary)]">{entry?.type}</span>{' '}
            transaction of{' '}
            <span className="font-mono font-semibold text-[var(--text-primary)]">
              {entry ? formatAmount(entry.amount) : ''}
            </span>
            {entry?.pilotCallsign ? ` for ${entry.pilotCallsign}` : ''}?
            This will create an offsetting reversal entry.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={voiding}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleVoid} disabled={voiding}>
            {voiding ? 'Voiding...' : 'Void Transaction'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Overview Tab ────────────────────────────────────────────────

interface OverviewTabProps {
  summary: FinanceSummary;
}

function OverviewTab({ summary }: OverviewTabProps) {
  const [monthlyData, setMonthlyData] = useState<Array<{ month: string; revenue: number; expenses: number; profit: number }>>([]);
  const [routeProfit, setRouteProfit] = useState<RouteProfitEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [periodSummary, setPeriodSummary] = useState<FinanceSummary>(summary);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo) params.set('dateTo', dateTo);
      const queryStr = params.toString();
      const suffix = queryStr ? `?${queryStr}` : '';

      const [summaryRes, entriesRes, routeRes] = await Promise.all([
        api.get<FinanceSummary>(`/api/admin/finances/summary${suffix}`),
        api.get<FinanceListResponse>(`/api/admin/finances?pageSize=500${queryStr ? `&${queryStr}` : ''}`),
        api.get<RouteProfitEntry[]>(`/api/admin/finances/route-profit${suffix}`),
      ]);

      setPeriodSummary(summaryRes);
      setRouteProfit(routeRes);

      // Build monthly chart data from entries
      const months = new Map<string, { month: string; revenue: number; expenses: number; profit: number }>();
      for (const entry of entriesRes.entries) {
        const d = new Date(entry.createdAt);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const label = d.toLocaleDateString('en-US', { year: '2-digit', month: 'short' });
        if (!months.has(key)) {
          months.set(key, { month: label, revenue: 0, expenses: 0, profit: 0 });
        }
        const m = months.get(key)!;
        if (isPositiveType(entry.type)) {
          m.revenue += entry.amount;
        } else {
          m.expenses += entry.amount;
        }
        m.profit = m.revenue - m.expenses;
      }
      const sorted = Array.from(months.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .slice(-6)
        .map(([, v]) => v);
      setMonthlyData(sorted);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to load overview');
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const totalRevenue = periodSummary.totalIncome + periodSummary.totalPay + periodSummary.totalBonuses;
  const totalExpenses = periodSummary.totalExpenses + periodSummary.totalDeductions;
  const netProfit = totalRevenue - totalExpenses;
  const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

  const topRoutes = useMemo(() => {
    return [...routeProfit]
      .sort((a, b) => b.profit - a.profit)
      .slice(0, 5);
  }, [routeProfit]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-[100px] rounded-lg bg-[var(--surface-2)] animate-pulse" />
          ))}
        </div>
        <div className="h-[300px] rounded-lg bg-[var(--surface-2)] animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Date Range Filter */}
      <div className="flex flex-wrap items-center gap-3">
        <Label className="text-[var(--text-tertiary)]">Period:</Label>
        <Input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          className="w-[160px]"
        />
        <span className="text-[var(--text-tertiary)]">to</span>
        <Input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          className="w-[160px]"
        />
        {(dateFrom || dateTo) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { setDateFrom(''); setDateTo(''); }}
          >
            Clear
          </Button>
        )}
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Surface elevation={1} padding="default">
          <div className="flex items-center gap-2 text-[var(--text-tertiary)] mb-1">
            <TrendUp size={16} weight="duotone" className="text-[var(--accent-emerald)]" />
            <span className="text-xs uppercase tracking-wider">Revenue</span>
          </div>
          <p className="text-xl font-mono font-bold text-[var(--accent-emerald)]">{formatAmount(totalRevenue)}</p>
        </Surface>
        <Surface elevation={1} padding="default">
          <div className="flex items-center gap-2 text-[var(--text-tertiary)] mb-1">
            <TrendDown size={16} weight="duotone" className="text-[var(--accent-red)]" />
            <span className="text-xs uppercase tracking-wider">Expenses</span>
          </div>
          <p className="text-xl font-mono font-bold text-[var(--accent-red)]">{formatAmount(totalExpenses)}</p>
        </Surface>
        <Surface elevation={1} padding="default">
          <div className="flex items-center gap-2 text-[var(--text-tertiary)] mb-1">
            <CurrencyDollar size={16} weight="duotone" className="text-[var(--accent-blue)]" />
            <span className="text-xs uppercase tracking-wider">Net Profit</span>
          </div>
          <p className={`text-xl font-mono font-bold ${netProfit >= 0 ? 'text-[var(--accent-emerald)]' : 'text-[var(--accent-red)]'}`}>
            {formatAmount(netProfit)}
          </p>
        </Surface>
        <Surface elevation={1} padding="default">
          <div className="flex items-center gap-2 text-[var(--text-tertiary)] mb-1">
            <ChartBar size={16} weight="duotone" className="text-[var(--accent-blue)]" />
            <span className="text-xs uppercase tracking-wider">Profit Margin</span>
          </div>
          <p className={`text-xl font-mono font-bold ${profitMargin >= 0 ? 'text-[var(--accent-emerald)]' : 'text-[var(--accent-red)]'}`}>
            {formatMargin(profitMargin)}
          </p>
        </Surface>
      </div>

      {/* Area Chart: 6-Month P&L */}
      <Surface elevation={1} padding="none">
        <div className="p-4 pb-0">
          <SectionHeader title="Monthly Profit & Loss" />
        </div>
        <div className="p-4">
          {monthlyData.length === 0 ? (
            <p className="text-sm text-[var(--text-tertiary)] py-8 text-center">
              No data for the selected period
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={monthlyData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={CHART_COLORS.emerald} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={CHART_COLORS.emerald} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorExpenses" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={CHART_COLORS.red} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={CHART_COLORS.red} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={CHART_COLORS.blue} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={CHART_COLORS.blue} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-primary)" />
                <XAxis
                  dataKey="month"
                  tick={AXIS_TICK}
                  tickLine={false}
                  axisLine={{ stroke: 'var(--border-primary)' }}
                />
                <YAxis
                  tick={AXIS_TICK}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v: number) =>
                    v >= 1000 ? `$${(v / 1000).toFixed(0)}k` : `$${v}`
                  }
                />
                <RechartsTooltip
                  contentStyle={TOOLTIP_STYLE}
                  formatter={(value: number | string | undefined) => [
                    `$${Number(value ?? 0).toLocaleString()}`,
                  ]}
                  labelStyle={{ color: '#8b8fa3' }}
                />
                <Legend wrapperStyle={{ fontSize: 12, color: '#8b8fa3' }} />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  name="Revenue"
                  stroke={CHART_COLORS.emerald}
                  fillOpacity={1}
                  fill="url(#colorRevenue)"
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="expenses"
                  name="Expenses"
                  stroke={CHART_COLORS.red}
                  fillOpacity={1}
                  fill="url(#colorExpenses)"
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="profit"
                  name="Profit"
                  stroke={CHART_COLORS.blue}
                  fillOpacity={1}
                  fill="url(#colorProfit)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </Surface>

      {/* Top Routes + Breakdown */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Top Routes */}
        <Surface elevation={1} padding="none">
          <div className="p-4 pb-0">
            <SectionHeader
              title="Top Routes by Profit"
              action={<MapPin size={14} weight="duotone" className="text-[var(--text-tertiary)]" />}
            />
          </div>
          <div className="p-4">
            {topRoutes.length === 0 ? (
              <p className="text-sm text-[var(--text-tertiary)] py-4 text-center">
                No route data available
              </p>
            ) : (
              <div className="space-y-3">
                {topRoutes.map((route, idx) => (
                  <div
                    key={route.route}
                    className="flex items-center justify-between py-2 border-b border-[var(--border-secondary)] last:border-0"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-mono text-[var(--text-quaternary)] w-4">{idx + 1}</span>
                      <div>
                        <span className="font-mono font-medium text-sm text-[var(--text-primary)]">
                          {route.depIcao} <span className="text-[var(--text-quaternary)]">&rarr;</span> {route.arrIcao}
                        </span>
                        <div className="text-xs text-[var(--text-tertiary)]">
                          {route.flights} flight{route.flights !== 1 ? 's' : ''}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`font-mono font-medium text-sm ${route.profit >= 0 ? 'text-[var(--accent-emerald)]' : 'text-[var(--accent-red)]'}`}>
                        {formatAmount(route.profit)}
                      </p>
                      <p className="text-xs text-[var(--text-tertiary)]">
                        {formatMargin(route.margin)} margin
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Surface>

        {/* Detailed Breakdown */}
        <Surface elevation={1} padding="none">
          <div className="p-4 pb-0">
            <SectionHeader title="Breakdown by Type" />
          </div>
          <div className="p-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between py-2 border-b border-[var(--border-secondary)]">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-sm bg-[var(--accent-emerald)]" />
                  <span className="text-sm text-[var(--text-primary)]">Income</span>
                </div>
                <span className="font-mono text-[var(--accent-emerald)]">{formatAmount(periodSummary.totalIncome)}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-[var(--border-secondary)]">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-sm bg-[var(--accent-blue)]" />
                  <span className="text-sm text-[var(--text-primary)]">Pilot Pay</span>
                </div>
                <span className="font-mono text-[var(--accent-blue)]">{formatAmount(periodSummary.totalPay)}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-[var(--border-secondary)]">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-sm bg-[var(--accent-cyan)]" />
                  <span className="text-sm text-[var(--text-primary)]">Bonuses</span>
                </div>
                <span className="font-mono text-[var(--accent-cyan)]">{formatAmount(periodSummary.totalBonuses)}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-[var(--border-secondary)]">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-sm bg-[var(--accent-red)]" />
                  <span className="text-sm text-[var(--text-primary)]">Expenses</span>
                </div>
                <span className="font-mono text-[var(--accent-red)]">{formatAmount(periodSummary.totalExpenses)}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-[var(--border-secondary)]">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-sm bg-[var(--accent-amber)]" />
                  <span className="text-sm text-[var(--text-primary)]">Deductions</span>
                </div>
                <span className="font-mono text-[var(--accent-amber)]">{formatAmount(periodSummary.totalDeductions)}</span>
              </div>
              <div className="flex items-center justify-between py-2 pt-3">
                <span className="text-sm font-semibold text-[var(--text-primary)]">Net Total</span>
                <span
                  className={`font-mono font-bold text-lg ${
                    periodSummary.netTotal >= 0 ? 'text-[var(--accent-emerald)]' : 'text-[var(--accent-red)]'
                  }`}
                >
                  {formatAmount(periodSummary.netTotal)}
                </span>
              </div>
            </div>
          </div>
        </Surface>
      </div>
    </div>
  );
}

// ── Revenue Tab ─────────────────────────────────────────────────

function RevenueTab() {
  const [entries, setEntries] = useState<RevenueEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [routeProfit, setRouteProfit] = useState<RouteProfitEntry[]>([]);

  // Detail panel
  const [detailEntry, setDetailEntry] = useState<RevenueEntry | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('pageSize', String(pageSize));
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo) params.set('dateTo', dateTo);

      const dateParams = new URLSearchParams();
      if (dateFrom) dateParams.set('dateFrom', dateFrom);
      if (dateTo) dateParams.set('dateTo', dateTo);
      const dateSuffix = dateParams.toString() ? `?${dateParams.toString()}` : '';

      const [revRes, routeRes] = await Promise.all([
        api.get<{ entries: RevenueEntry[]; total: number }>(`/api/admin/finances/revenue?${params}`),
        api.get<RouteProfitEntry[]>(`/api/admin/finances/route-profit${dateSuffix}`),
      ]);

      setEntries(revRes.entries);
      setTotal(revRes.total);
      setRouteProfit(routeRes);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to load revenue data');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, dateFrom, dateTo]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    setPage(1);
  }, [dateFrom, dateTo]);

  const topRoutes = useMemo(() => {
    return [...routeProfit]
      .sort((a, b) => b.profit - a.profit)
      .slice(0, 5);
  }, [routeProfit]);

  function handleRowClick(entry: RevenueEntry) {
    setDetailEntry(entry);
    setDetailOpen(true);
  }

  function handleCloseDetail() {
    setDetailOpen(false);
    setDetailEntry(null);
  }

  const columns: ColumnDef<RevenueEntry, unknown>[] = useMemo(
    () => [
      {
        accessorKey: 'flightDate',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Date" />,
        cell: ({ row }) => (
          <span className="text-[var(--text-tertiary)] text-sm">
            {formatDate(row.original.flightDate)}
          </span>
        ),
        size: 110,
      },
      {
        accessorKey: 'flightNumber',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Flight #" />,
        cell: ({ row }) => (
          <span className="font-mono font-medium">{row.original.flightNumber}</span>
        ),
        size: 100,
      },
      {
        id: 'route',
        header: 'Route',
        cell: ({ row }) => (
          <span className="font-mono text-sm">
            {row.original.depIcao}
            <span className="text-[var(--text-quaternary)] mx-1">&rarr;</span>
            {row.original.arrIcao}
          </span>
        ),
        enableSorting: false,
        size: 120,
      },
      {
        accessorKey: 'aircraftType',
        header: 'Aircraft',
        cell: ({ row }) => (
          <span className="text-sm text-[var(--text-tertiary)]">{row.original.aircraftType}</span>
        ),
        size: 110,
      },
      {
        accessorKey: 'cargoLbs',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Cargo (lbs)" />,
        cell: ({ row }) => (
          <span className="font-mono text-sm">{formatNumber(row.original.cargoLbs)}</span>
        ),
        size: 100,
      },
      {
        accessorKey: 'revenue',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Revenue" />,
        cell: ({ row }) => (
          <span className="font-mono font-medium text-[var(--accent-emerald)]">
            {formatAmount(row.original.revenue)}
          </span>
        ),
        size: 110,
      },
      {
        accessorKey: 'pilotCallsign',
        header: 'Pilot',
        cell: ({ row }) => (
          <span className="font-mono text-sm text-[var(--text-tertiary)]">
            {row.original.pilotCallsign}
          </span>
        ),
        size: 90,
      },
    ],
    []
  );

  return (
    <div className="space-y-4">
      {/* Top Routes Ranking */}
      {topRoutes.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
          {topRoutes.map((route, idx) => (
            <Surface key={route.route} elevation={1} padding="compact">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-[var(--text-tertiary)]">#{idx + 1} Route</span>
                <span className="inline-flex items-center px-1.5 py-0 rounded-md text-[10px] font-semibold ring-1 ring-[var(--border-primary)] text-[var(--text-tertiary)] bg-[var(--surface-3)]">
                  {route.flights} flights
                </span>
              </div>
              <p className="font-mono font-medium text-sm text-[var(--text-primary)]">
                {route.depIcao} <span className="text-[var(--text-quaternary)]">&rarr;</span> {route.arrIcao}
              </p>
              <div className="flex items-center justify-between mt-1">
                <span className={`font-mono text-sm font-medium ${route.profit >= 0 ? 'text-[var(--accent-emerald)]' : 'text-[var(--accent-red)]'}`}>
                  {formatAmount(route.profit)}
                </span>
                <span className="text-xs text-[var(--text-tertiary)]">{formatMargin(route.margin)}</span>
              </div>
            </Surface>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Label className="text-[var(--text-tertiary)]">Period:</Label>
        <Input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          className="w-[150px]"
        />
        <span className="text-[var(--text-tertiary)]">to</span>
        <Input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          className="w-[150px]"
        />
        {(dateFrom || dateTo) && (
          <Button variant="ghost" size="sm" onClick={() => { setDateFrom(''); setDateTo(''); }}>
            Clear
          </Button>
        )}
      </div>

      {/* Split view: table + detail */}
      <div className="flex flex-1 gap-0 overflow-hidden rounded-md border border-[var(--border-primary)]">
        <div className={`${detailOpen ? 'w-[55%]' : 'w-full'} flex flex-col transition-all duration-200`}>
          <DataTable
            columns={columns}
            data={entries}
            onRowClick={handleRowClick}
            selectedRowId={detailEntry?.financeId}
            loading={loading}
            emptyMessage="No revenue entries found"
            getRowId={(row) => String(row.financeId)}
          />
          <DataTablePagination
            page={page}
            pageSize={pageSize}
            total={total}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        </div>

        {detailOpen && detailEntry && (
          <DetailPanel
            open={detailOpen}
            onClose={handleCloseDetail}
            title={detailEntry.flightNumber}
            subtitle={`${detailEntry.depIcao} \u2192 ${detailEntry.arrIcao}`}
          >
            <div className="space-y-6">
              {/* Flight Info */}
              <section>
                <SectionHeader title="Flight Info" action={<AirplaneTilt size={14} weight="duotone" className="text-[var(--text-tertiary)]" />} />
                <div className="space-y-0.5">
                  <DataRow label="Flight #" value={<span className="font-mono font-medium">{detailEntry.flightNumber}</span>} />
                  <DataRow label="Route" value={
                    <span className="font-mono">
                      {detailEntry.depIcao} <span className="text-[var(--text-quaternary)]">&rarr;</span> {detailEntry.arrIcao}
                    </span>
                  } />
                  <DataRow label="Aircraft" value={<span className="font-mono">{detailEntry.aircraftType}</span>} />
                  <DataRow label="Date" value={formatDate(detailEntry.flightDate)} />
                  <DataRow label="Pilot" value={
                    <>
                      <span className="font-mono">{detailEntry.pilotCallsign}</span>
                      <span className="text-[var(--text-tertiary)] ml-1">({detailEntry.pilotName})</span>
                    </>
                  } />
                </div>
              </section>

              {/* Revenue Breakdown */}
              <section>
                <SectionHeader title="Cargo & Revenue" action={<Package size={14} weight="duotone" className="text-[var(--text-tertiary)]" />} />
                <div className="space-y-0.5">
                  <DataRow label="Cargo Weight" value={<span className="font-mono">{formatNumber(detailEntry.cargoLbs)} lbs</span>} mono />
                  <DataRow label="Revenue" value={
                    <span className="font-mono font-medium text-[var(--accent-emerald)]">
                      {formatAmount(detailEntry.revenue)}
                    </span>
                  } />
                  {detailEntry.pirepId && (
                    <DataRow label="PIREP ID" value={<span className="font-mono text-[var(--text-tertiary)]">#{detailEntry.pirepId}</span>} />
                  )}
                </div>
              </section>
            </div>
          </DetailPanel>
        )}
      </div>
    </div>
  );
}

// ── Pilot Pay Tab ───────────────────────────────────────────────

interface PilotPayTabProps {
  pilots: PilotOption[];
  onRefresh: () => void;
}

function PilotPayTab({ pilots, onRefresh }: PilotPayTabProps) {
  const [payData, setPayData] = useState<PilotPayEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [addOpen, setAddOpen] = useState(false);

  // Detail panel
  const [detailEntry, setDetailEntry] = useState<PilotPayEntry | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo) params.set('dateTo', dateTo);
      const suffix = params.toString() ? `?${params.toString()}` : '';

      const res = await api.get<PilotPayEntry[]>(`/api/admin/finances/pilot-pay${suffix}`);
      setPayData(res);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to load pilot pay data');
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const totals = useMemo(() => {
    return payData.reduce(
      (acc, p) => ({
        hours: acc.hours + p.hours,
        flights: acc.flights + p.flights,
        basePay: acc.basePay + p.basePay,
        bonuses: acc.bonuses + p.bonuses,
        deductions: acc.deductions + p.deductions,
        netPay: acc.netPay + p.netPay,
      }),
      { hours: 0, flights: 0, basePay: 0, bonuses: 0, deductions: 0, netPay: 0 }
    );
  }, [payData]);

  function handleRowClick(entry: PilotPayEntry) {
    setDetailEntry(entry);
    setDetailOpen(true);
  }

  function handleCloseDetail() {
    setDetailOpen(false);
    setDetailEntry(null);
  }

  function handleTransactionCreated() {
    fetchData();
    onRefresh();
  }

  const columns: ColumnDef<PilotPayEntry, unknown>[] = useMemo(
    () => [
      {
        accessorKey: 'callsign',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Pilot" />,
        cell: ({ row }) => (
          <div>
            <span className="font-mono font-medium">{row.original.callsign}</span>
            <p className="text-xs text-[var(--text-tertiary)]">{row.original.pilotName}</p>
          </div>
        ),
        size: 140,
      },
      {
        accessorKey: 'hours',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Hours" />,
        cell: ({ row }) => (
          <span className="font-mono text-[var(--text-tertiary)]">{row.original.hours.toFixed(1)}h</span>
        ),
        size: 80,
      },
      {
        accessorKey: 'flights',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Flights" />,
        cell: ({ row }) => (
          <span className="font-mono text-[var(--text-tertiary)]">{row.original.flights}</span>
        ),
        size: 80,
      },
      {
        accessorKey: 'basePay',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Base Pay" />,
        cell: ({ row }) => (
          <span className="font-mono text-[var(--accent-emerald)]">{formatAmount(row.original.basePay)}</span>
        ),
        size: 110,
      },
      {
        accessorKey: 'bonuses',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Bonuses" />,
        cell: ({ row }) => (
          <span className="font-mono text-[var(--accent-cyan)]">{formatAmount(row.original.bonuses)}</span>
        ),
        size: 110,
      },
      {
        accessorKey: 'deductions',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Deductions" />,
        cell: ({ row }) => (
          <span className="font-mono text-[var(--accent-amber)]">{formatAmount(row.original.deductions)}</span>
        ),
        size: 110,
      },
      {
        accessorKey: 'netPay',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Net Pay" />,
        cell: ({ row }) => (
          <span className={`font-mono font-medium ${row.original.netPay >= 0 ? 'text-[var(--accent-emerald)]' : 'text-[var(--accent-red)]'}`}>
            {formatAmount(row.original.netPay)}
          </span>
        ),
        size: 120,
      },
    ],
    []
  );

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Surface elevation={1} padding="compact">
          <span className="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)]">Total Base Pay</span>
          <p className="text-lg font-mono font-bold text-[var(--accent-emerald)] mt-1">{formatAmount(totals.basePay)}</p>
        </Surface>
        <Surface elevation={1} padding="compact">
          <span className="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)]">Total Bonuses</span>
          <p className="text-lg font-mono font-bold text-[var(--accent-cyan)] mt-1">{formatAmount(totals.bonuses)}</p>
        </Surface>
        <Surface elevation={1} padding="compact">
          <span className="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)]">Total Deductions</span>
          <p className="text-lg font-mono font-bold text-[var(--accent-amber)] mt-1">{formatAmount(totals.deductions)}</p>
        </Surface>
        <Surface elevation={1} padding="compact">
          <span className="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)]">Total Net Pay</span>
          <p className={`text-lg font-mono font-bold mt-1 ${totals.netPay >= 0 ? 'text-[var(--accent-emerald)]' : 'text-[var(--accent-red)]'}`}>
            {formatAmount(totals.netPay)}
          </p>
        </Surface>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <Label className="text-[var(--text-tertiary)]">Period:</Label>
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="w-[150px]"
          />
          <span className="text-[var(--text-tertiary)]">to</span>
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="w-[150px]"
          />
          {(dateFrom || dateTo) && (
            <Button variant="ghost" size="sm" onClick={() => { setDateFrom(''); setDateTo(''); }}>
              Clear
            </Button>
          )}
        </div>
        <Button onClick={() => setAddOpen(true)}>
          <Plus size={16} weight="bold" />
          Add Adjustment
        </Button>
      </div>

      {/* Split view: table + detail */}
      <div className="flex flex-1 gap-0 overflow-hidden rounded-md border border-[var(--border-primary)]">
        <div className={`${detailOpen ? 'w-[55%]' : 'w-full'} flex flex-col transition-all duration-200`}>
          <DataTable
            columns={columns}
            data={payData}
            onRowClick={handleRowClick}
            selectedRowId={detailEntry?.pilotId}
            loading={loading}
            emptyMessage="No pilot pay data found"
            getRowId={(row) => String(row.pilotId)}
          />
        </div>

        {detailOpen && detailEntry && (
          <DetailPanel
            open={detailOpen}
            onClose={handleCloseDetail}
            title={detailEntry.callsign}
            subtitle={detailEntry.pilotName}
          >
            <div className="space-y-6">
              {/* Activity */}
              <section>
                <SectionHeader title="Activity" action={<UsersIcon size={14} weight="duotone" className="text-[var(--text-tertiary)]" />} />
                <div className="space-y-0.5">
                  <DataRow label="Flights" value={<span className="font-mono">{detailEntry.flights}</span>} />
                  <DataRow label="Hours" value={<span className="font-mono">{detailEntry.hours.toFixed(1)}h</span>} />
                </div>
              </section>

              {/* Pay Breakdown */}
              <section>
                <SectionHeader title="Pay Breakdown" action={<Wallet size={14} weight="duotone" className="text-[var(--text-tertiary)]" />} />
                <div className="space-y-0.5">
                  <DataRow label="Base Pay" value={<span className="font-mono text-[var(--accent-emerald)]">{formatAmount(detailEntry.basePay)}</span>} />
                  <DataRow label="Bonuses" value={<span className="font-mono text-[var(--accent-cyan)]">{formatAmount(detailEntry.bonuses)}</span>} />
                  <DataRow label="Deductions" value={<span className="font-mono text-[var(--accent-amber)]">-{formatAmount(detailEntry.deductions)}</span>} />
                </div>
              </section>

              {/* Net Pay */}
              <div className="flex items-center justify-between pt-2 border-t border-[var(--border-primary)]">
                <span className="text-sm font-semibold text-[var(--text-primary)]">Net Pay</span>
                <span className={`font-mono font-bold text-lg ${detailEntry.netPay >= 0 ? 'text-[var(--accent-emerald)]' : 'text-[var(--accent-red)]'}`}>
                  {formatAmount(detailEntry.netPay)}
                </span>
              </div>

              {/* Per-flight average */}
              {detailEntry.flights > 0 && (
                <Surface elevation={0} padding="compact" className="bg-[var(--surface-1)] border border-[var(--border-secondary)]">
                  <span className="text-xs text-[var(--text-tertiary)]">Average per flight</span>
                  <p className="font-mono font-medium text-sm mt-0.5 text-[var(--text-primary)]">
                    {formatAmount(detailEntry.netPay / detailEntry.flights)}
                  </p>
                </Surface>
              )}
            </div>
          </DetailPanel>
        )}
      </div>

      <AddTransactionDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onCreated={handleTransactionCreated}
        pilots={pilots}
      />
    </div>
  );
}

// ── Ledger Tab ──────────────────────────────────────────────────

interface LedgerTabProps {
  pilots: PilotOption[];
  onRefresh: () => void;
}

function LedgerTab({ pilots, onRefresh }: LedgerTabProps) {
  const [entries, setEntries] = useState<FinanceEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Dialogs
  const [addOpen, setAddOpen] = useState(false);
  const [voidEntry, setVoidEntry] = useState<FinanceEntry | null>(null);

  // Detail panel
  const [detailEntry, setDetailEntry] = useState<FinanceEntry | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('pageSize', String(pageSize));
      if (typeFilter !== 'all') params.set('type', typeFilter);
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo) params.set('dateTo', dateTo);

      const res = await api.get<FinanceListResponse>(`/api/admin/finances?${params}`);
      setEntries(res.entries);
      setTotal(res.total);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to load transactions');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, typeFilter, dateFrom, dateTo]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  useEffect(() => {
    setPage(1);
  }, [typeFilter, dateFrom, dateTo]);

  // Client-side search filtering
  const filteredEntries = useMemo(() => {
    if (!search) return entries;
    const q = search.toLowerCase();
    return entries.filter(
      (e) =>
        e.pilotCallsign.toLowerCase().includes(q) ||
        e.pilotName.toLowerCase().includes(q) ||
        (e.description ?? '').toLowerCase().includes(q)
    );
  }, [entries, search]);

  function handleRowClick(entry: FinanceEntry) {
    setDetailEntry(entry);
    setDetailOpen(true);
  }

  function handleCloseDetail() {
    setDetailOpen(false);
    setDetailEntry(null);
  }

  function handleVoided() {
    fetchEntries();
    onRefresh();
  }

  function handleCreated() {
    fetchEntries();
    onRefresh();
  }

  const isVoided = (entry: FinanceEntry) => !!entry.voidedAt || !!entry.reversalId;

  const columns: ColumnDef<FinanceEntry, unknown>[] = useMemo(
    () => [
      {
        accessorKey: 'createdAt',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Date" />,
        cell: ({ row }) => {
          const voided = isVoided(row.original);
          return (
            <span className={`text-[var(--text-tertiary)] text-sm ${voided ? 'line-through opacity-50' : ''}`}>
              {formatDateTime(row.original.createdAt)}
            </span>
          );
        },
        size: 150,
      },
      {
        accessorKey: 'type',
        header: 'Type',
        cell: ({ row }) => {
          const voided = isVoided(row.original);
          return (
            <div className={voided ? 'opacity-50' : ''}>
              <StatusBadge status={row.original.type} />
              {voided && (
                <StatusBadge status="voided" className="ml-1" />
              )}
            </div>
          );
        },
        enableSorting: false,
        size: 130,
      },
      {
        accessorKey: 'description',
        header: 'Description',
        cell: ({ row }) => {
          const voided = isVoided(row.original);
          return (
            <span className={`max-w-[250px] truncate block ${voided ? 'line-through opacity-50' : ''}`}>
              {row.original.description || <span className="text-[var(--text-quaternary)] italic">No description</span>}
            </span>
          );
        },
        enableSorting: false,
      },
      {
        accessorKey: 'amount',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Amount" className="justify-end" />,
        cell: ({ row }) => {
          const voided = isVoided(row.original);
          const positive = isPositiveType(row.original.type);
          return (
            <span
              className={`font-mono font-medium text-right block ${
                voided
                  ? 'line-through opacity-50 text-[var(--text-quaternary)]'
                  : positive
                    ? 'text-[var(--accent-emerald)]'
                    : 'text-[var(--accent-red)]'
              }`}
            >
              {positive ? '+' : '-'}
              {formatAmount(row.original.amount)}
            </span>
          );
        },
        size: 130,
      },
      {
        accessorKey: 'pilotCallsign',
        header: 'Pilot',
        cell: ({ row }) => {
          const voided = isVoided(row.original);
          return (
            <span className={`font-mono text-sm ${voided ? 'opacity-50' : ''}`}>
              {row.original.pilotCallsign}
            </span>
          );
        },
        enableSorting: false,
        size: 100,
      },
      {
        id: 'actions',
        enableHiding: false,
        enableSorting: false,
        size: 50,
        cell: ({ row }) => {
          const entry = row.original;
          const voided = isVoided(entry);
          if (voided) return null;
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={(e) => e.stopPropagation()}
                >
                  <DotsThreeVertical size={16} weight="bold" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  className="text-[var(--accent-red)] focus:text-[var(--accent-red)]"
                  onClick={(e) => { e.stopPropagation(); setVoidEntry(entry); }}
                >
                  <Prohibit size={14} />
                  Void
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          );
        },
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-3">
          <div className="relative max-w-xs flex-1 min-w-[200px]">
            <MagnifyingGlass
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-quaternary)]"
            />
            <Input
              placeholder="Search transactions..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="income">Income</SelectItem>
              <SelectItem value="pay">Pay</SelectItem>
              <SelectItem value="bonus">Bonus</SelectItem>
              <SelectItem value="expense">Expense</SelectItem>
              <SelectItem value="deduction">Deduction</SelectItem>
            </SelectContent>
          </Select>
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="w-[150px]"
            placeholder="From"
          />
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="w-[150px]"
            placeholder="To"
          />
        </div>
        <Button onClick={() => setAddOpen(true)}>
          <Plus size={16} weight="bold" />
          Add Transaction
        </Button>
      </div>

      {/* Split view: table + detail */}
      <div className="flex flex-1 gap-0 overflow-hidden rounded-md border border-[var(--border-primary)]">
        <div className={`${detailOpen ? 'w-[55%]' : 'w-full'} flex flex-col transition-all duration-200`}>
          <DataTable
            columns={columns}
            data={filteredEntries}
            onRowClick={handleRowClick}
            selectedRowId={detailEntry?.id}
            loading={loading}
            emptyMessage="No transactions found"
            getRowId={(row) => String(row.id)}
          />
          <DataTablePagination
            page={page}
            pageSize={pageSize}
            total={total}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        </div>

        {detailOpen && detailEntry && (
          <DetailPanel
            open={detailOpen}
            onClose={handleCloseDetail}
            title={`Transaction #${detailEntry.id}`}
            subtitle={detailEntry.pilotCallsign}
            actions={
              !isVoided(detailEntry) ? (
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => { handleCloseDetail(); setVoidEntry(detailEntry); }}
                >
                  <Prohibit size={14} weight="bold" />
                  Void
                </Button>
              ) : undefined
            }
          >
            <div className="space-y-6">
              {isVoided(detailEntry) && (
                <StatusBadge status="voided" className="text-[var(--accent-red)]" />
              )}

              <section>
                <SectionHeader title="Details" action={<Receipt size={14} weight="duotone" className="text-[var(--text-tertiary)]" />} />
                <div className="space-y-0.5">
                  <DataRow label="Type" value={<StatusBadge status={detailEntry.type} />} />
                  <DataRow label="Amount" value={
                    <span className={`font-mono font-medium ${isPositiveType(detailEntry.type) ? 'text-[var(--accent-emerald)]' : 'text-[var(--accent-red)]'}`}>
                      {isPositiveType(detailEntry.type) ? '+' : '-'}{formatAmount(detailEntry.amount)}
                    </span>
                  } />
                  <DataRow label="Pilot" value={
                    <>
                      <span className="font-mono">{detailEntry.pilotCallsign}</span>
                      <span className="text-[var(--text-tertiary)] ml-1">({detailEntry.pilotName})</span>
                    </>
                  } />
                  <DataRow label="Date" value={formatDateTime(detailEntry.createdAt)} />
                  {detailEntry.description && (
                    <DataRow label="Description" value={<span className="text-sm">{detailEntry.description}</span>} />
                  )}
                  {detailEntry.pirepId && (
                    <DataRow label="PIREP" value={<span className="font-mono text-[var(--text-tertiary)]">#{detailEntry.pirepId}</span>} />
                  )}
                  {detailEntry.creatorCallsign && (
                    <DataRow label="Created By" value={<span className="font-mono text-[var(--text-tertiary)]">{detailEntry.creatorCallsign}</span>} />
                  )}
                </div>
              </section>
            </div>
          </DetailPanel>
        )}
      </div>

      {/* Dialogs */}
      <AddTransactionDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onCreated={handleCreated}
        pilots={pilots}
      />
      <VoidTransactionDialog
        entry={voidEntry}
        open={!!voidEntry}
        onOpenChange={(open) => { if (!open) setVoidEntry(null); }}
        onVoided={handleVoided}
      />
    </div>
  );
}

// ── Page ────────────────────────────────────────────────────────

export function FinancesPage() {
  const [summary, setSummary] = useState<FinanceSummary | null>(null);
  const [pilots, setPilots] = useState<PilotOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchInitial = useCallback(async () => {
    try {
      const [summaryRes, usersRes] = await Promise.all([
        api.get<FinanceSummary>('/api/admin/finances/summary'),
        api.get<{ users: PilotOption[] }>('/api/admin/users?pageSize=100'),
      ]);
      setSummary(summaryRes);
      setPilots(usersRes.users);
      setError(null);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to load finance data';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInitial();
  }, [fetchInitial]);

  const refreshSummary = useCallback(async () => {
    try {
      const summaryRes = await api.get<FinanceSummary>('/api/admin/finances/summary');
      setSummary(summaryRes);
    } catch {
      // Silently fail — the individual tab will show its own errors
    }
  }, []);

  if (loading) {
    return (
      <PageShell title="Finances" subtitle="Revenue, payroll, and accounting">
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-[60px] rounded-lg bg-[var(--surface-2)] animate-pulse" />
            ))}
          </div>
          <div className="h-10 w-full rounded-lg bg-[var(--surface-2)] animate-pulse" />
          <div className="h-[400px] rounded-lg bg-[var(--surface-2)] animate-pulse" />
        </div>
      </PageShell>
    );
  }

  if (error) {
    return (
      <PageShell title="Finances" subtitle="Revenue, payroll, and accounting">
        <div className="flex items-center justify-center py-20 text-[var(--text-tertiary)]">
          <p>{error}</p>
        </div>
      </PageShell>
    );
  }

  const totalRevenue = summary ? summary.totalIncome + summary.totalPay + summary.totalBonuses : 0;
  const totalExpenses = summary ? summary.totalExpenses + summary.totalDeductions : 0;
  const netProfit = totalRevenue - totalExpenses;
  const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

  return (
    <PageShell
      title="Finances"
      subtitle="Revenue, payroll, and accounting"
      stats={[
        {
          label: 'Revenue',
          value: formatAmount(totalRevenue),
          icon: TrendUp,
          accent: 'emerald',
        },
        {
          label: 'Expenses',
          value: formatAmount(totalExpenses),
          icon: TrendDown,
          accent: 'red',
        },
        {
          label: 'Net Profit',
          value: formatAmount(netProfit),
          icon: CurrencyDollar,
          accent: netProfit >= 0 ? 'emerald' : 'red',
        },
        {
          label: 'Margin',
          value: formatMargin(profitMargin),
          icon: ChartBar,
          accent: 'blue',
        },
      ]}
    >
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="revenue">Revenue</TabsTrigger>
          <TabsTrigger value="pilot-pay">Pilot Pay</TabsTrigger>
          <TabsTrigger value="ledger">Ledger</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          {summary && <OverviewTab summary={summary} />}
        </TabsContent>

        <TabsContent value="revenue">
          <RevenueTab />
        </TabsContent>

        <TabsContent value="pilot-pay">
          <PilotPayTab pilots={pilots} onRefresh={refreshSummary} />
        </TabsContent>

        <TabsContent value="ledger">
          <LedgerTab pilots={pilots} onRefresh={refreshSummary} />
        </TabsContent>
      </Tabs>
    </PageShell>
  );
}
