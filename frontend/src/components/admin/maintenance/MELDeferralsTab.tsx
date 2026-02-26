import { useState, useEffect, useCallback } from 'react';
import {
  SpinnerGap,
  Plus,
  PencilSimple,
  Trash,
  X,
  Wrench,
  WarningCircle,
  ListChecks,
  CaretLeft,
  CaretRight,
  ArrowCounterClockwise,
  CheckCircle,
} from '@phosphor-icons/react';
import { api } from '../../../lib/api';
import { toast } from '../../../stores/toastStore';
import type {
  MELDeferral,
  MELCategory,
  MELStatus,
  MELListResponse,
  CreateMELRequest,
  UpdateMELRequest,
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

const STATUS_OPTIONS: { value: MELStatus; label: string }[] = [
  { value: 'open', label: 'Open' },
  { value: 'rectified', label: 'Rectified' },
  { value: 'expired', label: 'Expired' },
];

const CATEGORY_OPTIONS: { value: MELCategory; label: string }[] = [
  { value: 'A', label: 'Cat A' },
  { value: 'B', label: 'Cat B' },
  { value: 'C', label: 'Cat C' },
  { value: 'D', label: 'Cat D' },
];

const CATEGORY_BADGE: Record<MELCategory, { bg: string; text: string; border: string; label: string }> = {
  A: { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-400/20', label: 'Cat A - repair by flight' },
  B: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-400/20', label: 'Cat B - 3 days' },
  C: { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-400/20', label: 'Cat C - 10 days' },
  D: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-400/20', label: 'Cat D - 120 days' },
};

const STATUS_BADGE: Record<MELStatus, { bg: string; text: string; border: string; label: string }> = {
  open: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-400/20', label: 'Open' },
  rectified: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-400/20', label: 'Rectified' },
  expired: { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-400/20', label: 'Expired' },
};

// ─── Helpers ────────────────────────────────────────────────────

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '--';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function isExpiredOpen(deferral: MELDeferral): boolean {
  if (deferral.status !== 'open') return false;
  const today = new Date().toISOString().split('T')[0];
  return deferral.expiryDate < today;
}

// ─── Category Badge ─────────────────────────────────────────────

function CategoryBadge({ category }: { category: MELCategory }) {
  const cfg = CATEGORY_BADGE[category];
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${cfg.bg} ${cfg.text} border ${cfg.border}`}
      title={cfg.label}
    >
      {cfg.label}
    </span>
  );
}

// ─── Status Badge ───────────────────────────────────────────────

function MELStatusBadge({ status }: { status: MELStatus }) {
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
  confirmColor?: 'red' | 'green';
}

function ConfirmModal({ title, message, confirmLabel, onConfirm, onCancel, loading, confirmColor = 'red' }: ConfirmModalProps) {
  const colorCls = confirmColor === 'green'
    ? 'bg-emerald-500 hover:bg-emerald-500/80'
    : 'bg-red-500 hover:bg-red-500/80';

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
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-md text-xs font-semibold text-white ${colorCls} transition-colors disabled:opacity-40 disabled:cursor-not-allowed`}
          >
            {loading && <SpinnerGap className="w-3.5 h-3.5 animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── MEL Form Modal ─────────────────────────────────────────────

interface FormData {
  aircraftId: string;
  itemNumber: string;
  title: string;
  category: MELCategory;
  deferralDate: string;
  expiryDate: string;
  remarks: string;
  status: MELStatus;
  rectifiedDate: string;
}

const EMPTY_FORM: FormData = {
  aircraftId: '',
  itemNumber: '',
  title: '',
  category: 'A',
  deferralDate: '',
  expiryDate: '',
  remarks: '',
  status: 'open',
  rectifiedDate: '',
};

function deferralToForm(d: MELDeferral): FormData {
  return {
    aircraftId: String(d.aircraftId),
    itemNumber: d.itemNumber,
    title: d.title,
    category: d.category,
    deferralDate: d.deferralDate ? d.deferralDate.slice(0, 10) : '',
    expiryDate: d.expiryDate ? d.expiryDate.slice(0, 10) : '',
    remarks: d.remarks ?? '',
    status: d.status,
    rectifiedDate: d.rectifiedDate ? d.rectifiedDate.slice(0, 10) : '',
  };
}

interface MELFormModalProps {
  editDeferral: MELDeferral | null;
  fleet: FleetMaintenanceStatus[];
  onClose: () => void;
  onSaved: () => void;
}

function MELFormModal({ editDeferral, fleet, onClose, onSaved }: MELFormModalProps) {
  const [form, setForm] = useState<FormData>(editDeferral ? deferralToForm(editDeferral) : EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const isEdit = editDeferral !== null;
  const canSubmit =
    form.aircraftId !== '' &&
    form.itemNumber.trim() !== '' &&
    form.title.trim() !== '' &&
    form.deferralDate !== '' &&
    form.expiryDate !== '' &&
    !submitting;

  const updateField = <K extends keyof FormData>(key: K, value: FormData[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError('');

    try {
      if (isEdit) {
        const body: UpdateMELRequest = {
          itemNumber: form.itemNumber.trim(),
          title: form.title.trim(),
          category: form.category,
          deferralDate: form.deferralDate,
          expiryDate: form.expiryDate,
          remarks: form.remarks.trim() || undefined,
          status: form.status,
          rectifiedDate: form.status === 'rectified' ? (form.rectifiedDate || undefined) : undefined,
        };
        await api.patch(`/api/admin/maintenance/mel/${editDeferral.id}`, body);
        toast.success('MEL deferral updated');
      } else {
        const body: CreateMELRequest = {
          aircraftId: parseInt(form.aircraftId, 10),
          itemNumber: form.itemNumber.trim(),
          title: form.title.trim(),
          category: form.category,
          deferralDate: form.deferralDate,
          expiryDate: form.expiryDate,
          remarks: form.remarks.trim() || undefined,
        };
        await api.post('/api/admin/maintenance/mel', body);
        toast.success('MEL deferral created');
      }
      onSaved();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save MEL deferral';
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
              <ListChecks className="w-4 h-4 text-blue-400" />
            </div>
            <div>
              <h2 className="text-[13px] font-semibold text-acars-text">
                {isEdit ? 'Edit MEL Deferral' : 'New MEL Deferral'}
              </h2>
              <p className="text-[10px] text-acars-muted">
                {isEdit
                  ? `Editing item ${editDeferral.itemNumber}`
                  : 'Create a new MEL deferral record'}
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
          {/* Row: Aircraft + Item Number */}
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
              <label className={LABEL_CLS}>Item Number *</label>
              <input
                type="text"
                value={form.itemNumber}
                onChange={(e) => updateField('itemNumber', e.target.value)}
                placeholder="e.g. 24-30-01"
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
              placeholder="e.g. Cabin lighting panel inoperative"
              className={INPUT_CLS}
            />
          </div>

          {/* Row: Category + Deferral Date */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={LABEL_CLS}>Category *</label>
              <select
                value={form.category}
                onChange={(e) => updateField('category', e.target.value as MELCategory)}
                className={SELECT_CLS}
              >
                {CATEGORY_OPTIONS.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={LABEL_CLS}>Deferral Date *</label>
              <input
                type="date"
                value={form.deferralDate}
                onChange={(e) => updateField('deferralDate', e.target.value)}
                className={INPUT_CLS}
              />
            </div>
          </div>

          {/* Expiry Date */}
          <div>
            <label className={LABEL_CLS}>Expiry Date *</label>
            <input
              type="date"
              value={form.expiryDate}
              onChange={(e) => updateField('expiryDate', e.target.value)}
              className={INPUT_CLS}
            />
          </div>

          {/* Remarks */}
          <div>
            <label className={LABEL_CLS}>Remarks</label>
            <textarea
              value={form.remarks}
              onChange={(e) => updateField('remarks', e.target.value)}
              rows={3}
              placeholder="Optional notes about this deferral..."
              className="input-field text-xs resize-none"
            />
          </div>

          {/* Edit-only fields: Status + Rectified Date */}
          {isEdit && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={LABEL_CLS}>Status</label>
                  <select
                    value={form.status}
                    onChange={(e) => updateField('status', e.target.value as MELStatus)}
                    className={SELECT_CLS}
                  >
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </div>
                {form.status === 'rectified' && (
                  <div>
                    <label className={LABEL_CLS}>Rectified Date</label>
                    <input
                      type="date"
                      value={form.rectifiedDate}
                      onChange={(e) => updateField('rectifiedDate', e.target.value)}
                      className={INPUT_CLS}
                    />
                  </div>
                )}
              </div>
            </>
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
            {isEdit ? 'Save Changes' : 'Create Deferral'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── MEL Deferrals Tab (Main Export) ────────────────────────────

export function MELDeferralsTab() {
  // Data
  const [deferrals, setDeferrals] = useState<MELDeferral[]>([]);
  const [total, setTotal] = useState(0);
  const [fleet, setFleet] = useState<FleetMaintenanceStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters
  const [filterAircraft, setFilterAircraft] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterCategory, setFilterCategory] = useState('');

  // Pagination
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Modals
  const [showForm, setShowForm] = useState(false);
  const [editDeferral, setEditDeferral] = useState<MELDeferral | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MELDeferral | null>(null);
  const [rectifyTarget, setRectifyTarget] = useState<MELDeferral | null>(null);
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

  // Fetch deferrals
  const fetchDeferrals = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (filterAircraft) params.set('aircraftId', filterAircraft);
      if (filterStatus) params.set('status', filterStatus);
      if (filterCategory) params.set('category', filterCategory);
      params.set('page', String(page));
      params.set('pageSize', String(PAGE_SIZE));

      const data = await api.get<MELListResponse>(`/api/admin/maintenance/mel?${params.toString()}`);
      setDeferrals(data.deferrals);
      setTotal(data.total);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load MEL deferrals';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [filterAircraft, filterStatus, filterCategory, page]);

  useEffect(() => {
    fetchFleet();
  }, [fetchFleet]);

  useEffect(() => {
    fetchDeferrals();
  }, [fetchDeferrals]);

  // ── Filter Handlers ───────────────────────────────────────

  const handleFilterAircraft = useCallback((val: string) => {
    setFilterAircraft(val);
    setPage(1);
  }, []);

  const handleFilterStatus = useCallback((val: string) => {
    setFilterStatus(val);
    setPage(1);
  }, []);

  const handleFilterCategory = useCallback((val: string) => {
    setFilterCategory(val);
    setPage(1);
  }, []);

  const resetFilters = useCallback(() => {
    setFilterAircraft('');
    setFilterStatus('');
    setFilterCategory('');
    setPage(1);
  }, []);

  // ── Action Handlers ───────────────────────────────────────

  const handleEdit = useCallback((d: MELDeferral) => {
    setEditDeferral(d);
    setShowForm(true);
  }, []);

  const handleCreate = useCallback(() => {
    setEditDeferral(null);
    setShowForm(true);
  }, []);

  const handleFormClose = useCallback(() => {
    setShowForm(false);
    setEditDeferral(null);
  }, []);

  const handleFormSaved = useCallback(() => {
    setShowForm(false);
    setEditDeferral(null);
    fetchDeferrals();
  }, [fetchDeferrals]);

  const handleRectify = useCallback(async () => {
    if (!rectifyTarget) return;
    setActionLoading(true);
    try {
      await api.patch(`/api/admin/maintenance/mel/${rectifyTarget.id}`, {
        status: 'rectified',
        rectifiedDate: new Date().toISOString().split('T')[0],
      });
      toast.success(`"${rectifyTarget.itemNumber}" marked as rectified`);
      setRectifyTarget(null);
      fetchDeferrals();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to rectify deferral';
      toast.error(message);
    } finally {
      setActionLoading(false);
    }
  }, [rectifyTarget, fetchDeferrals]);

  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return;
    setActionLoading(true);
    try {
      await api.delete(`/api/admin/maintenance/mel/${deleteTarget.id}`);
      toast.success(`"${deleteTarget.itemNumber}" deleted`);
      setDeleteTarget(null);
      fetchDeferrals();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to delete deferral';
      toast.error(message);
    } finally {
      setActionLoading(false);
    }
  }, [deleteTarget, fetchDeferrals]);

  // ── Loading State ─────────────────────────────────────────

  if (loading && deferrals.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <SpinnerGap className="w-6 h-6 text-blue-400 animate-spin" />
      </div>
    );
  }

  if (error && deferrals.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <WarningCircle className="w-10 h-10 text-red-400/40" />
        <p className="text-sm text-red-400">{error}</p>
        <button
          onClick={fetchDeferrals}
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
              className={`${SELECT_CLS} w-36`}
            >
              <option value="">All Statuses</option>
              {STATUS_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>

          {/* Category */}
          <div>
            <label className={LABEL_CLS}>Category</label>
            <select
              value={filterCategory}
              onChange={(e) => handleFilterCategory(e.target.value)}
              className={`${SELECT_CLS} w-32`}
            >
              <option value="">All</option>
              {CATEGORY_OPTIONS.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
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

          {/* New Deferral */}
          <button
            onClick={handleCreate}
            className="inline-flex items-center gap-1.5 px-4 h-9 rounded-md text-xs font-semibold text-white bg-blue-500 hover:bg-blue-500/80 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" weight="bold" />
            New Deferral
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {deferrals.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 gap-3">
            <ListChecks className="w-10 h-10 text-acars-muted/30" />
            <p className="text-sm text-acars-muted">No MEL deferrals found</p>
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead className="sticky top-0 z-10 bg-acars-panel">
              <tr className="text-[10px] uppercase tracking-wider text-acars-muted border-b border-acars-border">
                <th className="text-left px-4 py-2.5 font-medium">Item Number</th>
                <th className="text-left px-3 py-2.5 font-medium">Aircraft</th>
                <th className="text-left px-3 py-2.5 font-medium">Title</th>
                <th className="text-center px-3 py-2.5 font-medium">Category</th>
                <th className="text-left px-3 py-2.5 font-medium">Deferral Date</th>
                <th className="text-left px-3 py-2.5 font-medium">Expiry Date</th>
                <th className="text-center px-3 py-2.5 font-medium">Status</th>
                <th className="text-center px-3 py-2.5 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {deferrals.map((d) => {
                const expiredOpen = isExpiredOpen(d);
                return (
                  <tr
                    key={d.id}
                    className={`border-b border-acars-border hover:bg-acars-hover transition-colors ${
                      expiredOpen ? 'bg-red-500/5' : ''
                    }`}
                  >
                    <td className="px-4 py-2.5">
                      <span className="font-mono font-semibold text-acars-text">
                        {d.itemNumber}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="font-mono font-semibold text-acars-text">
                        {d.aircraftRegistration ?? `ID:${d.aircraftId}`}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="text-acars-text truncate max-w-[200px] block" title={d.title}>
                        {d.title}
                      </span>
                      {d.remarks && (
                        <span className="text-acars-muted text-[10px] truncate max-w-[200px] block">
                          {d.remarks}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <CategoryBadge category={d.category} />
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="font-mono text-acars-text tabular-nums">
                        {formatDate(d.deferralDate)}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span
                        className={`font-mono tabular-nums ${
                          expiredOpen ? 'text-red-400 font-semibold' : 'text-acars-text'
                        }`}
                      >
                        {formatDate(d.expiryDate)}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <MELStatusBadge status={d.status} />
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        {/* Edit */}
                        <button
                          onClick={() => handleEdit(d)}
                          className="p-1.5 rounded-md text-blue-400 bg-blue-500/10 border border-blue-400/20 hover:bg-blue-500/20 transition-colors"
                          title="Edit"
                        >
                          <PencilSimple className="w-3.5 h-3.5" />
                        </button>

                        {/* Rectify (only for open items) */}
                        {d.status === 'open' && (
                          <button
                            onClick={() => setRectifyTarget(d)}
                            className="p-1.5 rounded-md text-emerald-400 bg-emerald-500/10 border border-emerald-400/20 hover:bg-emerald-500/20 transition-colors"
                            title="Rectify"
                          >
                            <CheckCircle className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {/* Delete */}
                        <button
                          onClick={() => setDeleteTarget(d)}
                          className="p-1.5 rounded-md text-red-400 bg-red-500/10 border border-red-400/20 hover:bg-red-500/20 transition-colors"
                          title="Delete"
                        >
                          <Trash className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {total > PAGE_SIZE && (
        <div className="flex-none flex items-center justify-between px-4 py-3 border-t border-acars-border">
          <span className="text-[11px] text-acars-muted">
            Showing {(page - 1) * PAGE_SIZE + 1}--{Math.min(page * PAGE_SIZE, total)} of {total} deferrals
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
        <MELFormModal
          editDeferral={editDeferral}
          fleet={fleet}
          onClose={handleFormClose}
          onSaved={handleFormSaved}
        />
      )}

      {/* Rectify Confirm Modal */}
      {rectifyTarget && (
        <ConfirmModal
          title="Rectify MEL Deferral"
          message={`Are you sure you want to mark item "${rectifyTarget.itemNumber}" as rectified? The rectified date will be set to today.`}
          confirmLabel="Rectify"
          onConfirm={handleRectify}
          onCancel={() => setRectifyTarget(null)}
          loading={actionLoading}
          confirmColor="green"
        />
      )}

      {/* Delete Confirm Modal */}
      {deleteTarget && (
        <ConfirmModal
          title="Delete MEL Deferral"
          message={`Are you sure you want to delete item "${deleteTarget.itemNumber}"? This action cannot be undone.`}
          confirmLabel="Delete"
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
          loading={actionLoading}
        />
      )}
    </div>
  );
}
