import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  Wrench,
  Search,
  Plus,
  Pencil,
  Trash2,
  MoreVertical,
  CheckCircle2,
  RotateCw,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { toast } from '@/stores/toastStore';
import { pageVariants, staggerContainer, staggerItem, fadeUp, tableContainer, tableRow, cardHover } from '@/lib/motion';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
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

// ── Types (mirroring @acars/shared) ──────────────────────────

type MaintenanceCheckType = 'A' | 'B' | 'C' | 'D';
type MaintenanceLogType = 'A' | 'B' | 'C' | 'D' | 'LINE' | 'UNSCHEDULED' | 'AD' | 'MEL' | 'SFP';
type MaintenanceLogStatus = 'scheduled' | 'in_progress' | 'completed' | 'deferred';

interface CheckDueStatus {
  checkType: MaintenanceCheckType;
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
  nextCheckType: string | null;
  nextCheckDueIn: number | null;
}

interface MaintenanceLogEntry {
  id: number;
  aircraftId: number;
  aircraftRegistration?: string;
  checkType: MaintenanceLogType;
  title: string;
  description: string | null;
  performedBy: string | null;
  performedAt: string | null;
  hoursAtCheck: number | null;
  cyclesAtCheck: number | null;
  cost: number | null;
  status: MaintenanceLogStatus;
  sfpDestination: string | null;
  sfpExpiry: string | null;
  createdBy: number | null;
  createdAt: string;
  updatedAt: string;
  durationHours?: number | null;
}

// ── Helpers ──────────────────────────────────────────────────

function formatDate(iso: string | null): string {
  if (!iso) return '--';
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatHours(h: number | null): string {
  if (h === null || h === undefined) return '--';
  return h.toLocaleString('en-US', { maximumFractionDigits: 1 });
}

function formatCurrency(v: number | null): string {
  if (v === null || v === undefined) return '--';
  return `$${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ── Badge Component ─────────────────────────────────────────

function TypeBadge({ type }: { type: MaintenanceLogType }) {
  const config: Record<string, { bg: string; text: string; label: string }> = {
    A: { bg: 'var(--accent-blue-bg)', text: 'var(--accent-blue-bright)', label: 'A Check' },
    B: { bg: 'var(--accent-emerald-bg)', text: 'var(--accent-emerald)', label: 'B Check' },
    C: { bg: 'var(--accent-amber-bg)', text: 'var(--accent-amber)', label: 'C Check' },
    D: { bg: 'var(--accent-red-bg)', text: 'var(--accent-red)', label: 'D Check' },
    LINE: { bg: 'var(--accent-cyan-bg)', text: 'var(--accent-cyan)', label: 'Line' },
    UNSCHEDULED: { bg: 'var(--accent-red-bg)', text: 'var(--accent-red)', label: 'Unscheduled' },
    AD: { bg: 'var(--accent-amber-bg)', text: 'var(--accent-amber)', label: 'AD' },
    MEL: { bg: 'var(--accent-blue-bg)', text: 'var(--accent-blue-bright)', label: 'MEL' },
    SFP: { bg: 'var(--accent-cyan-bg)', text: 'var(--accent-cyan)', label: 'SFP' },
  };
  const c = config[type] ?? { bg: 'var(--surface-2)', text: 'var(--text-secondary)', label: type };
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
      {c.label}
    </span>
  );
}

function StatusBadgeInline({ status }: { status: string }) {
  const normalized = status.toLowerCase().replace(/_/g, ' ');
  let bg = 'var(--surface-2)';
  let text = 'var(--text-secondary)';

  if (normalized === 'completed' || normalized === 'active' || normalized === 'ok') {
    bg = 'var(--accent-emerald-bg)';
    text = 'var(--accent-emerald)';
  } else if (normalized === 'overdue' || normalized === 'critical' || normalized === 'expired') {
    bg = 'var(--accent-red-bg)';
    text = 'var(--accent-red)';
  } else if (normalized === 'scheduled' || normalized === 'open' || normalized === 'complied') {
    bg = 'var(--accent-blue-bg)';
    text = 'var(--accent-blue-bright)';
  } else if (normalized === 'in progress' || normalized === 'in_progress' || normalized === 'deferred' || normalized === 'maintenance' || normalized === 'warning') {
    bg = 'var(--accent-amber-bg)';
    text = 'var(--accent-amber)';
  }

  const label = normalized.charAt(0).toUpperCase() + normalized.slice(1);

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
        background: bg,
        color: text,
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
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          style={{
            height: 42,
            background: 'var(--surface-2)',
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

// ── Column Header Style ──────────────────────────────────────

const colHeaderStyle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 600,
  letterSpacing: 0.8,
  color: 'var(--text-tertiary)',
  textTransform: 'uppercase',
  padding: '10px 16px',
  borderBottom: '1px solid var(--border-primary)',
  userSelect: 'none',
};

const cellStyle: React.CSSProperties = {
  padding: '10px 16px',
  borderBottom: '1px solid var(--border-primary)',
  fontSize: 12,
  color: 'var(--text-secondary)',
  verticalAlign: 'middle',
};

// ═══════════════════════════════════════════════════════════════
// Fleet Status Tab Content
// ═══════════════════════════════════════════════════════════════

function FleetStatusContent() {
  const [fleet, setFleet] = useState<FleetMaintenanceStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Adjust hours dialog
  const [adjustTarget, setAdjustTarget] = useState<FleetMaintenanceStatus | null>(null);
  const [adjustHours, setAdjustHours] = useState('');
  const [adjustCycles, setAdjustCycles] = useState('');
  const [adjustReason, setAdjustReason] = useState('');
  const [adjustLoading, setAdjustLoading] = useState(false);

  const fetchFleet = useCallback(async () => {
    try {
      const res = await api.get<{ fleet: FleetMaintenanceStatus[] }>('/api/admin/maintenance/fleet-status');
      setFleet(res.fleet);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to load fleet status');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchFleet(); }, [fetchFleet]);

  const filtered = useMemo(() => {
    let list = fleet;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (a) =>
          a.registration.toLowerCase().includes(q) ||
          a.icaoType.toLowerCase().includes(q) ||
          a.name.toLowerCase().includes(q),
      );
    }
    if (statusFilter !== 'all') {
      list = list.filter((a) => a.status === statusFilter);
    }
    return list;
  }, [fleet, search, statusFilter]);

  async function handleAdjustHours() {
    if (!adjustTarget || !adjustReason.trim()) return;
    setAdjustLoading(true);
    try {
      await api.patch(`/api/admin/maintenance/aircraft/${adjustTarget.aircraftId}/hours`, {
        totalHours: adjustHours ? parseFloat(adjustHours) : undefined,
        totalCycles: adjustCycles ? parseInt(adjustCycles) : undefined,
        reason: adjustReason.trim(),
      });
      toast.success(`Hours adjusted for ${adjustTarget.registration}`);
      setAdjustTarget(null);
      setAdjustHours('');
      setAdjustCycles('');
      setAdjustReason('');
      fetchFleet();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to adjust hours');
    } finally {
      setAdjustLoading(false);
    }
  }

  async function handleReturnToService(aircraft: FleetMaintenanceStatus) {
    try {
      const res = await api.post<{ ok: boolean; message: string }>(
        `/api/admin/maintenance/aircraft/${aircraft.aircraftId}/return-to-service`,
      );
      if (res.ok) {
        toast.success(res.message);
      } else {
        toast.warning(res.message);
      }
      fetchFleet();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to return aircraft to service');
    }
  }

  function getFleetStatusLabel(aircraft: FleetMaintenanceStatus): string {
    if (aircraft.hasOverdueChecks || aircraft.hasOverdueADs || aircraft.hasExpiredMEL) return 'Overdue';
    if (aircraft.checksDue.some((c) => c.isInOverflight)) return 'Warning';
    return aircraft.status;
  }

  if (loading) return <TableSkeleton />;

  return (
    <>
      {/* Filter Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '12px 24px',
          borderBottom: '1px solid var(--border-primary)',
        }}
      >
        <div style={{ position: 'relative', width: 220 }}>
          <Search
            size={14}
            style={{
              position: 'absolute',
              left: 10,
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-tertiary)',
            }}
          />
          <input
            type="text"
            placeholder="Search aircraft..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-glow"
            style={{
              width: '100%',
              height: 32,
              paddingLeft: 30,
              paddingRight: 10,
              background: 'var(--input-bg)',
              border: '1px solid var(--input-border)',
              borderRadius: 6,
              color: 'var(--text-primary)',
              fontSize: 12,
              outline: 'none',
            }}
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger
            style={{
              width: 140,
              height: 32,
              background: 'var(--input-bg)',
              border: '1px solid var(--input-border)',
              borderRadius: 6,
              color: 'var(--text-primary)',
              fontSize: 12,
            }}
          >
            <SelectValue placeholder="Status: All" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Status: All</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="maintenance">Maintenance</SelectItem>
            <SelectItem value="storage">Storage</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={colHeaderStyle}>REGISTRATION</th>
              <th style={colHeaderStyle}>TYPE</th>
              <th style={colHeaderStyle}>NAME</th>
              <th style={colHeaderStyle}>HOURS</th>
              <th style={colHeaderStyle}>CYCLES</th>
              <th style={colHeaderStyle}>NEXT CHECK</th>
              <th style={colHeaderStyle}>REMAINING</th>
              <th style={colHeaderStyle}>STATUS</th>
              <th style={{ ...colHeaderStyle, width: 50 }} />
            </tr>
          </thead>
          <motion.tbody variants={tableContainer} initial="hidden" animate="visible">
            {filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={9}
                  style={{ padding: '40px 16px', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}
                >
                  No aircraft found
                </td>
              </tr>
            ) : (
              filtered.map((aircraft) => (
                <motion.tr
                  key={aircraft.aircraftId}
                  variants={tableRow}
                  style={{ cursor: 'default' }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                >
                  <td style={{ ...cellStyle, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                    {aircraft.registration}
                  </td>
                  <td style={cellStyle}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>{aircraft.icaoType}</span>
                  </td>
                  <td style={{ ...cellStyle, color: 'var(--text-secondary)', fontSize: 11 }}>
                    {aircraft.name}
                  </td>
                  <td style={{ ...cellStyle, fontFamily: 'var(--font-mono)' }}>
                    {formatHours(aircraft.totalHours)}
                  </td>
                  <td style={{ ...cellStyle, fontFamily: 'var(--font-mono)' }}>
                    {aircraft.totalCycles.toLocaleString()}
                  </td>
                  <td style={cellStyle}>
                    {aircraft.nextCheckType ? (
                      <TypeBadge type={aircraft.nextCheckType as MaintenanceLogType} />
                    ) : (
                      <span style={{ color: 'var(--text-tertiary)' }}>--</span>
                    )}
                  </td>
                  <td style={{ ...cellStyle, fontFamily: 'var(--font-mono)' }}>
                    {aircraft.nextCheckDueIn !== null ? (
                      <span
                        style={{
                          color:
                            aircraft.hasOverdueChecks
                              ? 'var(--accent-red)'
                              : aircraft.checksDue.some((c) => c.isInOverflight)
                              ? 'var(--accent-amber)'
                              : 'var(--text-secondary)',
                        }}
                      >
                        {formatHours(aircraft.nextCheckDueIn)} hrs
                      </span>
                    ) : (
                      '--'
                    )}
                  </td>
                  <td style={cellStyle}>
                    <StatusBadgeInline status={getFleetStatusLabel(aircraft)} />
                  </td>
                  <td style={cellStyle}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            padding: 4,
                            borderRadius: 4,
                            color: 'var(--text-tertiary)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <MoreVertical size={16} />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => {
                            setAdjustTarget(aircraft);
                            setAdjustHours(aircraft.totalHours.toString());
                            setAdjustCycles(aircraft.totalCycles.toString());
                          }}
                        >
                          <Pencil size={14} /> Adjust Hours
                        </DropdownMenuItem>
                        {aircraft.status === 'maintenance' && (
                          <DropdownMenuItem onClick={() => handleReturnToService(aircraft)}>
                            <RotateCw size={14} /> Return to Service
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </motion.tr>
              ))
            )}
          </motion.tbody>
        </table>
      </div>

      {/* Adjust Hours Dialog */}
      <Dialog open={!!adjustTarget} onOpenChange={(open) => { if (!open) setAdjustTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adjust Hours &mdash; {adjustTarget?.registration}</DialogTitle>
            <DialogDescription>
              Update the total hours and cycles for this aircraft. A reason is required for audit purposes.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Total Hours</Label>
                <Input type="number" step="0.1" value={adjustHours} onChange={(e) => setAdjustHours(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Total Cycles</Label>
                <Input type="number" step="1" value={adjustCycles} onChange={(e) => setAdjustCycles(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Reason *</Label>
              <Textarea
                value={adjustReason}
                onChange={(e) => setAdjustReason(e.target.value)}
                placeholder="Reason for adjustment..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdjustTarget(null)} disabled={adjustLoading}>Cancel</Button>
            <Button onClick={handleAdjustHours} disabled={adjustLoading || !adjustReason.trim()}>
              {adjustLoading ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════
// Maintenance Log Tab Content
// ═══════════════════════════════════════════════════════════════

function MaintenanceLogContent({ onOpenCreate }: { onOpenCreate: () => void }) {
  const [entries, setEntries] = useState<MaintenanceLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);

  // Filters
  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  // Dialogs
  const [editEntry, setEditEntry] = useState<MaintenanceLogEntry | null>(null);
  const [deleteEntry, setDeleteEntry] = useState<MaintenanceLogEntry | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Form state
  const [formAircraftId, setFormAircraftId] = useState('');
  const [formCheckType, setFormCheckType] = useState<MaintenanceLogType>('LINE');
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formPerformedBy, setFormPerformedBy] = useState('');
  const [formStatus, setFormStatus] = useState<MaintenanceLogStatus>('scheduled');
  const [formCost, setFormCost] = useState('');
  const [formLoading, setFormLoading] = useState(false);

  const fetchEntries = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      params.set('page', page.toString());
      params.set('pageSize', pageSize.toString());
      if (statusFilter !== 'all') params.set('status', statusFilter);

      const res = await api.get<{ entries: MaintenanceLogEntry[]; total: number; page: number; pageSize: number }>(
        `/api/admin/maintenance/log?${params.toString()}`,
      );
      setEntries(res.entries);
      setTotal(res.total);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to load maintenance log');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, statusFilter]);

  useEffect(() => { fetchEntries(); }, [fetchEntries]);

  const filtered = useMemo(() => {
    let list = entries;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (e) =>
          e.title.toLowerCase().includes(q) ||
          (e.aircraftRegistration?.toLowerCase().includes(q) ?? false) ||
          (e.performedBy?.toLowerCase().includes(q) ?? false),
      );
    }
    if (dateFilter !== 'all') {
      const now = new Date();
      list = list.filter((e) => {
        const d = new Date(e.createdAt);
        if (dateFilter === '7d') return now.getTime() - d.getTime() < 7 * 86400000;
        if (dateFilter === '30d') return now.getTime() - d.getTime() < 30 * 86400000;
        if (dateFilter === '90d') return now.getTime() - d.getTime() < 90 * 86400000;
        return true;
      });
    }
    return list;
  }, [entries, search, dateFilter]);

  function resetForm() {
    setFormAircraftId('');
    setFormCheckType('LINE');
    setFormTitle('');
    setFormDescription('');
    setFormPerformedBy('');
    setFormStatus('scheduled');
    setFormCost('');
  }

  function openEdit(entry: MaintenanceLogEntry) {
    setEditEntry(entry);
    setFormAircraftId(entry.aircraftId.toString());
    setFormCheckType(entry.checkType);
    setFormTitle(entry.title);
    setFormDescription(entry.description ?? '');
    setFormPerformedBy(entry.performedBy ?? '');
    setFormStatus(entry.status);
    setFormCost(entry.cost?.toString() ?? '');
  }

  async function handleUpdate() {
    if (!editEntry || !formTitle.trim()) return;
    setFormLoading(true);
    try {
      await api.patch(`/api/admin/maintenance/log/${editEntry.id}`, {
        checkType: formCheckType,
        title: formTitle.trim(),
        description: formDescription.trim() || undefined,
        performedBy: formPerformedBy.trim() || undefined,
        status: formStatus,
        cost: formCost ? parseFloat(formCost) : undefined,
      });
      toast.success('Log entry updated');
      setEditEntry(null);
      resetForm();
      fetchEntries();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to update log entry');
    } finally {
      setFormLoading(false);
    }
  }

  async function handleComplete(entry: MaintenanceLogEntry) {
    try {
      await api.post(`/api/admin/maintenance/log/${entry.id}/complete`);
      toast.success('Check marked as completed');
      fetchEntries();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to complete check');
    }
  }

  async function handleDelete() {
    if (!deleteEntry) return;
    setDeleteLoading(true);
    try {
      await api.delete(`/api/admin/maintenance/log/${deleteEntry.id}`);
      toast.success('Log entry deleted');
      setDeleteEntry(null);
      fetchEntries();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to delete log entry');
    } finally {
      setDeleteLoading(false);
    }
  }

  const logTypes: MaintenanceLogType[] = ['A', 'B', 'C', 'D', 'LINE', 'UNSCHEDULED', 'AD', 'MEL', 'SFP'];
  const logStatuses: MaintenanceLogStatus[] = ['scheduled', 'in_progress', 'completed', 'deferred'];

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  if (loading) return <TableSkeleton />;

  return (
    <>
      {/* Filter Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '12px 24px',
          borderBottom: '1px solid var(--border-primary)',
        }}
      >
        <div style={{ position: 'relative', width: 220 }}>
          <Search
            size={14}
            style={{
              position: 'absolute',
              left: 10,
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-tertiary)',
            }}
          />
          <input
            type="text"
            placeholder="Search entries..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-glow"
            style={{
              width: '100%',
              height: 32,
              paddingLeft: 30,
              paddingRight: 10,
              background: 'var(--input-bg)',
              border: '1px solid var(--input-border)',
              borderRadius: 6,
              color: 'var(--text-primary)',
              fontSize: 12,
              outline: 'none',
            }}
          />
        </div>
        <Select value={dateFilter} onValueChange={setDateFilter}>
          <SelectTrigger
            style={{
              width: 130,
              height: 32,
              background: 'var(--input-bg)',
              border: '1px solid var(--input-border)',
              borderRadius: 6,
              color: 'var(--text-primary)',
              fontSize: 12,
            }}
          >
            <SelectValue placeholder="Date: All" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Date: All</SelectItem>
            <SelectItem value="7d">Last 7 days</SelectItem>
            <SelectItem value="30d">Last 30 days</SelectItem>
            <SelectItem value="90d">Last 90 days</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
          <SelectTrigger
            style={{
              width: 140,
              height: 32,
              background: 'var(--input-bg)',
              border: '1px solid var(--input-border)',
              borderRadius: 6,
              color: 'var(--text-primary)',
              fontSize: 12,
            }}
          >
            <SelectValue placeholder="Status: All" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Status: All</SelectItem>
            {logStatuses.map((s) => (
              <SelectItem key={s} value={s}>
                {s.charAt(0).toUpperCase() + s.slice(1).replace('_', ' ')}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={colHeaderStyle}>DATE</th>
              <th style={colHeaderStyle}>AIRCRAFT</th>
              <th style={colHeaderStyle}>TYPE</th>
              <th style={colHeaderStyle}>DESCRIPTION</th>
              <th style={colHeaderStyle}>COST</th>
              <th style={colHeaderStyle}>DURATION</th>
              <th style={colHeaderStyle}>STATUS</th>
              <th style={{ ...colHeaderStyle, width: 50 }} />
            </tr>
          </thead>
          <motion.tbody variants={tableContainer} initial="hidden" animate="visible">
            {filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={8}
                  style={{ padding: '40px 16px', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}
                >
                  No log entries found
                </td>
              </tr>
            ) : (
              filtered.map((entry) => (
                <motion.tr
                  key={entry.id}
                  variants={tableRow}
                  style={{ cursor: 'default' }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                >
                  <td style={{ ...cellStyle, color: 'var(--text-tertiary)', fontSize: 11 }}>
                    {formatDate(entry.createdAt)}
                  </td>
                  <td style={{ ...cellStyle, fontWeight: 600, color: 'var(--text-primary)', fontSize: 12, fontFamily: 'var(--font-mono)' }}>
                    {entry.aircraftRegistration ?? `#${entry.aircraftId}`}
                  </td>
                  <td style={cellStyle}>
                    <TypeBadge type={entry.checkType} />
                  </td>
                  <td
                    style={{
                      ...cellStyle,
                      color: 'var(--text-secondary)',
                      fontSize: 11,
                      maxWidth: 260,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {entry.title}
                  </td>
                  <td style={{ ...cellStyle, color: 'var(--text-secondary)', fontSize: 11, fontFamily: 'var(--font-mono)' }}>
                    {formatCurrency(entry.cost)}
                  </td>
                  <td style={{ ...cellStyle, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                    {entry.durationHours != null ? `${formatHours(entry.durationHours)}h` : '--'}
                  </td>
                  <td style={cellStyle}>
                    <StatusBadgeInline status={entry.status} />
                  </td>
                  <td style={cellStyle}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            padding: 4,
                            borderRadius: 4,
                            color: 'var(--text-tertiary)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreVertical size={16} />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEdit(entry)}>
                          <Pencil size={14} /> Edit
                        </DropdownMenuItem>
                        {entry.status !== 'completed' && (
                          <DropdownMenuItem onClick={() => handleComplete(entry)}>
                            <CheckCircle2 size={14} className="text-[var(--accent-emerald)]" /> Complete
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-[var(--accent-red)] focus:text-[var(--accent-red)]"
                          onClick={() => setDeleteEntry(entry)}
                        >
                          <Trash2 size={14} /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </motion.tr>
              ))
            )}
          </motion.tbody>
        </table>
      </div>

      {/* Pagination */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 24px',
          borderTop: '1px solid var(--border-primary)',
          fontSize: 12,
          color: 'var(--text-tertiary)',
        }}
      >
        <span>
          {total === 0 ? 'No results' : `${(page - 1) * pageSize + 1}--${Math.min(page * pageSize, total)} of ${total}`}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <button
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            style={{
              background: 'none',
              border: '1px solid var(--border-primary)',
              borderRadius: 4,
              padding: '4px 8px',
              cursor: page <= 1 ? 'not-allowed' : 'pointer',
              color: page <= 1 ? 'var(--text-quaternary)' : 'var(--text-secondary)',
              display: 'flex',
              alignItems: 'center',
              opacity: page <= 1 ? 0.5 : 1,
            }}
          >
            <ChevronLeft size={14} />
          </button>
          <span style={{ padding: '0 8px', color: 'var(--text-secondary)', fontSize: 12 }}>
            {page} / {totalPages}
          </span>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            style={{
              background: 'none',
              border: '1px solid var(--border-primary)',
              borderRadius: 4,
              padding: '4px 8px',
              cursor: page >= totalPages ? 'not-allowed' : 'pointer',
              color: page >= totalPages ? 'var(--text-quaternary)' : 'var(--text-secondary)',
              display: 'flex',
              alignItems: 'center',
              opacity: page >= totalPages ? 0.5 : 1,
            }}
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      {/* Edit Dialog */}
      <Dialog
        open={!!editEntry}
        onOpenChange={(open) => { if (!open) { setEditEntry(null); resetForm(); } }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Log Entry</DialogTitle>
            <DialogDescription>Update this maintenance log entry.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Check Type *</Label>
                <Select value={formCheckType} onValueChange={(v) => setFormCheckType(v as MaintenanceLogType)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {logTypes.map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={formStatus} onValueChange={(v) => setFormStatus(v as MaintenanceLogStatus)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {logStatuses.map((s) => (
                      <SelectItem key={s} value={s}>{s.replace('_', ' ')}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Title *</Label>
              <Input value={formTitle} onChange={(e) => setFormTitle(e.target.value)} placeholder="Maintenance action title" />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea value={formDescription} onChange={(e) => setFormDescription(e.target.value)} rows={3} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Performed By</Label>
                <Input value={formPerformedBy} onChange={(e) => setFormPerformedBy(e.target.value)} placeholder="Technician name" />
              </div>
              <div className="space-y-2">
                <Label>Cost</Label>
                <Input type="number" step="0.01" value={formCost} onChange={(e) => setFormCost(e.target.value)} placeholder="0.00" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setEditEntry(null); resetForm(); }} disabled={formLoading}>
              Cancel
            </Button>
            <Button onClick={handleUpdate} disabled={formLoading || !formTitle.trim()}>
              {formLoading ? 'Saving...' : 'Update'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <Dialog open={!!deleteEntry} onOpenChange={(open) => { if (!open) setDeleteEntry(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Log Entry</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &ldquo;{deleteEntry?.title}&rdquo;? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteEntry(null)} disabled={deleteLoading}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleteLoading}>
              {deleteLoading ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════
// Create Entry Dialog (shared)
// ═══════════════════════════════════════════════════════════════

function CreateEntryDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const [formAircraftId, setFormAircraftId] = useState('');
  const [formCheckType, setFormCheckType] = useState<MaintenanceLogType>('LINE');
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formPerformedBy, setFormPerformedBy] = useState('');
  const [formStatus, setFormStatus] = useState<MaintenanceLogStatus>('scheduled');
  const [formCost, setFormCost] = useState('');
  const [formLoading, setFormLoading] = useState(false);

  const logTypes: MaintenanceLogType[] = ['A', 'B', 'C', 'D', 'LINE', 'UNSCHEDULED', 'AD', 'MEL', 'SFP'];
  const logStatuses: MaintenanceLogStatus[] = ['scheduled', 'in_progress', 'completed', 'deferred'];

  function resetForm() {
    setFormAircraftId('');
    setFormCheckType('LINE');
    setFormTitle('');
    setFormDescription('');
    setFormPerformedBy('');
    setFormStatus('scheduled');
    setFormCost('');
  }

  async function handleCreate() {
    if (!formAircraftId || !formTitle.trim()) return;
    setFormLoading(true);
    try {
      await api.post('/api/admin/maintenance/log', {
        aircraftId: parseInt(formAircraftId),
        checkType: formCheckType,
        title: formTitle.trim(),
        description: formDescription.trim() || undefined,
        performedBy: formPerformedBy.trim() || undefined,
        status: formStatus,
        cost: formCost ? parseFloat(formCost) : undefined,
      });
      toast.success('Log entry created');
      resetForm();
      onClose();
      onCreated();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to create log entry');
    } finally {
      setFormLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { resetForm(); onClose(); } }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>New Log Entry</DialogTitle>
          <DialogDescription>Create a new maintenance log entry.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Aircraft ID *</Label>
            <Input type="number" value={formAircraftId} onChange={(e) => setFormAircraftId(e.target.value)} placeholder="Aircraft ID" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Check Type *</Label>
              <Select value={formCheckType} onValueChange={(v) => setFormCheckType(v as MaintenanceLogType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {logTypes.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={formStatus} onValueChange={(v) => setFormStatus(v as MaintenanceLogStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {logStatuses.map((s) => (
                    <SelectItem key={s} value={s}>{s.replace('_', ' ')}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Title *</Label>
            <Input value={formTitle} onChange={(e) => setFormTitle(e.target.value)} placeholder="Maintenance action title" />
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea value={formDescription} onChange={(e) => setFormDescription(e.target.value)} rows={3} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Performed By</Label>
              <Input value={formPerformedBy} onChange={(e) => setFormPerformedBy(e.target.value)} placeholder="Technician name" />
            </div>
            <div className="space-y-2">
              <Label>Cost</Label>
              <Input type="number" step="0.01" value={formCost} onChange={(e) => setFormCost(e.target.value)} placeholder="0.00" />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => { resetForm(); onClose(); }} disabled={formLoading}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={formLoading || !formTitle.trim() || !formAircraftId}>
            {formLoading ? 'Saving...' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ═══════════════════════════════════════════════════════════════
// Main Page
// ═══════════════════════════════════════════════════════════════

export function MaintenancePage() {
  const [activeTab, setActiveTab] = useState<'fleet' | 'log'>('fleet');
  const [createOpen, setCreateOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <motion.div
      variants={pageVariants}
      initial="hidden"
      animate="visible"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: 'var(--surface-0)',
        color: 'var(--text-primary)',
      }}
    >
      {/* ── Page Header ──────────────────────────────────────── */}
      <motion.div
        variants={fadeUp}
        style={{
          padding: '16px 24px',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        {/* Title Row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Wrench size={20} style={{ color: 'var(--accent-blue)' }} />
          <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>
            Maintenance
          </span>
          <div style={{ flex: 1 }} />
          <button
            onClick={() => setCreateOpen(true)}
            className="btn-glow"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 16px',
              background: 'var(--accent-blue)',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'opacity 120ms',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.85'; }}
            onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
          >
            <Plus size={14} />
            Log Entry
          </button>
        </div>

        {/* Tabs */}
        <div
          style={{
            display: 'flex',
            gap: 0,
            borderBottom: '1px solid var(--border-primary)',
          }}
        >
          <button
            onClick={() => setActiveTab('fleet')}
            style={{
              background: 'none',
              border: 'none',
              borderBottom: activeTab === 'fleet' ? '2px solid var(--accent-blue)' : '2px solid transparent',
              padding: '8px 16px',
              fontSize: 13,
              fontWeight: 500,
              color: activeTab === 'fleet' ? 'var(--accent-blue-bright)' : 'var(--text-tertiary)',
              cursor: 'pointer',
              transition: 'color 120ms',
            }}
          >
            Fleet Status
          </button>
          <button
            onClick={() => setActiveTab('log')}
            style={{
              background: 'none',
              border: 'none',
              borderBottom: activeTab === 'log' ? '2px solid var(--accent-blue)' : '2px solid transparent',
              padding: '8px 16px',
              fontSize: 13,
              fontWeight: 500,
              color: activeTab === 'log' ? 'var(--accent-blue-bright)' : 'var(--text-tertiary)',
              cursor: 'pointer',
              transition: 'color 120ms',
            }}
          >
            Maintenance Log
          </button>
        </div>
      </motion.div>

      {/* ── Tab Content ──────────────────────────────────────── */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {activeTab === 'fleet' && <FleetStatusContent />}
        {activeTab === 'log' && (
          <MaintenanceLogContent
            key={refreshKey}
            onOpenCreate={() => setCreateOpen(true)}
          />
        )}
      </div>

      {/* ── Create Entry Dialog ──────────────────────────────── */}
      <CreateEntryDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => setRefreshKey((k) => k + 1)}
      />
    </motion.div>
  );
}
