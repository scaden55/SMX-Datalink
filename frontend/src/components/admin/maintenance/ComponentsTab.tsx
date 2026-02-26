import { useState, useEffect, useCallback } from 'react';
import {
  SpinnerGap,
  Plus,
  PencilSimple,
  Trash,
  X,
  GearSix,
  WarningCircle,
  ArrowCounterClockwise,
} from '@phosphor-icons/react';
import { api } from '../../../lib/api';
import { toast } from '../../../stores/toastStore';
import type {
  AircraftComponent,
  ComponentType,
  ComponentStatus,
  CreateComponentRequest,
  UpdateComponentRequest,
  FleetMaintenanceStatus,
} from '@acars/shared';

// ─── Types ──────────────────────────────────────────────────────

interface ComponentListResponse {
  components: AircraftComponent[];
}

interface FleetStatusResponse {
  fleet: FleetMaintenanceStatus[];
}

// ─── Constants ──────────────────────────────────────────────────

const LABEL_CLS =
  'text-[10px] uppercase tracking-wider text-acars-muted font-medium mb-1.5 block';
const INPUT_CLS = 'input-field text-xs font-mono h-9';
const SELECT_CLS = 'select-field text-xs font-mono h-9';

const COMPONENT_TYPE_OPTIONS: { value: ComponentType; label: string }[] = [
  { value: 'ENGINE', label: 'Engine' },
  { value: 'APU', label: 'APU' },
  { value: 'LANDING_GEAR', label: 'Landing Gear' },
  { value: 'PROP', label: 'Prop' },
  { value: 'AVIONICS', label: 'Avionics' },
  { value: 'OTHER', label: 'Other' },
];

const STATUS_OPTIONS: { value: ComponentStatus; label: string }[] = [
  { value: 'installed', label: 'Installed' },
  { value: 'removed', label: 'Removed' },
  { value: 'in_shop', label: 'In Shop' },
  { value: 'scrapped', label: 'Scrapped' },
];

const COMPONENT_TYPE_BADGE: Record<ComponentType, { bg: string; text: string; border: string; label: string }> = {
  ENGINE: { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-400/20', label: 'Engine' },
  APU: { bg: 'bg-purple-500/10', text: 'text-purple-400', border: 'border-purple-400/20', label: 'APU' },
  LANDING_GEAR: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-400/20', label: 'Landing Gear' },
  PROP: { bg: 'bg-cyan-500/10', text: 'text-cyan-400', border: 'border-cyan-400/20', label: 'Prop' },
  AVIONICS: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-400/20', label: 'Avionics' },
  OTHER: { bg: 'bg-zinc-500/10', text: 'text-zinc-400', border: 'border-zinc-400/20', label: 'Other' },
};

const STATUS_BADGE: Record<ComponentStatus, { bg: string; text: string; border: string; label: string }> = {
  installed: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-400/20', label: 'Installed' },
  removed: { bg: 'bg-zinc-500/10', text: 'text-zinc-400', border: 'border-zinc-400/20', label: 'Removed' },
  in_shop: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-400/20', label: 'In Shop' },
  scrapped: { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-400/20', label: 'Scrapped' },
};

// ─── Component Type Badge ────────────────────────────────────────

function TypeBadge({ type }: { type: ComponentType }) {
  const cfg = COMPONENT_TYPE_BADGE[type];
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${cfg.bg} ${cfg.text} border ${cfg.border}`}
    >
      {cfg.label}
    </span>
  );
}

// ─── Status Badge ───────────────────────────────────────────────

function CompStatusBadge({ status }: { status: ComponentStatus }) {
  const cfg = STATUS_BADGE[status];
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${cfg.bg} ${cfg.text} border ${cfg.border}`}
    >
      {cfg.label}
    </span>
  );
}

// ─── Overhaul Life Bar ──────────────────────────────────────────

function OverhaulLifeBar({ tso, interval }: { tso: number; interval: number | null }) {
  if (interval == null || interval === 0) {
    return <span className="text-[10px] text-acars-muted">N/A</span>;
  }

  const pct = Math.min((tso / interval) * 100, 100);
  const barColor =
    pct > 90 ? 'bg-red-500' : pct >= 70 ? 'bg-amber-500' : 'bg-emerald-500';

  return (
    <div className="min-w-[120px]">
      <div className="w-full h-2 rounded-full bg-acars-bg border border-acars-border overflow-hidden">
        <div
          className={`h-full rounded-full ${barColor} transition-all`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[10px] font-mono text-acars-muted tabular-nums mt-0.5 block">
        {tso.toFixed(1)} / {interval.toFixed(1)}h ({Math.round(pct)}%)
      </span>
    </div>
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

// ─── Component Form Modal ───────────────────────────────────────

interface FormData {
  aircraftId: string;
  componentType: ComponentType;
  position: string;
  serialNumber: string;
  partNumber: string;
  hoursSinceNew: string;
  cyclesSinceNew: string;
  hoursSinceOverhaul: string;
  cyclesSinceOverhaul: string;
  overhaulIntervalHours: string;
  installedDate: string;
  status: ComponentStatus;
  remarks: string;
}

const EMPTY_FORM: FormData = {
  aircraftId: '',
  componentType: 'ENGINE',
  position: '',
  serialNumber: '',
  partNumber: '',
  hoursSinceNew: '0',
  cyclesSinceNew: '0',
  hoursSinceOverhaul: '0',
  cyclesSinceOverhaul: '0',
  overhaulIntervalHours: '',
  installedDate: '',
  status: 'installed',
  remarks: '',
};

function componentToForm(c: AircraftComponent): FormData {
  return {
    aircraftId: String(c.aircraftId),
    componentType: c.componentType,
    position: c.position ?? '',
    serialNumber: c.serialNumber ?? '',
    partNumber: c.partNumber ?? '',
    hoursSinceNew: String(c.hoursSinceNew),
    cyclesSinceNew: String(c.cyclesSinceNew),
    hoursSinceOverhaul: String(c.hoursSinceOverhaul),
    cyclesSinceOverhaul: String(c.cyclesSinceOverhaul),
    overhaulIntervalHours: c.overhaulIntervalHours != null ? String(c.overhaulIntervalHours) : '',
    installedDate: c.installedDate ? c.installedDate.slice(0, 10) : '',
    status: c.status,
    remarks: c.remarks ?? '',
  };
}

interface ComponentFormModalProps {
  editComponent: AircraftComponent | null;
  fleet: FleetMaintenanceStatus[];
  onClose: () => void;
  onSaved: () => void;
}

function ComponentFormModal({ editComponent, fleet, onClose, onSaved }: ComponentFormModalProps) {
  const [form, setForm] = useState<FormData>(editComponent ? componentToForm(editComponent) : EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const isEdit = editComponent !== null;
  const canSubmit = form.aircraftId !== '' && !submitting;

  const updateField = <K extends keyof FormData>(key: K, value: FormData[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError('');

    try {
      if (isEdit) {
        const body: UpdateComponentRequest = {
          componentType: form.componentType,
          position: form.position.trim() || undefined,
          serialNumber: form.serialNumber.trim() || undefined,
          partNumber: form.partNumber.trim() || undefined,
          hoursSinceNew: form.hoursSinceNew ? parseFloat(form.hoursSinceNew) : undefined,
          cyclesSinceNew: form.cyclesSinceNew ? parseInt(form.cyclesSinceNew, 10) : undefined,
          hoursSinceOverhaul: form.hoursSinceOverhaul ? parseFloat(form.hoursSinceOverhaul) : undefined,
          cyclesSinceOverhaul: form.cyclesSinceOverhaul ? parseInt(form.cyclesSinceOverhaul, 10) : undefined,
          overhaulIntervalHours: form.overhaulIntervalHours ? parseFloat(form.overhaulIntervalHours) : undefined,
          installedDate: form.installedDate || undefined,
          status: form.status,
          remarks: form.remarks.trim() || undefined,
        };
        await api.patch(`/api/admin/maintenance/components/${editComponent.id}`, body);
        toast.success('Component updated');
      } else {
        const body: CreateComponentRequest = {
          aircraftId: parseInt(form.aircraftId, 10),
          componentType: form.componentType,
          position: form.position.trim() || undefined,
          serialNumber: form.serialNumber.trim() || undefined,
          partNumber: form.partNumber.trim() || undefined,
          hoursSinceNew: form.hoursSinceNew ? parseFloat(form.hoursSinceNew) : undefined,
          cyclesSinceNew: form.cyclesSinceNew ? parseInt(form.cyclesSinceNew, 10) : undefined,
          hoursSinceOverhaul: form.hoursSinceOverhaul ? parseFloat(form.hoursSinceOverhaul) : undefined,
          cyclesSinceOverhaul: form.cyclesSinceOverhaul ? parseInt(form.cyclesSinceOverhaul, 10) : undefined,
          overhaulIntervalHours: form.overhaulIntervalHours ? parseFloat(form.overhaulIntervalHours) : undefined,
          installedDate: form.installedDate || undefined,
          status: form.status,
          remarks: form.remarks.trim() || undefined,
        };
        await api.post('/api/admin/maintenance/components', body);
        toast.success('Component created');
      }
      onSaved();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save component';
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
              <GearSix className="w-4 h-4 text-blue-400" />
            </div>
            <div>
              <h2 className="text-[13px] font-semibold text-acars-text">
                {isEdit ? 'Edit Component' : 'New Component'}
              </h2>
              <p className="text-[10px] text-acars-muted">
                {isEdit
                  ? `Editing ${editComponent.componentType} ${editComponent.serialNumber ?? ''}`
                  : 'Add a tracked component to an aircraft'}
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
          {/* Row: Aircraft + Component Type */}
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
              <label className={LABEL_CLS}>Component Type *</label>
              <select
                value={form.componentType}
                onChange={(e) => updateField('componentType', e.target.value as ComponentType)}
                className={SELECT_CLS}
              >
                {COMPONENT_TYPE_OPTIONS.map((ct) => (
                  <option key={ct.value} value={ct.value}>{ct.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Row: Position + Status */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={LABEL_CLS}>Position</label>
              <input
                type="text"
                value={form.position}
                onChange={(e) => updateField('position', e.target.value)}
                placeholder="e.g. L, R, #1, #2, NOSE"
                className={INPUT_CLS}
              />
            </div>
            <div>
              <label className={LABEL_CLS}>Status</label>
              <select
                value={form.status}
                onChange={(e) => updateField('status', e.target.value as ComponentStatus)}
                className={SELECT_CLS}
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Row: Serial Number + Part Number */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={LABEL_CLS}>Serial Number</label>
              <input
                type="text"
                value={form.serialNumber}
                onChange={(e) => updateField('serialNumber', e.target.value)}
                placeholder="e.g. SN-12345"
                className={INPUT_CLS}
              />
            </div>
            <div>
              <label className={LABEL_CLS}>Part Number</label>
              <input
                type="text"
                value={form.partNumber}
                onChange={(e) => updateField('partNumber', e.target.value)}
                placeholder="e.g. PN-67890"
                className={INPUT_CLS}
              />
            </div>
          </div>

          {/* Row: Hours Since New + Cycles Since New */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={LABEL_CLS}>Hours Since New</label>
              <input
                type="number"
                step="0.1"
                min="0"
                value={form.hoursSinceNew}
                onChange={(e) => updateField('hoursSinceNew', e.target.value)}
                className={INPUT_CLS}
              />
            </div>
            <div>
              <label className={LABEL_CLS}>Cycles Since New</label>
              <input
                type="number"
                step="1"
                min="0"
                value={form.cyclesSinceNew}
                onChange={(e) => updateField('cyclesSinceNew', e.target.value)}
                className={INPUT_CLS}
              />
            </div>
          </div>

          {/* Row: Hours Since Overhaul + Cycles Since Overhaul */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={LABEL_CLS}>Hours Since Overhaul</label>
              <input
                type="number"
                step="0.1"
                min="0"
                value={form.hoursSinceOverhaul}
                onChange={(e) => updateField('hoursSinceOverhaul', e.target.value)}
                className={INPUT_CLS}
              />
            </div>
            <div>
              <label className={LABEL_CLS}>Cycles Since Overhaul</label>
              <input
                type="number"
                step="1"
                min="0"
                value={form.cyclesSinceOverhaul}
                onChange={(e) => updateField('cyclesSinceOverhaul', e.target.value)}
                className={INPUT_CLS}
              />
            </div>
          </div>

          {/* Row: Overhaul Interval + Installed Date */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={LABEL_CLS}>Overhaul Interval (hours)</label>
              <input
                type="number"
                step="0.1"
                min="0"
                value={form.overhaulIntervalHours}
                onChange={(e) => updateField('overhaulIntervalHours', e.target.value)}
                placeholder="e.g. 3000"
                className={INPUT_CLS}
              />
            </div>
            <div>
              <label className={LABEL_CLS}>Installed Date</label>
              <input
                type="date"
                value={form.installedDate}
                onChange={(e) => updateField('installedDate', e.target.value)}
                className={INPUT_CLS}
              />
            </div>
          </div>

          {/* Remarks */}
          <div>
            <label className={LABEL_CLS}>Remarks</label>
            <textarea
              value={form.remarks}
              onChange={(e) => updateField('remarks', e.target.value)}
              rows={3}
              placeholder="Optional notes about this component..."
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
              <GearSix className="w-3.5 h-3.5" />
            )}
            {isEdit ? 'Save Changes' : 'Create Component'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Components Tab (Main Export) ────────────────────────────────

export function ComponentsTab() {
  // Data
  const [components, setComponents] = useState<AircraftComponent[]>([]);
  const [fleet, setFleet] = useState<FleetMaintenanceStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters
  const [filterAircraft, setFilterAircraft] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  // Modals
  const [showForm, setShowForm] = useState(false);
  const [editComponent, setEditComponent] = useState<AircraftComponent | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AircraftComponent | null>(null);
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

  // Fetch components
  const fetchComponents = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (filterAircraft) params.set('aircraftId', filterAircraft);
      if (filterType) params.set('componentType', filterType);
      if (filterStatus) params.set('status', filterStatus);

      const qs = params.toString();
      const url = `/api/admin/maintenance/components${qs ? `?${qs}` : ''}`;
      const data = await api.get<ComponentListResponse>(url);
      setComponents(data.components);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load components';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [filterAircraft, filterType, filterStatus]);

  useEffect(() => {
    fetchFleet();
  }, [fetchFleet]);

  useEffect(() => {
    fetchComponents();
  }, [fetchComponents]);

  // ── Filter Handlers ───────────────────────────────────────

  const handleFilterAircraft = useCallback((val: string) => {
    setFilterAircraft(val);
  }, []);

  const handleFilterType = useCallback((val: string) => {
    setFilterType(val);
  }, []);

  const handleFilterStatus = useCallback((val: string) => {
    setFilterStatus(val);
  }, []);

  const resetFilters = useCallback(() => {
    setFilterAircraft('');
    setFilterType('');
    setFilterStatus('');
  }, []);

  // ── Action Handlers ───────────────────────────────────────

  const handleEdit = useCallback((c: AircraftComponent) => {
    setEditComponent(c);
    setShowForm(true);
  }, []);

  const handleCreate = useCallback(() => {
    setEditComponent(null);
    setShowForm(true);
  }, []);

  const handleFormClose = useCallback(() => {
    setShowForm(false);
    setEditComponent(null);
  }, []);

  const handleFormSaved = useCallback(() => {
    setShowForm(false);
    setEditComponent(null);
    fetchComponents();
  }, [fetchComponents]);

  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return;
    setActionLoading(true);
    try {
      await api.delete(`/api/admin/maintenance/components/${deleteTarget.id}`);
      toast.success(`Component ${deleteTarget.serialNumber ?? deleteTarget.componentType} deleted`);
      setDeleteTarget(null);
      fetchComponents();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to delete component';
      toast.error(message);
    } finally {
      setActionLoading(false);
    }
  }, [deleteTarget, fetchComponents]);

  // ── Loading State ─────────────────────────────────────────

  if (loading && components.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <SpinnerGap className="w-6 h-6 text-blue-400 animate-spin" />
      </div>
    );
  }

  if (error && components.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <WarningCircle className="w-10 h-10 text-red-400/40" />
        <p className="text-sm text-red-400">{error}</p>
        <button
          onClick={fetchComponents}
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

          {/* Component Type */}
          <div>
            <label className={LABEL_CLS}>Component Type</label>
            <select
              value={filterType}
              onChange={(e) => handleFilterType(e.target.value)}
              className={`${SELECT_CLS} w-40`}
            >
              <option value="">All Types</option>
              {COMPONENT_TYPE_OPTIONS.map((ct) => (
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

          {/* Add Component */}
          <button
            onClick={handleCreate}
            className="inline-flex items-center gap-1.5 px-4 h-9 rounded-md text-xs font-semibold text-white bg-blue-500 hover:bg-blue-500/80 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" weight="bold" />
            Add Component
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {components.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 gap-3">
            <GearSix className="w-10 h-10 text-acars-muted/30" />
            <p className="text-sm text-acars-muted">No components found</p>
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead className="sticky top-0 z-10 bg-acars-panel">
              <tr className="text-[10px] uppercase tracking-wider text-acars-muted border-b border-acars-border">
                <th className="text-left px-4 py-2.5 font-medium">Aircraft</th>
                <th className="text-left px-3 py-2.5 font-medium">Type</th>
                <th className="text-left px-3 py-2.5 font-medium">Position</th>
                <th className="text-left px-3 py-2.5 font-medium">Serial Number</th>
                <th className="text-right px-3 py-2.5 font-medium">TSN Hours</th>
                <th className="text-right px-3 py-2.5 font-medium">CSN Cycles</th>
                <th className="text-right px-3 py-2.5 font-medium">TSO Hours</th>
                <th className="text-left px-3 py-2.5 font-medium">Overhaul Life</th>
                <th className="text-center px-3 py-2.5 font-medium">Status</th>
                <th className="text-center px-3 py-2.5 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {components.map((c) => (
                <tr
                  key={c.id}
                  className="border-b border-acars-border hover:bg-acars-hover transition-colors"
                >
                  <td className="px-4 py-2.5">
                    <span className="font-mono font-semibold text-acars-text">
                      {c.aircraftRegistration ?? `ID:${c.aircraftId}`}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <TypeBadge type={c.componentType} />
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="font-mono text-acars-text">
                      {c.position ?? '--'}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="font-mono text-acars-text">
                      {c.serialNumber ?? '--'}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <span className="font-mono text-acars-text tabular-nums">
                      {c.hoursSinceNew.toFixed(1)}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <span className="font-mono text-acars-text tabular-nums">
                      {c.cyclesSinceNew}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <span className="font-mono text-acars-text tabular-nums">
                      {c.hoursSinceOverhaul.toFixed(1)}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <OverhaulLifeBar tso={c.hoursSinceOverhaul} interval={c.overhaulIntervalHours} />
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <CompStatusBadge status={c.status} />
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      <button
                        onClick={() => handleEdit(c)}
                        className="p-1.5 rounded-md text-blue-400 bg-blue-500/10 border border-blue-400/20 hover:bg-blue-500/20 transition-colors"
                        title="Edit"
                      >
                        <PencilSimple className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(c)}
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

      {/* Form Modal */}
      {showForm && (
        <ComponentFormModal
          editComponent={editComponent}
          fleet={fleet}
          onClose={handleFormClose}
          onSaved={handleFormSaved}
        />
      )}

      {/* Delete Confirm Modal */}
      {deleteTarget && (
        <ConfirmModal
          title="Delete Component"
          message={`Are you sure you want to delete ${deleteTarget.componentType} ${deleteTarget.serialNumber ? `(${deleteTarget.serialNumber})` : ''}? This action cannot be undone.`}
          confirmLabel="Delete"
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
          loading={actionLoading}
        />
      )}
    </div>
  );
}
