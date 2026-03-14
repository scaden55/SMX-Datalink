import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Search,
  Plus,
  Pencil,
  Trash2,
  X,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  BookOpen,
  List,
} from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { toast } from '@/stores/toastStore';
import { fadeUp, tableContainer, tableRow } from '@/lib/motion';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

// ── Types ────────────────────────────────────────────────────

interface MELDeferral {
  id: number;
  aircraftId: number;
  aircraftRegistration?: string;
  itemNumber: string;
  title: string;
  category: string;
  deferralDate: string;
  expiryDate: string;
  rectifiedDate: string | null;
  status: 'open' | 'rectified' | 'expired';
  remarks: string | null;
  ataChapter?: string | null;
  placardInfo?: string | null;
  operationsProcedure?: string | null;
  maintenanceProcedure?: string | null;
}

interface MelMasterItem {
  id: number;
  icaoType: string;
  ataChapter: string;
  ataChapterTitle?: string;
  itemNumber: string;
  title: string;
  description: string | null;
  category: 'A' | 'B' | 'C' | 'D';
  repairIntervalDays: number | null;
  remarks: string | null;
  operationsProcedure: string | null;
  maintenanceProcedure: string | null;
  isActive: boolean;
}

interface MelStats {
  active: number;
  expiring48h: number;
  catAB: number;
  catCD: number;
  rectified30d: number;
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

function daysRemaining(expiryDate: string): number {
  const now = new Date();
  const exp = new Date(expiryDate);
  return Math.ceil((exp.getTime() - now.getTime()) / 86400000);
}

function remainingColor(days: number): string {
  if (days < 2) return 'var(--accent-red)';
  if (days < 7) return 'var(--accent-amber)';
  return 'var(--accent-emerald)';
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

// ── Badges ───────────────────────────────────────────────────

function CategoryBadge({ category }: { category: string }) {
  const config: Record<string, { bg: string; text: string }> = {
    A: { bg: 'var(--accent-red-bg)', text: 'var(--accent-red)' },
    B: { bg: 'var(--accent-amber-bg)', text: 'var(--accent-amber)' },
    C: { bg: 'var(--accent-blue-bg)', text: 'var(--accent-blue-bright)' },
    D: { bg: 'var(--surface-2)', text: 'var(--text-secondary)' },
  };
  const c = config[category] ?? { bg: 'var(--surface-2)', text: 'var(--text-secondary)' };
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2px 8px',
        borderRadius: 3,
        fontSize: 11,
        fontWeight: 600,
        lineHeight: '16px',
        background: c.bg,
        color: c.text,
        whiteSpace: 'nowrap',
        minWidth: 28,
      }}
    >
      Cat {category}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  let bg = 'var(--surface-2)';
  let text = 'var(--text-secondary)';

  if (status === 'open') {
    bg = 'var(--accent-blue-bg)';
    text = 'var(--accent-blue-bright)';
  } else if (status === 'rectified') {
    bg = 'var(--accent-emerald-bg)';
    text = 'var(--accent-emerald)';
  } else if (status === 'expired') {
    bg = 'var(--accent-red-bg)';
    text = 'var(--accent-red)';
  }

  const label = status.charAt(0).toUpperCase() + status.slice(1);

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

// ── Stat Card ────────────────────────────────────────────────

function StatCard({
  label,
  value,
  borderColor,
}: {
  label: string;
  value: number;
  borderColor: string;
}) {
  return (
    <motion.div
      variants={fadeUp}
      style={{
        background: 'var(--surface-1)',
        borderRadius: 6,
        padding: 16,
        borderLeft: `3px solid ${borderColor}`,
        flex: 1,
        minWidth: 140,
      }}
    >
      <div
        style={{
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: 0.6,
          color: 'var(--text-tertiary)',
          textTransform: 'uppercase',
          marginBottom: 6,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 22,
          fontWeight: 700,
          color: borderColor,
          fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums',
        }}
      >
        {value}
      </div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Detail Panel
// ═══════════════════════════════════════════════════════════════

function DetailPanel({
  deferral,
  onClose,
  onRectify,
}: {
  deferral: MELDeferral;
  onClose: () => void;
  onRectify: (id: number) => void;
}) {
  const days = daysRemaining(deferral.expiryDate);

  return (
    <motion.div
      initial={{ x: 20, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 20, opacity: 0 }}
      transition={{ duration: 0.2 }}
      style={{
        position: 'absolute',
        top: 0,
        right: 0,
        bottom: 0,
        width: 400,
        background: 'var(--surface-1)',
        borderLeft: '1px solid var(--border-primary)',
        boxShadow: '-4px 0 16px rgba(0,0,0,0.3)',
        overflowY: 'auto',
        zIndex: 10,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 20px',
          borderBottom: '1px solid var(--border-primary)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <CategoryBadge category={deferral.category} />
          <span
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: 'var(--text-primary)',
              fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums',
            }}
          >
            {deferral.itemNumber}
          </span>
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

      {/* Body */}
      <div style={{ flex: 1, padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Title */}
        <div>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.4 }}>
            {deferral.title}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>
            Aircraft: {deferral.aircraftRegistration ?? `#${deferral.aircraftId}`}
          </div>
        </div>

        {/* ATA Chapter */}
        {deferral.ataChapter && (
          <DetailField label="ATA Chapter" value={deferral.ataChapter} />
        )}

        {/* Dates */}
        <div style={{ display: 'flex', gap: 16 }}>
          <DetailField label="Deferred" value={formatDate(deferral.deferralDate)} style={{ flex: 1 }} />
          <DetailField label="Expires" value={formatDate(deferral.expiryDate)} style={{ flex: 1 }} />
        </div>

        {/* Remaining */}
        {deferral.status === 'open' && (
          <div
            style={{
              background: 'var(--surface-2)',
              borderRadius: 6,
              padding: '10px 14px',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <AlertTriangle size={14} style={{ color: remainingColor(days) }} />
            <span style={{ fontSize: 12, fontWeight: 600, color: remainingColor(days) }}>
              {days <= 0 ? 'Expired' : `${days} day${days === 1 ? '' : 's'} remaining`}
            </span>
          </div>
        )}

        {/* Rectified date for rectified items */}
        {deferral.status === 'rectified' && deferral.rectifiedDate && (
          <DetailField label="Rectified" value={formatDate(deferral.rectifiedDate)} />
        )}

        {/* Placard Info */}
        {deferral.placardInfo && (
          <div
            style={{
              background: 'var(--accent-amber-bg)',
              borderRadius: 6,
              padding: '10px 14px',
            }}
          >
            <div
              style={{
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: 0.6,
                color: 'var(--accent-amber)',
                textTransform: 'uppercase',
                marginBottom: 4,
              }}
            >
              Placard Info
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-primary)', lineHeight: 1.5 }}>
              {deferral.placardInfo}
            </div>
          </div>
        )}

        {/* Operations Procedure */}
        {deferral.operationsProcedure && (
          <DetailField label="Operations Procedure" value={deferral.operationsProcedure} multiline />
        )}

        {/* Maintenance Procedure */}
        {deferral.maintenanceProcedure && (
          <DetailField label="Maintenance Procedure" value={deferral.maintenanceProcedure} multiline />
        )}

        {/* Remarks */}
        {deferral.remarks && (
          <DetailField label="Remarks" value={deferral.remarks} multiline />
        )}
      </div>

      {/* Footer */}
      {deferral.status === 'open' && (
        <div
          style={{
            padding: '16px 20px',
            borderTop: '1px solid var(--border-primary)',
          }}
        >
          <button
            onClick={() => onRectify(deferral.id)}
            style={{
              width: '100%',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              padding: '10px 16px',
              background: 'var(--accent-emerald)',
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
            <CheckCircle2 size={15} />
            Rectify Deferral
          </button>
        </div>
      )}
    </motion.div>
  );
}

function DetailField({
  label,
  value,
  multiline,
  style: extraStyle,
}: {
  label: string;
  value: string;
  multiline?: boolean;
  style?: React.CSSProperties;
}) {
  return (
    <div style={extraStyle}>
      <div
        style={{
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: 0.6,
          color: 'var(--text-tertiary)',
          textTransform: 'uppercase',
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 12,
          color: 'var(--text-secondary)',
          lineHeight: multiline ? 1.6 : 1.3,
          whiteSpace: multiline ? 'pre-wrap' : 'normal',
        }}
      >
        {value}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Active Deferrals View
// ═══════════════════════════════════════════════════════════════

function ActiveDeferralsView({ refreshKey }: { refreshKey: number }) {
  const [deferrals, setDeferrals] = useState<MELDeferral[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selected, setSelected] = useState<MELDeferral | null>(null);

  const fetchDeferrals = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      params.set('page', page.toString());
      params.set('pageSize', pageSize.toString());
      if (statusFilter !== 'all') params.set('status', statusFilter);

      const res = await api.get<{ deferrals: MELDeferral[]; total: number }>(
        `/api/admin/maintenance/mel?${params.toString()}`,
      );
      setDeferrals(res.deferrals);
      setTotal(res.total);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to load MEL deferrals');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, statusFilter]);

  useEffect(() => {
    setLoading(true);
    fetchDeferrals();
  }, [fetchDeferrals, refreshKey]);

  const filtered = useMemo(() => {
    if (!search) return deferrals;
    const q = search.toLowerCase();
    return deferrals.filter(
      (d) =>
        d.title.toLowerCase().includes(q) ||
        d.itemNumber.toLowerCase().includes(q) ||
        (d.aircraftRegistration?.toLowerCase().includes(q) ?? false) ||
        (d.ataChapter?.toLowerCase().includes(q) ?? false),
    );
  }, [deferrals, search]);

  async function handleRectify(id: number) {
    try {
      await api.patch(`/api/admin/maintenance/mel/${id}`, {
        status: 'rectified',
        rectifiedDate: new Date().toISOString(),
      });
      toast.success('Deferral rectified');
      setSelected(null);
      fetchDeferrals();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to rectify deferral');
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  if (loading) return <TableSkeleton />;

  return (
    <div style={{ position: 'relative', flex: 1, display: 'flex', flexDirection: 'column' }}>
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
            placeholder="Search deferrals..."
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
        <Select
          value={statusFilter}
          onValueChange={(v) => {
            setStatusFilter(v);
            setPage(1);
          }}
        >
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
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="rectified">Rectified</SelectItem>
            <SelectItem value="expired">Expired</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div style={{ flex: 1, overflowX: 'auto', position: 'relative' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={colHeaderStyle}>Category</th>
              <th style={colHeaderStyle}>Aircraft</th>
              <th style={colHeaderStyle}>MEL Item #</th>
              <th style={colHeaderStyle}>Title</th>
              <th style={colHeaderStyle}>Deferred</th>
              <th style={colHeaderStyle}>Expires</th>
              <th style={colHeaderStyle}>Remaining</th>
              <th style={colHeaderStyle}>Status</th>
            </tr>
          </thead>
          <motion.tbody variants={tableContainer} initial="hidden" animate="visible">
            {filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={8}
                  style={{
                    padding: '40px 16px',
                    textAlign: 'center',
                    color: 'var(--text-tertiary)',
                    fontSize: 13,
                  }}
                >
                  No deferrals found
                </td>
              </tr>
            ) : (
              filtered.map((def) => {
                const days = def.status === 'open' ? daysRemaining(def.expiryDate) : null;
                const isUrgent = days !== null && days < 2;

                return (
                  <motion.tr
                    key={def.id}
                    variants={tableRow}
                    style={{
                      cursor: 'pointer',
                      background: isUrgent ? 'rgba(239, 68, 68, 0.05)' : 'transparent',
                    }}
                    onClick={() => setSelected(def)}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.background = isUrgent
                        ? 'rgba(239, 68, 68, 0.08)'
                        : 'var(--surface-2)';
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.background = isUrgent
                        ? 'rgba(239, 68, 68, 0.05)'
                        : 'transparent';
                    }}
                  >
                    <td style={cellStyle}>
                      <CategoryBadge category={def.category} />
                    </td>
                    <td
                      style={{
                        ...cellStyle,
                        fontWeight: 600,
                        color: 'var(--text-primary)',
                        fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums',
                        fontSize: 12,
                      }}
                    >
                      {def.aircraftRegistration ?? `#${def.aircraftId}`}
                    </td>
                    <td
                      style={{
                        ...cellStyle,
                        fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums',
                        fontSize: 11,
                      }}
                    >
                      {def.itemNumber}
                    </td>
                    <td
                      style={{
                        ...cellStyle,
                        maxWidth: 220,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {def.title}
                    </td>
                    <td style={{ ...cellStyle, color: 'var(--text-tertiary)', fontSize: 11 }}>
                      {formatDate(def.deferralDate)}
                    </td>
                    <td style={{ ...cellStyle, color: 'var(--text-tertiary)', fontSize: 11 }}>
                      {formatDate(def.expiryDate)}
                    </td>
                    <td style={{ ...cellStyle, fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums' }}>
                      {def.status === 'open' && days !== null ? (
                        <span style={{ color: remainingColor(days), fontWeight: 600 }}>
                          {days <= 0 ? 'Expired' : `${days}d`}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-tertiary)' }}>--</span>
                      )}
                    </td>
                    <td style={cellStyle}>
                      <StatusBadge status={def.status} />
                    </td>
                  </motion.tr>
                );
              })
            )}
          </motion.tbody>
        </table>

        {/* Detail Panel */}
        <AnimatePresence>
          {selected && (
            <DetailPanel
              deferral={selected}
              onClose={() => setSelected(null)}
              onRectify={handleRectify}
            />
          )}
        </AnimatePresence>
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
          {total === 0
            ? 'No results'
            : `${(page - 1) * pageSize + 1}--${Math.min(page * pageSize, total)} of ${total}`}
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
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MEL Master List View
// ═══════════════════════════════════════════════════════════════

function MelMasterDialog({
  open,
  onClose,
  onSaved,
  editItem,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  editItem: MelMasterItem | null;
}) {
  const [icaoType, setIcaoType] = useState('');
  const [ataChapter, setAtaChapter] = useState('');
  const [itemNumber, setItemNumber] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<'A' | 'B' | 'C' | 'D'>('C');
  const [repairInterval, setRepairInterval] = useState('');
  const [opsProcedure, setOpsProcedure] = useState('');
  const [mxProcedure, setMxProcedure] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editItem) {
      setIcaoType(editItem.icaoType);
      setAtaChapter(editItem.ataChapter);
      setItemNumber(editItem.itemNumber);
      setTitle(editItem.title);
      setDescription(editItem.description ?? '');
      setCategory(editItem.category);
      setRepairInterval(editItem.repairIntervalDays?.toString() ?? '');
      setOpsProcedure(editItem.operationsProcedure ?? '');
      setMxProcedure(editItem.maintenanceProcedure ?? '');
    } else {
      resetForm();
    }
  }, [editItem, open]);

  function resetForm() {
    setIcaoType('');
    setAtaChapter('');
    setItemNumber('');
    setTitle('');
    setDescription('');
    setCategory('C');
    setRepairInterval('');
    setOpsProcedure('');
    setMxProcedure('');
  }

  async function handleSave() {
    if (!icaoType.trim() || !ataChapter.trim() || !itemNumber.trim() || !title.trim()) return;
    setSaving(true);
    try {
      const body = {
        icaoType: icaoType.trim().toUpperCase(),
        ataChapter: ataChapter.trim(),
        itemNumber: itemNumber.trim(),
        title: title.trim(),
        description: description.trim() || null,
        category,
        repairIntervalDays: repairInterval ? parseInt(repairInterval) : null,
        operationsProcedure: opsProcedure.trim() || null,
        maintenanceProcedure: mxProcedure.trim() || null,
      };

      if (editItem) {
        await api.patch(`/api/admin/maintenance/mel-master/${editItem.id}`, body);
        toast.success('MEL item updated');
      } else {
        await api.post('/api/admin/maintenance/mel-master', body);
        toast.success('MEL item created');
      }
      resetForm();
      onClose();
      onSaved();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to save MEL item');
    } finally {
      setSaving(false);
    }
  }

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
          <DialogTitle>{editItem ? 'Edit MEL Item' : 'Add MEL Item'}</DialogTitle>
          <DialogDescription>
            {editItem
              ? 'Update this MEL master list item.'
              : 'Add a new item to the MEL master list.'}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2" style={{ maxHeight: 420, overflowY: 'auto' }}>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>ICAO Type *</Label>
              <Input
                value={icaoType}
                onChange={(e) => setIcaoType(e.target.value)}
                placeholder="e.g. B738"
              />
            </div>
            <div className="space-y-2">
              <Label>ATA Chapter *</Label>
              <Input
                value={ataChapter}
                onChange={(e) => setAtaChapter(e.target.value)}
                placeholder="e.g. 32"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Item Number *</Label>
              <Input
                value={itemNumber}
                onChange={(e) => setItemNumber(e.target.value)}
                placeholder="e.g. 32-01-01"
              />
            </div>
            <div className="space-y-2">
              <Label>Category *</Label>
              <Select value={category} onValueChange={(v) => setCategory(v as 'A' | 'B' | 'C' | 'D')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="A">A - Calendar limited</SelectItem>
                  <SelectItem value="B">B - 3 days</SelectItem>
                  <SelectItem value="C">C - 10 days</SelectItem>
                  <SelectItem value="D">D - 120 days</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Title *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="MEL item title" />
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Optional description"
            />
          </div>
          {category === 'A' && (
            <div className="space-y-2">
              <Label>Repair Interval (days)</Label>
              <Input
                type="number"
                value={repairInterval}
                onChange={(e) => setRepairInterval(e.target.value)}
                placeholder="Days"
              />
            </div>
          )}
          <div className="space-y-2">
            <Label>Operations Procedure</Label>
            <Textarea
              value={opsProcedure}
              onChange={(e) => setOpsProcedure(e.target.value)}
              rows={2}
              placeholder="Procedure for flight ops"
            />
          </div>
          <div className="space-y-2">
            <Label>Maintenance Procedure</Label>
            <Textarea
              value={mxProcedure}
              onChange={(e) => setMxProcedure(e.target.value)}
              rows={2}
              placeholder="Procedure for maintenance"
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
          <Button
            onClick={handleSave}
            disabled={saving || !icaoType.trim() || !ataChapter.trim() || !itemNumber.trim() || !title.trim()}
          >
            {saving ? 'Saving...' : editItem ? 'Update' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MelMasterListView() {
  const [items, setItems] = useState<MelMasterItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<MelMasterItem | null>(null);
  const [deleteItem, setDeleteItem] = useState<MelMasterItem | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const fetchItems = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (typeFilter !== 'all') params.set('icaoType', typeFilter);

      const res = await api.get<{ items: MelMasterItem[] }>(
        `/api/admin/maintenance/mel-master${params.toString() ? `?${params.toString()}` : ''}`,
      );
      setItems(res.items);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to load MEL master list');
    } finally {
      setLoading(false);
    }
  }, [typeFilter]);

  useEffect(() => {
    setLoading(true);
    fetchItems();
  }, [fetchItems]);

  const distinctTypes = useMemo(() => {
    const types = new Set(items.map((i) => i.icaoType));
    return Array.from(types).sort();
  }, [items]);

  async function handleDelete() {
    if (!deleteItem) return;
    setDeleteLoading(true);
    try {
      await api.delete(`/api/admin/maintenance/mel-master/${deleteItem.id}`);
      toast.success('MEL item deactivated');
      setDeleteItem(null);
      fetchItems();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to deactivate MEL item');
    } finally {
      setDeleteLoading(false);
    }
  }

  if (loading) return <TableSkeleton />;

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
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
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger
            style={{
              width: 160,
              height: 32,
              background: 'var(--input-bg)',
              border: '1px solid var(--input-border)',
              borderRadius: 6,
              color: 'var(--text-primary)',
              fontSize: 12,
            }}
          >
            <SelectValue placeholder="Type: All" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Type: All</SelectItem>
            {distinctTypes.map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div style={{ flex: 1 }} />
        <button
          onClick={() => {
            setEditItem(null);
            setDialogOpen(true);
          }}
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
          onMouseEnter={(e) => {
            e.currentTarget.style.opacity = '0.85';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.opacity = '1';
          }}
        >
          <Plus size={13} />
          Add MEL Item
        </button>
      </div>

      {/* Table */}
      <div style={{ flex: 1, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={colHeaderStyle}>Item #</th>
              <th style={colHeaderStyle}>ATA Chapter</th>
              <th style={colHeaderStyle}>Type</th>
              <th style={colHeaderStyle}>Title</th>
              <th style={colHeaderStyle}>Category</th>
              <th style={colHeaderStyle}>Active</th>
              <th style={{ ...colHeaderStyle, width: 80 }}>Actions</th>
            </tr>
          </thead>
          <motion.tbody variants={tableContainer} initial="hidden" animate="visible">
            {items.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  style={{
                    padding: '40px 16px',
                    textAlign: 'center',
                    color: 'var(--text-tertiary)',
                    fontSize: 13,
                  }}
                >
                  No MEL master items found
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <motion.tr
                  key={item.id}
                  variants={tableRow}
                  style={{ cursor: 'default' }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.background = 'transparent';
                  }}
                >
                  <td
                    style={{
                      ...cellStyle,
                      fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums',
                      fontSize: 11,
                      fontWeight: 600,
                      color: 'var(--text-primary)',
                    }}
                  >
                    {item.itemNumber}
                  </td>
                  <td style={{ ...cellStyle, fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums', fontSize: 11 }}>
                    {item.ataChapter}
                    {item.ataChapterTitle && (
                      <span style={{ color: 'var(--text-tertiary)', marginLeft: 6 }}>
                        {item.ataChapterTitle}
                      </span>
                    )}
                  </td>
                  <td style={{ ...cellStyle, fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums', fontSize: 11 }}>
                    {item.icaoType}
                  </td>
                  <td
                    style={{
                      ...cellStyle,
                      maxWidth: 260,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {item.title}
                  </td>
                  <td style={cellStyle}>
                    <CategoryBadge category={item.category} />
                  </td>
                  <td style={cellStyle}>
                    <span
                      style={{
                        display: 'inline-block',
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: item.isActive ? 'var(--accent-emerald)' : 'var(--text-quaternary)',
                      }}
                    />
                  </td>
                  <td style={cellStyle}>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button
                        onClick={() => {
                          setEditItem(item);
                          setDialogOpen(true);
                        }}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          padding: 4,
                          borderRadius: 4,
                          color: 'var(--text-tertiary)',
                          display: 'flex',
                          alignItems: 'center',
                        }}
                        title="Edit"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => setDeleteItem(item)}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          padding: 4,
                          borderRadius: 4,
                          color: 'var(--text-tertiary)',
                          display: 'flex',
                          alignItems: 'center',
                        }}
                        title="Deactivate"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </motion.tr>
              ))
            )}
          </motion.tbody>
        </table>
      </div>

      {/* Create/Edit Dialog */}
      <MelMasterDialog
        open={dialogOpen}
        onClose={() => {
          setDialogOpen(false);
          setEditItem(null);
        }}
        onSaved={() => fetchItems()}
        editItem={editItem}
      />

      {/* Delete Confirm */}
      <Dialog open={!!deleteItem} onOpenChange={(open) => { if (!open) setDeleteItem(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Deactivate MEL Item</DialogTitle>
            <DialogDescription>
              Are you sure you want to deactivate &ldquo;{deleteItem?.title}&rdquo;? This will soft-delete the item.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteItem(null)} disabled={deleteLoading}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleteLoading}>
              {deleteLoading ? 'Deactivating...' : 'Deactivate'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MEL Deferrals Tab (exported)
// ═══════════════════════════════════════════════════════════════

export function MelDeferralsTab() {
  const [view, setView] = useState<'deferrals' | 'master'>('deferrals');
  const [stats, setStats] = useState<MelStats | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await api.get<MelStats>('/api/admin/maintenance/mel/stats');
        setStats(res);
      } catch {
        // stats are non-critical, silent fail
      }
    }
    fetchStats();
  }, [refreshKey]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Stats Row */}
      {stats && (
        <motion.div
          initial="hidden"
          animate="visible"
          variants={{
            hidden: { opacity: 0 },
            visible: { opacity: 1, transition: { staggerChildren: 0.05, delayChildren: 0.05 } },
          }}
          style={{
            display: 'flex',
            gap: 12,
            padding: '16px 24px',
            borderBottom: '1px solid var(--border-primary)',
            overflowX: 'auto',
          }}
        >
          <StatCard label="Active" value={stats.active} borderColor="var(--accent-blue-bright)" />
          <StatCard label="Expiring <48h" value={stats.expiring48h} borderColor="var(--accent-red)" />
          <StatCard label="Cat A/B" value={stats.catAB} borderColor="var(--accent-amber)" />
          <StatCard label="Cat C/D" value={stats.catCD} borderColor="var(--accent-cyan)" />
          <StatCard label="Rectified 30d" value={stats.rectified30d} borderColor="var(--accent-emerald)" />
        </motion.div>
      )}

      {/* View Toggle Bar */}
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
          onClick={() => setView('deferrals')}
          style={{
            background: 'none',
            border: 'none',
            borderBottom:
              view === 'deferrals' ? '2px solid var(--accent-blue)' : '2px solid transparent',
            padding: '8px 16px',
            fontSize: 12,
            fontWeight: 500,
            color: view === 'deferrals' ? 'var(--accent-blue-bright)' : 'var(--text-tertiary)',
            cursor: 'pointer',
            transition: 'color 120ms',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <AlertTriangle size={13} />
          Active Deferrals
        </button>
        <button
          onClick={() => setView('master')}
          style={{
            background: 'none',
            border: 'none',
            borderBottom:
              view === 'master' ? '2px solid var(--accent-blue)' : '2px solid transparent',
            padding: '8px 16px',
            fontSize: 12,
            fontWeight: 500,
            color: view === 'master' ? 'var(--accent-blue-bright)' : 'var(--text-tertiary)',
            cursor: 'pointer',
            transition: 'color 120ms',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <BookOpen size={13} />
          MEL Master List
        </button>
      </div>

      {/* View Content */}
      <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
        {view === 'deferrals' && <ActiveDeferralsView refreshKey={refreshKey} />}
        {view === 'master' && <MelMasterListView />}
      </div>
    </div>
  );
}
