import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CurrencyDollar,
  MagnifyingGlass,
  Plus,
  DotsThreeVertical,
  Trash,
  ArrowUp,
  ArrowDown,
  Coins,
  ChartBar,
  Receipt,
  Wallet,
  CaretLeft,
  CaretRight,
} from '@phosphor-icons/react';
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
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
import { StatCard } from '@/components/widgets/StatCard';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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

// ── Skeleton ────────────────────────────────────────────────────

function FinancesPageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[110px] rounded-md" />
        ))}
      </div>
      <Skeleton className="h-10 w-full rounded-md" />
      <Skeleton className="h-[400px] rounded-md" />
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

// ── Delete Confirmation Dialog ──────────────────────────────────

interface DeleteTransactionDialogProps {
  entry: FinanceEntry | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted: () => void;
}

function DeleteTransactionDialog({ entry, open, onOpenChange, onDeleted }: DeleteTransactionDialogProps) {
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!entry) return;
    setDeleting(true);
    try {
      await api.delete(`/api/admin/finances/${entry.id}`);
      toast.success('Transaction deleted');
      onOpenChange(false);
      onDeleted();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to delete transaction');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Transaction</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete this{' '}
            <span className="font-semibold text-foreground">{entry?.type}</span>{' '}
            transaction of{' '}
            <span className="font-mono font-semibold text-foreground">
              {entry ? formatAmount(entry.amount) : ''}
            </span>
            {entry?.pilotCallsign ? ` for ${entry.pilotCallsign}` : ''}?
            This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={deleting}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
            {deleting ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Ledger Tab ──────────────────────────────────────────────────

interface LedgerTabProps {
  pilots: PilotOption[];
}

function LedgerTab({ pilots }: LedgerTabProps) {
  const [entries, setEntries] = useState<FinanceEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const pageSize = 25;

  // Filters
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Dialogs
  const [addOpen, setAddOpen] = useState(false);
  const [deleteEntry, setDeleteEntry] = useState<FinanceEntry | null>(null);

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
  }, [page, typeFilter, dateFrom, dateTo]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [typeFilter, dateFrom, dateTo]);

  // Client-side search filtering (search within loaded page)
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

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  // Running balance not available from API, just show amounts
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

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[130px]">Date</TableHead>
              <TableHead className="w-[100px]">Type</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="w-[130px] text-right">Amount</TableHead>
              <TableHead className="w-[130px]">Pilot</TableHead>
              <TableHead className="w-[60px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 6 }).map((_, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : filteredEntries.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                  No transactions found
                </TableCell>
              </TableRow>
            ) : (
              filteredEntries.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell className="text-muted-foreground text-sm">
                    {formatDateTime(entry.createdAt)}
                  </TableCell>
                  <TableCell>{typeBadge(entry.type)}</TableCell>
                  <TableCell className="max-w-[250px] truncate">
                    {entry.description || <span className="text-muted-foreground italic">No description</span>}
                  </TableCell>
                  <TableCell className="text-right">
                    <span
                      className={`font-mono font-medium ${
                        isPositiveType(entry.type) ? 'text-emerald-400' : 'text-red-400'
                      }`}
                    >
                      {isPositiveType(entry.type) ? '+' : '-'}
                      {formatAmount(entry.amount)}
                    </span>
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {entry.pilotCallsign}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <DotsThreeVertical size={16} weight="bold" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          className="text-red-400 focus:text-red-400"
                          onClick={() => setDeleteEntry(entry)}
                        >
                          <Trash size={14} />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-2">
          <p className="text-sm text-muted-foreground">
            Showing {((page - 1) * pageSize) + 1}-{Math.min(page * pageSize, total)} of {total}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              <CaretLeft size={14} />
            </Button>
            <span className="text-sm text-muted-foreground">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              <CaretRight size={14} />
            </Button>
          </div>
        </div>
      )}

      {/* Dialogs */}
      <AddTransactionDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onCreated={fetchEntries}
        pilots={pilots}
      />
      <DeleteTransactionDialog
        entry={deleteEntry}
        open={!!deleteEntry}
        onOpenChange={(open) => { if (!open) setDeleteEntry(null); }}
        onDeleted={fetchEntries}
      />
    </div>
  );
}

// ── Balances Tab ────────────────────────────────────────────────

function BalancesTab() {
  const [balances, setBalances] = useState<PilotBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [search, setSearch] = useState('');

  useEffect(() => {
    async function fetch() {
      try {
        const res = await api.get<{ balances: PilotBalance[] }>('/api/admin/finances/balances');
        setBalances(res.balances);
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : 'Failed to load balances');
      } finally {
        setLoading(false);
      }
    }
    fetch();
  }, []);

  const filteredBalances = useMemo(() => {
    let result = balances;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (b) =>
          b.callsign.toLowerCase().includes(q) ||
          b.pilotName.toLowerCase().includes(q)
      );
    }
    return [...result].sort((a, b) =>
      sortDir === 'desc' ? b.balance - a.balance : a.balance - b.balance
    );
  }, [balances, search, sortDir]);

  const totals = useMemo(() => {
    return balances.reduce(
      (acc, b) => ({
        totalPay: acc.totalPay + b.totalPay,
        totalBonuses: acc.totalBonuses + b.totalBonuses,
        totalDeductions: acc.totalDeductions + b.totalDeductions,
        totalBalance: acc.totalBalance + b.balance,
      }),
      { totalPay: 0, totalBonuses: 0, totalDeductions: 0, totalBalance: 0 }
    );
  }, [balances]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[110px] rounded-md" />
          ))}
        </div>
        <Skeleton className="h-[300px] rounded-md" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Pay"
          value={formatAmount(totals.totalPay)}
          icon={<CurrencyDollar size={22} weight="duotone" />}
        />
        <StatCard
          title="Total Bonuses"
          value={formatAmount(totals.totalBonuses)}
          icon={<Coins size={22} weight="duotone" />}
        />
        <StatCard
          title="Total Deductions"
          value={formatAmount(totals.totalDeductions)}
          icon={<Receipt size={22} weight="duotone" />}
        />
        <StatCard
          title="Net Balance"
          value={formatAmount(totals.totalBalance)}
          icon={<Wallet size={22} weight="duotone" />}
        />
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <div className="relative max-w-sm flex-1">
          <MagnifyingGlass
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            placeholder="Search pilots..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'))}
          className="gap-1"
        >
          Balance
          {sortDir === 'desc' ? <ArrowDown size={14} /> : <ArrowUp size={14} />}
        </Button>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[120px]">Callsign</TableHead>
              <TableHead>Name</TableHead>
              <TableHead className="text-right w-[130px]">Pay</TableHead>
              <TableHead className="text-right w-[130px]">Bonuses</TableHead>
              <TableHead className="text-right w-[130px]">Deductions</TableHead>
              <TableHead className="text-right w-[130px]">Balance</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredBalances.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                  No pilot balances found
                </TableCell>
              </TableRow>
            ) : (
              filteredBalances.map((b) => (
                <TableRow key={b.pilotId}>
                  <TableCell className="font-mono font-medium">{b.callsign}</TableCell>
                  <TableCell>{b.pilotName}</TableCell>
                  <TableCell className="text-right font-mono text-emerald-400">
                    {formatAmount(b.totalPay)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-blue-400">
                    {formatAmount(b.totalBonuses)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-amber-400">
                    {formatAmount(b.totalDeductions)}
                  </TableCell>
                  <TableCell className="text-right">
                    <span
                      className={`font-mono font-semibold ${
                        b.balance >= 0 ? 'text-emerald-400' : 'text-red-400'
                      }`}
                    >
                      {formatAmount(b.balance)}
                    </span>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// ── Summary Tab ─────────────────────────────────────────────────

const CHART_COLORS = {
  income: '#22c55e',
  pay: '#3b82f6',
  bonus: '#60a5fa',
  expense: '#ef4444',
  deduction: '#f59e0b',
};

const PIE_COLORS = ['#22c55e', '#3b82f6', '#60a5fa', '#ef4444', '#f59e0b'];

function SummaryTab() {
  const [summary, setSummary] = useState<FinanceSummary | null>(null);
  const [entries, setEntries] = useState<FinanceEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo) params.set('dateTo', dateTo);

      const queryStr = params.toString();
      const suffix = queryStr ? `?${queryStr}` : '';

      const [summaryRes, entriesRes] = await Promise.all([
        api.get<FinanceSummary>(`/api/admin/finances/summary${suffix}`),
        api.get<FinanceListResponse>(`/api/admin/finances?pageSize=100${queryStr ? `&${queryStr}` : ''}`),
      ]);

      setSummary(summaryRes);
      setEntries(entriesRes.entries);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to load summary');
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Build monthly bar chart data from entries
  const monthlyData = useMemo(() => {
    if (entries.length === 0) return [];

    const months = new Map<string, { month: string; income: number; expenses: number }>();

    for (const entry of entries) {
      const d = new Date(entry.createdAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleDateString('en-US', { year: 'numeric', month: 'short' });

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

    return Array.from(months.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, v]) => v);
  }, [entries]);

  // Pie chart data from summary
  const pieData = useMemo(() => {
    if (!summary) return [];
    const items = [
      { name: 'Income', value: summary.totalIncome },
      { name: 'Pay', value: summary.totalPay },
      { name: 'Bonuses', value: summary.totalBonuses },
      { name: 'Expenses', value: summary.totalExpenses },
      { name: 'Deductions', value: summary.totalDeductions },
    ].filter((d) => d.value > 0);
    return items;
  }, [summary]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-[110px] rounded-md" />
          ))}
        </div>
        <Skeleton className="h-[350px] rounded-md" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Date Range */}
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

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard
            title="Total Income"
            value={formatAmount(summary.totalIncome + summary.totalPay + summary.totalBonuses)}
            icon={<ArrowUp size={22} weight="duotone" className="text-emerald-500" />}
          />
          <StatCard
            title="Total Expenses"
            value={formatAmount(summary.totalExpenses + summary.totalDeductions)}
            icon={<ArrowDown size={22} weight="duotone" className="text-red-500" />}
          />
          <StatCard
            title="Net Total"
            value={formatAmount(summary.netTotal)}
            icon={<CurrencyDollar size={22} weight="duotone" />}
          />
        </div>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Bar Chart: Income vs Expenses by Month */}
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Income vs Expenses by Month</CardTitle>
          </CardHeader>
          <CardContent>
            {monthlyData.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No data for the selected period
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={monthlyData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2a2e3f" />
                  <XAxis
                    dataKey="month"
                    tick={{ fill: '#8b8fa3', fontSize: 12 }}
                    tickLine={false}
                    axisLine={{ stroke: '#2a2e3f' }}
                  />
                  <YAxis
                    tick={{ fill: '#8b8fa3', fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v: number) =>
                      v >= 1000 ? `$${(v / 1000).toFixed(0)}k` : `$${v}`
                    }
                  />
                  <RechartsTooltip
                    contentStyle={{
                      backgroundColor: '#1a1d2e',
                      border: '1px solid #2a2e3f',
                      borderRadius: '6px',
                      color: '#e8eaed',
                      fontSize: 12,
                    }}
                    formatter={(value: number | string | undefined) => [
                      `$${Number(value ?? 0).toLocaleString()}`,
                    ]}
                    labelStyle={{ color: '#8b8fa3' }}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: 12, color: '#8b8fa3' }}
                  />
                  <Bar dataKey="income" name="Income" fill={CHART_COLORS.income} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="expenses" name="Expenses" fill={CHART_COLORS.expense} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Pie Chart: Breakdown by Type */}
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Breakdown by Type</CardTitle>
          </CardHeader>
          <CardContent>
            {pieData.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No data for the selected period
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    dataKey="value"
                    nameKey="name"
                    label={({ name, percent }: { name?: string; percent?: number }) =>
                      `${name ?? ''} ${((percent ?? 0) * 100).toFixed(0)}%`
                    }
                    labelLine={{ stroke: '#8b8fa3' }}
                  >
                    {pieData.map((_, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={PIE_COLORS[index % PIE_COLORS.length]}
                        stroke="transparent"
                      />
                    ))}
                  </Pie>
                  <RechartsTooltip
                    contentStyle={{
                      backgroundColor: '#1a1d2e',
                      border: '1px solid #2a2e3f',
                      borderRadius: '6px',
                      color: '#e8eaed',
                      fontSize: 12,
                    }}
                    formatter={(value: number | string | undefined) => [
                      `$${Number(value ?? 0).toLocaleString()}`,
                    ]}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: 12, color: '#8b8fa3' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Detailed breakdown table */}
      {summary && (
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Detailed Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between py-2 border-b border-border/50">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: CHART_COLORS.income }} />
                  <span className="text-sm">Income</span>
                </div>
                <span className="font-mono text-emerald-400">{formatAmount(summary.totalIncome)}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-border/50">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: CHART_COLORS.pay }} />
                  <span className="text-sm">Pilot Pay</span>
                </div>
                <span className="font-mono text-blue-400">{formatAmount(summary.totalPay)}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-border/50">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: CHART_COLORS.bonus }} />
                  <span className="text-sm">Bonuses</span>
                </div>
                <span className="font-mono text-blue-400">{formatAmount(summary.totalBonuses)}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-border/50">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: CHART_COLORS.expense }} />
                  <span className="text-sm">Expenses</span>
                </div>
                <span className="font-mono text-red-400">{formatAmount(summary.totalExpenses)}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-border/50">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: CHART_COLORS.deduction }} />
                  <span className="text-sm">Deductions</span>
                </div>
                <span className="font-mono text-amber-400">{formatAmount(summary.totalDeductions)}</span>
              </div>
              <div className="flex items-center justify-between py-2 pt-3">
                <span className="text-sm font-semibold">Net Total</span>
                <span
                  className={`font-mono font-bold text-lg ${
                    summary.netTotal >= 0 ? 'text-emerald-400' : 'text-red-400'
                  }`}
                >
                  {formatAmount(summary.netTotal)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ── Page ────────────────────────────────────────────────────────

export function FinancesPage() {
  const [summary, setSummary] = useState<FinanceSummary | null>(null);
  const [pilots, setPilots] = useState<PilotOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchInitial() {
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
    }
    fetchInitial();
  }, []);

  if (loading) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-semibold mb-6">Finances</h1>
        <FinancesPageSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-semibold mb-6">Finances</h1>
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-6">Finances</h1>

      <div className="space-y-6">
        {/* Top-level stat cards */}
        {summary && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              title="Total Revenue"
              value={formatAmount(summary.totalIncome + summary.totalPay)}
              icon={<CurrencyDollar size={22} weight="duotone" />}
            />
            <StatCard
              title="Total Bonuses"
              value={formatAmount(summary.totalBonuses)}
              icon={<Coins size={22} weight="duotone" />}
            />
            <StatCard
              title="Total Expenses"
              value={formatAmount(summary.totalExpenses + summary.totalDeductions)}
              icon={<Receipt size={22} weight="duotone" />}
            />
            <StatCard
              title="Net Total"
              value={formatAmount(summary.netTotal)}
              icon={<ChartBar size={22} weight="duotone" />}
            />
          </div>
        )}

        {/* Tabs */}
        <Tabs defaultValue="ledger">
          <TabsList>
            <TabsTrigger value="ledger">Ledger</TabsTrigger>
            <TabsTrigger value="balances">Balances</TabsTrigger>
            <TabsTrigger value="summary">Summary</TabsTrigger>
          </TabsList>

          <TabsContent value="ledger" className="mt-4">
            <LedgerTab pilots={pilots} />
          </TabsContent>

          <TabsContent value="balances" className="mt-4">
            <BalancesTab />
          </TabsContent>

          <TabsContent value="summary" className="mt-4">
            <SummaryTab />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
