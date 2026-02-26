import { useState, useEffect, useCallback } from 'react';
import {
  SpinnerGap,
  Plus,
  PencilSimple,
  CheckCircle,
  Trash,
  ArrowCounterClockwise,
  X,
  Wrench,
  WarningCircle,
  ClipboardText,
  CaretLeft,
  CaretRight,
} from '@phosphor-icons/react';
import { api } from '../../../lib/api';
import { toast } from '../../../stores/toastStore';
import type {
  MaintenanceLogEntry,
  MaintenanceLogType,
  MaintenanceLogStatus,
  FleetMaintenanceStatus,
  CreateMaintenanceLogRequest,
  UpdateMaintenanceLogRequest,
} from '@acars/shared';

// ─── Types ──────────────────────────────────────────────────────

interface LogListResponse {
  entries: MaintenanceLogEntry[];
  total: number;
  page: number;
  pageSize: number;
}

interface FleetStatusResponse {
  fleet: FleetMaintenanceStatus[];
}

// ─── Constants ──────────────────────────────────────────────────

const LABEL_CLS =
  'text-[10px] uppercase tracking-wider text-acars-muted font-medium mb-1.5 block';
const INPUT_CLS = 'input-field text-xs font-mono h-9';
const SELECT_CLS = 'select-field text-xs font-mono h-9';

const PAGE_SIZE = 25;

const CHECK_TYPES: { value: MaintenanceLogType; label: string }[] = [
  { value: 'A', label: 'A-Check' },
  { value: 'B', label: 'B-Check' },
  { value: 'C', label: 'C-Check' },
  { value: 'D', label: 'D-Check' },
  { value: 'LINE', label: 'Line' },
  { value: 'UNSCHEDULED', label: 'Unscheduled' },
  { value: 'AD', label: 'AD' },
  { value: 'MEL', label: 'MEL' },
  { value: 'SFP', label: 'SFP' },
];

const STATUS_OPTIONS: { value: MaintenanceLogStatus; label: string }[] = [
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'deferred', label: 'Deferred' },
];

const CHECK_TYPE_BADGE: Record<MaintenanceLogType, { bg: string; text: string; border: string }> = {
  A: { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-400/20' },
  B: { bg: 'bg-cyan-500/10', text: 'text-cyan-400', border: 'border-cyan-400/20' },
  C: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-400/20' },
  D: { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-400/20' },
  LINE: { bg: 'bg-zinc-500/10', text: 'text-zinc-400', border: 'border-zinc-400/20' },
  UNSCHEDULED: { bg: 'bg-orange-500/10', text: 'text-orange-400', border: 'border-orange-400/20' },
  AD: { bg: 'bg-purple-500/10', text: 'text-purple-400', border: 'border-purple-400/20' },
  MEL: { bg: 'bg-pink-500/10', text: 'text-pink-400', border: 'border-pink-400/20' },
  SFP: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-400/20' },
};

const STATUS_BADGE: Record<MaintenanceLogStatus, { bg: string; text: string; border: string; label: string }> = {
  scheduled: { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-400/20', label: 'Scheduled' },
  in_progress: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-400/20', label: 'In Progress' },
  completed: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-400/20', label: 'Completed' },
  deferred: { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-400/20', label: 'Deferred' },
};

// ─── Helpers ────────────────────────────────────────────────────

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '--';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatCurrency(amount: number | null): string {
  if (amount == null) return '--';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
}

// ─── Check Type Badge ───────────────────────────────────────────

function CheckTypeBadge({ type }: { type: MaintenanceLogType }) {
  const cfg = CHECK_TYPE_BADGE[type];
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${cfg.bg} ${cfg.text} border ${cfg.border}`}
    >
      {type}
    </span>
  );
}

// ─── Status Badge ───────────────────────────────────────────────

function LogStatusBadge({ status }: { status: MaintenanceLogStatus }) {
  const cfg = STATUS_BADGE[status];
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${cfg.bg} ${cfg.text} border ${cfg.border}`}
    >
      {cfg.label}
    </span>
  );
}

// ─── Confirm Modal ──────────────────────────────────────────────

interface ConfirmModalProps {
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}

function ConfirmModal({ title, message, confirmLabel, onConfirm, onCancel, loading }: ConfirmModalProps) {
  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center" onClick={onCancel}>
      <div className="absolute inset-0 bg-black/60" />
      <div
        className="relative w-full max-w-sm mx-4 rounded-md border border-acars-border bg-acars-panel shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4">
          <h3 className="text-[13px] font-semibold text-acars-text mb-2">{title}</h3>
          <p className="text-xs text-acars-muted">{message}</p>
        </div>
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-acars-border">
          <button onClick={onCancel} className="btn-secondary btn-md" disabled={loading}>
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-xs font-semibold text-white bg-red-500 hover:bg-red-500/80 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading && <SpinnerGap className="w-3.5 h-3.5 animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Log Entry Form Modal ───────────────────────────────────────

interface FormData {
  aircraftId: string;
  checkType: MaintenanceLogType;
  title: string;
  description: string;
  performedBy: string;
  performedAt: string;
  hoursAtCheck: string;
  cyclesAtCheck: string;
  cost: string;
  status: MaintenanceLogStatus;
  sfpDestination: string;
  sfpExpiry: string;
}

const EMPTY_FORM: FormData = {
  aircraftId: '',
  checkType: 'A',
  title: '',
  description: '',
  performedBy: '',
  performedAt: '',
  hoursAtCheck: '',
  cyclesAtCheck: '',
  cost: '',
  status: 'scheduled',
  sfpDestination: '',
  sfpExpiry: '',
};

function entryToForm(entry: MaintenanceLogEntry): FormData {
  return {
    aircraftId: String(entry.aircraftId),
    checkType: entry.checkType,
    title: entry.title,
    description: entry.description ?? '',
    performedBy: entry.performedBy ?? '',
    performedAt: entry.performedAt ? entry.performedAt.slice(0, 10) : '',
    hoursAtCheck: entry.hoursAtCheck != null ? String(entry.hoursAtCheck) : '',
    cyclesAtCheck: entry.cyclesAtCheck != null ? String(entry.cyclesAtCheck) : '',
    cost: entry.cost != null ? String(entry.cost) : '',
    status: entry.status,
    sfpDestination: entry.sfpDestination ?? '',
    sfpExpiry: entry.sfpExpiry ? entry.sfpExpiry.slice(0, 10) : '',
  };
}

interface LogFormModalProps {
  editEntry: MaintenanceLogEntry | null; // null = creating new
  fleet: FleetMaintenanceStatus[];
  onClose: () => void;
  onSaved: () => void;
}

function LogFormModal({ editEntry, fleet, onClose, onSaved }: LogFormModalProps) {
  const [form, setForm] = useState<FormData>(editEntry ? entryToForm(editEntry) : EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const isEdit = editEntry !== null;
  const canSubmit = form.aircraftId !== '' && form.title.trim() !== '' && !submitting;

  const updateField = <K extends keyof FormData>(key: K, value: FormData[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError('');

    try {
      if (isEdit) {
        const body: UpdateMaintenanceLogRequest = {
          checkType: form.checkType,
          title: form.title.trim(),
          description: form.description.trim() || undefined,
          performedBy: form.performedBy.trim() || undefined,
          performedAt: form.performedAt || undefined,
          hoursAtCheck: form.hoursAtCheck ? parseFloat(form.hoursAtCheck) : undefined,
          cyclesAtCheck: form.cyclesAtCheck ? parseInt(form.cyclesAtCheck, 10) : undefined,
          cost: form.cost ? parseFloat(form.cost) : undefined,
          status: form.status,
          sfpDestination: form.checkType === 'SFP' ? (form.sfpDestination.trim() || undefined) : undefined,
          sfpExpiry: form.checkType === 'SFP' ? (form.sfpExpiry || undefined) : undefined,
        };
        await api.patch(`/api/admin/maintenance/log/${editEntry.id}`, body);
        toast.success('Log entry updated');
      } else {
        const body: CreateMaintenanceLogRequest = {
          aircraftId: parseInt(form.aircraftId, 10),
          checkType: form.checkType,
          title: form.title.trim(),
          description: form.description.trim() || undefined,
          performedBy: form.performedBy.trim() || undefined,
          performedAt: form.performedAt || undefined,
          hoursAtCheck: form.hoursAtCheck ? parseFloat(form.hoursAtCheck) : undefined,
          cyclesAtCheck: form.cyclesAtCheck ? parseInt(form.cyclesAtCheck, 10) : undefined,
          cost: form.cost ? parseFloat(form.cost) : undefined,
          status: form.status,
          sfpDestination: form.checkType === 'SFP' ? (form.sfpDestination.trim() || undefined) : undefined,
          sfpExpiry: form.checkType === 'SFP' ? (form.sfpExpiry || undefined) : undefined,
        };
        await api.post('/api/admin/maintenance/log', body);
        toast.success('Log entry created');
      }
      onSaved();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save log entry';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60" />
      <div
        className="relative w-full max-w-lg mx-4 rounded-md border border-acars-border bg-acars-panel shadow-2xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex-none flex items-center justify-between px-5 py-3.5 border-b border-acars-border">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center w-8 h-8 rounded-md bg-blue-500/10 border border-blue-400/20">
              <Wrench className="w-4 h-4 text-blue-400" />
            </div>
            <div>
              <h2 className="text-[13px] font-semibold text-acars-text">
                {isEdit ? 'Edit Log Entry' : 'New Log Entry'}
              </h2>
              <p className="text-[10px] text-acars-muted">
                {isEdit ? `Editing entry #${editEntry.id}` : 'Create a new maintenance log entry'}
              </p>
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
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Row: Aircraft + Check Type */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={LABEL_CLS}>Aircraft *</label>
              {fleet.length > 0 ? (
                <select
                  value={form.aircraftId}
                  onChange={(e) => updateField('aircraftId', e.target.value)}
                  className={SELECT_CLS}
                  disabled={isEdit}
                >
                  <option value="">Select aircraft...</option>
                  {fleet.map((ac) => (
                    <option key={ac.aircraftId} value={String(ac.aircraftId)}>
                      {ac.registration} -- {ac.icaoType}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="number"
                  value={form.aircraftId}
                  onChange={(e) => updateField('aircraftId', e.target.value)}
                  placeholder="Aircraft ID"
                  className={INPUT_CLS}
                  disabled={isEdit}
                />
              )}
            </div>
            <div>
              <label className={LABEL_CLS}>Check Type *</label>
              <select
                value={form.checkType}
                onChange={(e) => updateField('checkType', e.target.value as MaintenanceLogType)}
                className={SELECT_CLS}
              >
                {CHECK_TYPES.map((ct) => (
                  <option key={ct.value} value={ct.value}>{ct.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Title */}
          <div>
            <label className={LABEL_CLS}>Title *</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => updateField('title', e.target.value)}
              placeholder="e.g. A-Check performed at 500h"
              className={INPUT_CLS}
            />
          </div>

          {/* Description */}
          <div>
            <label className={LABEL_CLS}>Description</label>
            <textarea
              value={form.description}
              onChange={(e) => updateField('description', e.target.value)}
              rows={3}
              placeholder="Optional notes..."
              className="input-field text-xs resize-none"
            />
          </div>

          {/* Row: Performed By + Performed At */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={LABEL_CLS}>Performed By</label>
              <input
                type="text"
                value={form.performedBy}
                onChange={(e) => updateField('performedBy', e.target.value)}
                placeholder="Technician name"
                className={INPUT_CLS}
              />
            </div>
            <div>
              <label className={LABEL_CLS}>Performed At</label>
              <input
                type="date"
                value={form.performedAt}
                onChange={(e) => updateField('performedAt', e.target.value)}
                className={INPUT_CLS}
              />
            </div>
          </div>

          {/* Row: Hours + Cycles */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={LABEL_CLS}>Hours at Check</label>
              <input
                type="number"
                step="0.1"
                value={form.hoursAtCheck}
                onChange={(e) => updateField('hoursAtCheck', e.target.value)}
                placeholder="0.0"
                className={INPUT_CLS}
              />
            </div>
            <div>
              <label className={LABEL_CLS}>Cycles at Check</label>
              <input
                type="number"
                step="1"
                value={form.cyclesAtCheck}
                onChange={(e) => updateField('cyclesAtCheck', e.target.value)}
                placeholder="0"
                className={INPUT_CLS}
              />
            </div>
          </div>

          {/* Row: Cost + Status */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={LABEL_CLS}>Cost (USD)</label>
              <input
                type="number"
                step="0.01"
                value={form.cost}
                onChange={(e) => updateField('cost', e.target.value)}
                placeholder="0.00"
                className={INPUT_CLS}
              />
            </div>
            <div>
              <label className={LABEL_CLS}>Status</label>
              <select
                value={form.status}
                onChange={(e) => updateField('status', e.target.value as MaintenanceLogStatus)}
                className={SELECT_CLS}
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* SFP fields (conditional) */}
          {form.checkType === 'SFP' && (
            <div className="grid grid-cols-2 gap-4 rounded-md border border-emerald-400/20 bg-emerald-500/5 p-3">
              <div>
                <label className={LABEL_CLS}>SFP Destination</label>
                <input
                  type="text"
                  value={form.sfpDestination}
                  onChange={(e) => updateField('sfpDestination', e.target.value)}
                  placeholder="ICAO code"
                  className={INPUT_CLS}
                />
              </div>
              <div>
                <label className={LABEL_CLS}>SFP Expiry</label>
                <input
                  type="date"
                  value={form.sfpExpiry}
                  onChange={(e) => updateField('sfpExpiry', e.target.value)}
                  className={INPUT_CLS}
                />
              </div>
            </div>
          )}

          {error && (
            <p className="text-[11px] text-red-400 bg-red-500/10 border border-red-400/20 rounded-md px-3 py-2">
              {error}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex-none flex items-center justify-end gap-2 px-5 py-3 border-t border-acars-border">
          <button onClick={onClose} className="btn-secondary btn-md">
            Cancel
          </button>
          <button
            disabled={!canSubmit}
            onClick={handleSubmit}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-xs font-semibold text-white bg-blue-500 hover:bg-blue-500/80 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {submitting ? (
              <SpinnerGap className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Wrench className="w-3.5 h-3.5" />
            )}
            {isEdit ? 'Save Changes' : 'Create Entry'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Maintenance Log Tab (Main Export) ──────────────────────────

export function MaintenanceLogTab() {
  // Data
  const [entries, setEntries] = useState<MaintenanceLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [fleet, setFleet] = useState<FleetMaintenanceStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters
  const [filterAircraft, setFilterAircraft] = useState('');
  const [filterCheckType, setFilterCheckType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');

  // Pagination
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Modals
  const [showForm, setShowForm] = useState(false);
  const [editEntry, setEditEntry] = useState<MaintenanceLogEntry | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MaintenanceLogEntry | null>(null);
  const [completeTarget, setCompleteTarget] = useState<MaintenanceLogEntry | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Fetch fleet list (for dropdown)
  const fetchFleet = useCallback(async () => {
    try {
      const data = await api.get<FleetStatusResponse>('/api/admin/maintenance/fleet-status');
      setFleet(data.fleet);
    } catch {
      // Non-critical: fleet list just won't populate the dropdown
    }
  }, []);

  // Fetch log entries
  const fetchEntries = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (filterAircraft) params.set('aircraftId', filterAircraft);
      if (filterCheckType) params.set('checkType', filterCheckType);
      if (filterStatus) params.set('status', filterStatus);
      if (filterDateFrom) params.set('dateFrom', filterDateFrom);
      if (filterDateTo) params.set('dateTo', filterDateTo);
      params.set('page', String(page));
      params.set('pageSize', String(PAGE_SIZE));

      const data = await api.get<LogListResponse>(`/api/admin/maintenance/log?${params.toString()}`);
      setEntries(data.entries);
      setTotal(data.total);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load maintenance log';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [filterAircraft, filterCheckType, filterStatus, filterDateFrom, filterDateTo, page]);

  useEffect(() => {
    fetchFleet();
  }, [fetchFleet]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  // ── Filter Handlers ───────────────────────────────────────

  const handleFilterAircraft = useCallback((val: string) => {
    setFilterAircraft(val);
    setPage(1);
  }, []);

  const handleFilterCheckType = useCallback((val: string) => {
    setFilterCheckType(val);
    setPage(1);
  }, []);

  const handleFilterStatus = useCallback((val: string) => {
    setFilterStatus(val);
    setPage(1);
  }, []);

  const handleFilterDateFrom = useCallback((val: string) => {
    setFilterDateFrom(val);
    setPage(1);
  }, []);

  const handleFilterDateTo = useCallback((val: string) => {
    setFilterDateTo(val);
    setPage(1);
  }, []);

  const resetFilters = useCallback(() => {
    setFilterAircraft('');
    setFilterCheckType('');
    setFilterStatus('');
    setFilterDateFrom('');
    setFilterDateTo('');
    setPage(1);
  }, []);

  // ── Action Handlers ───────────────────────────────────────

  const handleEdit = useCallback((entry: MaintenanceLogEntry) => {
    setEditEntry(entry);
    setShowForm(true);
  }, []);

  const handleCreate = useCallback(() => {
    setEditEntry(null);
    setShowForm(true);
  }, []);

  const handleFormClose = useCallback(() => {
    setShowForm(false);
    setEditEntry(null);
  }, []);

  const handleFormSaved = useCallback(() => {
    setShowForm(false);
    setEditEntry(null);
    fetchEntries();
  }, [fetchEntries]);

  const handleComplete = useCallback(async () => {
    if (!completeTarget) return;
    setActionLoading(true);
    try {
      await api.post(`/api/admin/maintenance/log/${completeTarget.id}/complete`);
      toast.success(`"${completeTarget.title}" marked as completed`);
      setCompleteTarget(null);
      fetchEntries();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to complete entry';
      toast.error(message);
    } finally {
      setActionLoading(false);
    }
  }, [completeTarget, fetchEntries]);

  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return;
    setActionLoading(true);
    try {
      await api.delete(`/api/admin/maintenance/log/${deleteTarget.id}`);
      toast.success(`"${deleteTarget.title}" deleted`);
      setDeleteTarget(null);
      fetchEntries();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to delete entry';
      toast.error(message);
    } finally {
      setActionLoading(false);
    }
  }, [deleteTarget, fetchEntries]);

  // ── Loading State ─────────────────────────────────────────

  if (loading && entries.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <SpinnerGap className="w-6 h-6 text-blue-400 animate-spin" />
      </div>
    );
  }

  if (error && entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <WarningCircle className="w-10 h-10 text-red-400/40" />
        <p className="text-sm text-red-400">{error}</p>
        <button
          onClick={fetchEntries}
          className="text-xs px-3 py-1.5 rounded-md text-blue-400 bg-blue-500/10 border border-blue-400/20 hover:bg-blue-500/20 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Filters Bar */}
      <div className="flex-none px-4 pt-4 pb-3">
        <div className="flex flex-wrap items-end gap-3">
          {/* Aircraft filter */}
          <div>
            <label className={LABEL_CLS}>Aircraft</label>
            {fleet.length > 0 ? (
              <select
                value={filterAircraft}
                onChange={(e) => handleFilterAircraft(e.target.value)}
                className={`${SELECT_CLS} w-44`}
              >
                <option value="">All Aircraft</option>
                {fleet.map((ac) => (
                  <option key={ac.aircraftId} value={String(ac.aircraftId)}>
                    {ac.registration}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={filterAircraft}
                onChange={(e) => handleFilterAircraft(e.target.value)}
                placeholder="Aircraft ID"
                className={`${INPUT_CLS} w-28`}
              />
            )}
          </div>

          {/* Check Type */}
          <div>
            <label className={LABEL_CLS}>Check Type</label>
            <select
              value={filterCheckType}
              onChange={(e) => handleFilterCheckType(e.target.value)}
              className={`${SELECT_CLS} w-36`}
            >
              <option value="">All Types</option>
              {CHECK_TYPES.map((ct) => (
                <option key={ct.value} value={ct.value}>{ct.label}</option>
              ))}
            </select>
          </div>

          {/* Status */}
          <div>
            <label className={LABEL_CLS}>Status</label>
            <select
              value={filterStatus}
              onChange={(e) => handleFilterStatus(e.target.value)}
              className={`${SELECT_CLS} w-36`}
            >
              <option value="">All Statuses</option>
              {STATUS_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>

          {/* Date From */}
          <div>
            <label className={LABEL_CLS}>From</label>
            <input
              type="date"
              value={filterDateFrom}
              onChange={(e) => handleFilterDateFrom(e.target.value)}
              className={`${INPUT_CLS} w-36`}
            />
          </div>

          {/* Date To */}
          <div>
            <label className={LABEL_CLS}>To</label>
            <input
              type="date"
              value={filterDateTo}
              onChange={(e) => handleFilterDateTo(e.target.value)}
              className={`${INPUT_CLS} w-36`}
            />
          </div>

          {/* Reset */}
          <button
            onClick={resetFilters}
            className="inline-flex items-center gap-1.5 px-3 h-9 rounded-md text-xs font-medium text-acars-muted hover:text-acars-text bg-acars-bg border border-acars-border hover:bg-acars-hover transition-colors"
          >
            <ArrowCounterClockwise className="w-3.5 h-3.5" />
            Reset
          </button>

          {/* Spacer */}
          <div className="flex-1" />

          {/* New Entry */}
          <button
            onClick={handleCreate}
            className="inline-flex items-center gap-1.5 px-4 h-9 rounded-md text-xs font-semibold text-white bg-blue-500 hover:bg-blue-500/80 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" weight="bold" />
            New Entry
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 gap-3">
            <ClipboardText className="w-10 h-10 text-acars-muted/30" />
            <p className="text-sm text-acars-muted">No maintenance log entries found</p>
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead className="sticky top-0 z-10 bg-acars-panel">
              <tr className="text-[10px] uppercase tracking-wider text-acars-muted border-b border-acars-border">
                <th className="text-left px-4 py-2.5 font-medium">Date</th>
                <th className="text-left px-3 py-2.5 font-medium">Aircraft</th>
                <th className="text-left px-3 py-2.5 font-medium">Check Type</th>
                <th className="text-left px-3 py-2.5 font-medium">Title</th>
                <th className="text-left px-3 py-2.5 font-medium">Performed By</th>
                <th className="text-center px-3 py-2.5 font-medium">Status</th>
                <th className="text-right px-3 py-2.5 font-medium">Cost</th>
                <th className="text-center px-3 py-2.5 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr
                  key={entry.id}
                  className="border-b border-acars-border hover:bg-acars-hover transition-colors"
                >
                  <td className="px-4 py-2.5">
                    <span className="font-mono text-acars-text tabular-nums">
                      {formatDate(entry.performedAt ?? entry.createdAt)}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="font-mono font-semibold text-acars-text">
                      {entry.aircraftRegistration ?? `ID:${entry.aircraftId}`}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <CheckTypeBadge type={entry.checkType} />
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="text-acars-text truncate max-w-[200px] block" title={entry.title}>
                      {entry.title}
                    </span>
                    {entry.description && (
                      <span className="text-acars-muted text-[10px] truncate max-w-[200px] block">
                        {entry.description}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="text-acars-text">{entry.performedBy ?? '--'}</span>
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <LogStatusBadge status={entry.status} />
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <span className="font-mono text-acars-text tabular-nums">
                      {formatCurrency(entry.cost)}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      {/* Edit */}
                      <button
                        onClick={() => handleEdit(entry)}
                        className="p-1.5 rounded-md text-blue-400 bg-blue-500/10 border border-blue-400/20 hover:bg-blue-500/20 transition-colors"
                        title="Edit"
                      >
                        <PencilSimple className="w-3.5 h-3.5" />
                      </button>

                      {/* Complete (only for non-completed) */}
                      {entry.status !== 'completed' && (
                        <button
                          onClick={() => setCompleteTarget(entry)}
                          className="p-1.5 rounded-md text-emerald-400 bg-emerald-500/10 border border-emerald-400/20 hover:bg-emerald-500/20 transition-colors"
                          title="Mark Complete"
                        >
                          <CheckCircle className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {/* Delete */}
                      <button
                        onClick={() => setDeleteTarget(entry)}
                        className="p-1.5 rounded-md text-red-400 bg-red-500/10 border border-red-400/20 hover:bg-red-500/20 transition-colors"
                        title="Delete"
                      >
                        <Trash className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {total > PAGE_SIZE && (
        <div className="flex-none flex items-center justify-between px-4 py-3 border-t border-acars-border">
          <span className="text-[11px] text-acars-muted">
            Showing {(page - 1) * PAGE_SIZE + 1}--{Math.min(page * PAGE_SIZE, total)} of {total} entries
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium text-acars-muted hover:text-acars-text bg-acars-bg border border-acars-border hover:bg-acars-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <CaretLeft className="w-3.5 h-3.5" />
              Previous
            </button>
            <span className="text-xs text-acars-muted font-mono tabular-nums">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium text-acars-muted hover:text-acars-text bg-acars-bg border border-acars-border hover:bg-acars-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next
              <CaretRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <LogFormModal
          editEntry={editEntry}
          fleet={fleet}
          onClose={handleFormClose}
          onSaved={handleFormSaved}
        />
      )}

      {/* Complete Confirm Modal */}
      {completeTarget && (
        <ConfirmModal
          title="Mark as Completed"
          message={`Are you sure you want to mark "${completeTarget.title}" as completed? This will update the aircraft's last check records.`}
          confirmLabel="Complete"
          onConfirm={handleComplete}
          onCancel={() => setCompleteTarget(null)}
          loading={actionLoading}
        />
      )}

      {/* Delete Confirm Modal */}
      {deleteTarget && (
        <ConfirmModal
          title="Delete Entry"
          message={`Are you sure you want to delete "${deleteTarget.title}"? This action cannot be undone.`}
          confirmLabel="Delete"
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
          loading={actionLoading}
        />
      )}
    </div>
  );
}
