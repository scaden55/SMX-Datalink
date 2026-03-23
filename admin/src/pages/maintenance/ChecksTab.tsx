import React, { useCallback, useEffect, useState } from 'react';
import { motion } from 'motion/react';
import {
  Settings,
  Save,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  X,
} from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { toast } from '@/stores/toastStore';
import { formatHours, formatDate, formatCurrency } from '@/lib/formatters';
import { fadeUp, staggerContainer, tableContainer, tableRow } from '@/lib/motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

// ── Types ────────────────────────────────────────────────────

interface ChecksTabProps {
  aircraftId: number;
  icaoType: string;
}

interface CheckDueStatus {
  checkType: 'A' | 'B' | 'C' | 'D';
  dueAtHours: number | null;
  dueAtCycles: number | null;
  dueAtDate: string | null;
  currentHours: number;
  currentCycles: number;
  isOverdue: boolean;
  isInOverflight: boolean;
  remainingHours: number | null;
  remainingCycles: number | null;
  overflightPct: number;
}

interface MaintenanceLogEntry {
  id: number;
  aircraftId: number;
  checkType: string;
  title: string;
  description: string | null;
  performedBy: string | null;
  performedAt: string | null;
  hoursAtCheck: number | null;
  cyclesAtCheck: number | null;
  cost: number | null;
  status: string;
}

interface CheckSchedule {
  id: number;
  icaoType: string;
  checkType: 'A' | 'B' | 'C' | 'D';
  intervalHours: number | null;
  intervalCycles: number | null;
  intervalMonths: number | null;
  overflightPct: number;
  estimatedDurationHours: number | null;
  description: string | null;
}

interface FleetMaintenanceStatus {
  aircraftId: number;
  registration: string;
  icaoType: string;
  name: string;
  status: string;
  totalHours: number;
  totalCycles: number;
  checksDue: CheckDueStatus[];
  hasOverdueChecks: boolean;
  hasOverdueADs: boolean;
  hasExpiredMEL: boolean;
  openDiscrepancies: number;
  activeMELs: number;
  nextCheckType: string | null;
  nextCheckDueIn: number | null;
}

// ── Constants ────────────────────────────────────────────────

type CheckType = 'A' | 'B' | 'C' | 'D';

const CHECK_TYPES: CheckType[] = ['A', 'B', 'C', 'D'];

const CHECK_COLORS: Record<CheckType, { bg: string; text: string; bar: string }> = {
  A: { bg: 'var(--accent-blue-bg)', text: 'var(--accent-blue-bright)', bar: 'var(--accent-blue)' },
  B: { bg: 'var(--accent-emerald-bg)', text: 'var(--accent-emerald)', bar: 'var(--accent-emerald)' },
  C: { bg: 'var(--accent-amber-bg)', text: 'var(--accent-amber)', bar: 'var(--accent-amber)' },
  D: { bg: 'var(--accent-cyan-bg)', text: 'var(--accent-cyan)', bar: 'var(--accent-cyan)' },
};

const LOG_STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  scheduled: { bg: 'var(--accent-blue-bg)', text: 'var(--accent-blue-bright)' },
  in_progress: { bg: 'var(--accent-amber-bg)', text: 'var(--accent-amber)' },
  completed: { bg: 'var(--accent-emerald-bg)', text: 'var(--accent-emerald)' },
  deferred: { bg: 'var(--accent-cyan-bg)', text: 'var(--accent-cyan)' },
};

const PAGE_SIZE = 25;

// ── Shared Styles ────────────────────────────────────────────

const COL_HEADER_CLASS = 'text-subheading';
const colHeaderStyle: React.CSSProperties = {
  padding: '10px 16px',
  borderBottom: '1px solid var(--border-primary)',
  userSelect: 'none',
};
const CELL_CLASS = 'text-caption';
const cellStyle: React.CSSProperties = {
  padding: '10px 16px',
  borderBottom: '1px solid var(--border-primary)',
  verticalAlign: 'middle',
};
const MONO_CLASS = 'data-sm';

// ── Helpers ──────────────────────────────────────────────────

function progressColor(remaining: number | null, interval: number | null): string {
  if (remaining == null || interval == null || interval <= 0) return 'var(--accent-emerald)';
  const pct = remaining / interval;
  if (pct < 0.05) return 'var(--accent-red)';
  if (pct < 0.20) return 'var(--accent-amber)';
  return 'var(--accent-emerald)';
}

function progressPct(remaining: number | null, interval: number | null): number {
  if (remaining == null || interval == null || interval <= 0) return 0;
  const used = interval - remaining;
  return Math.min(100, Math.max(0, (used / interval) * 100));
}

// ── Badges ───────────────────────────────────────────────────

function CheckTypeBadge({ type }: { type: CheckType }) {
  const c = CHECK_COLORS[type];
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 8px',
        borderRadius: 3,
        fontSize: 11,
        fontWeight: 600,
        lineHeight: '16px',
        background: c.bg,
        color: c.text,
        whiteSpace: 'nowrap',
      }}
    >
      {type} Check
    </span>
  );
}

function LogStatusBadge({ status }: { status: string }) {
  const c = LOG_STATUS_COLORS[status] ?? { bg: 'var(--surface-2)', text: 'var(--text-secondary)' };
  const label = status.replace(/_/g, ' ').replace(/\b\w/g, (ch) => ch.toUpperCase());
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 8px',
        borderRadius: 3,
        fontSize: 11,
        fontWeight: 600,
        lineHeight: '16px',
        background: c.bg,
        color: c.text,
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </span>
  );
}

// ── Skeleton ─────────────────────────────────────────────────

function TableSkeleton() {
  return (
    <div style={{ padding: 24 }}>
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          style={{
            height: 42,
            background: 'transparent',
            border: '1px solid var(--panel-border)',
            borderRadius: 4,
            marginBottom: 4,
            opacity: 0.5,
          }}
          className="animate-pulse"
        />
      ))}
    </div>
  );
}

// ── Check Status Card ────────────────────────────────────────

function CheckStatusCard({
  type,
  checkDue,
  schedule,
}: {
  type: CheckType;
  checkDue: CheckDueStatus | undefined;
  schedule: CheckSchedule | undefined;
}) {
  const colors = CHECK_COLORS[type];
  const hasSchedule = !!schedule;
  const interval = schedule?.intervalHours ?? null;

  if (!hasSchedule && !checkDue) {
    return (
      <motion.div
        variants={fadeUp}
        style={{
          background: 'var(--surface-1)',
          borderRadius: 6,
          padding: 16,
          borderLeft: `3px solid var(--surface-3)`,
          flex: 1,
          minWidth: 180,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <CheckTypeBadge type={type} />
        </div>
        <div className="text-caption" style={{ color: 'var(--text-quaternary)', fontStyle: 'italic' }}>
          Not configured
        </div>
      </motion.div>
    );
  }

  const remaining = checkDue?.remainingHours ?? null;
  const remainingCycles = checkDue?.remainingCycles ?? null;
  const isOverdue = checkDue?.isOverdue ?? false;
  const isInOverflight = checkDue?.isInOverflight ?? false;
  const barColor = isOverdue ? 'var(--accent-red)' : progressColor(remaining, interval);
  const filled = isOverdue ? 100 : progressPct(remaining, interval);

  return (
    <motion.div
      variants={fadeUp}
      style={{
        background: 'var(--surface-1)',
        borderRadius: 6,
        padding: 16,
        borderLeft: `3px solid ${colors.bar}`,
        flex: 1,
        minWidth: 180,
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <CheckTypeBadge type={type} />
        {isOverdue && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 600, color: 'var(--accent-red)' }}>
            <AlertTriangle size={12} /> OVERDUE
          </span>
        )}
        {isInOverflight && !isOverdue && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 600, color: 'var(--accent-amber)' }}>
            <AlertTriangle size={12} /> OVERFLIGHT
          </span>
        )}
      </div>

      {/* Interval info */}
      {interval != null && (
        <div className="text-caption" style={{ color: 'var(--text-tertiary)', marginBottom: 8 }}>
          every <span className="font-mono" style={{ fontVariantNumeric: 'tabular-nums' }}>{formatHours(interval)}h</span>
          {schedule?.intervalCycles != null && (
            <> / <span className="font-mono" style={{ fontVariantNumeric: 'tabular-nums' }}>{schedule.intervalCycles.toLocaleString()} cyc</span></>
          )}
        </div>
      )}

      {/* Remaining */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 10, color: 'var(--text-quaternary)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>
            Remaining Hours
          </div>
          <span
            className="font-mono"
            style={{
              fontSize: 15,
              fontWeight: 700,
              fontVariantNumeric: 'tabular-nums',
              color: isOverdue ? 'var(--accent-red)' : 'var(--text-primary)',
            }}
          >
            {remaining != null ? formatHours(remaining) : '\u2014'}
          </span>
        </div>
        <div>
          <div style={{ fontSize: 10, color: 'var(--text-quaternary)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>
            Remaining Cycles
          </div>
          <span
            className="font-mono"
            style={{
              fontSize: 15,
              fontWeight: 700,
              fontVariantNumeric: 'tabular-nums',
              color: isOverdue ? 'var(--accent-red)' : 'var(--text-primary)',
            }}
          >
            {remainingCycles != null ? remainingCycles.toLocaleString() : '\u2014'}
          </span>
        </div>
      </div>

      {/* Progress bar */}
      <div
        style={{
          width: '100%',
          height: 4,
          background: 'var(--surface-3)',
          borderRadius: 2,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${filled}%`,
            height: '100%',
            background: barColor,
            borderRadius: 2,
            transition: 'width 400ms ease',
          }}
        />
      </div>
    </motion.div>
  );
}

// ── Configure Intervals Section ──────────────────────────────

interface IntervalFormRow {
  checkType: CheckType;
  id: number | null;
  intervalHours: string;
  intervalCycles: string;
  intervalMonths: string;
  overflightPct: string;
  estimatedDurationHours: string;
  saving: boolean;
  dirty: boolean;
}

function initFormRow(type: CheckType, schedule: CheckSchedule | undefined): IntervalFormRow {
  return {
    checkType: type,
    id: schedule?.id ?? null,
    intervalHours: schedule?.intervalHours?.toString() ?? '',
    intervalCycles: schedule?.intervalCycles?.toString() ?? '',
    intervalMonths: schedule?.intervalMonths?.toString() ?? '',
    overflightPct: schedule?.overflightPct?.toString() ?? '10',
    estimatedDurationHours: schedule?.estimatedDurationHours?.toString() ?? '',
    saving: false,
    dirty: false,
  };
}

function ConfigureIntervalsPanel({
  icaoType,
  schedules,
  onClose,
  onSaved,
}: {
  icaoType: string;
  schedules: CheckSchedule[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [rows, setRows] = useState<IntervalFormRow[]>(() =>
    CHECK_TYPES.map((t) => initFormRow(t, schedules.find((s) => s.checkType === t))),
  );

  function updateRow(idx: number, field: keyof IntervalFormRow, value: string) {
    setRows((prev) =>
      prev.map((r, i) => (i === idx ? { ...r, [field]: value, dirty: true } : r)),
    );
  }

  async function saveRow(idx: number) {
    const row = rows[idx];
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, saving: true } : r)));

    const payload = {
      icaoType,
      checkType: row.checkType,
      intervalHours: row.intervalHours ? Number(row.intervalHours) : null,
      intervalCycles: row.intervalCycles ? Number(row.intervalCycles) : null,
      intervalMonths: row.intervalMonths ? Number(row.intervalMonths) : null,
      overflightPct: row.overflightPct ? Number(row.overflightPct) : 10,
      estimatedDurationHours: row.estimatedDurationHours ? Number(row.estimatedDurationHours) : null,
    };

    try {
      if (row.id != null) {
        await api.patch(`/api/admin/maintenance/check-schedules/${row.id}`, payload);
        toast.success(`Updated ${row.checkType} Check interval`);
      } else {
        const res = await api.post<{ id: number }>('/api/admin/maintenance/check-schedules', payload);
        setRows((prev) =>
          prev.map((r, i) => (i === idx ? { ...r, id: res.id, saving: false, dirty: false } : r)),
        );
        toast.success(`Created ${row.checkType} Check interval`);
        onSaved();
        return;
      }
      setRows((prev) =>
        prev.map((r, i) => (i === idx ? { ...r, saving: false, dirty: false } : r)),
      );
      onSaved();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : `Failed to save ${row.checkType} Check interval`);
      setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, saving: false } : r)));
    }
  }

  const inputStyle: React.CSSProperties = {
    background: 'var(--surface-2)',
    border: '1px solid var(--border-primary)',
    color: 'var(--text-primary)',
    fontSize: 12,
    height: 32,
    width: '100%',
  };

  return (
    <div
      style={{
        background: 'var(--surface-1)',
        borderRadius: 6,
        border: '1px solid var(--border-primary)',
        padding: '16px 20px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div className="text-body" style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
          Configure Check Intervals
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--text-tertiary)',
            padding: 4,
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <X size={16} />
        </button>
      </div>

      <div
        className="text-caption"
        style={{ color: 'var(--text-tertiary)', marginBottom: 16 }}
      >
        These intervals apply to all <span className="font-mono" style={{ fontWeight: 600 }}>{icaoType}</span> aircraft.
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {rows.map((row, idx) => {
          const colors = CHECK_COLORS[row.checkType];
          return (
            <div
              key={row.checkType}
              style={{
                display: 'grid',
                gridTemplateColumns: '80px 1fr 1fr 1fr 1fr 1fr auto',
                gap: 8,
                alignItems: 'end',
                padding: '10px 0',
                borderBottom: idx < rows.length - 1 ? '1px solid var(--border-primary)' : undefined,
              }}
            >
              {/* Check type label */}
              <div style={{ paddingBottom: 6 }}>
                <CheckTypeBadge type={row.checkType} />
              </div>

              {/* Interval Hours */}
              <div>
                <Label className="text-subheading" style={{ marginBottom: 4, display: 'block' }}>Hours</Label>
                <Input
                  type="number"
                  value={row.intervalHours}
                  onChange={(e) => updateRow(idx, 'intervalHours', e.target.value)}
                  placeholder="—"
                  style={inputStyle}
                />
              </div>

              {/* Interval Cycles */}
              <div>
                <Label className="text-subheading" style={{ marginBottom: 4, display: 'block' }}>Cycles</Label>
                <Input
                  type="number"
                  value={row.intervalCycles}
                  onChange={(e) => updateRow(idx, 'intervalCycles', e.target.value)}
                  placeholder="—"
                  style={inputStyle}
                />
              </div>

              {/* Interval Months */}
              <div>
                <Label className="text-subheading" style={{ marginBottom: 4, display: 'block' }}>Months</Label>
                <Input
                  type="number"
                  value={row.intervalMonths}
                  onChange={(e) => updateRow(idx, 'intervalMonths', e.target.value)}
                  placeholder="—"
                  style={inputStyle}
                />
              </div>

              {/* Overflight % */}
              <div>
                <Label className="text-subheading" style={{ marginBottom: 4, display: 'block' }}>Overflight %</Label>
                <Input
                  type="number"
                  value={row.overflightPct}
                  onChange={(e) => updateRow(idx, 'overflightPct', e.target.value)}
                  placeholder="10"
                  style={inputStyle}
                />
              </div>

              {/* Est. Duration */}
              <div>
                <Label className="text-subheading" style={{ marginBottom: 4, display: 'block' }}>Est. Hrs</Label>
                <Input
                  type="number"
                  value={row.estimatedDurationHours}
                  onChange={(e) => updateRow(idx, 'estimatedDurationHours', e.target.value)}
                  placeholder="—"
                  style={inputStyle}
                />
              </div>

              {/* Save */}
              <div style={{ paddingBottom: 2 }}>
                <Button
                  size="sm"
                  disabled={row.saving || !row.dirty}
                  onClick={() => saveRow(idx)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    height: 32,
                    fontSize: 11,
                    background: row.dirty ? 'var(--accent-blue)' : 'var(--surface-2)',
                    color: row.dirty ? '#fff' : 'var(--text-quaternary)',
                    border: 'none',
                    cursor: row.dirty ? 'pointer' : 'default',
                  }}
                >
                  <Save size={12} />
                  Save
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════
// ChecksTab
// ═════════════════════════════════════════════════════════════

export function ChecksTab({ aircraftId, icaoType }: ChecksTabProps) {
  const [loading, setLoading] = useState(true);
  const [checksDue, setChecksDue] = useState<CheckDueStatus[]>([]);
  const [schedules, setSchedules] = useState<CheckSchedule[]>([]);
  const [logEntries, setLogEntries] = useState<MaintenanceLogEntry[]>([]);
  const [logTotal, setLogTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [showConfig, setShowConfig] = useState(false);

  // ── Fetch fleet status (for checksDue) ───────────────────
  const fetchChecksDue = useCallback(async () => {
    try {
      const res = await api.get<{ fleet: FleetMaintenanceStatus[] }>('/api/admin/maintenance/fleet-status');
      const found = res.fleet.find((a) => a.aircraftId === aircraftId);
      setChecksDue((found?.checksDue as CheckDueStatus[]) ?? []);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to load check status');
    }
  }, [aircraftId]);

  // ── Fetch check schedules ────────────────────────────────
  const fetchSchedules = useCallback(async () => {
    try {
      const res = await api.get<{ schedules: CheckSchedule[] }>('/api/admin/maintenance/check-schedules');
      setSchedules(res.schedules.filter((s) => s.icaoType === icaoType));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to load check schedules');
    }
  }, [icaoType]);

  // ── Fetch maintenance log ────────────────────────────────
  const fetchLog = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      params.set('aircraftId', String(aircraftId));
      params.set('page', page.toString());
      params.set('pageSize', PAGE_SIZE.toString());

      const res = await api.get<{
        entries: MaintenanceLogEntry[];
        total: number;
        page: number;
        pageSize: number;
      }>(`/api/admin/maintenance/log?${params.toString()}`);

      // Client-side filter to check types only
      const checkEntries = res.entries.filter((e) =>
        ['A', 'B', 'C', 'D'].includes(e.checkType),
      );
      setLogEntries(checkEntries);
      setLogTotal(res.total);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to load maintenance log');
    }
  }, [aircraftId, page]);

  // ── Initial load ─────────────────────────────────────────
  useEffect(() => {
    async function load() {
      setLoading(true);
      await Promise.all([fetchChecksDue(), fetchSchedules(), fetchLog()]);
      setLoading(false);
    }
    load();
  }, [fetchChecksDue, fetchSchedules, fetchLog]);

  function handleScheduleSaved() {
    fetchSchedules();
    fetchChecksDue();
  }

  // ── Derived ──────────────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(logTotal / PAGE_SIZE));

  // ── Loading ──────────────────────────────────────────────
  if (loading) {
    return <TableSkeleton />;
  }

  return (
    <div style={{ padding: '16px 24px 24px' }}>
      {/* ── Section 1: Check Status Cards ──────────────────── */}
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
        style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}
      >
        {CHECK_TYPES.map((type) => (
          <CheckStatusCard
            key={type}
            type={type}
            checkDue={checksDue.find((c) => c.checkType === type)}
            schedule={schedules.find((s) => s.checkType === type)}
          />
        ))}
      </motion.div>

      {/* ── Section 2: Configure Intervals Toggle ──────────── */}
      <div style={{ marginBottom: 20 }}>
        {!showConfig && (
          <button
            onClick={() => setShowConfig(true)}
            className="text-caption"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 14px',
              background: 'none',
              color: 'var(--text-secondary)',
              border: '1px solid var(--border-primary)',
              borderRadius: 6,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'color 120ms, border-color 120ms',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--accent-blue)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-primary)'; }}
          >
            <Settings size={13} />
            Configure Intervals
          </button>
        )}

        {showConfig && (
          <ConfigureIntervalsPanel
            icaoType={icaoType}
            schedules={schedules}
            onClose={() => setShowConfig(false)}
            onSaved={handleScheduleSaved}
          />
        )}
      </div>

      {/* ── Section 3: Checks History Table ────────────────── */}
      <div style={{ marginBottom: 8 }}>
        <div className="text-body" style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 12 }}>
          Checks History
        </div>
      </div>

      {logEntries.length === 0 ? (
        <div
          className="text-body"
          style={{ padding: '48px 0', textAlign: 'center', color: 'var(--text-tertiary)' }}
        >
          No check history entries found for this aircraft.
        </div>
      ) : (
        <>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th className={COL_HEADER_CLASS} style={{ ...colHeaderStyle, width: 90 }}>Type</th>
                  <th className={COL_HEADER_CLASS} style={colHeaderStyle}>Title</th>
                  <th className={COL_HEADER_CLASS} style={colHeaderStyle}>Performed At</th>
                  <th className={COL_HEADER_CLASS} style={{ ...colHeaderStyle, textAlign: 'right' }}>Hours</th>
                  <th className={COL_HEADER_CLASS} style={{ ...colHeaderStyle, textAlign: 'right' }}>Cycles</th>
                  <th className={COL_HEADER_CLASS} style={{ ...colHeaderStyle, textAlign: 'right' }}>Cost</th>
                  <th className={COL_HEADER_CLASS} style={{ ...colHeaderStyle, textAlign: 'center' }}>Status</th>
                </tr>
              </thead>
              <motion.tbody variants={tableContainer} initial="hidden" animate="visible">
                {logEntries.map((entry) => (
                  <motion.tr
                    key={entry.id}
                    variants={tableRow}
                    style={{
                      cursor: 'default',
                      transition: 'background 80ms',
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--tint-subtle)'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                  >
                    {/* Type */}
                    <td className={CELL_CLASS} style={cellStyle}>
                      {CHECK_TYPES.includes(entry.checkType as CheckType) ? (
                        <CheckTypeBadge type={entry.checkType as CheckType} />
                      ) : (
                        <span className="font-mono" style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                          {entry.checkType}
                        </span>
                      )}
                    </td>

                    {/* Title */}
                    <td
                      className={CELL_CLASS}
                      style={{
                        ...cellStyle,
                        maxWidth: 280,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        color: 'var(--text-primary)',
                        fontWeight: 500,
                      }}
                    >
                      {entry.title}
                    </td>

                    {/* Performed At */}
                    <td className={`${CELL_CLASS} ${MONO_CLASS}`} style={cellStyle}>
                      {formatDate(entry.performedAt)}
                    </td>

                    {/* Hours */}
                    <td className={`${CELL_CLASS} ${MONO_CLASS}`} style={{ ...cellStyle, textAlign: 'right' }}>
                      {entry.hoursAtCheck != null ? formatHours(entry.hoursAtCheck) : '\u2014'}
                    </td>

                    {/* Cycles */}
                    <td className={`${CELL_CLASS} ${MONO_CLASS}`} style={{ ...cellStyle, textAlign: 'right' }}>
                      {entry.cyclesAtCheck != null ? entry.cyclesAtCheck.toLocaleString() : '\u2014'}
                    </td>

                    {/* Cost */}
                    <td className={`${CELL_CLASS} ${MONO_CLASS}`} style={{ ...cellStyle, textAlign: 'right' }}>
                      {entry.cost != null ? formatCurrency(entry.cost) : '\u2014'}
                    </td>

                    {/* Status */}
                    <td className={CELL_CLASS} style={{ ...cellStyle, textAlign: 'center' }}>
                      <LogStatusBadge status={entry.status} />
                    </td>
                  </motion.tr>
                ))}
              </motion.tbody>
            </table>
          </div>

          {/* Pagination footer */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 0',
              borderTop: '1px solid var(--border-primary)',
            }}
          >
            <span className="text-caption">
              {logTotal === 0
                ? 'No results'
                : `${(page - 1) * PAGE_SIZE + 1}\u2013${Math.min(page * PAGE_SIZE, logTotal)} of ${logTotal}`}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 28,
                  height: 28,
                  background: 'none',
                  border: '1px solid var(--border-primary)',
                  borderRadius: 4,
                  color: page <= 1 ? 'var(--text-tertiary)' : 'var(--text-secondary)',
                  cursor: page <= 1 ? 'default' : 'pointer',
                  opacity: page <= 1 ? 0.4 : 1,
                }}
              >
                <ChevronLeft size={14} />
              </button>
              <span className={`text-caption ${MONO_CLASS}`} style={{ padding: '0 6px' }}>
                {page} / {totalPages}
              </span>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 28,
                  height: 28,
                  background: 'none',
                  border: '1px solid var(--border-primary)',
                  borderRadius: 4,
                  color: page >= totalPages ? 'var(--text-tertiary)' : 'var(--text-secondary)',
                  cursor: page >= totalPages ? 'default' : 'pointer',
                  opacity: page >= totalPages ? 0.4 : 1,
                }}
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
