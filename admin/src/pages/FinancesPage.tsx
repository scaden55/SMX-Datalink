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
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
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

function typeBadge(type: FinanceType) {
  switch (type) {
    case 'income':
      return (
        <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20">
          Income
        </Badge>
      );
    case 'pay':
      return (
        <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20">
          Pay
        </Badge>
      );
    case 'expense':
      return (
        <Badge className="bg-red-500/15 text-red-400 border-red-500/30 hover:bg-red-500/20">
          Expense
        </Badge>
      );
    case 'deduction':
      return (
        <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/30 hover:bg-amber-500/20">
          Deduction
        </Badge>
      );
    case 'bonus':
      return (
        <Badge className="bg-blue-500/15 text-blue-400 border-blue-500/30 hover:bg-blue-500/20">
          Bonus
        </Badge>
      );
  }
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

// ── Detail Row ──────────────────────────────────────────────────

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1.5">
      <span className="text-sm text-muted-foreground shrink-0">{label}</span>
      <span className="text-sm text-right">{children}</span>
    </div>
  );
}

// ── Chart Styling ───────────────────────────────────────────────

const CHART_COLORS = {
  income: '#22c55e',
  expense: '#ef4444',
  profit: '#3b82f6',
};

const TOOLTIP_STYLE = {
  backgroundColor: '#1a1d2e',
  border: '1px solid #2a2e3f',
  borderRadius: '6px',
  color: '#e8eaed',
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
            <span className="font-semibold text-foreground">{entry?.type}</span>{' '}
            transaction of{' '}
            <span className="font-mono font-semibold text-foreground">
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
            <Skeleton key={i} className="h-[100px] rounded-md" />
          ))}
        </div>
        <Skeleton className="h-[300px] rounded-md" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Date Range Filter */}
      <div className="flex flex-wrap items-center gap-3">
        <Label className="text-muted-foreground">Period:</Label>
        <Input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          className="w-[160px]"
        />
        <span className="text-muted-foreground">to</span>
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
        <Card className="border-border/50 bg-[#1c2033]">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <TrendUp size={16} weight="duotone" className="text-emerald-500" />
              <span className="text-xs uppercase tracking-wider">Revenue</span>
            </div>
            <p className="text-xl font-mono font-bold text-emerald-400">{formatAmount(totalRevenue)}</p>
          </CardContent>
        </Card>
        <Card className="border-border/50 bg-[#1c2033]">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <TrendDown size={16} weight="duotone" className="text-red-500" />
              <span className="text-xs uppercase tracking-wider">Expenses</span>
            </div>
            <p className="text-xl font-mono font-bold text-red-400">{formatAmount(totalExpenses)}</p>
          </CardContent>
        </Card>
        <Card className="border-border/50 bg-[#1c2033]">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <CurrencyDollar size={16} weight="duotone" className="text-blue-500" />
              <span className="text-xs uppercase tracking-wider">Net Profit</span>
            </div>
            <p className={`text-xl font-mono font-bold ${netProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {formatAmount(netProfit)}
            </p>
          </CardContent>
        </Card>
        <Card className="border-border/50 bg-[#1c2033]">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <ChartBar size={16} weight="duotone" className="text-blue-500" />
              <span className="text-xs uppercase tracking-wider">Profit Margin</span>
            </div>
            <p className={`text-xl font-mono font-bold ${profitMargin >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {formatMargin(profitMargin)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Area Chart: 6-Month P&L */}
      <Card className="border-border/50 bg-[#1c2033]">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Monthly Profit & Loss</CardTitle>
        </CardHeader>
        <CardContent>
          {monthlyData.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No data for the selected period
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={monthlyData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={CHART_COLORS.income} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={CHART_COLORS.income} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorExpenses" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={CHART_COLORS.expense} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={CHART_COLORS.expense} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={CHART_COLORS.profit} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={CHART_COLORS.profit} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a2e3f" />
                <XAxis
                  dataKey="month"
                  tick={AXIS_TICK}
                  tickLine={false}
                  axisLine={{ stroke: '#2a2e3f' }}
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
                  stroke={CHART_COLORS.income}
                  fillOpacity={1}
                  fill="url(#colorRevenue)"
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="expenses"
                  name="Expenses"
                  stroke={CHART_COLORS.expense}
                  fillOpacity={1}
                  fill="url(#colorExpenses)"
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="profit"
                  name="Profit"
                  stroke={CHART_COLORS.profit}
                  fillOpacity={1}
                  fill="url(#colorProfit)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Top Routes + Breakdown */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Top Routes */}
        <Card className="border-border/50 bg-[#1c2033]">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <MapPin size={16} weight="duotone" />
              Top Routes by Profit
            </CardTitle>
          </CardHeader>
          <CardContent>
            {topRoutes.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No route data available
              </p>
            ) : (
              <div className="space-y-3">
                {topRoutes.map((route, idx) => (
                  <div
                    key={route.route}
                    className="flex items-center justify-between py-2 border-b border-border/30 last:border-0"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-mono text-muted-foreground w-4">{idx + 1}</span>
                      <div>
                        <span className="font-mono font-medium text-sm">
                          {route.depIcao} <span className="text-muted-foreground">&rarr;</span> {route.arrIcao}
                        </span>
                        <div className="text-xs text-muted-foreground">
                          {route.flights} flight{route.flights !== 1 ? 's' : ''}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`font-mono font-medium text-sm ${route.profit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {formatAmount(route.profit)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatMargin(route.margin)} margin
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Detailed Breakdown */}
        <Card className="border-border/50 bg-[#1c2033]">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Breakdown by Type</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between py-2 border-b border-border/30">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-sm bg-emerald-500" />
                  <span className="text-sm">Income</span>
                </div>
                <span className="font-mono text-emerald-400">{formatAmount(periodSummary.totalIncome)}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-border/30">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-sm bg-blue-500" />
                  <span className="text-sm">Pilot Pay</span>
                </div>
                <span className="font-mono text-blue-400">{formatAmount(periodSummary.totalPay)}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-border/30">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-sm bg-blue-400" />
                  <span className="text-sm">Bonuses</span>
                </div>
                <span className="font-mono text-blue-400">{formatAmount(periodSummary.totalBonuses)}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-border/30">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-sm bg-red-500" />
                  <span className="text-sm">Expenses</span>
                </div>
                <span className="font-mono text-red-400">{formatAmount(periodSummary.totalExpenses)}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-border/30">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-sm bg-amber-500" />
                  <span className="text-sm">Deductions</span>
                </div>
                <span className="font-mono text-amber-400">{formatAmount(periodSummary.totalDeductions)}</span>
              </div>
              <div className="flex items-center justify-between py-2 pt-3">
                <span className="text-sm font-semibold">Net Total</span>
                <span
                  className={`font-mono font-bold text-lg ${
                    periodSummary.netTotal >= 0 ? 'text-emerald-400' : 'text-red-400'
                  }`}
                >
                  {formatAmount(periodSummary.netTotal)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
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
          <span className="text-muted-foreground text-sm">
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
            <span className="text-muted-foreground mx-1">&rarr;</span>
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
          <span className="text-sm text-muted-foreground">{row.original.aircraftType}</span>
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
          <span className="font-mono font-medium text-emerald-400">
            {formatAmount(row.original.revenue)}
          </span>
        ),
        size: 110,
      },
      {
        accessorKey: 'pilotCallsign',
        header: 'Pilot',
        cell: ({ row }) => (
          <span className="font-mono text-sm text-muted-foreground">
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
            <Card key={route.route} className="border-border/50 bg-[#1c2033]">
              <CardContent className="p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-muted-foreground">#{idx + 1} Route</span>
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                    {route.flights} flights
                  </Badge>
                </div>
                <p className="font-mono font-medium text-sm">
                  {route.depIcao} <span className="text-muted-foreground">&rarr;</span> {route.arrIcao}
                </p>
                <div className="flex items-center justify-between mt-1">
                  <span className={`font-mono text-sm font-medium ${route.profit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {formatAmount(route.profit)}
                  </span>
                  <span className="text-xs text-muted-foreground">{formatMargin(route.margin)}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Label className="text-muted-foreground">Period:</Label>
        <Input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          className="w-[150px]"
        />
        <span className="text-muted-foreground">to</span>
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
      <div className="flex flex-1 gap-0 overflow-hidden rounded-md border border-border/50">
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
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                  <AirplaneTilt size={14} weight="duotone" />
                  Flight Info
                </h3>
                <div className="space-y-0.5">
                  <DetailRow label="Flight #">
                    <span className="font-mono font-medium">{detailEntry.flightNumber}</span>
                  </DetailRow>
                  <DetailRow label="Route">
                    <span className="font-mono">
                      {detailEntry.depIcao} <span className="text-muted-foreground">&rarr;</span> {detailEntry.arrIcao}
                    </span>
                  </DetailRow>
                  <DetailRow label="Aircraft">
                    <span className="font-mono">{detailEntry.aircraftType}</span>
                  </DetailRow>
                  <DetailRow label="Date">{formatDate(detailEntry.flightDate)}</DetailRow>
                  <DetailRow label="Pilot">
                    <span className="font-mono">{detailEntry.pilotCallsign}</span>
                    <span className="text-muted-foreground ml-1">({detailEntry.pilotName})</span>
                  </DetailRow>
                </div>
              </section>

              <Separator />

              {/* Revenue Breakdown */}
              <section>
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Package size={14} weight="duotone" />
                  Cargo & Revenue
                </h3>
                <div className="space-y-0.5">
                  <DetailRow label="Cargo Weight">
                    <span className="font-mono">{formatNumber(detailEntry.cargoLbs)} lbs</span>
                  </DetailRow>
                  <DetailRow label="Revenue">
                    <span className="font-mono font-medium text-emerald-400">
                      {formatAmount(detailEntry.revenue)}
                    </span>
                  </DetailRow>
                  {detailEntry.pirepId && (
                    <DetailRow label="PIREP ID">
                      <span className="font-mono text-muted-foreground">#{detailEntry.pirepId}</span>
                    </DetailRow>
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
            <p className="text-xs text-muted-foreground">{row.original.pilotName}</p>
          </div>
        ),
        size: 140,
      },
      {
        accessorKey: 'hours',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Hours" />,
        cell: ({ row }) => (
          <span className="font-mono text-muted-foreground">{row.original.hours.toFixed(1)}h</span>
        ),
        size: 80,
      },
      {
        accessorKey: 'flights',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Flights" />,
        cell: ({ row }) => (
          <span className="font-mono text-muted-foreground">{row.original.flights}</span>
        ),
        size: 80,
      },
      {
        accessorKey: 'basePay',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Base Pay" />,
        cell: ({ row }) => (
          <span className="font-mono text-emerald-400">{formatAmount(row.original.basePay)}</span>
        ),
        size: 110,
      },
      {
        accessorKey: 'bonuses',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Bonuses" />,
        cell: ({ row }) => (
          <span className="font-mono text-blue-400">{formatAmount(row.original.bonuses)}</span>
        ),
        size: 110,
      },
      {
        accessorKey: 'deductions',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Deductions" />,
        cell: ({ row }) => (
          <span className="font-mono text-amber-400">{formatAmount(row.original.deductions)}</span>
        ),
        size: 110,
      },
      {
        accessorKey: 'netPay',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Net Pay" />,
        cell: ({ row }) => (
          <span className={`font-mono font-medium ${row.original.netPay >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
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
        <div className="rounded-md bg-[#1c2033] border border-border/50 p-3">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Total Base Pay</span>
          <p className="text-lg font-mono font-bold text-emerald-400 mt-1">{formatAmount(totals.basePay)}</p>
        </div>
        <div className="rounded-md bg-[#1c2033] border border-border/50 p-3">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Total Bonuses</span>
          <p className="text-lg font-mono font-bold text-blue-400 mt-1">{formatAmount(totals.bonuses)}</p>
        </div>
        <div className="rounded-md bg-[#1c2033] border border-border/50 p-3">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Total Deductions</span>
          <p className="text-lg font-mono font-bold text-amber-400 mt-1">{formatAmount(totals.deductions)}</p>
        </div>
        <div className="rounded-md bg-[#1c2033] border border-border/50 p-3">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Total Net Pay</span>
          <p className={`text-lg font-mono font-bold mt-1 ${totals.netPay >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {formatAmount(totals.netPay)}
          </p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <Label className="text-muted-foreground">Period:</Label>
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="w-[150px]"
          />
          <span className="text-muted-foreground">to</span>
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
      <div className="flex flex-1 gap-0 overflow-hidden rounded-md border border-border/50">
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
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                  <UsersIcon size={14} weight="duotone" />
                  Activity
                </h3>
                <div className="space-y-0.5">
                  <DetailRow label="Flights">
                    <span className="font-mono">{detailEntry.flights}</span>
                  </DetailRow>
                  <DetailRow label="Hours">
                    <span className="font-mono">{detailEntry.hours.toFixed(1)}h</span>
                  </DetailRow>
                </div>
              </section>

              <Separator />

              {/* Pay Breakdown */}
              <section>
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Wallet size={14} weight="duotone" />
                  Pay Breakdown
                </h3>
                <div className="space-y-0.5">
                  <DetailRow label="Base Pay">
                    <span className="font-mono text-emerald-400">{formatAmount(detailEntry.basePay)}</span>
                  </DetailRow>
                  <DetailRow label="Bonuses">
                    <span className="font-mono text-blue-400">{formatAmount(detailEntry.bonuses)}</span>
                  </DetailRow>
                  <DetailRow label="Deductions">
                    <span className="font-mono text-amber-400">-{formatAmount(detailEntry.deductions)}</span>
                  </DetailRow>
                </div>
              </section>

              <Separator />

              {/* Net Pay */}
              <div className="flex items-center justify-between pt-2">
                <span className="text-sm font-semibold">Net Pay</span>
                <span className={`font-mono font-bold text-lg ${detailEntry.netPay >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {formatAmount(detailEntry.netPay)}
                </span>
              </div>

              {/* Per-flight average */}
              {detailEntry.flights > 0 && (
                <div className="rounded-md bg-[#0f1219] border border-border/30 p-3 mt-4">
                  <span className="text-xs text-muted-foreground">Average per flight</span>
                  <p className="font-mono font-medium text-sm mt-0.5">
                    {formatAmount(detailEntry.netPay / detailEntry.flights)}
                  </p>
                </div>
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
            <span className={`text-muted-foreground text-sm ${voided ? 'line-through opacity-50' : ''}`}>
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
              {typeBadge(row.original.type)}
              {voided && (
                <Badge variant="outline" className="ml-1 text-[10px] text-muted-foreground">
                  Voided
                </Badge>
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
              {row.original.description || <span className="text-muted-foreground italic">No description</span>}
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
                  ? 'line-through opacity-50 text-muted-foreground'
                  : positive
                    ? 'text-emerald-400'
                    : 'text-red-400'
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
                  className="text-red-400 focus:text-red-400"
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
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
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
      <div className="flex flex-1 gap-0 overflow-hidden rounded-md border border-border/50">
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
                <Badge variant="outline" className="text-red-400 border-red-500/30">
                  Voided
                </Badge>
              )}

              <section>
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Receipt size={14} weight="duotone" />
                  Details
                </h3>
                <div className="space-y-0.5">
                  <DetailRow label="Type">{typeBadge(detailEntry.type)}</DetailRow>
                  <DetailRow label="Amount">
                    <span className={`font-mono font-medium ${isPositiveType(detailEntry.type) ? 'text-emerald-400' : 'text-red-400'}`}>
                      {isPositiveType(detailEntry.type) ? '+' : '-'}{formatAmount(detailEntry.amount)}
                    </span>
                  </DetailRow>
                  <DetailRow label="Pilot">
                    <span className="font-mono">{detailEntry.pilotCallsign}</span>
                    <span className="text-muted-foreground ml-1">({detailEntry.pilotName})</span>
                  </DetailRow>
                  <DetailRow label="Date">{formatDateTime(detailEntry.createdAt)}</DetailRow>
                  {detailEntry.description && (
                    <DetailRow label="Description">
                      <span className="text-sm">{detailEntry.description}</span>
                    </DetailRow>
                  )}
                  {detailEntry.pirepId && (
                    <DetailRow label="PIREP">
                      <span className="font-mono text-muted-foreground">#{detailEntry.pirepId}</span>
                    </DetailRow>
                  )}
                  {detailEntry.creatorCallsign && (
                    <DetailRow label="Created By">
                      <span className="font-mono text-muted-foreground">{detailEntry.creatorCallsign}</span>
                    </DetailRow>
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
              <Skeleton key={i} className="h-[60px] rounded-md" />
            ))}
          </div>
          <Skeleton className="h-10 w-full rounded-md" />
          <Skeleton className="h-[400px] rounded-md" />
        </div>
      </PageShell>
    );
  }

  if (error) {
    return (
      <PageShell title="Finances" subtitle="Revenue, payroll, and accounting">
        <div className="flex items-center justify-center py-20 text-muted-foreground">
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
