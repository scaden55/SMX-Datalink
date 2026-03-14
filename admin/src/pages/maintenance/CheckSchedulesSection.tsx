import React, { useCallback, useEffect, useState } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { toast } from '@/stores/toastStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

// ── Types ────────────────────────────────────────────────────

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

type CheckType = 'A' | 'B' | 'C' | 'D';

const ALL_CHECK_TYPES: CheckType[] = ['A', 'B', 'C', 'D'];

const CHECK_BADGE_COLORS: Record<CheckType, { bg: string; text: string }> = {
  A: { bg: 'var(--accent-blue-bg)', text: 'var(--accent-blue-bright)' },
  B: { bg: 'var(--accent-emerald-bg)', text: 'var(--accent-emerald)' },
  C: { bg: 'var(--accent-amber-bg)', text: 'var(--accent-amber)' },
  D: { bg: 'var(--accent-cyan-bg)', text: 'var(--accent-cyan)' },
};

// ── Helpers ──────────────────────────────────────────────────

function CheckTypeBadge({ type }: { type: CheckType }) {
  const c = CHECK_BADGE_COLORS[type];
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

const labelStyle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 600,
  letterSpacing: 0.8,
  textTransform: 'uppercase',
  color: 'var(--text-tertiary)',
};

const monoValue: React.CSSProperties = {
  fontSize: 13,
  color: 'var(--text-primary)',
  fontFamily: 'var(--font-mono)',
  fontVariantNumeric: 'tabular-nums',
};

// ── Skeleton ─────────────────────────────────────────────────

function CardSkeleton() {
  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          style={{
            height: 180,
            background: 'var(--surface-2)',
            borderRadius: 'var(--radius-lg)',
            opacity: 0.5,
          }}
          className="animate-pulse"
        />
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// CheckSchedulesSection
// ═══════════════════════════════════════════════════════════════

export function CheckSchedulesSection({ refreshKey }: { refreshKey: number }) {
  const [schedules, setSchedules] = useState<CheckSchedule[]>([]);
  const [loading, setLoading] = useState(true);

  // Dialogs
  const [addTypeOpen, setAddTypeOpen] = useState(false);
  const [editCheck, setEditCheck] = useState<CheckSchedule | null>(null);
  const [deleteCheck, setDeleteCheck] = useState<CheckSchedule | null>(null);
  const [deleteAllType, setDeleteAllType] = useState<string | null>(null);

  // Add Aircraft Type form
  const [addIcaoType, setAddIcaoType] = useState('');
  const [addLoading, setAddLoading] = useState(false);

  // Edit form state
  const [editIntervalHours, setEditIntervalHours] = useState('');
  const [editIntervalCycles, setEditIntervalCycles] = useState('');
  const [editIntervalMonths, setEditIntervalMonths] = useState('');
  const [editOverflightPct, setEditOverflightPct] = useState('');
  const [editDurationHours, setEditDurationHours] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editLoading, setEditLoading] = useState(false);

  // Delete loading
  const [deleteLoading, setDeleteLoading] = useState(false);

  // ── Fetch ────────────────────────────────────────────────

  const fetchSchedules = useCallback(async () => {
    try {
      const res = await api.get<{ schedules: CheckSchedule[] }>(
        '/api/admin/maintenance/check-schedules',
      );
      setSchedules(res.schedules);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to load check schedules');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSchedules();
  }, [fetchSchedules, refreshKey]);

  // ── Group by ICAO type ───────────────────────────────────

  const grouped = new Map<string, CheckSchedule[]>();
  for (const s of schedules) {
    const list = grouped.get(s.icaoType) || [];
    list.push(s);
    grouped.set(s.icaoType, list);
  }
  // Sort types alphabetically
  const sortedTypes = Array.from(grouped.keys()).sort();

  // ── Add Aircraft Type ────────────────────────────────────

  function resetAddForm() {
    setAddIcaoType('');
  }

  async function handleAddType() {
    const icao = addIcaoType.trim().toUpperCase();
    if (!icao || icao.length > 4) return;
    setAddLoading(true);
    try {
      const defaults: Array<Partial<CheckSchedule> & { icaoType: string; checkType: CheckType }> = [
        { icaoType: icao, checkType: 'A', intervalHours: 500, overflightPct: 10 },
        { icaoType: icao, checkType: 'B', intervalHours: 4500, overflightPct: 0 },
        { icaoType: icao, checkType: 'C', intervalHours: 6000, intervalCycles: 3000, overflightPct: 0 },
        { icaoType: icao, checkType: 'D', intervalMonths: 72, overflightPct: 0 },
      ];
      for (const row of defaults) {
        await api.post('/api/admin/maintenance/check-schedules', row);
      }
      toast.success(`Added check schedules for ${icao}`);
      resetAddForm();
      setAddTypeOpen(false);
      fetchSchedules();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to add aircraft type');
    } finally {
      setAddLoading(false);
    }
  }

  // ── Edit Check ───────────────────────────────────────────

  function resetEditForm() {
    setEditIntervalHours('');
    setEditIntervalCycles('');
    setEditIntervalMonths('');
    setEditOverflightPct('');
    setEditDurationHours('');
    setEditDescription('');
  }

  function openEdit(check: CheckSchedule) {
    setEditCheck(check);
    setEditIntervalHours(check.intervalHours?.toString() ?? '');
    setEditIntervalCycles(check.intervalCycles?.toString() ?? '');
    setEditIntervalMonths(check.intervalMonths?.toString() ?? '');
    setEditOverflightPct(check.overflightPct.toString());
    setEditDurationHours(check.estimatedDurationHours?.toString() ?? '');
    setEditDescription(check.description ?? '');
  }

  async function handleUpdate() {
    if (!editCheck) return;
    setEditLoading(true);
    try {
      await api.patch(`/api/admin/maintenance/check-schedules/${editCheck.id}`, {
        intervalHours: editIntervalHours ? parseFloat(editIntervalHours) : null,
        intervalCycles: editIntervalCycles ? parseInt(editIntervalCycles) : null,
        intervalMonths: editIntervalMonths ? parseInt(editIntervalMonths) : null,
        overflightPct: editOverflightPct ? parseFloat(editOverflightPct) : 0,
        estimatedDurationHours: editDurationHours ? parseFloat(editDurationHours) : null,
        description: editDescription.trim() || null,
      });
      toast.success('Check schedule updated');
      setEditCheck(null);
      resetEditForm();
      fetchSchedules();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to update check schedule');
    } finally {
      setEditLoading(false);
    }
  }

  // ── Delete Single ────────────────────────────────────────

  async function handleDeleteSingle() {
    if (!deleteCheck) return;
    setDeleteLoading(true);
    try {
      await api.delete(`/api/admin/maintenance/check-schedules/${deleteCheck.id}`);
      toast.success(`Deleted ${deleteCheck.checkType} check for ${deleteCheck.icaoType}`);
      setDeleteCheck(null);
      fetchSchedules();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to delete check schedule');
    } finally {
      setDeleteLoading(false);
    }
  }

  // ── Delete All for Type ──────────────────────────────────

  async function handleDeleteAllForType() {
    if (!deleteAllType) return;
    const checksForType = grouped.get(deleteAllType) || [];
    if (checksForType.length === 0) return;
    setDeleteLoading(true);
    try {
      for (const check of checksForType) {
        await api.delete(`/api/admin/maintenance/check-schedules/${check.id}`);
      }
      toast.success(`Deleted all checks for ${deleteAllType}`);
      setDeleteAllType(null);
      fetchSchedules();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to delete check schedules');
    } finally {
      setDeleteLoading(false);
    }
  }

  // ── Add missing check for existing type ──────────────────

  async function handleAddMissingCheck(icaoType: string, checkType: CheckType) {
    const defaults: Record<CheckType, Partial<CheckSchedule>> = {
      A: { intervalHours: 500, overflightPct: 10 },
      B: { intervalHours: 4500, overflightPct: 0 },
      C: { intervalHours: 6000, intervalCycles: 3000, overflightPct: 0 },
      D: { intervalMonths: 72, overflightPct: 0 },
    };
    try {
      await api.post('/api/admin/maintenance/check-schedules', {
        icaoType,
        checkType,
        ...defaults[checkType],
      });
      toast.success(`Added ${checkType} check for ${icaoType}`);
      fetchSchedules();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to add check');
    }
  }

  // ── Render ───────────────────────────────────────────────

  if (loading) return <CardSkeleton />;

  return (
    <>
      <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Top bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
            Check Schedules
          </div>
          <button
            onClick={() => setAddTypeOpen(true)}
            className="btn-glow"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 14px',
              background: 'var(--accent-blue)',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'opacity 120ms',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.85'; }}
            onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
          >
            <Plus size={13} />
            Add Aircraft Type
          </button>
        </div>

        {/* Empty state */}
        {sortedTypes.length === 0 && (
          <div
            style={{
              padding: '60px 24px',
              textAlign: 'center',
              color: 'var(--text-tertiary)',
              fontSize: 13,
            }}
          >
            No check schedules configured. Add an aircraft type to get started.
          </div>
        )}

        {/* Grouped cards */}
        {sortedTypes.map((icaoType) => {
          const checks = grouped.get(icaoType)!;
          const checkMap = new Map<CheckType, CheckSchedule>();
          for (const c of checks) checkMap.set(c.checkType, c);
          const missingTypes = ALL_CHECK_TYPES.filter((t) => !checkMap.has(t));

          return (
            <div
              key={icaoType}
              style={{
                border: '1px solid var(--border-primary)',
                borderRadius: 'var(--radius-lg)',
                overflow: 'hidden',
              }}
            >
              {/* Card header */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 16px',
                  background: 'var(--surface-2)',
                }}
              >
                <span
                  style={{
                    fontSize: 14,
                    fontWeight: 700,
                    fontFamily: 'var(--font-mono)',
                    color: 'var(--text-primary)',
                  }}
                >
                  {icaoType}
                </span>
                <button
                  onClick={() => setDeleteAllType(icaoType)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: '4px 10px',
                    background: 'none',
                    border: '1px solid var(--border-primary)',
                    borderRadius: 4,
                    fontSize: 11,
                    fontWeight: 500,
                    color: 'var(--text-tertiary)',
                    cursor: 'pointer',
                    transition: 'color 120ms',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--accent-red)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-tertiary)'; }}
                >
                  <Trash2 size={12} />
                  Delete All
                </button>
              </div>

              {/* Check rows */}
              <div>
                {ALL_CHECK_TYPES.map((ct) => {
                  const check = checkMap.get(ct);
                  if (!check) return null;

                  return (
                    <div
                      key={ct}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 16,
                        padding: '10px 16px',
                        borderTop: '1px solid var(--border-primary)',
                        transition: 'background 80ms',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface-2)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                    >
                      {/* Badge */}
                      <div style={{ width: 72 }}>
                        <CheckTypeBadge type={ct} />
                      </div>

                      {/* Interval Hours */}
                      <div style={{ minWidth: 90 }}>
                        <div style={labelStyle}>Hours</div>
                        <div style={monoValue}>
                          {check.intervalHours != null ? `${check.intervalHours.toLocaleString()}h` : '--'}
                        </div>
                      </div>

                      {/* Interval Cycles (C only) */}
                      {ct === 'C' && (
                        <div style={{ minWidth: 90 }}>
                          <div style={labelStyle}>Cycles</div>
                          <div style={monoValue}>
                            {check.intervalCycles != null ? check.intervalCycles.toLocaleString() : '--'}
                          </div>
                        </div>
                      )}

                      {/* Interval Months (D only) */}
                      {ct === 'D' && (
                        <div style={{ minWidth: 90 }}>
                          <div style={labelStyle}>Months</div>
                          <div style={monoValue}>
                            {check.intervalMonths != null ? `${check.intervalMonths}mo` : '--'}
                          </div>
                        </div>
                      )}

                      {/* Overflight % (A/B only) */}
                      {(ct === 'A' || ct === 'B') && (
                        <div style={{ minWidth: 90 }}>
                          <div style={labelStyle}>Overflight</div>
                          <div style={monoValue}>{check.overflightPct}%</div>
                        </div>
                      )}

                      {/* Spacer */}
                      <div style={{ flex: 1 }} />

                      {/* Edit button */}
                      <button
                        onClick={() => openEdit(check)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          padding: '4px 8px',
                          background: 'none',
                          border: '1px solid var(--border-primary)',
                          borderRadius: 4,
                          fontSize: 11,
                          color: 'var(--text-tertiary)',
                          cursor: 'pointer',
                          transition: 'color 120ms',
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--accent-blue-bright)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-tertiary)'; }}
                      >
                        <Pencil size={12} />
                      </button>
                    </div>
                  );
                })}

                {/* Missing check types — ghost "Add [X] Check" buttons */}
                {missingTypes.map((ct) => (
                  <div
                    key={ct}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 16,
                      padding: '10px 16px',
                      borderTop: '1px solid var(--border-primary)',
                    }}
                  >
                    <div style={{ width: 72, opacity: 0.4 }}>
                      <CheckTypeBadge type={ct} />
                    </div>
                    <button
                      onClick={() => handleAddMissingCheck(icaoType, ct)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        padding: '4px 10px',
                        background: 'none',
                        border: '1px dashed var(--border-primary)',
                        borderRadius: 4,
                        fontSize: 11,
                        color: 'var(--text-tertiary)',
                        cursor: 'pointer',
                        transition: 'color 120ms, border-color 120ms',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.color = 'var(--accent-blue-bright)';
                        e.currentTarget.style.borderColor = 'var(--accent-blue)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.color = 'var(--text-tertiary)';
                        e.currentTarget.style.borderColor = 'var(--border-primary)';
                      }}
                    >
                      <Plus size={12} />
                      Add {ct} Check
                    </button>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Add Aircraft Type Dialog ──────────────────────────── */}
      <Dialog
        open={addTypeOpen}
        onOpenChange={(o) => {
          if (!o) {
            resetAddForm();
            setAddTypeOpen(false);
          }
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Add Aircraft Type</DialogTitle>
            <DialogDescription>
              Create default A/B/C/D check schedules for an aircraft type.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>ICAO Type Code *</Label>
              <Input
                value={addIcaoType}
                onChange={(e) => setAddIcaoType(e.target.value.toUpperCase().slice(0, 4))}
                placeholder="B738"
                maxLength={4}
                style={{ fontFamily: 'var(--font-mono)', textTransform: 'uppercase' }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                resetAddForm();
                setAddTypeOpen(false);
              }}
              disabled={addLoading}
            >
              Cancel
            </Button>
            <Button onClick={handleAddType} disabled={addLoading || !addIcaoType.trim()}>
              {addLoading ? 'Creating...' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Edit Check Dialog ─────────────────────────────────── */}
      <Dialog
        open={!!editCheck}
        onOpenChange={(open) => {
          if (!open) {
            setEditCheck(null);
            resetEditForm();
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              Edit {editCheck?.checkType} Check — {editCheck?.icaoType}
            </DialogTitle>
            <DialogDescription>Update check schedule intervals and parameters.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Interval Hours</Label>
              <Input
                type="number"
                value={editIntervalHours}
                onChange={(e) => setEditIntervalHours(e.target.value)}
                placeholder="e.g. 500"
              />
            </div>
            {editCheck?.checkType === 'C' && (
              <div className="space-y-2">
                <Label>Interval Cycles</Label>
                <Input
                  type="number"
                  value={editIntervalCycles}
                  onChange={(e) => setEditIntervalCycles(e.target.value)}
                  placeholder="e.g. 3000"
                />
              </div>
            )}
            {editCheck?.checkType === 'D' && (
              <div className="space-y-2">
                <Label>Interval Months</Label>
                <Input
                  type="number"
                  value={editIntervalMonths}
                  onChange={(e) => setEditIntervalMonths(e.target.value)}
                  placeholder="e.g. 72"
                />
              </div>
            )}
            {(editCheck?.checkType === 'A' || editCheck?.checkType === 'B') && (
              <div className="space-y-2">
                <Label>Overflight %</Label>
                <Input
                  type="number"
                  value={editOverflightPct}
                  onChange={(e) => setEditOverflightPct(e.target.value)}
                  placeholder="e.g. 10"
                />
              </div>
            )}
            <div className="space-y-2">
              <Label>Est. Duration Hours</Label>
              <Input
                type="number"
                value={editDurationHours}
                onChange={(e) => setEditDurationHours(e.target.value)}
                placeholder="e.g. 8"
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder="Optional description"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setEditCheck(null);
                resetEditForm();
              }}
              disabled={editLoading}
            >
              Cancel
            </Button>
            <Button onClick={handleUpdate} disabled={editLoading}>
              {editLoading ? 'Saving...' : 'Update'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Single Check Dialog ────────────────────────── */}
      <Dialog
        open={!!deleteCheck}
        onOpenChange={(open) => {
          if (!open) setDeleteCheck(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Check Schedule</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the {deleteCheck?.checkType} check for{' '}
              {deleteCheck?.icaoType}? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteCheck(null)} disabled={deleteLoading}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteSingle} disabled={deleteLoading}>
              {deleteLoading ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete All for Type Dialog ────────────────────────── */}
      <Dialog
        open={!!deleteAllType}
        onOpenChange={(open) => {
          if (!open) setDeleteAllType(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete All Checks</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete all check schedules for {deleteAllType}? This cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteAllType(null)}
              disabled={deleteLoading}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteAllForType}
              disabled={deleteLoading}
            >
              {deleteLoading ? 'Deleting...' : 'Delete All'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
