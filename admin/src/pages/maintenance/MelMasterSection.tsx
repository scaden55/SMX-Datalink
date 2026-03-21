import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { Plus, Pencil, MoreVertical, Power, PowerOff } from 'lucide-react';
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

interface MelMasterItem {
  id: number;
  icaoType: string;
  ataChapter: string;
  ataTitle?: string;
  itemNumber: string;
  title: string;
  category: 'A' | 'B' | 'C' | 'D';
  repairIntervalDays: number | null;
  remarks: string | null;
  operationsProcedure: string | null;
  maintenanceProcedure: string | null;
  isActive: boolean;
}

interface ATAChapter {
  chapter: string;
  title: string;
}

type MelCategory = 'A' | 'B' | 'C' | 'D';

const CATEGORY_BADGE_COLORS: Record<MelCategory, { bg: string; text: string }> = {
  A: { bg: 'var(--accent-red-bg)', text: 'var(--accent-red)' },
  B: { bg: 'var(--accent-amber-bg)', text: 'var(--accent-amber)' },
  C: { bg: 'var(--accent-blue-bg)', text: 'var(--accent-blue-bright)' },
  D: { bg: 'var(--accent-cyan-bg)', text: 'var(--accent-cyan)' },
};

// ── Helpers ──────────────────────────────────────────────────

function CategoryBadge({ category }: { category: MelCategory }) {
  const c = CATEGORY_BADGE_COLORS[category];
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
      Cat {category}
    </span>
  );
}

function StatusBadge({ active }: { active: boolean }) {
  const bg = active ? 'var(--accent-emerald-bg)' : 'var(--surface-2)';
  const text = active ? 'var(--accent-emerald)' : 'var(--text-tertiary)';
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
      {active ? 'Active' : 'Inactive'}
    </span>
  );
}

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

// ═══════════════════════════════════════════════════════════════
// MelMasterSection
// ═══════════════════════════════════════════════════════════════

export function MelMasterSection({ refreshKey }: { refreshKey: number }) {
  const [items, setItems] = useState<MelMasterItem[]>([]);
  const [ataChapters, setAtaChapters] = useState<ATAChapter[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState('all');

  // Dialog state
  const [createOpen, setCreateOpen] = useState(false);
  const [editItem, setEditItem] = useState<MelMasterItem | null>(null);

  // Row hover
  const [hoveredId, setHoveredId] = useState<number | null>(null);

  // ── Fetch ────────────────────────────────────────────────

  const fetchItems = useCallback(async () => {
    try {
      const res = await api.get<{ items: MelMasterItem[] }>(
        '/api/admin/maintenance/mel-master',
      );
      setItems(res.items);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to load MEL master list');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchAtaChapters = useCallback(async () => {
    try {
      const res = await api.get<{ chapters: ATAChapter[] }>('/api/ata-chapters');
      setAtaChapters(res.chapters);
    } catch (err) {
      // Non-critical — dropdown will just be empty
      console.warn('Failed to load ATA chapters', err);
    }
  }, []);

  useEffect(() => {
    fetchItems();
    fetchAtaChapters();
  }, [fetchItems, fetchAtaChapters, refreshKey]);

  // ── Derived data ───────────────────────────────────────────

  const distinctTypes = useMemo(() => {
    const set = new Set(items.map((i) => i.icaoType));
    return Array.from(set).sort();
  }, [items]);

  const filteredItems = useMemo(() => {
    const filtered = typeFilter === 'all'
      ? items
      : items.filter((i) => i.icaoType === typeFilter);
    // Sort: active first, then inactive
    return [...filtered].sort((a, b) => {
      if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
      return a.itemNumber.localeCompare(b.itemNumber);
    });
  }, [items, typeFilter]);

  // ── Deactivate / Reactivate ────────────────────────────────

  async function handleDeactivate(item: MelMasterItem) {
    try {
      await api.delete(`/api/admin/maintenance/mel-master/${item.id}`);
      toast.success(`Deactivated MEL item ${item.itemNumber}`);
      fetchItems();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to deactivate MEL item');
    }
  }

  async function handleReactivate(item: MelMasterItem) {
    try {
      await api.patch(`/api/admin/maintenance/mel-master/${item.id}`, { isActive: true });
      toast.success(`Reactivated MEL item ${item.itemNumber}`);
      fetchItems();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to reactivate MEL item');
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
        }}
      >
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="text-caption" style={{ width: 160 }}>
            <SelectValue placeholder="All Types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {distinctTypes.map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div style={{ flex: 1 }} />

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
          Add MEL Item
        </button>
      </div>

      {/* Empty state */}
      {filteredItems.length === 0 && (
        <div
          className="text-body"
          style={{ padding: '60px 24px', textAlign: 'center', color: 'var(--text-tertiary)' }}
        >
          No MEL master items found. Add an item to get started.
        </div>
      )}

      {/* Table */}
      {filteredItems.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th className={COL_HEADER_CLASS} style={{ ...colHeaderStyle, width: 80 }}>Item #</th>
                <th className={COL_HEADER_CLASS} style={colHeaderStyle}>ATA</th>
                <th className={COL_HEADER_CLASS} style={colHeaderStyle}>Title</th>
                <th className={COL_HEADER_CLASS} style={{ ...colHeaderStyle, width: 80, textAlign: 'center' }}>Category</th>
                <th className={COL_HEADER_CLASS} style={{ ...colHeaderStyle, width: 100 }}>Repair Int.</th>
                <th className={COL_HEADER_CLASS} style={{ ...colHeaderStyle, width: 80, textAlign: 'center' }}>Status</th>
                <th className={COL_HEADER_CLASS} style={{ ...colHeaderStyle, width: 48 }} />
              </tr>
            </thead>
            <motion.tbody variants={tableContainer} initial="hidden" animate="visible">
              {filteredItems.map((item) => (
                <motion.tr
                  key={item.id}
                  variants={tableRow}
                  style={{
                    background: hoveredId === item.id ? 'var(--tint-subtle)' : 'transparent',
                    transition: 'background 80ms',
                    opacity: item.isActive ? 1 : 0.5,
                  }}
                  onMouseEnter={() => setHoveredId(item.id)}
                  onMouseLeave={() => setHoveredId(null)}
                >
                  {/* Item # */}
                  <td className={`${CELL_CLASS} ${MONO_CLASS}`} style={cellStyle}>
                    {item.itemNumber}
                  </td>

                  {/* ATA */}
                  <td className={`${CELL_CLASS} ${MONO_CLASS}`} style={cellStyle}>
                    {item.ataChapter}
                    {item.ataTitle && (
                      <span style={{ color: 'var(--text-tertiary)', marginLeft: 6 }}>
                        — {item.ataTitle}
                      </span>
                    )}
                  </td>

                  {/* Title */}
                  <td className={CELL_CLASS} style={cellStyle}>
                    {item.title}
                  </td>

                  {/* Category */}
                  <td className={CELL_CLASS} style={{ ...cellStyle, textAlign: 'center' }}>
                    <CategoryBadge category={item.category} />
                  </td>

                  {/* Repair Interval */}
                  <td className={`${CELL_CLASS} ${MONO_CLASS}`} style={cellStyle}>
                    {item.repairIntervalDays != null ? `${item.repairIntervalDays}d` : '\u2014'}
                  </td>

                  {/* Status */}
                  <td className={CELL_CLASS} style={{ ...cellStyle, textAlign: 'center' }}>
                    <StatusBadge active={item.isActive} />
                  </td>

                  {/* Actions */}
                  <td className={CELL_CLASS} style={{ ...cellStyle, padding: '6px 8px' }}>
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
                        {item.isActive ? (
                          <DropdownMenuItem onClick={() => handleDeactivate(item)}>
                            <PowerOff size={13} style={{ marginRight: 6 }} />
                            Deactivate
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem onClick={() => handleReactivate(item)}>
                            <Power size={13} style={{ marginRight: 6 }} />
                            Reactivate
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </motion.tr>
              ))}
            </motion.tbody>
          </table>
        </div>
      )}

      {/* ── Create Dialog ─────────────────────────────────────── */}
      <MelFormDialog
        open={createOpen}
        mode="create"
        ataChapters={ataChapters}
        onClose={() => setCreateOpen(false)}
        onSaved={() => {
          setCreateOpen(false);
          fetchItems();
        }}
      />

      {/* ── Edit Dialog ───────────────────────────────────────── */}
      <MelFormDialog
        open={!!editItem}
        mode="edit"
        item={editItem ?? undefined}
        ataChapters={ataChapters}
        onClose={() => setEditItem(null)}
        onSaved={() => {
          setEditItem(null);
          fetchItems();
        }}
      />
    </>
  );
}

// ═══════════════════════════════════════════════════════════════
// MelFormDialog — shared create/edit form
// ═══════════════════════════════════════════════════════════════

function MelFormDialog({
  open,
  mode,
  item,
  ataChapters,
  onClose,
  onSaved,
}: {
  open: boolean;
  mode: 'create' | 'edit';
  item?: MelMasterItem;
  ataChapters: ATAChapter[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [icaoType, setIcaoType] = useState('');
  const [ataChapter, setAtaChapter] = useState('');
  const [itemNumber, setItemNumber] = useState('');
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<MelCategory>('C');
  const [repairIntervalDays, setRepairIntervalDays] = useState('');
  const [remarks, setRemarks] = useState('');
  const [operationsProcedure, setOperationsProcedure] = useState('');
  const [maintenanceProcedure, setMaintenanceProcedure] = useState('');
  const [saving, setSaving] = useState(false);

  // Populate form when editing
  useEffect(() => {
    if (mode === 'edit' && item) {
      setIcaoType(item.icaoType);
      setAtaChapter(item.ataChapter);
      setItemNumber(item.itemNumber);
      setTitle(item.title);
      setCategory(item.category);
      setRepairIntervalDays(item.repairIntervalDays?.toString() ?? '');
      setRemarks(item.remarks ?? '');
      setOperationsProcedure(item.operationsProcedure ?? '');
      setMaintenanceProcedure(item.maintenanceProcedure ?? '');
    } else if (mode === 'create') {
      resetForm();
    }
  }, [mode, item]);

  function resetForm() {
    setIcaoType('');
    setAtaChapter('');
    setItemNumber('');
    setTitle('');
    setCategory('C');
    setRepairIntervalDays('');
    setRemarks('');
    setOperationsProcedure('');
    setMaintenanceProcedure('');
  }

  async function handleSave() {
    if (!title.trim()) return;
    setSaving(true);
    try {
      const payload = {
        icaoType: icaoType.trim().toUpperCase(),
        ataChapter: ataChapter.trim(),
        itemNumber: itemNumber.trim(),
        title: title.trim(),
        category,
        repairIntervalDays: category === 'A' && repairIntervalDays
          ? parseInt(repairIntervalDays)
          : null,
        remarks: remarks.trim() || null,
        operationsProcedure: operationsProcedure.trim() || null,
        maintenanceProcedure: maintenanceProcedure.trim() || null,
      };

      if (mode === 'create') {
        await api.post('/api/admin/maintenance/mel-master', payload);
        toast.success('MEL item created');
      } else if (item) {
        // Edit: don't send icaoType/itemNumber (read-only)
        const { icaoType: _t, itemNumber: _n, ...editPayload } = payload;
        await api.patch(`/api/admin/maintenance/mel-master/${item.id}`, editPayload);
        toast.success('MEL item updated');
      }
      resetForm();
      onSaved();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : `Failed to ${mode} MEL item`);
    } finally {
      setSaving(false);
    }
  }

  const isEdit = mode === 'edit';
  const canSave = title.trim() && icaoType.trim() && ataChapter.trim() && itemNumber.trim();

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          resetForm();
          onClose();
        }
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit MEL Item' : 'Add MEL Item'}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Update MEL master list item details.'
              : 'Add a new item to the MEL master list.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2" style={{ maxHeight: 420, overflowY: 'auto' }}>
          {/* ICAO Type */}
          <div className="space-y-2">
            <Label>ICAO Type *</Label>
            <Input
              value={icaoType}
              onChange={(e) => setIcaoType(e.target.value.toUpperCase().slice(0, 4))}
              placeholder="B738"
              maxLength={4}
              disabled={isEdit}
              className={MONO_CLASS}
              style={{ textTransform: 'uppercase' }}
            />
          </div>

          {/* ATA Chapter */}
          <div className="space-y-2">
            <Label>ATA Chapter *</Label>
            <Select value={ataChapter} onValueChange={setAtaChapter} disabled={false}>
              <SelectTrigger className="text-caption">
                <SelectValue placeholder="Select ATA chapter" />
              </SelectTrigger>
              <SelectContent>
                {ataChapters.map((ch) => (
                  <SelectItem key={ch.chapter} value={ch.chapter}>
                    {ch.chapter} — {ch.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Item Number */}
          <div className="space-y-2">
            <Label>Item Number *</Label>
            <Input
              value={itemNumber}
              onChange={(e) => setItemNumber(e.target.value)}
              placeholder="21-01"
              disabled={isEdit}
              className={MONO_CLASS}
            />
          </div>

          {/* Title */}
          <div className="space-y-2">
            <Label>Title *</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Pack Valve"
            />
          </div>

          {/* Category */}
          <div className="space-y-2">
            <Label>Category *</Label>
            <Select value={category} onValueChange={(v) => setCategory(v as MelCategory)}>
              <SelectTrigger className="text-caption">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="A">A — Repair within calendar days</SelectItem>
                <SelectItem value="B">B — Repair within 3 calendar days</SelectItem>
                <SelectItem value="C">C — Repair within 10 calendar days</SelectItem>
                <SelectItem value="D">D — No repair interval specified</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Repair Interval Days — only for Cat A */}
          {category === 'A' && (
            <div className="space-y-2">
              <Label>Repair Interval Days</Label>
              <Input
                type="number"
                value={repairIntervalDays}
                onChange={(e) => setRepairIntervalDays(e.target.value)}
                placeholder="e.g. 3"
              />
            </div>
          )}

          {/* Remarks */}
          <div className="space-y-2">
            <Label>Remarks</Label>
            <Textarea
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Optional remarks"
              rows={2}
            />
          </div>

          {/* Operations Procedure */}
          <div className="space-y-2">
            <Label>Operations Procedure</Label>
            <Textarea
              value={operationsProcedure}
              onChange={(e) => setOperationsProcedure(e.target.value)}
              placeholder="Optional (O) procedure"
              rows={2}
            />
          </div>

          {/* Maintenance Procedure */}
          <div className="space-y-2">
            <Label>Maintenance Procedure</Label>
            <Textarea
              value={maintenanceProcedure}
              onChange={(e) => setMaintenanceProcedure(e.target.value)}
              placeholder="Optional (M) procedure"
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
