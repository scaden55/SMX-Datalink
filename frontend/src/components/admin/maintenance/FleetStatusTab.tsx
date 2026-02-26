import { useState, useEffect, useCallback, Fragment } from 'react';
import {
  SpinnerGap,
  Wrench,
  ArrowClockwise,
  CaretDown,
  CaretUp,
  AirplaneTilt,
  CheckCircle,
  WarningCircle,
  X,
} from '@phosphor-icons/react';
import { api } from '../../../lib/api';
import { toast } from '../../../stores/toastStore';
import type { FleetMaintenanceStatus, CheckDueStatus } from '@acars/shared';

// ─── Types ──────────────────────────────────────────────────────

interface FleetStatusResponse {
  fleet: FleetMaintenanceStatus[];
}

// ─── Constants ──────────────────────────────────────────────────

const LABEL_CLS =
  'text-[10px] uppercase tracking-wider text-acars-muted font-medium mb-1.5 block';
const INPUT_CLS = 'input-field text-xs font-mono h-9';

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; border: string }> = {
  active: { label: 'Active', bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-400/20' },
  maintenance: { label: 'Maintenance', bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-400/20' },
  stored: { label: 'Stored', bg: 'bg-zinc-500/10', text: 'text-zinc-400', border: 'border-zinc-400/20' },
  retired: { label: 'Retired', bg: 'bg-zinc-500/10', text: 'text-zinc-400', border: 'border-zinc-400/20' },
};

// ─── Helpers ────────────────────────────────────────────────────

function formatHours(h: number): string {
  return h.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

function getCheckStatusColor(check: CheckDueStatus): string {
  if (check.isOverdue) return 'text-red-400';
  if (check.isInOverflight) return 'text-amber-400';
  return 'text-emerald-400';
}

function getCheckStatusLabel(check: CheckDueStatus): string {
  if (check.isOverdue) return 'OVERDUE';
  if (check.isInOverflight) return 'OVERFLIGHT';
  return 'OK';
}

function getRowBg(ac: FleetMaintenanceStatus): string {
  if (ac.hasOverdueChecks || ac.hasOverdueADs || ac.hasExpiredMEL) return 'bg-red-500/5';
  const hasOverflight = ac.checksDue.some((c) => c.isInOverflight);
  if (hasOverflight) return 'bg-amber-500/5';
  return '';
}

// ─── Status Badge ───────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.active;
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${cfg.bg} ${cfg.text} border ${cfg.border}`}
    >
      {cfg.label}
    </span>
  );
}

// ─── Next Check Cell ────────────────────────────────────────────

function NextCheckCell({ aircraft }: { aircraft: FleetMaintenanceStatus }) {
  if (!aircraft.nextCheckType) {
    return <span className="text-acars-muted">--</span>;
  }

  // Find the actual check data for the next check type
  const check = aircraft.checksDue.find((c) => c.checkType === aircraft.nextCheckType);

  if (!check) {
    return (
      <span className="text-acars-muted">
        {aircraft.nextCheckType} -- {aircraft.nextCheckDueIn != null ? `${formatHours(aircraft.nextCheckDueIn)}h` : ''}
      </span>
    );
  }

  const color = getCheckStatusColor(check);

  if (check.isOverdue) {
    return (
      <span className={`font-mono font-semibold ${color}`}>
        {check.checkType} -- OVERDUE
      </span>
    );
  }

  if (check.isInOverflight) {
    return (
      <span className={`font-mono font-semibold ${color}`}>
        {check.checkType} -- OVERFLIGHT ({check.remainingHours != null ? `${formatHours(check.remainingHours)}h` : '--'})
      </span>
    );
  }

  return (
    <span className={`font-mono font-semibold ${color}`}>
      {check.checkType} -- {check.remainingHours != null ? `${formatHours(check.remainingHours)}h remaining` : '--'}
    </span>
  );
}

// ─── Expanded Row Detail ────────────────────────────────────────

function CheckDetailTable({ checks }: { checks: CheckDueStatus[] }) {
  if (checks.length === 0) {
    return (
      <p className="text-xs text-acars-muted py-2">No check schedules configured for this aircraft type.</p>
    );
  }

  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="text-[10px] uppercase tracking-wider text-acars-muted border-b border-acars-border">
          <th className="text-left px-3 py-2 font-medium">Check Type</th>
          <th className="text-right px-3 py-2 font-medium">Due At (hours)</th>
          <th className="text-right px-3 py-2 font-medium">Due At (cycles)</th>
          <th className="text-right px-3 py-2 font-medium">Remaining Hours</th>
          <th className="text-right px-3 py-2 font-medium">Remaining Cycles</th>
          <th className="text-center px-3 py-2 font-medium">Status</th>
        </tr>
      </thead>
      <tbody>
        {checks.map((check) => {
          const color = getCheckStatusColor(check);
          const statusLabel = getCheckStatusLabel(check);

          return (
            <tr
              key={check.checkType}
              className={`border-b border-acars-border/50 ${
                check.isOverdue ? 'bg-red-500/5' : check.isInOverflight ? 'bg-amber-500/5' : ''
              }`}
            >
              <td className="px-3 py-2">
                <span className="font-mono font-semibold text-acars-text">{check.checkType}-Check</span>
              </td>
              <td className="px-3 py-2 text-right">
                <span className="font-mono text-acars-text">
                  {check.dueAtHours != null ? formatHours(check.dueAtHours) : '--'}
                </span>
              </td>
              <td className="px-3 py-2 text-right">
                <span className="font-mono text-acars-text">
                  {check.dueAtCycles != null ? check.dueAtCycles.toLocaleString() : '--'}
                </span>
              </td>
              <td className="px-3 py-2 text-right">
                <span className={`font-mono font-semibold ${color}`}>
                  {check.remainingHours != null ? formatHours(check.remainingHours) : '--'}
                </span>
              </td>
              <td className="px-3 py-2 text-right">
                <span className={`font-mono font-semibold ${color}`}>
                  {check.remainingCycles != null ? check.remainingCycles.toLocaleString() : '--'}
                </span>
              </td>
              <td className="px-3 py-2 text-center">
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${
                  check.isOverdue
                    ? 'bg-red-500/10 text-red-400 border border-red-400/20'
                    : check.isInOverflight
                      ? 'bg-amber-500/10 text-amber-400 border border-amber-400/20'
                      : 'bg-emerald-500/10 text-emerald-400 border border-emerald-400/20'
                }`}>
                  {statusLabel}
                </span>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

// ─── Adjust Hours Modal ─────────────────────────────────────────

interface AdjustHoursModalProps {
  aircraft: FleetMaintenanceStatus;
  onClose: () => void;
  onSaved: () => void;
}

function AdjustHoursModal({ aircraft, onClose, onSaved }: AdjustHoursModalProps) {
  const [totalHours, setTotalHours] = useState(String(aircraft.totalHours));
  const [totalCycles, setTotalCycles] = useState(String(aircraft.totalCycles));
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const canSubmit = reason.trim() !== '' && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError('');
    try {
      await api.patch(`/api/admin/maintenance/aircraft/${aircraft.aircraftId}/hours`, {
        totalHours: parseFloat(totalHours),
        totalCycles: parseInt(totalCycles, 10),
        reason: reason.trim(),
      });
      toast.success(`Hours adjusted for ${aircraft.registration}`);
      onSaved();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to adjust hours';
      setError(message);
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
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-acars-border">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center w-8 h-8 rounded-md bg-blue-500/10 border border-blue-400/20">
              <Wrench className="w-4 h-4 text-blue-400" />
            </div>
            <div>
              <h2 className="text-[13px] font-semibold text-acars-text">Adjust Hours / Cycles</h2>
              <p className="text-[10px] text-acars-muted">{aircraft.registration} -- {aircraft.icaoType}</p>
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
          <div>
            <label className={LABEL_CLS}>Total Hours</label>
            <input
              type="number"
              step="0.1"
              value={totalHours}
              onChange={(e) => setTotalHours(e.target.value)}
              className={INPUT_CLS}
            />
          </div>

          <div>
            <label className={LABEL_CLS}>Total Cycles</label>
            <input
              type="number"
              step="1"
              value={totalCycles}
              onChange={(e) => setTotalCycles(e.target.value)}
              className={INPUT_CLS}
            />
          </div>

          <div>
            <label className={LABEL_CLS}>Reason *</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="Reason for adjustment (required)..."
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
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Stats Bar ──────────────────────────────────────────────────

function StatsBar({ fleet }: { fleet: FleetMaintenanceStatus[] }) {
  const total = fleet.length;
  const operational = fleet.filter((a) => a.status === 'active').length;
  const inMaintenance = fleet.filter((a) => a.status === 'maintenance').length;
  const overdueCount = fleet.filter((a) => a.hasOverdueChecks || a.hasOverdueADs || a.hasExpiredMEL).length;

  const stats = [
    {
      label: 'Total Fleet',
      value: total,
      color: 'text-acars-text',
      bg: 'bg-acars-panel',
      border: 'border-acars-border',
      iconColor: 'text-blue-400',
      Icon: AirplaneTilt,
    },
    {
      label: 'Operational',
      value: operational,
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10',
      border: 'border-emerald-400/20',
      iconColor: 'text-emerald-400',
      Icon: CheckCircle,
    },
    {
      label: 'In Maintenance',
      value: inMaintenance,
      color: 'text-amber-400',
      bg: 'bg-amber-500/10',
      border: 'border-amber-400/20',
      iconColor: 'text-amber-400',
      Icon: Wrench,
    },
    {
      label: 'Overdue Items',
      value: overdueCount,
      color: 'text-red-400',
      bg: 'bg-red-500/10',
      border: 'border-red-400/20',
      iconColor: 'text-red-400',
      Icon: WarningCircle,
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
      {stats.map((stat) => {
        const Icon = stat.Icon;
        return (
          <div
            key={stat.label}
            className={`rounded-md border ${stat.border} ${stat.bg} p-4`}
          >
            <div className="flex items-center gap-2 mb-2">
              <div className={`flex items-center justify-center w-7 h-7 rounded-md ${stat.bg} border ${stat.border}`}>
                <Icon className={`w-3.5 h-3.5 ${stat.iconColor}`} />
              </div>
              <span className="text-[10px] uppercase tracking-wider text-acars-muted font-medium">
                {stat.label}
              </span>
            </div>
            <p className={`text-xl font-bold font-mono tabular-nums ${stat.color}`}>
              {stat.value}
            </p>
          </div>
        );
      })}
    </div>
  );
}

// ─── Fleet Status Tab (Main Export) ─────────────────────────────

export function FleetStatusTab() {
  const [fleet, setFleet] = useState<FleetMaintenanceStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedRow, setExpandedRow] = useState<number | null>(null);
  const [adjustTarget, setAdjustTarget] = useState<FleetMaintenanceStatus | null>(null);
  const [returningId, setReturningId] = useState<number | null>(null);

  const fetchFleet = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.get<FleetStatusResponse>('/api/admin/maintenance/fleet-status');
      setFleet(data.fleet);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load fleet status';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFleet();
  }, [fetchFleet]);

  const handleReturnToService = useCallback(async (aircraftId: number, registration: string) => {
    setReturningId(aircraftId);
    try {
      await api.post(`/api/admin/maintenance/aircraft/${aircraftId}/return-to-service`);
      toast.success(`${registration} returned to service`);
      fetchFleet();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to return aircraft to service';
      toast.error(message);
    } finally {
      setReturningId(null);
    }
  }, [fetchFleet]);

  const toggleExpanded = useCallback((aircraftId: number) => {
    setExpandedRow((prev) => (prev === aircraftId ? null : aircraftId));
  }, []);

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
          onClick={fetchFleet}
          className="text-xs px-3 py-1.5 rounded-md text-blue-400 bg-blue-500/10 border border-blue-400/20 hover:bg-blue-500/20 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  if (fleet.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <AirplaneTilt className="w-10 h-10 text-acars-muted/30" />
        <p className="text-sm text-acars-muted">No aircraft in fleet</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Stats */}
      <div className="flex-none px-4 pt-4">
        <StatsBar fleet={fleet} />
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0 z-10 bg-acars-panel">
            <tr className="text-[10px] uppercase tracking-wider text-acars-muted border-b border-acars-border">
              <th className="text-left px-4 py-2.5 font-medium w-8" />
              <th className="text-left px-3 py-2.5 font-medium">Registration</th>
              <th className="text-left px-3 py-2.5 font-medium">Type</th>
              <th className="text-right px-3 py-2.5 font-medium">Total Hours</th>
              <th className="text-right px-3 py-2.5 font-medium">Total Cycles</th>
              <th className="text-left px-3 py-2.5 font-medium">Next Check</th>
              <th className="text-center px-3 py-2.5 font-medium">Status</th>
              <th className="text-center px-3 py-2.5 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {fleet.map((ac) => {
              const isExpanded = expandedRow === ac.aircraftId;
              const rowBg = getRowBg(ac);

              return (
                <Fragment key={ac.aircraftId}>
                  <tr
                    className={`border-b border-acars-border hover:bg-acars-hover transition-colors cursor-pointer ${rowBg}`}
                    onClick={() => toggleExpanded(ac.aircraftId)}
                  >
                    <td className="px-4 py-2.5 text-acars-muted">
                      {isExpanded ? (
                        <CaretUp className="w-3.5 h-3.5" />
                      ) : (
                        <CaretDown className="w-3.5 h-3.5" />
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="text-acars-text font-mono font-semibold">{ac.registration}</span>
                      <div className="text-acars-muted text-[10px] truncate max-w-[160px]">{ac.name}</div>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="text-acars-text font-mono">{ac.icaoType}</span>
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <span className="font-mono text-acars-text tabular-nums">{formatHours(ac.totalHours)}</span>
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <span className="font-mono text-acars-text tabular-nums">{ac.totalCycles.toLocaleString()}</span>
                    </td>
                    <td className="px-3 py-2.5">
                      <NextCheckCell aircraft={ac} />
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <StatusBadge status={ac.status} />
                    </td>
                    <td className="px-3 py-2.5 text-center" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => setAdjustTarget(ac)}
                          className="text-xs px-3 py-1.5 rounded-md text-blue-400 bg-blue-500/10 border border-blue-400/20 hover:bg-blue-500/20 transition-colors"
                          title="Adjust Hours"
                        >
                          <Wrench className="w-3.5 h-3.5" />
                        </button>
                        {ac.status === 'maintenance' && (
                          <button
                            onClick={() => handleReturnToService(ac.aircraftId, ac.registration)}
                            disabled={returningId === ac.aircraftId}
                            className="text-xs px-3 py-1.5 rounded-md text-emerald-400 bg-emerald-500/10 border border-emerald-400/20 hover:bg-emerald-500/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                            title="Return to Service"
                          >
                            {returningId === ac.aircraftId ? (
                              <SpinnerGap className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <ArrowClockwise className="w-3.5 h-3.5" />
                            )}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <tr className="border-b border-acars-border">
                      <td colSpan={8} className="px-6 py-4 bg-acars-bg/50">
                        <div className="text-[10px] uppercase tracking-wider text-acars-muted font-medium mb-2">
                          Check Status Detail -- {ac.registration}
                        </div>
                        <div className="rounded-md border border-acars-border overflow-hidden bg-acars-panel">
                          <CheckDetailTable checks={ac.checksDue} />
                        </div>
                        {(ac.hasOverdueADs || ac.hasExpiredMEL) && (
                          <div className="mt-3 flex items-center gap-3">
                            {ac.hasOverdueADs && (
                              <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold uppercase bg-red-500/10 text-red-400 border border-red-400/20">
                                <WarningCircle className="w-3 h-3" />
                                Overdue ADs
                              </span>
                            )}
                            {ac.hasExpiredMEL && (
                              <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold uppercase bg-red-500/10 text-red-400 border border-red-400/20">
                                <WarningCircle className="w-3 h-3" />
                                Expired MEL
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Adjust Hours Modal */}
      {adjustTarget && (
        <AdjustHoursModal
          aircraft={adjustTarget}
          onClose={() => setAdjustTarget(null)}
          onSaved={() => {
            setAdjustTarget(null);
            fetchFleet();
          }}
        />
      )}
    </div>
  );
}
