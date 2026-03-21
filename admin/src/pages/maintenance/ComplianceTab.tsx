import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AirworthinessDirectivesSection } from './AirworthinessDirectivesSection';
import { motion } from 'motion/react';
import {
  Search,
  Plus,
  Pencil,
  Trash2,
  MoreVertical,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { toast } from '@/stores/toastStore';
import { tableContainer, tableRow } from '@/lib/motion';
import { formatDate, formatHours } from '@/lib/formatters';
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

// ── Types ────────────────────────────────────────────────────

export type MaintenanceLogType = 'A' | 'B' | 'C' | 'D' | 'LINE' | 'UNSCHEDULED' | 'AD' | 'MEL' | 'SFP';
export type MaintenanceLogStatus = 'scheduled' | 'in_progress' | 'completed' | 'deferred';

export interface MaintenanceLogEntry {
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

// formatDate, formatHours imported from @/lib/formatters

function formatCurrency(v: number | null): string {
  if (v === null || v === undefined) return '--';
  return `$${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ── Badges ───────────────────────────────────────────────────

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

// ── Shared Styles ────────────────────────────────────────────

const COL_HEADER_CLASS = 'text-subheading';
const colHeaderStyle: React.CSSProperties = {
  textAlign: 'left',
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

// ═══════════════════════════════════════════════════════════════
// Create Entry Dialog
// ═══════════════════════════════════════════════════════════════

interface FleetAircraftShort {
  aircraftId: number;
  registration: string;
  icaoType: string;
}

function CreateEntryDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const [fleet, setFleet] = useState<FleetAircraftShort[]>([]);
  const [formAircraftId, setFormAircraftId] = useState('');
  const [formCheckType, setFormCheckType] = useState<MaintenanceLogType>('LINE');
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formPerformedBy, setFormPerformedBy] = useState('');
  const [formPerformedAt, setFormPerformedAt] = useState('');
  const [formStatus, setFormStatus] = useState<MaintenanceLogStatus>('scheduled');
  const [formCost, setFormCost] = useState('');
  const [formLoading, setFormLoading] = useState(false);

  const logTypes: MaintenanceLogType[] = ['A', 'B', 'C', 'D', 'LINE', 'UNSCHEDULED', 'AD', 'MEL', 'SFP'];
  const logStatuses: MaintenanceLogStatus[] = ['scheduled', 'in_progress', 'completed', 'deferred'];

  useEffect(() => {
    if (!open) return;
    api.get<{ fleet: FleetAircraftShort[] }>('/api/admin/maintenance/fleet-status')
      .then((res) => setFleet(res.fleet))
      .catch(() => {});
  }, [open]);

  function resetForm() {
    setFormAircraftId('');
    setFormCheckType('LINE');
    setFormTitle('');
    setFormDescription('');
    setFormPerformedBy('');
    setFormPerformedAt('');
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
        performedAt: formPerformedAt || undefined,
        status: formStatus,
        cost: formCost ? parseFloat(formCost.replace(/,/g, '')) : undefined,
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
            <Label>Aircraft *</Label>
            <Select value={formAircraftId} onValueChange={setFormAircraftId}>
              <SelectTrigger><SelectValue placeholder="Select aircraft..." /></SelectTrigger>
              <SelectContent>
                {fleet.map((a) => (
                  <SelectItem key={a.aircraftId} value={a.aircraftId.toString()}>
                    {a.registration} ({a.icaoType})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
                    <SelectItem key={s} value={s}>{s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}</SelectItem>
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
              <Label>Date Completed</Label>
              <Input type="date" value={formPerformedAt} onChange={(e) => setFormPerformedAt(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Cost ($)</Label>
            <Input
              value={formCost}
              onChange={(e) => {
                const raw = e.target.value.replace(/[^0-9.,]/g, '');
                setFormCost(raw);
              }}
              placeholder="126,483.22"
              className="data-md"
            />
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
// Maintenance Log Content
// ═══════════════════════════════════════════════════════════════

function MaintenanceLogContent({ refreshKey }: { refreshKey: number }) {
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
  const [formCheckType, setFormCheckType] = useState<MaintenanceLogType>('LINE');
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formPerformedBy, setFormPerformedBy] = useState('');
  const [formPerformedAt, setFormPerformedAt] = useState('');
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

  useEffect(() => { fetchEntries(); }, [fetchEntries, refreshKey]);

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
    setFormCheckType('LINE');
    setFormTitle('');
    setFormDescription('');
    setFormPerformedBy('');
    setFormPerformedAt('');
    setFormStatus('scheduled');
    setFormCost('');
  }

  function openEdit(entry: MaintenanceLogEntry) {
    setEditEntry(entry);
    setFormCheckType(entry.checkType);
    setFormTitle(entry.title);
    setFormDescription(entry.description ?? '');
    setFormPerformedBy(entry.performedBy ?? '');
    setFormPerformedAt(entry.performedAt ? entry.performedAt.split('T')[0] : '');
    setFormStatus(entry.status);
    setFormCost(entry.cost != null ? entry.cost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '');
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
        performedAt: formPerformedAt || undefined,
        status: formStatus,
        cost: formCost ? parseFloat(formCost.replace(/,/g, '')) : undefined,
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
            className="input-glow text-caption"
            style={{
              width: '100%',
              height: 32,
              paddingLeft: 30,
              paddingRight: 10,
              background: 'var(--input-bg)',
              border: '1px solid var(--input-border)',
              borderRadius: 6,
              color: 'var(--text-primary)',
              outline: 'none',
            }}
          />
        </div>
        <Select value={dateFilter} onValueChange={setDateFilter}>
          <SelectTrigger
            className="text-caption"
            style={{
              width: 130,
              height: 32,
              background: 'var(--input-bg)',
              border: '1px solid var(--input-border)',
              borderRadius: 6,
              color: 'var(--text-primary)',
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
            className="text-caption"
            style={{
              width: 140,
              height: 32,
              background: 'var(--input-bg)',
              border: '1px solid var(--input-border)',
              borderRadius: 6,
              color: 'var(--text-primary)',
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
              <th className={COL_HEADER_CLASS} style={colHeaderStyle}>DATE</th>
              <th className={COL_HEADER_CLASS} style={colHeaderStyle}>AIRCRAFT</th>
              <th className={COL_HEADER_CLASS} style={colHeaderStyle}>TYPE</th>
              <th className={COL_HEADER_CLASS} style={colHeaderStyle}>DESCRIPTION</th>
              <th className={COL_HEADER_CLASS} style={colHeaderStyle}>COST</th>
              <th className={COL_HEADER_CLASS} style={colHeaderStyle}>DURATION</th>
              <th className={COL_HEADER_CLASS} style={colHeaderStyle}>STATUS</th>
              <th className={COL_HEADER_CLASS} style={{ ...colHeaderStyle, width: 50 }} />
            </tr>
          </thead>
          <motion.tbody variants={tableContainer} initial="hidden" animate="visible">
            {filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={8}
                  className="text-body"
                  style={{ padding: '40px 16px', textAlign: 'center', color: 'var(--text-tertiary)' }}
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
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--tint-subtle)'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                >
                  <td className={CELL_CLASS} style={cellStyle}>
                    {formatDate(entry.createdAt)}
                  </td>
                  <td className={`${CELL_CLASS} data-sm`} style={{ ...cellStyle, fontWeight: 600, color: 'var(--text-primary)' }}>
                    {entry.aircraftRegistration ?? `#${entry.aircraftId}`}
                  </td>
                  <td className={CELL_CLASS} style={cellStyle}>
                    <TypeBadge type={entry.checkType} />
                  </td>
                  <td
                    className={CELL_CLASS}
                    style={{
                      ...cellStyle,
                      maxWidth: 260,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {entry.title}
                  </td>
                  <td className={`${CELL_CLASS} data-sm`} style={cellStyle}>
                    {formatCurrency(entry.cost)}
                  </td>
                  <td className={`${CELL_CLASS} data-sm`} style={cellStyle}>
                    {entry.durationHours != null ? `${formatHours(entry.durationHours)}h` : '--'}
                  </td>
                  <td className={CELL_CLASS} style={cellStyle}>
                    <StatusBadgeInline status={entry.status} />
                  </td>
                  <td className={CELL_CLASS} style={cellStyle}>
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
        }}
        className="text-caption"
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
          <span className="data-sm" style={{ padding: '0 8px', color: 'var(--text-secondary)' }}>
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
                      <SelectItem key={s} value={s}>{s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}</SelectItem>
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
                <Label>Date Completed</Label>
                <Input type="date" value={formPerformedAt} onChange={(e) => setFormPerformedAt(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Cost ($)</Label>
              <Input
                value={formCost}
                onChange={(e) => {
                  const raw = e.target.value.replace(/[^0-9.,]/g, '');
                  setFormCost(raw);
                }}
                placeholder="126,483.22"
                className="data-md"
              />
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
// Compliance Tab (exported)
// ═══════════════════════════════════════════════════════════════

export function ComplianceTab() {
  const [subTab, setSubTab] = useState<'log' | 'ads'>('log');
  const [createOpen, setCreateOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Sub-tab bar + Create button */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 0,
          padding: '0 24px',
          borderBottom: '1px solid var(--border-primary)',
        }}
      >
        <button
          onClick={() => setSubTab('log')}
          className="text-caption"
          style={{
            background: 'none',
            border: 'none',
            borderBottom: subTab === 'log' ? '2px solid var(--accent-blue)' : '2px solid transparent',
            padding: '8px 16px',
            fontWeight: 500,
            color: subTab === 'log' ? 'var(--accent-blue-bright)' : 'var(--text-tertiary)',
            cursor: 'pointer',
            transition: 'color 120ms',
          }}
        >
          Maintenance Log
        </button>
        <button
          onClick={() => setSubTab('ads')}
          className="text-caption"
          style={{
            background: 'none',
            border: 'none',
            borderBottom: subTab === 'ads' ? '2px solid var(--accent-blue)' : '2px solid transparent',
            padding: '8px 16px',
            fontWeight: 500,
            color: subTab === 'ads' ? 'var(--accent-blue-bright)' : 'var(--text-tertiary)',
            cursor: 'pointer',
            transition: 'color 120ms',
          }}
        >
          Airworthiness Directives
        </button>
        <div style={{ flex: 1 }} />
        {subTab === 'log' && (
          <button
            onClick={() => setCreateOpen(true)}
            className="btn-glow text-caption"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 14px',
              background: 'var(--accent-blue)',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'opacity 120ms',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.85'; }}
            onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
          >
            <Plus size={13} />
            Log Entry
          </button>
        )}
      </div>

      {/* Sub-tab content */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {subTab === 'log' && (
          <MaintenanceLogContent refreshKey={refreshKey} />
        )}
        {subTab === 'ads' && (
          <AirworthinessDirectivesSection refreshKey={refreshKey} />
        )}
      </div>

      {/* Create Entry Dialog */}
      <CreateEntryDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => setRefreshKey((k) => k + 1)}
      />
    </div>
  );
}
