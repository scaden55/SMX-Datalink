import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { Plus, Pencil, Trash2, MoreVertical, ChevronLeft, ChevronRight } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { toast } from '@/stores/toastStore';
import { tableContainer, tableRow } from '@/lib/motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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

interface AircraftComponent {
  id: number;
  aircraftId: number;
  registration?: string;
  componentType: ComponentType;
  partNumber: string;
  serialNumber: string;
  position: string | null;
  hoursSinceNew: number | null;
  cyclesSinceNew: number | null;
  hoursSinceOverhaul: number | null;
  cyclesSinceOverhaul: number | null;
  overhaulIntervalHours: number | null;
  status: ComponentStatus;
  installDate: string | null;
  notes: string | null;
}

interface FleetAircraft {
  id: number;
  registration: string;
  icaoType: string;
  name: string;
}

type ComponentType = 'ENGINE' | 'APU' | 'LANDING_GEAR' | 'PROP' | 'AVIONICS' | 'OTHER';
type ComponentStatus = 'installed' | 'removed' | 'in_shop' | 'scrapped';

const ALL_COMPONENT_TYPES: ComponentType[] = ['ENGINE', 'APU', 'LANDING_GEAR', 'PROP', 'AVIONICS', 'OTHER'];
const ALL_STATUSES: ComponentStatus[] = ['installed', 'removed', 'in_shop', 'scrapped'];

const TYPE_BADGE_COLORS: Record<ComponentType, { bg: string; text: string }> = {
  ENGINE: { bg: 'var(--accent-blue-bg)', text: 'var(--accent-blue-bright)' },
  APU: { bg: 'var(--accent-cyan-bg)', text: 'var(--accent-cyan)' },
  LANDING_GEAR: { bg: 'var(--accent-amber-bg)', text: 'var(--accent-amber)' },
  PROP: { bg: 'var(--accent-emerald-bg)', text: 'var(--accent-emerald)' },
  AVIONICS: { bg: 'rgba(123,148,224,0.12)', text: 'var(--accent-blue-bright)' },
  OTHER: { bg: 'var(--surface-2)', text: 'var(--text-tertiary)' },
};

const STATUS_BADGE_COLORS: Record<ComponentStatus, { bg: string; text: string }> = {
  installed: { bg: 'var(--accent-emerald-bg)', text: 'var(--accent-emerald)' },
  removed: { bg: 'var(--accent-amber-bg)', text: 'var(--accent-amber)' },
  in_shop: { bg: 'var(--accent-cyan-bg)', text: 'var(--accent-cyan)' },
  scrapped: { bg: 'var(--accent-red-bg)', text: 'var(--accent-red)' },
};

const TYPE_LABELS: Record<ComponentType, string> = {
  ENGINE: 'Engine',
  APU: 'APU',
  LANDING_GEAR: 'Landing Gear',
  PROP: 'Prop',
  AVIONICS: 'Avionics',
  OTHER: 'Other',
};

const STATUS_LABELS: Record<ComponentStatus, string> = {
  installed: 'Installed',
  removed: 'Removed',
  in_shop: 'In Shop',
  scrapped: 'Scrapped',
};

// ── Helpers ──────────────────────────────────────────────────

function TypeBadge({ type }: { type: ComponentType }) {
  const c = TYPE_BADGE_COLORS[type];
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
      {TYPE_LABELS[type]}
    </span>
  );
}

function StatusBadge({ status }: { status: ComponentStatus }) {
  const c = STATUS_BADGE_COLORS[status];
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
      {STATUS_LABELS[status]}
    </span>
  );
}

// ── Shared Styles ────────────────────────────────────────────

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

const monoStyle: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontVariantNumeric: 'tabular-nums',
};

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

// ── Pagination ──────────────────────────────────────────────

const PAGE_SIZE = 25;

// ═══════════════════════════════════════════════════════════════
// ComponentsSection
// ═══════════════════════════════════════════════════════════════

export function ComponentsSection({ refreshKey }: { refreshKey: number }) {
  const [items, setItems] = useState<AircraftComponent[]>([]);
  const [fleet, setFleet] = useState<FleetAircraft[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [aircraftFilter, setAircraftFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  // Pagination
  const [page, setPage] = useState(1);

  // Dialog state
  const [createOpen, setCreateOpen] = useState(false);
  const [editItem, setEditItem] = useState<AircraftComponent | null>(null);
  const [deleteItem, setDeleteItem] = useState<AircraftComponent | null>(null);

  // Row hover
  const [hoveredId, setHoveredId] = useState<number | null>(null);

  // ── Fetch ────────────────────────────────────────────────

  const fetchItems = useCallback(async () => {
    try {
      const res = await api.get<{ components: AircraftComponent[] }>(
        '/api/admin/maintenance/components',
      );
      setItems(res.components);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to load components');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchFleet = useCallback(async () => {
    try {
      const res = await api.get<{ aircraft: FleetAircraft[] }>(
        '/api/admin/maintenance/fleet-status',
      );
      setFleet(res.aircraft);
    } catch (err) {
      console.warn('Failed to load fleet data', err);
    }
  }, []);

  useEffect(() => {
    fetchItems();
    fetchFleet();
  }, [fetchItems, fetchFleet, refreshKey]);

  // ── Derived data ───────────────────────────────────────────

  const filtered = useMemo(() => {
    let result = items;
    if (aircraftFilter !== 'all') {
      result = result.filter((i) => String(i.aircraftId) === aircraftFilter);
    }
    if (typeFilter !== 'all') {
      result = result.filter((i) => i.componentType === typeFilter);
    }
    if (statusFilter !== 'all') {
      result = result.filter((i) => i.status === statusFilter);
    }
    return result;
  }, [items, aircraftFilter, typeFilter, statusFilter]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [aircraftFilter, typeFilter, statusFilter]);

  // ── Delete ───────────────────────────────────────────────

  async function handleDelete() {
    if (!deleteItem) return;
    try {
      await api.delete(`/api/admin/maintenance/components/${deleteItem.id}`);
      toast.success(`Deleted component ${deleteItem.partNumber}`);
      setDeleteItem(null);
      fetchItems();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to delete component');
    }
  }

  // ── Render ────────────────────────────────────────────────

  if (loading) return <TableSkeleton />;

  return (
    <>
      {/* Filter bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '12px 24px',
          borderBottom: '1px solid var(--border-primary)',
          flexWrap: 'wrap',
        }}
      >
        <Select value={aircraftFilter} onValueChange={setAircraftFilter}>
          <SelectTrigger style={{ width: 160, fontSize: 12 }}>
            <SelectValue placeholder="All Aircraft" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Aircraft</SelectItem>
            {fleet.map((a) => (
              <SelectItem key={a.id} value={String(a.id)}>
                {a.registration}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger style={{ width: 160, fontSize: 12 }}>
            <SelectValue placeholder="All Types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {ALL_COMPONENT_TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                {TYPE_LABELS[t]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger style={{ width: 140, fontSize: 12 }}>
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            {ALL_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {STATUS_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div style={{ flex: 1 }} />

        <button
          onClick={() => setCreateOpen(true)}
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
          Add Component
        </button>
      </div>

      {/* Empty state */}
      {filtered.length === 0 && (
        <div
          style={{
            padding: '60px 24px',
            textAlign: 'center',
            color: 'var(--text-tertiary)',
            fontSize: 13,
          }}
        >
          No components found. Add a component to get started.
        </div>
      )}

      {/* Table */}
      {filtered.length > 0 && (
        <>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={colHeaderStyle}>Aircraft</th>
                  <th style={colHeaderStyle}>Type</th>
                  <th style={colHeaderStyle}>Part #</th>
                  <th style={colHeaderStyle}>Serial #</th>
                  <th style={colHeaderStyle}>Position</th>
                  <th style={{ ...colHeaderStyle, textAlign: 'right' }}>Hrs Since New</th>
                  <th style={{ ...colHeaderStyle, textAlign: 'right' }}>Cyc Since New</th>
                  <th style={{ ...colHeaderStyle, textAlign: 'right' }}>Overhaul Int.</th>
                  <th style={{ ...colHeaderStyle, textAlign: 'center' }}>Status</th>
                  <th style={{ ...colHeaderStyle, width: 48 }} />
                </tr>
              </thead>
              <motion.tbody variants={tableContainer} initial="hidden" animate="visible">
                {paged.map((item) => (
                  <motion.tr
                    key={item.id}
                    variants={tableRow}
                    style={{
                      background: hoveredId === item.id ? 'var(--surface-3)' : 'transparent',
                      transition: 'background 80ms',
                    }}
                    onMouseEnter={() => setHoveredId(item.id)}
                    onMouseLeave={() => setHoveredId(null)}
                  >
                    {/* Aircraft */}
                    <td style={{ ...cellStyle, ...monoStyle, fontSize: 12 }}>
                      {item.registration ?? '\u2014'}
                    </td>

                    {/* Type */}
                    <td style={cellStyle}>
                      <TypeBadge type={item.componentType} />
                    </td>

                    {/* Part # */}
                    <td style={{ ...cellStyle, ...monoStyle, fontSize: 12 }}>
                      {item.partNumber}
                    </td>

                    {/* Serial # */}
                    <td style={{ ...cellStyle, ...monoStyle, fontSize: 12 }}>
                      {item.serialNumber}
                    </td>

                    {/* Position */}
                    <td style={{ ...cellStyle, fontSize: 12 }}>
                      {item.position ?? '\u2014'}
                    </td>

                    {/* Hours Since New */}
                    <td style={{ ...cellStyle, ...monoStyle, textAlign: 'right' }}>
                      {item.hoursSinceNew != null ? item.hoursSinceNew.toLocaleString() : '\u2014'}
                    </td>

                    {/* Cycles Since New */}
                    <td style={{ ...cellStyle, ...monoStyle, textAlign: 'right' }}>
                      {item.cyclesSinceNew != null ? item.cyclesSinceNew.toLocaleString() : '\u2014'}
                    </td>

                    {/* Overhaul Interval */}
                    <td style={{ ...cellStyle, ...monoStyle, textAlign: 'right' }}>
                      {item.overhaulIntervalHours != null ? `${item.overhaulIntervalHours.toLocaleString()}h` : '\u2014'}
                    </td>

                    {/* Status */}
                    <td style={{ ...cellStyle, textAlign: 'center' }}>
                      <StatusBadge status={item.status} />
                    </td>

                    {/* Actions */}
                    <td style={{ ...cellStyle, padding: '6px 8px' }}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              width: 28,
                              height: 28,
                              background: 'none',
                              border: '1px solid var(--border-primary)',
                              borderRadius: 4,
                              color: 'var(--text-tertiary)',
                              cursor: 'pointer',
                            }}
                          >
                            <MoreVertical size={14} />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setEditItem(item)}>
                            <Pencil size={13} style={{ marginRight: 6 }} />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setDeleteItem(item)}>
                            <Trash2 size={13} style={{ marginRight: 6 }} />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
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
              padding: '12px 24px',
              borderTop: '1px solid var(--border-primary)',
            }}
          >
            <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
              {Math.min((page - 1) * PAGE_SIZE + 1, filtered.length)}&ndash;{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
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
              <span style={{ fontSize: 11, color: 'var(--text-tertiary)', padding: '0 6px', ...monoStyle }}>
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

      {/* ── Create Dialog ─────────────────────────────────────── */}
      <ComponentFormDialog
        open={createOpen}
        mode="create"
        fleet={fleet}
        onClose={() => setCreateOpen(false)}
        onSaved={() => {
          setCreateOpen(false);
          fetchItems();
        }}
      />

      {/* ── Edit Dialog ───────────────────────────────────────── */}
      <ComponentFormDialog
        open={!!editItem}
        mode="edit"
        item={editItem ?? undefined}
        fleet={fleet}
        onClose={() => setEditItem(null)}
        onSaved={() => {
          setEditItem(null);
          fetchItems();
        }}
      />

      {/* ── Delete Confirmation ───────────────────────────────── */}
      <Dialog open={!!deleteItem} onOpenChange={(o: boolean) => { if (!o) setDeleteItem(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Component</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete component{' '}
              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                {deleteItem?.partNumber}
              </span>
              {deleteItem?.serialNumber ? ` (S/N ${deleteItem.serialNumber})` : ''}? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteItem(null)}>
              Cancel
            </Button>
            <Button onClick={handleDelete} style={{ background: 'var(--accent-red)' }}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════
// ComponentFormDialog — shared create/edit form
// ═══════════════════════════════════════════════════════════════

function ComponentFormDialog({
  open,
  mode,
  item,
  fleet,
  onClose,
  onSaved,
}: {
  open: boolean;
  mode: 'create' | 'edit';
  item?: AircraftComponent;
  fleet: FleetAircraft[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [aircraftId, setAircraftId] = useState('');
  const [componentType, setComponentType] = useState<ComponentType>('ENGINE');
  const [partNumber, setPartNumber] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [position, setPosition] = useState('');
  const [hoursSinceNew, setHoursSinceNew] = useState('');
  const [cyclesSinceNew, setCyclesSinceNew] = useState('');
  const [hoursSinceOverhaul, setHoursSinceOverhaul] = useState('');
  const [cyclesSinceOverhaul, setCyclesSinceOverhaul] = useState('');
  const [overhaulIntervalHours, setOverhaulIntervalHours] = useState('');
  const [status, setStatus] = useState<ComponentStatus>('installed');
  const [installDate, setInstallDate] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  // Populate form when editing
  useEffect(() => {
    if (mode === 'edit' && item) {
      setAircraftId(String(item.aircraftId));
      setComponentType(item.componentType);
      setPartNumber(item.partNumber);
      setSerialNumber(item.serialNumber);
      setPosition(item.position ?? '');
      setHoursSinceNew(item.hoursSinceNew?.toString() ?? '');
      setCyclesSinceNew(item.cyclesSinceNew?.toString() ?? '');
      setHoursSinceOverhaul(item.hoursSinceOverhaul?.toString() ?? '');
      setCyclesSinceOverhaul(item.cyclesSinceOverhaul?.toString() ?? '');
      setOverhaulIntervalHours(item.overhaulIntervalHours?.toString() ?? '');
      setStatus(item.status);
      setInstallDate(item.installDate ?? '');
      setNotes(item.notes ?? '');
    } else if (mode === 'create') {
      resetForm();
    }
  }, [mode, item]);

  function resetForm() {
    setAircraftId('');
    setComponentType('ENGINE');
    setPartNumber('');
    setSerialNumber('');
    setPosition('');
    setHoursSinceNew('');
    setCyclesSinceNew('');
    setHoursSinceOverhaul('');
    setCyclesSinceOverhaul('');
    setOverhaulIntervalHours('');
    setStatus('installed');
    setInstallDate('');
    setNotes('');
  }

  async function handleSave() {
    if (!aircraftId || !partNumber.trim() || !serialNumber.trim()) return;
    setSaving(true);
    try {
      const payload = {
        aircraftId: parseInt(aircraftId),
        componentType,
        partNumber: partNumber.trim(),
        serialNumber: serialNumber.trim(),
        position: position.trim() || null,
        hoursSinceNew: hoursSinceNew ? parseFloat(hoursSinceNew) : null,
        cyclesSinceNew: cyclesSinceNew ? parseInt(cyclesSinceNew) : null,
        hoursSinceOverhaul: hoursSinceOverhaul ? parseFloat(hoursSinceOverhaul) : null,
        cyclesSinceOverhaul: cyclesSinceOverhaul ? parseInt(cyclesSinceOverhaul) : null,
        overhaulIntervalHours: overhaulIntervalHours ? parseFloat(overhaulIntervalHours) : null,
        status,
        installDate: installDate || null,
        notes: notes.trim() || null,
      };

      if (mode === 'create') {
        await api.post('/api/admin/maintenance/components', payload);
        toast.success('Component created');
      } else if (item) {
        await api.patch(`/api/admin/maintenance/components/${item.id}`, payload);
        toast.success('Component updated');
      }
      resetForm();
      onSaved();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : `Failed to ${mode} component`);
    } finally {
      setSaving(false);
    }
  }

  const isEdit = mode === 'edit';
  const canSave = aircraftId && partNumber.trim() && serialNumber.trim();

  return (
    <Dialog
      open={open}
      onOpenChange={(o: boolean) => {
        if (!o) {
          resetForm();
          onClose();
        }
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Component' : 'Add Component'}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Update life-limited component details.'
              : 'Add a new life-limited component to an aircraft.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2" style={{ maxHeight: 420, overflowY: 'auto' }}>
          {/* Aircraft */}
          <div className="space-y-2">
            <Label>Aircraft *</Label>
            <Select value={aircraftId} onValueChange={setAircraftId}>
              <SelectTrigger style={{ fontSize: 12 }}>
                <SelectValue placeholder="Select aircraft" />
              </SelectTrigger>
              <SelectContent>
                {fleet.map((a) => (
                  <SelectItem key={a.id} value={String(a.id)}>
                    <span style={{ fontFamily: 'var(--font-mono)' }}>{a.registration}</span>
                    <span style={{ color: 'var(--text-tertiary)', marginLeft: 8 }}>{a.icaoType}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Component Type */}
          <div className="space-y-2">
            <Label>Component Type *</Label>
            <Select value={componentType} onValueChange={(v) => setComponentType(v as ComponentType)}>
              <SelectTrigger style={{ fontSize: 12 }}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ALL_COMPONENT_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {TYPE_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Part Number */}
          <div className="space-y-2">
            <Label>Part Number *</Label>
            <Input
              value={partNumber}
              onChange={(e) => setPartNumber(e.target.value)}
              placeholder="e.g. CFM56-7B26"
              style={{ fontFamily: 'var(--font-mono)' }}
            />
          </div>

          {/* Serial Number */}
          <div className="space-y-2">
            <Label>Serial Number *</Label>
            <Input
              value={serialNumber}
              onChange={(e) => setSerialNumber(e.target.value)}
              placeholder="e.g. ESN-123456"
              style={{ fontFamily: 'var(--font-mono)' }}
            />
          </div>

          {/* Position */}
          <div className="space-y-2">
            <Label>Position</Label>
            <Input
              value={position}
              onChange={(e) => setPosition(e.target.value)}
              placeholder="e.g. #1 (left)"
            />
          </div>

          {/* Hours / Cycles row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="space-y-2">
              <Label>Hours Since New</Label>
              <Input
                type="number"
                value={hoursSinceNew}
                onChange={(e) => setHoursSinceNew(e.target.value)}
                placeholder="0"
                min={0}
              />
            </div>
            <div className="space-y-2">
              <Label>Cycles Since New</Label>
              <Input
                type="number"
                value={cyclesSinceNew}
                onChange={(e) => setCyclesSinceNew(e.target.value)}
                placeholder="0"
                min={0}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="space-y-2">
              <Label>Hours Since Overhaul</Label>
              <Input
                type="number"
                value={hoursSinceOverhaul}
                onChange={(e) => setHoursSinceOverhaul(e.target.value)}
                placeholder="0"
                min={0}
              />
            </div>
            <div className="space-y-2">
              <Label>Cycles Since Overhaul</Label>
              <Input
                type="number"
                value={cyclesSinceOverhaul}
                onChange={(e) => setCyclesSinceOverhaul(e.target.value)}
                placeholder="0"
                min={0}
              />
            </div>
          </div>

          {/* Overhaul Interval */}
          <div className="space-y-2">
            <Label>Overhaul Interval (Hours)</Label>
            <Input
              type="number"
              value={overhaulIntervalHours}
              onChange={(e) => setOverhaulIntervalHours(e.target.value)}
              placeholder="e.g. 20000"
              min={0}
            />
          </div>

          {/* Status */}
          <div className="space-y-2">
            <Label>Status *</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as ComponentStatus)}>
              <SelectTrigger style={{ fontSize: 12 }}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ALL_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {STATUS_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Install Date */}
          <div className="space-y-2">
            <Label>Install Date</Label>
            <Input
              type="date"
              value={installDate}
              onChange={(e) => setInstallDate(e.target.value)}
            />
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes"
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              resetForm();
              onClose();
            }}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || !canSave}>
            {saving ? 'Saving...' : isEdit ? 'Update' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
