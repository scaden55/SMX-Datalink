import { useState, useEffect, useCallback } from 'react';
import {
  SpinnerGap,
  Plus,
  PencilSimple,
  Trash,
  X,
  Wrench,
  WarningCircle,
  ShieldWarning,
  CaretLeft,
  CaretRight,
  ArrowCounterClockwise,
} from '@phosphor-icons/react';
import { api } from '../../../lib/api';
import { toast } from '../../../stores/toastStore';
import type {
  AirworthinessDirective,
  ADComplianceStatus,
  ADListResponse,
  CreateADRequest,
  UpdateADRequest,
  FleetMaintenanceStatus,
} from '@acars/shared';

// ─── Types ──────────────────────────────────────────────────────

interface FleetStatusResponse {
  fleet: FleetMaintenanceStatus[];
}

// ─── Constants ──────────────────────────────────────────────────

const LABEL_CLS =
  'text-[10px] uppercase tracking-wider text-acars-muted font-medium mb-1.5 block';
const INPUT_CLS = 'input-field text-xs font-mono h-9';
const SELECT_CLS = 'select-field text-xs font-mono h-9';

const PAGE_SIZE = 25;

const STATUS_OPTIONS: { value: ADComplianceStatus; label: string }[] = [
  { value: 'open', label: 'Open' },
  { value: 'complied', label: 'Complied' },
  { value: 'recurring', label: 'Recurring' },
  { value: 'not_applicable', label: 'Not Applicable' },
];

const STATUS_BADGE: Record<ADComplianceStatus, { bg: string; text: string; border: string; label: string }> = {
  open: { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-400/20', label: 'Open' },
  complied: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-400/20', label: 'Complied' },
  recurring: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-400/20', label: 'Recurring' },
  not_applicable: { bg: 'bg-zinc-500/10', text: 'text-zinc-400', border: 'border-zinc-400/20', label: 'N/A' },
};

// ─── Helpers ────────────────────────────────────────────────────

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '--';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatNextDue(hours: number | null, date: string | null): string {
  if (hours != null) return `${hours.toLocaleString('en-US')} hrs`;
  if (date) return formatDate(date);
  return '--';
}

// ─── Status Badge ───────────────────────────────────────────────

function ComplianceBadge({ status }: { status: ADComplianceStatus }) {
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

// ─── AD Form Modal ──────────────────────────────────────────────

interface FormData {
  aircraftId: string;
  adNumber: string;
  title: string;
  description: string;
  complianceStatus: ADComplianceStatus;
  complianceDate: string;
  complianceMethod: string;
  recurringIntervalHours: string;
  nextDueHours: string;
  nextDueDate: string;
}

const EMPTY_FORM: FormData = {
  aircraftId: '',
  adNumber: '',
  title: '',
  description: '',
  complianceStatus: 'open',
  complianceDate: '',
  complianceMethod: '',
  recurringIntervalHours: '',
  nextDueHours: '',
  nextDueDate: '',
};

function directiveToForm(ad: AirworthinessDirective): FormData {
  return {
    aircraftId: String(ad.aircraftId),
    adNumber: ad.adNumber,
    title: ad.title,
    description: ad.description ?? '',
    complianceStatus: ad.complianceStatus,
    complianceDate: ad.complianceDate ? ad.complianceDate.slice(0, 10) : '',
    complianceMethod: ad.complianceMethod ?? '',
    recurringIntervalHours: ad.recurringIntervalHours != null ? String(ad.recurringIntervalHours) : '',
    nextDueHours: ad.nextDueHours != null ? String(ad.nextDueHours) : '',
    nextDueDate: ad.nextDueDate ? ad.nextDueDate.slice(0, 10) : '',
  };
}

interface ADFormModalProps {
  editDirective: AirworthinessDirective | null;
  fleet: FleetMaintenanceStatus[];
  onClose: () => void;
  onSaved: () => void;
}

function ADFormModal({ editDirective, fleet, onClose, onSaved }: ADFormModalProps) {
  const [form, setForm] = useState<FormData>(editDirective ? directiveToForm(editDirective) : EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const isEdit = editDirective !== null;
  const canSubmit = form.aircraftId !== '' && form.adNumber.trim() !== '' && form.title.trim() !== '' && !submitting;

  const updateField = <K extends keyof FormData>(key: K, value: FormData[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError('');

    try {
      if (isEdit) {
        const body: UpdateADRequest = {
          adNumber: form.adNumber.trim(),
          title: form.title.trim(),
          description: form.description.trim() || undefined,
          complianceStatus: form.complianceStatus,
          complianceDate: form.complianceDate || undefined,
          complianceMethod: form.complianceMethod.trim() || undefined,
          recurringIntervalHours: form.recurringIntervalHours ? parseFloat(form.recurringIntervalHours) : undefined,
          nextDueHours: form.nextDueHours ? parseFloat(form.nextDueHours) : undefined,
          nextDueDate: form.nextDueDate || undefined,
        };
        await api.patch(`/api/admin/maintenance/ads/${editDirective.id}`, body);
        toast.success('Airworthiness directive updated');
      } else {
        const body: CreateADRequest = {
          aircraftId: parseInt(form.aircraftId, 10),
          adNumber: form.adNumber.trim(),
          title: form.title.trim(),
          description: form.description.trim() || undefined,
          complianceStatus: form.complianceStatus,
          complianceDate: form.complianceDate || undefined,
          complianceMethod: form.complianceMethod.trim() || undefined,
          recurringIntervalHours: form.recurringIntervalHours ? parseFloat(form.recurringIntervalHours) : undefined,
          nextDueHours: form.nextDueHours ? parseFloat(form.nextDueHours) : undefined,
          nextDueDate: form.nextDueDate || undefined,
        };
        await api.post('/api/admin/maintenance/ads', body);
        toast.success('Airworthiness directive created');
      }
      onSaved();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save airworthiness directive';
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
              <ShieldWarning className="w-4 h-4 text-blue-400" />
            </div>
            <div>
              <h2 className="text-[13px] font-semibold text-acars-text">
                {isEdit ? 'Edit Airworthiness Directive' : 'New Airworthiness Directive'}
              </h2>
              <p className="text-[10px] text-acars-muted">
                {isEdit
                  ? `Editing AD ${editDirective.adNumber}`
                  : 'Create a new airworthiness directive record'}
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
          {/* Row: Aircraft + AD Number */}
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
              <label className={LABEL_CLS}>AD Number *</label>
              <input
                type="text"
                value={form.adNumber}
                onChange={(e) => updateField('adNumber', e.target.value)}
                placeholder="e.g. 2024-12-34"
                className={INPUT_CLS}
              />
            </div>
          </div>

          {/* Title */}
          <div>
            <label className={LABEL_CLS}>Title *</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => updateField('title', e.target.value)}
              placeholder="e.g. Engine fuel pump inspection"
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
              placeholder="Optional notes about this directive..."
              className="input-field text-xs resize-none"
            />
          </div>

          {/* Row: Compliance Status + Compliance Date */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={LABEL_CLS}>Compliance Status</label>
              <select
                value={form.complianceStatus}
                onChange={(e) => updateField('complianceStatus', e.target.value as ADComplianceStatus)}
                className={SELECT_CLS}
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={LABEL_CLS}>Compliance Date</label>
              <input
                type="date"
                value={form.complianceDate}
                onChange={(e) => updateField('complianceDate', e.target.value)}
                className={INPUT_CLS}
              />
            </div>
          </div>

          {/* Compliance Method */}
          <div>
            <label className={LABEL_CLS}>Compliance Method</label>
            <input
              type="text"
              value={form.complianceMethod}
              onChange={(e) => updateField('complianceMethod', e.target.value)}
              placeholder="e.g. Replaced fuel pump per SB-1234"
              className={INPUT_CLS}
            />
          </div>

          {/* Recurring Interval (conditional) */}
          {form.complianceStatus === 'recurring' && (
            <div className="rounded-md border border-amber-400/20 bg-amber-500/5 p-3">
              <label className={LABEL_CLS}>Recurring Interval Hours</label>
              <input
                type="number"
                step="0.1"
                value={form.recurringIntervalHours}
                onChange={(e) => updateField('recurringIntervalHours', e.target.value)}
                placeholder="e.g. 500"
                className={INPUT_CLS}
              />
            </div>
          )}

          {/* Row: Next Due Hours + Next Due Date */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={LABEL_CLS}>Next Due Hours</label>
              <input
                type="number"
                step="0.1"
                value={form.nextDueHours}
                onChange={(e) => updateField('nextDueHours', e.target.value)}
                placeholder="e.g. 1500"
                className={INPUT_CLS}
              />
            </div>
            <div>
              <label className={LABEL_CLS}>Next Due Date</label>
              <input
                type="date"
                value={form.nextDueDate}
                onChange={(e) => updateField('nextDueDate', e.target.value)}
                className={INPUT_CLS}
              />
            </div>
          </div>

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
            {isEdit ? 'Save Changes' : 'Create Directive'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Airworthiness Directives Tab (Main Export) ─────────────────

export function AirworthinessDirectivesTab() {
  // Data
  const [directives, setDirectives] = useState<AirworthinessDirective[]>([]);
  const [total, setTotal] = useState(0);
  const [fleet, setFleet] = useState<FleetMaintenanceStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters
  const [filterAircraft, setFilterAircraft] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  // Pagination
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Modals
  const [showForm, setShowForm] = useState(false);
  const [editDirective, setEditDirective] = useState<AirworthinessDirective | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AirworthinessDirective | null>(null);
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

  // Fetch directives
  const fetchDirectives = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (filterAircraft) params.set('aircraftId', filterAircraft);
      if (filterStatus) params.set('status', filterStatus);
      params.set('page', String(page));
      params.set('pageSize', String(PAGE_SIZE));

      const data = await api.get<ADListResponse>(`/api/admin/maintenance/ads?${params.toString()}`);
      setDirectives(data.directives);
      setTotal(data.total);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load airworthiness directives';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [filterAircraft, filterStatus, page]);

  useEffect(() => {
    fetchFleet();
  }, [fetchFleet]);

  useEffect(() => {
    fetchDirectives();
  }, [fetchDirectives]);

  // ── Filter Handlers ───────────────────────────────────────

  const handleFilterAircraft = useCallback((val: string) => {
    setFilterAircraft(val);
    setPage(1);
  }, []);

  const handleFilterStatus = useCallback((val: string) => {
    setFilterStatus(val);
    setPage(1);
  }, []);

  const resetFilters = useCallback(() => {
    setFilterAircraft('');
    setFilterStatus('');
    setPage(1);
  }, []);

  // ── Action Handlers ───────────────────────────────────────

  const handleEdit = useCallback((ad: AirworthinessDirective) => {
    setEditDirective(ad);
    setShowForm(true);
  }, []);

  const handleCreate = useCallback(() => {
    setEditDirective(null);
    setShowForm(true);
  }, []);

  const handleFormClose = useCallback(() => {
    setShowForm(false);
    setEditDirective(null);
  }, []);

  const handleFormSaved = useCallback(() => {
    setShowForm(false);
    setEditDirective(null);
    fetchDirectives();
  }, [fetchDirectives]);

  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return;
    setActionLoading(true);
    try {
      await api.delete(`/api/admin/maintenance/ads/${deleteTarget.id}`);
      toast.success(`AD "${deleteTarget.adNumber}" deleted`);
      setDeleteTarget(null);
      fetchDirectives();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to delete directive';
      toast.error(message);
    } finally {
      setActionLoading(false);
    }
  }, [deleteTarget, fetchDirectives]);

  // ── Loading State ─────────────────────────────────────────

  if (loading && directives.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <SpinnerGap className="w-6 h-6 text-blue-400 animate-spin" />
      </div>
    );
  }

  if (error && directives.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <WarningCircle className="w-10 h-10 text-red-400/40" />
        <p className="text-sm text-red-400">{error}</p>
        <button
          onClick={fetchDirectives}
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

          {/* Status */}
          <div>
            <label className={LABEL_CLS}>Status</label>
            <select
              value={filterStatus}
              onChange={(e) => handleFilterStatus(e.target.value)}
              className={`${SELECT_CLS} w-40`}
            >
              <option value="">All Statuses</option>
              {STATUS_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
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

          {/* New AD */}
          <button
            onClick={handleCreate}
            className="inline-flex items-center gap-1.5 px-4 h-9 rounded-md text-xs font-semibold text-white bg-blue-500 hover:bg-blue-500/80 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" weight="bold" />
            New AD
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {directives.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 gap-3">
            <ShieldWarning className="w-10 h-10 text-acars-muted/30" />
            <p className="text-sm text-acars-muted">No airworthiness directives found</p>
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead className="sticky top-0 z-10 bg-acars-panel">
              <tr className="text-[10px] uppercase tracking-wider text-acars-muted border-b border-acars-border">
                <th className="text-left px-4 py-2.5 font-medium">AD Number</th>
                <th className="text-left px-3 py-2.5 font-medium">Aircraft</th>
                <th className="text-left px-3 py-2.5 font-medium">Title</th>
                <th className="text-center px-3 py-2.5 font-medium">Status</th>
                <th className="text-left px-3 py-2.5 font-medium">Compliance Date</th>
                <th className="text-left px-3 py-2.5 font-medium">Next Due</th>
                <th className="text-center px-3 py-2.5 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {directives.map((ad) => (
                <tr
                  key={ad.id}
                  className="border-b border-acars-border hover:bg-acars-hover transition-colors"
                >
                  <td className="px-4 py-2.5">
                    <span className="font-mono font-semibold text-acars-text">
                      {ad.adNumber}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="font-mono font-semibold text-acars-text">
                      {ad.aircraftRegistration ?? `ID:${ad.aircraftId}`}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="text-acars-text truncate max-w-[200px] block" title={ad.title}>
                      {ad.title}
                    </span>
                    {ad.description && (
                      <span className="text-acars-muted text-[10px] truncate max-w-[200px] block">
                        {ad.description}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <ComplianceBadge status={ad.complianceStatus} />
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="font-mono text-acars-text tabular-nums">
                      {formatDate(ad.complianceDate)}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="font-mono text-acars-text tabular-nums">
                      {formatNextDue(ad.nextDueHours, ad.nextDueDate)}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      <button
                        onClick={() => handleEdit(ad)}
                        className="p-1.5 rounded-md text-blue-400 bg-blue-500/10 border border-blue-400/20 hover:bg-blue-500/20 transition-colors"
                        title="Edit"
                      >
                        <PencilSimple className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(ad)}
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
            Showing {(page - 1) * PAGE_SIZE + 1}--{Math.min(page * PAGE_SIZE, total)} of {total} directives
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
        <ADFormModal
          editDirective={editDirective}
          fleet={fleet}
          onClose={handleFormClose}
          onSaved={handleFormSaved}
        />
      )}

      {/* Delete Confirm Modal */}
      {deleteTarget && (
        <ConfirmModal
          title="Delete Airworthiness Directive"
          message={`Are you sure you want to delete AD "${deleteTarget.adNumber}"? This action cannot be undone.`}
          confirmLabel="Delete"
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
          loading={actionLoading}
        />
      )}
    </div>
  );
}
