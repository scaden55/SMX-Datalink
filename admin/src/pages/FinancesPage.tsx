import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { type ColumnDef } from '@tanstack/react-table';
import {
  DollarSign,
  Search,
  Plus,
  MoreVertical,
  Ban,
  Plane,
  Users as UsersIcon,
  Package,
  Wallet,
  Calendar,
  Receipt,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from 'recharts';
import { api, ApiError } from '@/lib/api';
import { toast } from '@/stores/toastStore';
import { pageVariants, staggerContainer, staggerItem, fadeUp, cardHover } from '@/lib/motion';
import { StatusBadge, SectionHeader, DataRow } from '@/components/primitives';
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

// ── Colors ──────────────────────────────────────────────────────

const ACCENT_BLUE = '#3b5bdb';
const ACCENT_EMERALD = '#4ade80';
const ACCENT_AMBER = '#fbbf24';
const ACCENT_RED = '#f87171';
const ACCENT_CYAN = '#22d3ee';

// ── Chart Styling ───────────────────────────────────────────────

const TOOLTIP_STYLE = {
  backgroundColor: 'var(--surface-2)',
  border: '1px solid var(--border-primary)',
  borderRadius: '6px',
  color: 'var(--text-primary)',
  fontSize: 12,
};

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

function formatNumber(n: number): string {
  return n.toLocaleString('en-US');
}

// ── Stat Card ───────────────────────────────────────────────────

function StatCard({
  label,
  value,
  valueColor,
}: {
  label: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <div
      style={{
        borderRadius: 6,
        background: 'var(--surface-2)',
        border: '1px solid var(--border-primary)',
        padding: '12px 16px',
      }}
    >
      <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 4 }}>{label}</div>
      <div
        className="font-mono"
        style={{ fontSize: 22, fontWeight: 700, color: valueColor || 'var(--text-primary)' }}
      >
        {value}
      </div>
    </div>
  );
}

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
            <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{entry?.type}</span>{' '}
            transaction of{' '}
            <span className="font-mono font-semibold" style={{ color: 'var(--text-primary)' }}>
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
  dateFrom: string;
  dateTo: string;
}

function OverviewTab({ summary, dateFrom, dateTo }: OverviewTabProps) {
  const [monthlyData, setMonthlyData] = useState<Array<{ month: string; income: number; expenses: number }>>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo) params.set('dateTo', dateTo);
      const queryStr = params.toString();
      const suffix = queryStr ? `?${queryStr}` : '';

      const entriesRes = await api.get<FinanceListResponse>(`/api/admin/finances?pageSize=500${queryStr ? `&${queryStr}` : ''}`);

      // Build monthly chart data from entries
      const months = new Map<string, { month: string; income: number; expenses: number }>();
      for (const entry of entriesRes.entries) {
        const d = new Date(entry.createdAt);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const label = d.toLocaleDateString('en-US', { year: '2-digit', month: 'short' });
        if (!months.has(key)) {
          months.set(key, { month: label, income: 0, expenses: 0 });
        }
        const m = months.get(key)!;
        if (isPositiveType(entry.type)) {
          m.income += entry.amount;
        } else {
          m.expenses += entry.amount;
        }
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

  // Expense breakdown items
  const breakdownItems = [
    { label: 'Fuel', amount: summary.totalExpenses * 0.45, color: ACCENT_BLUE },
    { label: 'Operating', amount: summary.totalExpenses * 0.25, color: ACCENT_EMERALD },
    { label: 'Maintenance', amount: summary.totalExpenses * 0.15, color: ACCENT_AMBER },
    { label: 'Ground Handling', amount: summary.totalExpenses * 0.10, color: ACCENT_CYAN },
    { label: 'Other', amount: summary.totalExpenses * 0.05, color: 'var(--text-tertiary)' },
  ];

  if (loading) {
    return (
      <div style={{ display: 'flex', gap: 16 }}>
        <div style={{ flex: 1, height: 340, background: 'var(--surface-2)', borderRadius: 6, border: '1px solid var(--border-primary)' }} className="animate-pulse" />
        <div style={{ width: 300, height: 340, background: 'var(--surface-2)', borderRadius: 6, border: '1px solid var(--border-primary)' }} className="animate-pulse" />
      </div>
    );
  }

  return (
    <motion.div variants={staggerContainer} initial="hidden" animate="visible" style={{ display: 'flex', gap: 16 }}>
      {/* Left: Revenue vs Expenses chart */}
      <motion.div
        variants={staggerItem}
        style={{
          flex: 1,
          background: 'var(--surface-2)',
          border: '1px solid var(--border-primary)',
          borderRadius: 6,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '12px 16px',
            borderBottom: '1px solid var(--border-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
            Revenue vs Expenses
          </span>
          <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>Monthly</span>
        </div>
        <div style={{ padding: 16 }}>
          {monthlyData.length === 0 ? (
            <p style={{ fontSize: 12, color: 'var(--text-tertiary)', textAlign: 'center', padding: '40px 0' }}>
              No data for the selected period
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={monthlyData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-primary)" />
                <XAxis
                  dataKey="month"
                  tick={{ fill: 'var(--text-tertiary)', fontSize: 11 }}
                  tickLine={false}
                  axisLine={{ stroke: 'var(--border-primary)' }}
                />
                <YAxis
                  tick={{ fill: 'var(--text-tertiary)', fontSize: 11 }}
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
                  labelStyle={{ color: 'var(--text-tertiary)' }}
                />
                <Bar dataKey="income" name="Income" fill={ACCENT_EMERALD} radius={[4, 4, 0, 0]} maxBarSize={32} />
                <Bar dataKey="expenses" name="Expenses" fill={ACCENT_RED} radius={[4, 4, 0, 0]} maxBarSize={32} />
              </BarChart>
            </ResponsiveContainer>
          )}
          {/* Chart legend */}
          <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginTop: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: ACCENT_EMERALD }} />
              <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Income</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: ACCENT_RED }} />
              <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Expenses</span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Right: Expense Breakdown */}
      <motion.div
        variants={staggerItem}
        style={{
          width: 300,
          background: 'var(--surface-2)',
          border: '1px solid var(--border-primary)',
          borderRadius: 6,
          overflow: 'hidden',
          flexShrink: 0,
        }}
      >
        <div
          style={{
            padding: '12px 16px',
            borderBottom: '1px solid var(--border-primary)',
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
            Expense Breakdown
          </span>
        </div>
        <div style={{ padding: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {breakdownItems.map((item) => (
              <div
                key={item.label}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: item.color, flexShrink: 0 }} />
                  <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{item.label}</span>
                </div>
                <span className="font-mono" style={{ fontSize: 13, color: 'var(--text-primary)' }}>
                  {formatAmount(item.amount)}
                </span>
              </div>
            ))}
            {/* Total */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingTop: 12,
                borderTop: '1px solid var(--border-primary)',
                marginTop: 4,
              }}
            >
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Total</span>
              <span className="font-mono" style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                {formatAmount(summary.totalExpenses + summary.totalDeductions)}
              </span>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
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

      const revRes = await api.get<{ entries: RevenueEntry[]; total: number }>(`/api/admin/finances/revenue?${params}`);
      setEntries(revRes.entries);
      setTotal(revRes.total);
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
          <span style={{ color: 'var(--text-tertiary)', fontSize: 13 }}>
            {formatDate(row.original.flightDate)}
          </span>
        ),
        size: 110,
      },
      {
        accessorKey: 'flightNumber',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Flight #" />,
        cell: ({ row }) => (
          <span className="font-mono" style={{ fontWeight: 500 }}>{row.original.flightNumber}</span>
        ),
        size: 100,
      },
      {
        id: 'route',
        header: 'Route',
        cell: ({ row }) => (
          <span className="font-mono" style={{ fontSize: 13 }}>
            {row.original.depIcao}
            <span style={{ color: 'var(--text-quaternary)', margin: '0 4px' }}>&rarr;</span>
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
          <span style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>{row.original.aircraftType}</span>
        ),
        size: 110,
      },
      {
        accessorKey: 'cargoLbs',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Cargo (lbs)" />,
        cell: ({ row }) => (
          <span className="font-mono" style={{ fontSize: 13 }}>{formatNumber(row.original.cargoLbs)}</span>
        ),
        size: 100,
      },
      {
        accessorKey: 'revenue',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Revenue" />,
        cell: ({ row }) => (
          <span className="font-mono" style={{ fontWeight: 500, color: ACCENT_EMERALD }}>
            {formatAmount(row.original.revenue)}
          </span>
        ),
        size: 110,
      },
      {
        accessorKey: 'pilotCallsign',
        header: 'Pilot',
        cell: ({ row }) => (
          <span className="font-mono" style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>
            {row.original.pilotCallsign}
          </span>
        ),
        size: 90,
      },
    ],
    []
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Filters */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12 }}>
        <Label style={{ color: 'var(--text-tertiary)' }}>Period:</Label>
        <Input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          className="input-glow"
          style={{ width: 150 }}
        />
        <span style={{ color: 'var(--text-tertiary)' }}>to</span>
        <Input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          className="input-glow"
          style={{ width: 150 }}
        />
        {(dateFrom || dateTo) && (
          <Button variant="ghost" size="sm" onClick={() => { setDateFrom(''); setDateTo(''); }}>
            Clear
          </Button>
        )}
      </div>

      {/* Split view: table + detail */}
      <div className="flex flex-1 gap-0 overflow-hidden" style={{ borderRadius: 6, border: '1px solid var(--border-primary)' }}>
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
              <section>
                <SectionHeader title="Flight Info" action={<Plane size={14} style={{ color: 'var(--text-tertiary)' }} />} />
                <div className="space-y-0.5">
                  <DataRow label="Flight #" value={<span className="font-mono font-medium">{detailEntry.flightNumber}</span>} />
                  <DataRow label="Route" value={
                    <span className="font-mono">
                      {detailEntry.depIcao} <span style={{ color: 'var(--text-quaternary)' }}>&rarr;</span> {detailEntry.arrIcao}
                    </span>
                  } />
                  <DataRow label="Aircraft" value={<span className="font-mono">{detailEntry.aircraftType}</span>} />
                  <DataRow label="Date" value={formatDate(detailEntry.flightDate)} />
                  <DataRow label="Pilot" value={
                    <>
                      <span className="font-mono">{detailEntry.pilotCallsign}</span>
                      <span style={{ color: 'var(--text-tertiary)', marginLeft: 4 }}>({detailEntry.pilotName})</span>
                    </>
                  } />
                </div>
              </section>

              <section>
                <SectionHeader title="Cargo & Revenue" action={<Package size={14} style={{ color: 'var(--text-tertiary)' }} />} />
                <div className="space-y-0.5">
                  <DataRow label="Cargo Weight" value={<span className="font-mono">{formatNumber(detailEntry.cargoLbs)} lbs</span>} mono />
                  <DataRow label="Revenue" value={
                    <span className="font-mono font-medium" style={{ color: ACCENT_EMERALD }}>
                      {formatAmount(detailEntry.revenue)}
                    </span>
                  } />
                  {detailEntry.pirepId && (
                    <DataRow label="PIREP ID" value={<span className="font-mono" style={{ color: 'var(--text-tertiary)' }}>#{detailEntry.pirepId}</span>} />
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
            <span className="font-mono" style={{ fontWeight: 500 }}>{row.original.callsign}</span>
            <p style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{row.original.pilotName}</p>
          </div>
        ),
        size: 140,
      },
      {
        accessorKey: 'hours',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Hours" />,
        cell: ({ row }) => (
          <span className="font-mono" style={{ color: 'var(--text-tertiary)' }}>{row.original.hours.toFixed(1)}h</span>
        ),
        size: 80,
      },
      {
        accessorKey: 'flights',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Flights" />,
        cell: ({ row }) => (
          <span className="font-mono" style={{ color: 'var(--text-tertiary)' }}>{row.original.flights}</span>
        ),
        size: 80,
      },
      {
        accessorKey: 'basePay',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Base Pay" />,
        cell: ({ row }) => (
          <span className="font-mono" style={{ color: ACCENT_EMERALD }}>{formatAmount(row.original.basePay)}</span>
        ),
        size: 110,
      },
      {
        accessorKey: 'bonuses',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Bonuses" />,
        cell: ({ row }) => (
          <span className="font-mono" style={{ color: ACCENT_CYAN }}>{formatAmount(row.original.bonuses)}</span>
        ),
        size: 110,
      },
      {
        accessorKey: 'deductions',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Deductions" />,
        cell: ({ row }) => (
          <span className="font-mono" style={{ color: ACCENT_AMBER }}>{formatAmount(row.original.deductions)}</span>
        ),
        size: 110,
      },
      {
        accessorKey: 'netPay',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Net Pay" />,
        cell: ({ row }) => (
          <span className="font-mono" style={{ fontWeight: 500, color: row.original.netPay >= 0 ? ACCENT_EMERALD : ACCENT_RED }}>
            {formatAmount(row.original.netPay)}
          </span>
        ),
        size: 120,
      },
    ],
    []
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Summary bar */}
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
        style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}
      >
        <motion.div variants={staggerItem}>
          <StatCard label="Total Base Pay" value={formatAmount(totals.basePay)} valueColor={ACCENT_EMERALD} />
        </motion.div>
        <motion.div variants={staggerItem}>
          <StatCard label="Total Bonuses" value={formatAmount(totals.bonuses)} valueColor={ACCENT_CYAN} />
        </motion.div>
        <motion.div variants={staggerItem}>
          <StatCard label="Total Deductions" value={formatAmount(totals.deductions)} valueColor={ACCENT_AMBER} />
        </motion.div>
        <motion.div variants={staggerItem}>
          <StatCard label="Total Net Pay" value={formatAmount(totals.netPay)} valueColor={totals.netPay >= 0 ? ACCENT_EMERALD : ACCENT_RED} />
        </motion.div>
      </motion.div>

      {/* Toolbar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12 }}>
          <Label style={{ color: 'var(--text-tertiary)' }}>Period:</Label>
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="input-glow"
            style={{ width: 150 }}
          />
          <span style={{ color: 'var(--text-tertiary)' }}>to</span>
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="input-glow"
            style={{ width: 150 }}
          />
          {(dateFrom || dateTo) && (
            <Button variant="ghost" size="sm" onClick={() => { setDateFrom(''); setDateTo(''); }}>
              Clear
            </Button>
          )}
        </div>
        <Button onClick={() => setAddOpen(true)} className="btn-glow">
          <Plus size={16} />
          Add Adjustment
        </Button>
      </div>

      {/* Split view: table + detail */}
      <div className="flex flex-1 gap-0 overflow-hidden" style={{ borderRadius: 6, border: '1px solid var(--border-primary)' }}>
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
              <section>
                <SectionHeader title="Activity" action={<UsersIcon size={14} style={{ color: 'var(--text-tertiary)' }} />} />
                <div className="space-y-0.5">
                  <DataRow label="Flights" value={<span className="font-mono">{detailEntry.flights}</span>} />
                  <DataRow label="Hours" value={<span className="font-mono">{detailEntry.hours.toFixed(1)}h</span>} />
                </div>
              </section>

              <section>
                <SectionHeader title="Pay Breakdown" action={<Wallet size={14} style={{ color: 'var(--text-tertiary)' }} />} />
                <div className="space-y-0.5">
                  <DataRow label="Base Pay" value={<span className="font-mono" style={{ color: ACCENT_EMERALD }}>{formatAmount(detailEntry.basePay)}</span>} />
                  <DataRow label="Bonuses" value={<span className="font-mono" style={{ color: ACCENT_CYAN }}>{formatAmount(detailEntry.bonuses)}</span>} />
                  <DataRow label="Deductions" value={<span className="font-mono" style={{ color: ACCENT_AMBER }}>-{formatAmount(detailEntry.deductions)}</span>} />
                </div>
              </section>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 8, borderTop: '1px solid var(--border-primary)' }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Net Pay</span>
                <span className="font-mono" style={{ fontWeight: 700, fontSize: 18, color: detailEntry.netPay >= 0 ? ACCENT_EMERALD : ACCENT_RED }}>
                  {formatAmount(detailEntry.netPay)}
                </span>
              </div>

              {detailEntry.flights > 0 && (
                <div
                  style={{
                    background: 'var(--surface-1)',
                    border: '1px solid var(--border-secondary)',
                    borderRadius: 6,
                    padding: '8px 12px',
                  }}
                >
                  <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Average per flight</span>
                  <p className="font-mono" style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', marginTop: 2 }}>
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

// ── Page ────────────────────────────────────────────────────────

export function FinancesPage() {
  const [summary, setSummary] = useState<FinanceSummary | null>(null);
  const [pilots, setPilots] = useState<PilotOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'revenue' | 'pilot-pay'>('overview');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

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
      // Silently fail
    }
  }, []);

  const totalRevenue = summary ? summary.totalIncome + summary.totalPay + summary.totalBonuses : 0;
  const totalExpenses = summary ? summary.totalExpenses + summary.totalDeductions : 0;
  const netProfit = totalRevenue - totalExpenses;
  const pilotPayroll = summary ? summary.totalPay + summary.totalBonuses - summary.totalDeductions : 0;

  const tabs: Array<{ key: typeof activeTab; label: string }> = [
    { key: 'overview', label: 'Overview' },
    { key: 'revenue', label: 'Revenue' },
    { key: 'pilot-pay', label: 'Pilot Pay' },
  ];

  if (loading) {
    return (
      <div>
        <div style={{ padding: '16px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <DollarSign size={20} style={{ color: ACCENT_BLUE }} />
            <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>Finances</span>
          </div>
          <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Revenue, expenses and cost management</span>
        </div>
        <div style={{ padding: '0 24px 24px 24px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} style={{ height: 72, borderRadius: 6, background: 'var(--surface-2)', border: '1px solid var(--border-primary)' }} className="animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <div style={{ padding: '16px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <DollarSign size={20} style={{ color: ACCENT_BLUE }} />
            <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>Finances</span>
          </div>
          <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Revenue, expenses and cost management</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px 0', color: 'var(--text-tertiary)' }}>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <motion.div variants={pageVariants} initial="hidden" animate="visible">
      {/* ── Header ─────────────────────────────────────────────── */}
      <div style={{ padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Title row */}
        <motion.div variants={fadeUp} style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <DollarSign size={20} style={{ color: ACCENT_BLUE }} />
              <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>Finances</span>
            </div>
            <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
              Revenue, expenses and cost management
            </span>
          </div>
          {/* Date range selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            <Calendar size={14} style={{ color: 'var(--text-tertiary)' }} />
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="input-glow"
              style={{ width: 140, height: 32, fontSize: 12 }}
            />
            <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>to</span>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="input-glow"
              style={{ width: 140, height: 32, fontSize: 12 }}
            />
            {(dateFrom || dateTo) && (
              <Button variant="ghost" size="sm" onClick={() => { setDateFrom(''); setDateTo(''); }} style={{ height: 32 }}>
                Clear
              </Button>
            )}
          </div>
        </motion.div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--border-primary)' }}>
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                padding: '8px 16px',
                fontSize: 13,
                fontWeight: 500,
                color: activeTab === tab.key ? ACCENT_BLUE : 'var(--text-tertiary)',
                background: 'none',
                border: 'none',
                borderBottom: activeTab === tab.key ? `2px solid ${ACCENT_BLUE}` : '2px solid transparent',
                cursor: 'pointer',
                marginBottom: -1,
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Stat cards row */}
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
          style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}
        >
          <motion.div variants={staggerItem}>
            <StatCard label="Total Revenue" value={formatAmount(totalRevenue)} valueColor={ACCENT_EMERALD} />
          </motion.div>
          <motion.div variants={staggerItem}>
            <StatCard label="Total Expenses" value={formatAmount(totalExpenses)} valueColor={ACCENT_RED} />
          </motion.div>
          <motion.div variants={staggerItem}>
            <StatCard label="Net Profit" value={formatAmount(netProfit)} />
          </motion.div>
          <motion.div variants={staggerItem}>
            <StatCard label="Pilot Payroll" value={formatAmount(pilotPayroll)} />
          </motion.div>
        </motion.div>
      </div>

      {/* ── Content Area ───────────────────────────────────────── */}
      <div style={{ padding: '0 24px 24px 24px' }}>
        {activeTab === 'overview' && summary && (
          <OverviewTab summary={summary} dateFrom={dateFrom} dateTo={dateTo} />
        )}
        {activeTab === 'revenue' && <RevenueTab />}
        {activeTab === 'pilot-pay' && (
          <PilotPayTab pilots={pilots} onRefresh={refreshSummary} />
        )}
      </div>
    </motion.div>
  );
}
