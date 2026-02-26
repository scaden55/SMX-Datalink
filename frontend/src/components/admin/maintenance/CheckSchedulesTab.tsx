import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  SpinnerGap,
  Plus,
  PencilSimple,
  Trash,
  X,
  Wrench,
  WarningCircle,
  CalendarBlank,
} from '@phosphor-icons/react';
import { api } from '../../../lib/api';
import { toast } from '../../../stores/toastStore';
import type {
  MaintenanceCheckSchedule,
  MaintenanceCheckType,
  CreateCheckScheduleRequest,
  UpdateCheckScheduleRequest,
} from '@acars/shared';

// ─── Types ──────────────────────────────────────────────────────

interface ScheduleListResponse {
  schedules: MaintenanceCheckSchedule[];
}

// ─── Constants ──────────────────────────────────────────────────

const LABEL_CLS =
  'text-[10px] uppercase tracking-wider text-acars-muted font-medium mb-1.5 block';
const INPUT_CLS = 'input-field text-xs font-mono h-9';
const SELECT_CLS = 'select-field text-xs font-mono h-9';

const CHECK_TYPE_OPTIONS: { value: MaintenanceCheckType; label: string }[] = [
  { value: 'A', label: 'A-Check' },
  { value: 'B', label: 'B-Check' },
  { value: 'C', label: 'C-Check' },
  { value: 'D', label: 'D-Check' },
];

const CHECK_TYPE_BADGE: Record<MaintenanceCheckType, { bg: string; text: string; border: string }> = {
  A: { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-400/20' },
  B: { bg: 'bg-cyan-500/10', text: 'text-cyan-400', border: 'border-cyan-400/20' },
  C: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-400/20' },
  D: { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-400/20' },
};

// ─── Check Type Badge ───────────────────────────────────────────

function CheckTypeBadge({ type }: { type: MaintenanceCheckType }) {
  const cfg = CHECK_TYPE_BADGE[type];
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${cfg.bg} ${cfg.text} border ${cfg.border}`}
    >
      {type}-Check
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

// ─── Schedule Form Modal ────────────────────────────────────────

interface FormData {
  icaoType: string;
  checkType: MaintenanceCheckType;
  intervalHours: string;
  intervalCycles: string;
  intervalMonths: string;
  overflightPct: string;
  estimatedDurationHours: string;
  description: string;
}

const EMPTY_FORM: FormData = {
  icaoType: '',
  checkType: 'A',
  intervalHours: '',
  intervalCycles: '',
  intervalMonths: '',
  overflightPct: '',
  estimatedDurationHours: '',
  description: '',
};

function scheduleToForm(schedule: MaintenanceCheckSchedule): FormData {
  return {
    icaoType: schedule.icaoType,
    checkType: schedule.checkType,
    intervalHours: schedule.intervalHours != null ? String(schedule.intervalHours) : '',
    intervalCycles: schedule.intervalCycles != null ? String(schedule.intervalCycles) : '',
    intervalMonths: schedule.intervalMonths != null ? String(schedule.intervalMonths) : '',
    overflightPct: String(Math.round(schedule.overflightPct * 100)),
    estimatedDurationHours: schedule.estimatedDurationHours != null ? String(schedule.estimatedDurationHours) : '',
    description: schedule.description ?? '',
  };
}

interface ScheduleFormModalProps {
  editSchedule: MaintenanceCheckSchedule | null;
  onClose: () => void;
  onSaved: () => void;
}

function ScheduleFormModal({ editSchedule, onClose, onSaved }: ScheduleFormModalProps) {
  const [form, setForm] = useState<FormData>(editSchedule ? scheduleToForm(editSchedule) : EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const isEdit = editSchedule !== null;
  const canSubmit = form.icaoType.trim() !== '' && !submitting;

  const updateField = <K extends keyof FormData>(key: K, value: FormData[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError('');

    try {
      // Convert overflight from display % (e.g. 10) to decimal (e.g. 0.10)
      const overflightDecimal = form.overflightPct ? parseFloat(form.overflightPct) / 100 : undefined;

      if (isEdit) {
        const body: UpdateCheckScheduleRequest = {
          intervalHours: form.intervalHours ? parseFloat(form.intervalHours) : undefined,
          intervalCycles: form.intervalCycles ? parseInt(form.intervalCycles, 10) : undefined,
          intervalMonths: form.intervalMonths ? parseInt(form.intervalMonths, 10) : undefined,
          overflightPct: overflightDecimal,
          estimatedDurationHours: form.estimatedDurationHours ? parseFloat(form.estimatedDurationHours) : undefined,
          description: form.description.trim() || undefined,
        };
        await api.patch(`/api/admin/maintenance/check-schedules/${editSchedule.id}`, body);
        toast.success('Check schedule updated');
      } else {
        const body: CreateCheckScheduleRequest = {
          icaoType: form.icaoType.trim().toUpperCase(),
          checkType: form.checkType,
          intervalHours: form.intervalHours ? parseFloat(form.intervalHours) : undefined,
          intervalCycles: form.intervalCycles ? parseInt(form.intervalCycles, 10) : undefined,
          intervalMonths: form.intervalMonths ? parseInt(form.intervalMonths, 10) : undefined,
          overflightPct: overflightDecimal,
          estimatedDurationHours: form.estimatedDurationHours ? parseFloat(form.estimatedDurationHours) : undefined,
          description: form.description.trim() || undefined,
        };
        await api.post('/api/admin/maintenance/check-schedules', body);
        toast.success('Check schedule created');
      }
      onSaved();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save check schedule';
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
              <CalendarBlank className="w-4 h-4 text-blue-400" />
            </div>
            <div>
              <h2 className="text-[13px] font-semibold text-acars-text">
                {isEdit ? 'Edit Check Schedule' : 'New Check Schedule'}
              </h2>
              <p className="text-[10px] text-acars-muted">
                {isEdit
                  ? `Editing ${editSchedule.checkType}-Check for ${editSchedule.icaoType}`
                  : 'Define a maintenance check interval for an aircraft type'}
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
          {/* Row: ICAO Type + Check Type */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={LABEL_CLS}>ICAO Type *</label>
              <input
                type="text"
                value={form.icaoType}
                onChange={(e) => updateField('icaoType', e.target.value)}
                placeholder="e.g. B738"
                className={INPUT_CLS}
                disabled={isEdit}
              />
            </div>
            <div>
              <label className={LABEL_CLS}>Check Type *</label>
              <select
                value={form.checkType}
                onChange={(e) => updateField('checkType', e.target.value as MaintenanceCheckType)}
                className={SELECT_CLS}
                disabled={isEdit}
              >
                {CHECK_TYPE_OPTIONS.map((ct) => (
                  <option key={ct.value} value={ct.value}>{ct.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Row: Interval Hours + Interval Cycles */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={LABEL_CLS}>Interval Hours</label>
              <input
                type="number"
                step="0.1"
                value={form.intervalHours}
                onChange={(e) => updateField('intervalHours', e.target.value)}
                placeholder="e.g. 500"
                className={INPUT_CLS}
              />
            </div>
            <div>
              <label className={LABEL_CLS}>Interval Cycles</label>
              <input
                type="number"
                step="1"
                value={form.intervalCycles}
                onChange={(e) => updateField('intervalCycles', e.target.value)}
                placeholder="e.g. 300"
                className={INPUT_CLS}
              />
            </div>
          </div>

          {/* Row: Interval Months + Overflight % */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={LABEL_CLS}>Interval Months</label>
              <input
                type="number"
                step="1"
                value={form.intervalMonths}
                onChange={(e) => updateField('intervalMonths', e.target.value)}
                placeholder="e.g. 12"
                className={INPUT_CLS}
              />
            </div>
            <div>
              <label className={LABEL_CLS}>Overflight %</label>
              <input
                type="number"
                step="1"
                min="0"
                max="100"
                value={form.overflightPct}
                onChange={(e) => updateField('overflightPct', e.target.value)}
                placeholder="e.g. 10"
                className={INPUT_CLS}
              />
            </div>
          </div>

          {/* Estimated Duration */}
          <div>
            <label className={LABEL_CLS}>Estimated Duration (hours)</label>
            <input
              type="number"
              step="0.1"
              value={form.estimatedDurationHours}
              onChange={(e) => updateField('estimatedDurationHours', e.target.value)}
              placeholder="e.g. 8"
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
              placeholder="Optional notes about this check schedule..."
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
              <Wrench className="w-3.5 h-3.5" />
            )}
            {isEdit ? 'Save Changes' : 'Create Schedule'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Overflight Badge ───────────────────────────────────────────

function OverflightBadge({ pct }: { pct: number }) {
  if (pct === 0) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide bg-zinc-500/10 text-zinc-400 border border-zinc-400/20">
        No overflight
      </span>
    );
  }

  return (
    <span className="font-mono text-acars-text">
      {Math.round(pct * 100)}%
    </span>
  );
}

// ─── Check Schedules Tab (Main Export) ──────────────────────────

export function CheckSchedulesTab() {
  const [schedules, setSchedules] = useState<MaintenanceCheckSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Modals
  const [showForm, setShowForm] = useState(false);
  const [editSchedule, setEditSchedule] = useState<MaintenanceCheckSchedule | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MaintenanceCheckSchedule | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchSchedules = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.get<ScheduleListResponse>('/api/admin/maintenance/check-schedules');
      setSchedules(data.schedules);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load check schedules';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSchedules();
  }, [fetchSchedules]);

  // Group schedules by ICAO type
  const groupedSchedules = useMemo(() => {
    const groups = new Map<string, MaintenanceCheckSchedule[]>();
    // Sort by icaoType then check type order (A, B, C, D)
    const typeOrder: Record<string, number> = { A: 0, B: 1, C: 2, D: 3 };
    const sorted = [...schedules].sort((a, b) => {
      const typeCmp = a.icaoType.localeCompare(b.icaoType);
      if (typeCmp !== 0) return typeCmp;
      return (typeOrder[a.checkType] ?? 99) - (typeOrder[b.checkType] ?? 99);
    });

    for (const schedule of sorted) {
      const existing = groups.get(schedule.icaoType);
      if (existing) {
        existing.push(schedule);
      } else {
        groups.set(schedule.icaoType, [schedule]);
      }
    }

    return groups;
  }, [schedules]);

  // Action handlers
  const handleCreate = useCallback(() => {
    setEditSchedule(null);
    setShowForm(true);
  }, []);

  const handleEdit = useCallback((schedule: MaintenanceCheckSchedule) => {
    setEditSchedule(schedule);
    setShowForm(true);
  }, []);

  const handleFormClose = useCallback(() => {
    setShowForm(false);
    setEditSchedule(null);
  }, []);

  const handleFormSaved = useCallback(() => {
    setShowForm(false);
    setEditSchedule(null);
    fetchSchedules();
  }, [fetchSchedules]);

  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return;
    setActionLoading(true);
    try {
      await api.delete(`/api/admin/maintenance/check-schedules/${deleteTarget.id}`);
      toast.success(`${deleteTarget.checkType}-Check schedule for ${deleteTarget.icaoType} deleted`);
      setDeleteTarget(null);
      fetchSchedules();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to delete check schedule';
      toast.error(message);
    } finally {
      setActionLoading(false);
    }
  }, [deleteTarget, fetchSchedules]);

  // ── Loading State ─────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <SpinnerGap className="w-6 h-6 text-blue-400 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <WarningCircle className="w-10 h-10 text-red-400/40" />
        <p className="text-sm text-red-400">{error}</p>
        <button
          onClick={fetchSchedules}
          className="text-xs px-3 py-1.5 rounded-md text-blue-400 bg-blue-500/10 border border-blue-400/20 hover:bg-blue-500/20 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Top Bar */}
      <div className="flex-none flex items-center justify-between px-4 pt-4 pb-3">
        <p className="text-xs text-acars-muted">
          {schedules.length} schedule{schedules.length !== 1 ? 's' : ''} across{' '}
          {groupedSchedules.size} aircraft type{groupedSchedules.size !== 1 ? 's' : ''}
        </p>
        <button
          onClick={handleCreate}
          className="inline-flex items-center gap-1.5 px-4 h-9 rounded-md text-xs font-semibold text-white bg-blue-500 hover:bg-blue-500/80 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" weight="bold" />
          Add Schedule
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto px-4 pb-4">
        {schedules.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 gap-3">
            <CalendarBlank className="w-10 h-10 text-acars-muted/30" />
            <p className="text-sm text-acars-muted">No check schedules configured</p>
            <p className="text-xs text-acars-muted/60">
              Add check schedules to define maintenance intervals for your fleet types.
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            {Array.from(groupedSchedules.entries()).map(([icaoType, typeSchedules]) => (
              <div key={icaoType} className="rounded-md border border-acars-border overflow-hidden bg-acars-panel">
                {/* Group Header */}
                <div className="flex items-center gap-2.5 px-4 py-2.5 border-b border-acars-border bg-acars-bg/50">
                  <span className="font-mono font-bold text-sm text-acars-text">{icaoType}</span>
                  <span className="text-[10px] text-acars-muted uppercase tracking-wider">
                    {typeSchedules.length} check{typeSchedules.length !== 1 ? 's' : ''}
                  </span>
                </div>

                {/* Table */}
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-[10px] uppercase tracking-wider text-acars-muted border-b border-acars-border">
                      <th className="text-left px-4 py-2 font-medium">Check Type</th>
                      <th className="text-right px-3 py-2 font-medium">Interval Hours</th>
                      <th className="text-right px-3 py-2 font-medium">Interval Cycles</th>
                      <th className="text-right px-3 py-2 font-medium">Interval Months</th>
                      <th className="text-center px-3 py-2 font-medium">Overflight</th>
                      <th className="text-right px-3 py-2 font-medium">Est. Duration</th>
                      <th className="text-left px-3 py-2 font-medium">Description</th>
                      <th className="text-center px-3 py-2 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {typeSchedules.map((schedule) => (
                      <tr
                        key={schedule.id}
                        className="border-b border-acars-border/50 hover:bg-acars-hover transition-colors"
                      >
                        <td className="px-4 py-2.5">
                          <CheckTypeBadge type={schedule.checkType} />
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <span className="font-mono text-acars-text tabular-nums">
                            {schedule.intervalHours != null
                              ? schedule.intervalHours.toLocaleString('en-US')
                              : '--'}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <span className="font-mono text-acars-text tabular-nums">
                            {schedule.intervalCycles != null
                              ? schedule.intervalCycles.toLocaleString('en-US')
                              : '--'}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <span className="font-mono text-acars-text tabular-nums">
                            {schedule.intervalMonths != null
                              ? schedule.intervalMonths
                              : '--'}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <OverflightBadge pct={schedule.overflightPct} />
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <span className="font-mono text-acars-text tabular-nums">
                            {schedule.estimatedDurationHours != null
                              ? `${schedule.estimatedDurationHours}h`
                              : '--'}
                          </span>
                        </td>
                        <td className="px-3 py-2.5">
                          <span className="text-acars-muted truncate max-w-[200px] block" title={schedule.description ?? undefined}>
                            {schedule.description ?? '--'}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => handleEdit(schedule)}
                              className="p-1.5 rounded-md text-blue-400 bg-blue-500/10 border border-blue-400/20 hover:bg-blue-500/20 transition-colors"
                              title="Edit"
                            >
                              <PencilSimple className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setDeleteTarget(schedule)}
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
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Form Modal */}
      {showForm && (
        <ScheduleFormModal
          editSchedule={editSchedule}
          onClose={handleFormClose}
          onSaved={handleFormSaved}
        />
      )}

      {/* Delete Confirm Modal */}
      {deleteTarget && (
        <ConfirmModal
          title="Delete Check Schedule"
          message={`Are you sure you want to delete the ${deleteTarget.checkType}-Check schedule for ${deleteTarget.icaoType}? This action cannot be undone.`}
          confirmLabel="Delete"
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
          loading={actionLoading}
        />
      )}
    </div>
  );
}
