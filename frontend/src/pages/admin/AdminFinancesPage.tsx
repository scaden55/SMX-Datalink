import { useState, useEffect, useCallback } from 'react';
import {
  DollarSign,
  Search,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Plus,
  X,
  Trash2,
  ArrowUpDown,
  Filter,
  Calendar,
  TrendingUp,
  TrendingDown,
  Wallet,
  Receipt,
  Award,
  RotateCcw,
} from 'lucide-react';
import { api } from '../../lib/api';
import { AdminPageHeader } from '../../components/admin/AdminPageHeader';
import { ConfirmDialog } from '../../components/admin/ConfirmDialog';

// ─── Types ──────────────────────────────────────────────────────

type FinanceType = 'pay' | 'bonus' | 'deduction' | 'expense' | 'income';

interface FinanceEntry {
  id: number;
  pilotId: number;
  pirepId: number | null;
  type: FinanceType;
  amount: number;
  description: string | null;
  createdBy: number;
  createdAt: string;
  pilotCallsign: string;
  pilotName: string;
  creatorCallsign: string;
}

interface PilotBalance {
  pilotId: number;
  callsign: string;
  name: string;
  balance: number;
  totalPay: number;
  totalBonus: number;
  totalDeductions: number;
}

interface FinanceSummary {
  totalPay: number;
  totalBonus: number;
  totalDeductions: number;
  totalExpenses: number;
  totalIncome: number;
  netBalance: number;
}

interface LedgerResponse {
  entries: FinanceEntry[];
  total: number;
  page: number;
  pageSize: number;
}

interface BalancesResponse {
  balances: PilotBalance[];
}

// ─── Constants ──────────────────────────────────────────────────

const INPUT_CLS = 'input-field text-xs font-mono h-9';
const LABEL_CLS =
  'text-[10px] uppercase tracking-wider text-acars-muted font-medium mb-1.5 block';

const TYPE_CONFIG: Record<FinanceType, { label: string; bg: string; text: string; border: string }> = {
  pay:       { label: 'Pay',       bg: 'bg-emerald-500/10',  text: 'text-emerald-400',  border: 'border-emerald-400/20' },
  bonus:     { label: 'Bonus',     bg: 'bg-blue-500/10',   text: 'text-blue-400',   border: 'border-blue-400/20' },
  deduction: { label: 'Deduction', bg: 'bg-red-500/10',    text: 'text-red-400',    border: 'border-red-400/20' },
  expense:   { label: 'Expense',   bg: 'bg-amber-500/10',  text: 'text-amber-400',  border: 'border-amber-400/20' },
  income:    { label: 'Income',    bg: 'bg-emerald-500/10',  text: 'text-emerald-400',  border: 'border-emerald-400/20' },
};

type Tab = 'ledger' | 'balances' | 'summary';

// ─── Helpers ────────────────────────────────────────────────────

function formatCurrency(amount: number): string {
  return '$' + Math.abs(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return (
    d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) +
    ' ' +
    d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }) +
    'z'
  );
}

function TypeBadge({ type }: { type: FinanceType }) {
  const cfg = TYPE_CONFIG[type] ?? TYPE_CONFIG.pay;
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${cfg.bg} ${cfg.text} border ${cfg.border}`}
    >
      {cfg.label}
    </span>
  );
}

function AmountCell({ amount }: { amount: number }) {
  const isPositive = amount >= 0;
  return (
    <span className={`font-mono font-semibold tabular-nums ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
      {isPositive ? '+' : '-'}{formatCurrency(amount)}
    </span>
  );
}

// ─── Add Entry Modal ────────────────────────────────────────────

interface AddEntryModalProps {
  onClose: () => void;
  onCreated: () => void;
}

function AddEntryModal({ onClose, onCreated }: AddEntryModalProps) {
  const [pilotId, setPilotId] = useState('');
  const [type, setType] = useState<FinanceType>('pay');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const canSubmit = pilotId.trim() !== '' && amount.trim() !== '' && parseFloat(amount) !== 0 && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError('');
    try {
      await api.post('/api/admin/finances', {
        pilotId: parseInt(pilotId),
        type,
        amount: parseFloat(amount),
        description: description.trim() || null,
      });
      onCreated();
    } catch (err: any) {
      setError(err?.message || 'Failed to create entry');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60" />
      <div
        className="relative w-full max-w-md mx-4 rounded-md border border-acars-border bg-acars-panel shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-acars-border">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center w-9 h-9 rounded-md bg-emerald-500/10 border border-emerald-400/20">
              <Plus className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-acars-text">Add Finance Entry</h2>
              <p className="text-[10px] text-acars-muted">Create a new ledger entry</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-acars-bg text-acars-muted hover:text-acars-text transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4">
          {/* Pilot ID */}
          <div>
            <label className={LABEL_CLS}>Pilot ID *</label>
            <input
              type="number"
              value={pilotId}
              onChange={(e) => setPilotId(e.target.value)}
              placeholder="Enter pilot ID"
              className={INPUT_CLS}
            />
          </div>

          {/* Type */}
          <div>
            <label className={LABEL_CLS}>Type *</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as FinanceType)}
              className="select-field"
            >
              <option value="pay">Pay</option>
              <option value="bonus">Bonus</option>
              <option value="deduction">Deduction</option>
              <option value="expense">Expense</option>
              <option value="income">Income</option>
            </select>
          </div>

          {/* Amount */}
          <div>
            <label className={LABEL_CLS}>Amount ($) *</label>
            <input
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className={INPUT_CLS}
            />
          </div>

          {/* Description */}
          <div>
            <label className={LABEL_CLS}>Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Optional description..."
              className="input-field text-xs resize-none"
            />
          </div>

          {error && (
            <p className="text-[11px] text-red-400 bg-red-500/10 border border-red-400/20 rounded-md px-3 py-2">
              {error}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-acars-border">
          <button
            onClick={onClose}
            className="btn-secondary btn-md"
          >
            Cancel
          </button>
          <button
            disabled={!canSubmit}
            onClick={handleSubmit}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-xs font-semibold text-white bg-emerald-500 hover:bg-emerald-500/80 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
            Add Entry
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Ledger Tab ─────────────────────────────────────────────────

function LedgerTab() {
  const [entries, setEntries] = useState<FinanceEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [typeFilter, setTypeFilter] = useState<FinanceType | ''>('');
  const [search, setSearch] = useState('');

  // Modal
  const [addModalOpen, setAddModalOpen] = useState(false);

  // Delete confirm
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('pageSize', String(pageSize));
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo) params.set('dateTo', dateTo);
      if (typeFilter) params.set('type', typeFilter);
      if (search) params.set('pilotId', search);

      const data = await api.get<LedgerResponse>(`/api/admin/finances?${params}`);
      setEntries(data.entries);
      setTotal(data.total);
    } catch (err: any) {
      setError(err?.message || 'Failed to load ledger');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, dateFrom, dateTo, typeFilter, search]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const handleDelete = async () => {
    if (deleteTarget == null) return;
    setDeleting(true);
    try {
      await api.delete(`/api/admin/finances/${deleteTarget}`);
      setDeleteTarget(null);
      fetchEntries();
    } catch (err: any) {
      console.error('[Finances] Delete error:', err);
    } finally {
      setDeleting(false);
    }
  };

  const resetFilters = () => {
    setDateFrom('');
    setDateTo('');
    setTypeFilter('');
    setSearch('');
    setPage(1);
  };

  const hasFilters = dateFrom || dateTo || typeFilter || search;

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Filters */}
      <div className="flex-none flex items-center gap-2 px-4 py-3 border-b border-acars-border">
        <div className="relative">
          <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-acars-muted pointer-events-none" />
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => {
              setDateFrom(e.target.value);
              setPage(1);
            }}
            className="input-field text-xs h-8 pl-7 pr-2"
            title="From date"
          />
        </div>
        <span className="text-acars-muted text-xs">to</span>
        <div className="relative">
          <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-acars-muted pointer-events-none" />
          <input
            type="date"
            value={dateTo}
            onChange={(e) => {
              setDateTo(e.target.value);
              setPage(1);
            }}
            className="input-field text-xs h-8 pl-7 pr-2"
            title="To date"
          />
        </div>

        <div className="relative">
          <Filter className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-acars-muted pointer-events-none" />
          <select
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value as FinanceType | '');
              setPage(1);
            }}
            className="select-field h-8 pl-7"
          >
            <option value="">All Types</option>
            <option value="pay">Pay</option>
            <option value="bonus">Bonus</option>
            <option value="deduction">Deduction</option>
            <option value="expense">Expense</option>
            <option value="income">Income</option>
          </select>
        </div>

        <div className="relative flex-1 max-w-[200px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-acars-muted pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Pilot ID..."
            className="input-field text-xs font-mono h-8 pl-8"
          />
        </div>

        {hasFilters && (
          <button
            onClick={resetFilters}
            className="btn-secondary btn-sm flex items-center gap-1.5 h-8"
          >
            <RotateCcw className="w-3 h-3" /> Reset
          </button>
        )}

        <div className="flex-1" />

        <button
          onClick={() => setAddModalOpen(true)}
          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-400/20 hover:bg-emerald-500/20 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" /> Add Entry
        </button>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-64 text-sm text-red-400">{error}</div>
        ) : entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 gap-3">
            <DollarSign className="w-10 h-10 text-acars-muted/30" />
            <p className="text-sm text-acars-muted">No ledger entries found</p>
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead className="sticky top-0 z-10 bg-acars-panel">
              <tr className="text-[10px] uppercase tracking-wider text-acars-muted border-b border-acars-border">
                <th className="text-left px-4 py-2.5 font-medium">Date</th>
                <th className="text-left px-3 py-2.5 font-medium">Pilot</th>
                <th className="text-center px-3 py-2.5 font-medium">Type</th>
                <th className="text-right px-3 py-2.5 font-medium">Amount</th>
                <th className="text-left px-3 py-2.5 font-medium">Description</th>
                <th className="text-left px-3 py-2.5 font-medium">Created By</th>
                <th className="text-center px-3 py-2.5 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry, i) => (
                <tr
                  key={entry.id}
                  className={`border-b border-acars-border hover:bg-acars-hover transition-colors ${
                    i % 2 === 0 ? 'bg-acars-panel' : 'bg-acars-bg'
                  }`}
                >
                  <td className="px-4 py-2.5">
                    <div className="text-acars-text font-medium">{formatDate(entry.createdAt)}</div>
                    <div className="text-acars-muted text-[10px]">
                      {new Date(entry.createdAt).toLocaleTimeString('en-US', {
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: false,
                      })}
                      z
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="text-acars-text font-mono font-semibold">{entry.pilotCallsign}</span>
                    <div className="text-acars-muted text-[10px] truncate max-w-[120px]">{entry.pilotName}</div>
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <TypeBadge type={entry.type} />
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <AmountCell amount={entry.amount} />
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="text-acars-muted text-[11px] truncate block max-w-[200px]">
                      {entry.description || '—'}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="text-acars-muted font-mono text-[11px]">{entry.creatorCallsign}</span>
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <button
                      onClick={() => setDeleteTarget(entry.id)}
                      className="p-1 rounded hover:bg-red-500/10 text-acars-muted hover:text-red-400 transition-colors"
                      title="Delete entry"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {total > pageSize && (
        <div className="flex-none border-t border-acars-border bg-acars-panel px-4 py-2 flex items-center justify-between">
          <span className="text-xs text-acars-muted">
            Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="h-7 w-7 rounded border border-acars-border bg-acars-panel text-acars-muted hover:text-acars-text disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span className="text-xs text-acars-text px-2 font-mono">
              {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="h-7 w-7 rounded border border-acars-border bg-acars-panel text-acars-muted hover:text-acars-text disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Add Entry Modal */}
      {addModalOpen && (
        <AddEntryModal
          onClose={() => setAddModalOpen(false)}
          onCreated={() => {
            setAddModalOpen(false);
            fetchEntries();
          }}
        />
      )}

      {/* Delete Confirm Dialog */}
      <ConfirmDialog
        open={deleteTarget != null}
        title="Delete Finance Entry"
        message="Are you sure you want to delete this ledger entry? This action cannot be undone."
        variant="danger"
        confirmLabel="Delete"
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

// ─── Balances Tab ───────────────────────────────────────────────

type BalanceSortField = 'callsign' | 'name' | 'balance' | 'totalPay' | 'totalBonus' | 'totalDeductions';
type SortDir = 'asc' | 'desc';

function BalancesTab() {
  const [balances, setBalances] = useState<PilotBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sortField, setSortField] = useState<BalanceSortField>('balance');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  useEffect(() => {
    setLoading(true);
    setError('');
    api
      .get<BalancesResponse>('/api/admin/finances/balances')
      .then((data) => setBalances(data.balances))
      .catch((err: any) => setError(err?.message || 'Failed to load balances'))
      .finally(() => setLoading(false));
  }, []);

  function toggleSort(field: BalanceSortField) {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir(field === 'callsign' || field === 'name' ? 'asc' : 'desc');
    }
  }

  const sorted = [...balances].sort((a, b) => {
    const dir = sortDir === 'asc' ? 1 : -1;
    switch (sortField) {
      case 'callsign':
        return dir * a.callsign.localeCompare(b.callsign);
      case 'name':
        return dir * a.name.localeCompare(b.name);
      case 'balance':
        return dir * (a.balance - b.balance);
      case 'totalPay':
        return dir * (a.totalPay - b.totalPay);
      case 'totalBonus':
        return dir * (a.totalBonus - b.totalBonus);
      case 'totalDeductions':
        return dir * (a.totalDeductions - b.totalDeductions);
      default:
        return 0;
    }
  });

  function SortHeader({
    field,
    label,
    className = '',
  }: {
    field: BalanceSortField;
    label: string;
    className?: string;
  }) {
    const active = sortField === field;
    return (
      <button
        onClick={() => toggleSort(field)}
        className={`flex items-center gap-1 text-[10px] uppercase tracking-wider font-medium hover:text-acars-text transition-colors ${
          active ? 'text-blue-400' : 'text-acars-muted'
        } ${className}`}
      >
        {label}
        <ArrowUpDown className={`w-3 h-3 ${active ? 'text-blue-400' : 'text-acars-muted/50'}`} />
      </button>
    );
  }

  return (
    <div className="flex-1 overflow-auto">
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
        </div>
      ) : error ? (
        <div className="flex items-center justify-center h-64 text-sm text-red-400">{error}</div>
      ) : sorted.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 gap-3">
          <Wallet className="w-10 h-10 text-acars-muted/30" />
          <p className="text-sm text-acars-muted">No pilot balances found</p>
        </div>
      ) : (
        <table className="w-full text-xs">
          <thead className="sticky top-0 z-10 bg-acars-panel">
            <tr className="border-b border-acars-border">
              <th className="text-left px-4 py-2.5">
                <SortHeader field="callsign" label="Callsign" />
              </th>
              <th className="text-left px-3 py-2.5">
                <SortHeader field="name" label="Name" />
              </th>
              <th className="text-right px-3 py-2.5">
                <SortHeader field="balance" label="Balance" className="justify-end" />
              </th>
              <th className="text-right px-3 py-2.5">
                <SortHeader field="totalPay" label="Total Pay" className="justify-end" />
              </th>
              <th className="text-right px-3 py-2.5">
                <SortHeader field="totalBonus" label="Total Bonus" className="justify-end" />
              </th>
              <th className="text-right px-3 py-2.5">
                <SortHeader field="totalDeductions" label="Deductions" className="justify-end" />
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((pilot, i) => (
              <tr
                key={pilot.pilotId}
                className={`border-b border-acars-border hover:bg-acars-hover transition-colors ${
                  i % 2 === 0 ? 'bg-acars-panel' : 'bg-acars-bg'
                }`}
              >
                <td className="px-4 py-2.5">
                  <span className="text-acars-text font-mono font-semibold">{pilot.callsign}</span>
                </td>
                <td className="px-3 py-2.5">
                  <span className="text-acars-text">{pilot.name}</span>
                </td>
                <td className="px-3 py-2.5 text-right">
                  <AmountCell amount={pilot.balance} />
                </td>
                <td className="px-3 py-2.5 text-right">
                  <span className="font-mono text-emerald-400 tabular-nums">{formatCurrency(pilot.totalPay)}</span>
                </td>
                <td className="px-3 py-2.5 text-right">
                  <span className="font-mono text-blue-400 tabular-nums">{formatCurrency(pilot.totalBonus)}</span>
                </td>
                <td className="px-3 py-2.5 text-right">
                  <span className="font-mono text-red-400 tabular-nums">{formatCurrency(pilot.totalDeductions)}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ─── Summary Tab ────────────────────────────────────────────────

function SummaryTab() {
  const [summary, setSummary] = useState<FinanceSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const fetchSummary = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo) params.set('dateTo', dateTo);
      const qs = params.toString();
      const data = await api.get<FinanceSummary>(`/api/admin/finances/summary${qs ? `?${qs}` : ''}`);
      setSummary(data);
    } catch (err: any) {
      setError(err?.message || 'Failed to load summary');
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  const cards: {
    label: string;
    key: keyof FinanceSummary;
    color: string;
    textColor: string;
    borderColor: string;
    icon: typeof TrendingUp;
    iconColor: string;
  }[] = [
    {
      label: 'Total Pay',
      key: 'totalPay',
      color: 'bg-emerald-500/10',
      textColor: 'text-emerald-400',
      borderColor: 'border-emerald-400/20',
      icon: DollarSign,
      iconColor: 'text-emerald-400',
    },
    {
      label: 'Total Bonus',
      key: 'totalBonus',
      color: 'bg-blue-500/10',
      textColor: 'text-blue-400',
      borderColor: 'border-blue-400/20',
      icon: Award,
      iconColor: 'text-blue-400',
    },
    {
      label: 'Total Deductions',
      key: 'totalDeductions',
      color: 'bg-red-500/10',
      textColor: 'text-red-400',
      borderColor: 'border-red-400/20',
      icon: TrendingDown,
      iconColor: 'text-red-400',
    },
    {
      label: 'Total Expenses',
      key: 'totalExpenses',
      color: 'bg-amber-500/10',
      textColor: 'text-amber-400',
      borderColor: 'border-amber-400/20',
      icon: Receipt,
      iconColor: 'text-amber-400',
    },
    {
      label: 'Total Income',
      key: 'totalIncome',
      color: 'bg-emerald-500/10',
      textColor: 'text-emerald-400',
      borderColor: 'border-emerald-400/20',
      icon: TrendingUp,
      iconColor: 'text-emerald-400',
    },
    {
      label: 'Net Balance',
      key: 'netBalance',
      color: 'bg-acars-panel',
      textColor: 'text-acars-text',
      borderColor: 'border-acars-border',
      icon: Wallet,
      iconColor: 'text-blue-400',
    },
  ];

  return (
    <div className="flex-1 overflow-auto p-4 space-y-4">
      {/* Date range filter */}
      <div className="flex items-center gap-2">
        <div className="relative">
          <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-acars-muted pointer-events-none" />
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="input-field text-xs h-8 pl-7 pr-2"
            title="From date"
          />
        </div>
        <span className="text-acars-muted text-xs">to</span>
        <div className="relative">
          <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-acars-muted pointer-events-none" />
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="input-field text-xs h-8 pl-7 pr-2"
            title="To date"
          />
        </div>
        {(dateFrom || dateTo) && (
          <button
            onClick={() => {
              setDateFrom('');
              setDateTo('');
            }}
            className="btn-secondary btn-sm flex items-center gap-1.5 h-8"
          >
            <RotateCcw className="w-3 h-3" /> Reset
          </button>
        )}
      </div>

      {/* Cards */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
        </div>
      ) : error ? (
        <div className="flex items-center justify-center h-64 text-sm text-red-400">{error}</div>
      ) : summary ? (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {cards.map((card) => {
            const Icon = card.icon;
            const value = summary[card.key];
            const isNet = card.key === 'netBalance';
            const displayColor = isNet ? (value >= 0 ? 'text-emerald-400' : 'text-red-400') : card.textColor;

            return (
              <div
                key={card.key}
                className={`rounded-md border ${card.borderColor} ${card.color} p-5`}
              >
                <div className="flex items-center gap-2 mb-3">
                  <div
                    className={`flex items-center justify-center w-8 h-8 rounded-md ${card.color} border ${card.borderColor}`}
                  >
                    <Icon className={`w-4 h-4 ${card.iconColor}`} />
                  </div>
                  <span className="text-[10px] uppercase tracking-wider text-acars-muted font-medium">
                    {card.label}
                  </span>
                </div>
                <p className={`text-2xl font-bold font-mono tabular-nums ${displayColor}`}>
                  {value < 0 ? '-' : ''}
                  {formatCurrency(value)}
                </p>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────

export function AdminFinancesPage() {
  const [activeTab, setActiveTab] = useState<Tab>('ledger');

  const tabs: { key: Tab; label: string }[] = [
    { key: 'ledger', label: 'Ledger' },
    { key: 'balances', label: 'Pilot Balances' },
    { key: 'summary', label: 'Summary' },
  ];

  return (
    <div className="h-full flex flex-col overflow-hidden p-6">
      <AdminPageHeader icon={DollarSign} title="Financial Management" subtitle="Track payments, bonuses, and expenses" />

      {/* Tabs */}
      <div className="flex-none flex items-center gap-6 mt-5 border-b border-acars-border">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`pb-2.5 text-xs font-medium transition-colors relative ${
              activeTab === tab.key
                ? 'text-blue-400'
                : 'text-acars-muted hover:text-acars-text'
            }`}
          >
            {tab.label}
            {activeTab === tab.key && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500 rounded-full" />
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 flex flex-col overflow-hidden mt-4 panel">
        {activeTab === 'ledger' && <LedgerTab />}
        {activeTab === 'balances' && <BalancesTab />}
        {activeTab === 'summary' && <SummaryTab />}
      </div>
    </div>
  );
}
