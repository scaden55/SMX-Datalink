import React, { useCallback, useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, MoreVertical, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, RefreshCw, Loader2, ExternalLink, AlertTriangle } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { toast } from '@/stores/toastStore';
import { formatDate } from '@/lib/formatters';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';

// ── Types ────────────────────────────────────────────────────

interface AirworthinessDirective {
  id: number;
  aircraftId: number;
  registration?: string;
  adNumber: string;
  title: string;
  description: string | null;
  complianceStatus: ComplianceStatus;
  complianceMethod: string | null;
  complianceDate: string | null;
  complianceNotes: string | null;
  complianceSummary: string | null;
  nextDueHours: number | null;
  nextDueDate: string | null;
  recurringIntervalHours: number | null;
  source: string | null;
  federalRegisterUrl: string | null;
  applicability: string | null;
  needsReview: boolean;
  classificationReason: string | null;
}

type ComplianceStatus = 'open' | 'complied' | 'recurring' | 'not_applicable';

const ALL_STATUSES: ComplianceStatus[] = ['open', 'complied', 'recurring', 'not_applicable'];

const STATUS_LABELS: Record<ComplianceStatus, string> = {
  open: 'Open',
  complied: 'Complied',
  recurring: 'Recurring',
  not_applicable: 'Not Applicable',
};

const STATUS_BADGE_COLORS: Record<ComplianceStatus, { bg: string; text: string }> = {
  open: { bg: 'var(--accent-amber-bg)', text: 'var(--accent-amber)' },
  complied: { bg: 'var(--accent-emerald-bg)', text: 'var(--accent-emerald)' },
  recurring: { bg: 'var(--accent-blue-bg)', text: 'var(--accent-blue-bright)' },
  not_applicable: { bg: 'var(--surface-2)', text: 'var(--text-tertiary)' },
};

// ── Helpers ──────────────────────────────────────────────────

function AdStatusBadge({ status }: { status: ComplianceStatus }) {
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

// ── Styles ───────────────────────────────────────────────────

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

const PAGE_SIZE = 25;

// ── Detail Panel (shown when a row is expanded) ─────────────

function AdDetailPanel({ item }: { item: AirworthinessDirective }) {
  const description = item.description || item.complianceSummary;
  const hasDetails = description || item.complianceMethod || item.complianceNotes || item.federalRegisterUrl || item.applicability || item.needsReview;

  if (!hasDetails) {
    return (
      <div style={{ padding: '16px 24px', color: 'var(--text-tertiary)', fontSize: 12 }}>
        No additional details available for this directive.
      </div>
    );
  }

  return (
    <div
      style={{
        padding: '16px 24px',
        background: 'var(--surface-1)',
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '12px 32px',
      }}
    >
      {/* Needs review banner */}
      {item.needsReview && (
        <div
          style={{
            gridColumn: '1 / -1',
            display: 'flex',
            alignItems: 'flex-start',
            gap: 8,
            padding: '10px 14px',
            borderRadius: 4,
            backgroundColor: 'rgba(245, 158, 11, 0.06)',
            border: '1px solid rgba(245, 158, 11, 0.2)',
          }}
        >
          <AlertTriangle size={14} style={{ color: 'var(--accent-amber)', flexShrink: 0, marginTop: 1 }} />
          <div>
            <div className="text-caption" style={{ fontWeight: 600, color: 'var(--accent-amber)', marginBottom: 2 }}>
              Manual Review Required
            </div>
            <div className="text-caption" style={{ color: 'var(--text-secondary)', lineHeight: 1.4 }}>
              {item.classificationReason || 'The system could not confidently classify this AD. Please review and update the compliance status.'}
            </div>
          </div>
        </div>
      )}

      {/* Classification */}
      {item.classificationReason && !item.needsReview && (
        <div style={{ gridColumn: '1 / -1' }}>
          <div className="text-subheading" style={{ fontSize: 10, marginBottom: 4 }}>CLASSIFICATION</div>
          <div className="text-caption" style={{ color: 'var(--text-tertiary)' }}>{item.classificationReason}</div>
        </div>
      )}

      {/* Description — full width */}
      {description && (
        <div style={{ gridColumn: '1 / -1' }}>
          <div className="text-subheading" style={{ fontSize: 10, marginBottom: 4 }}>DESCRIPTION</div>
          <div className="text-caption" style={{ color: 'var(--text-secondary)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
            {description}
          </div>
        </div>
      )}

      {/* Applicability */}
      {item.applicability && (
        <div>
          <div className="text-subheading" style={{ fontSize: 10, marginBottom: 4 }}>APPLICABILITY</div>
          <div className="text-caption" style={{ color: 'var(--text-secondary)' }}>{item.applicability}</div>
        </div>
      )}

      {/* Compliance Method */}
      {item.complianceMethod && (
        <div>
          <div className="text-subheading" style={{ fontSize: 10, marginBottom: 4 }}>COMPLIANCE METHOD</div>
          <div className="text-caption" style={{ color: 'var(--text-secondary)' }}>{item.complianceMethod}</div>
        </div>
      )}

      {/* Compliance Notes */}
      {item.complianceNotes && (
        <div style={{ gridColumn: '1 / -1' }}>
          <div className="text-subheading" style={{ fontSize: 10, marginBottom: 4 }}>COMPLIANCE NOTES</div>
          <div className="text-caption" style={{ color: 'var(--text-secondary)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
            {item.complianceNotes}
          </div>
        </div>
      )}

      {/* Federal Register link */}
      {item.federalRegisterUrl && (
        <div style={{ gridColumn: '1 / -1' }}>
          <a
            href={item.federalRegisterUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-caption"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              color: 'var(--accent-blue-bright)',
              textDecoration: 'none',
              fontWeight: 500,
            }}
            onMouseEnter={(e) => { e.currentTarget.style.textDecoration = 'underline'; }}
            onMouseLeave={(e) => { e.currentTarget.style.textDecoration = 'none'; }}
          >
            <ExternalLink size={12} />
            View on Federal Register
          </a>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// AdsTab — per-aircraft AD listing with sync + CRUD
// ═══════════════════════════════════════════════════════════════

export function AdsTab({ aircraftId }: { aircraftId: number }) {
  const [items, setItems] = useState<AirworthinessDirective[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);

  // Filters
  const [statusFilter, setStatusFilter] = useState('all');

  // Pagination
  const [page, setPage] = useState(1);

  // Dialog state
  const [createOpen, setCreateOpen] = useState(false);
  const [editItem, setEditItem] = useState<AirworthinessDirective | null>(null);
  const [deleteItem, setDeleteItem] = useState<AirworthinessDirective | null>(null);

  // Row expansion
  const [expandedId, setExpandedId] = useState<number | null>(null);

  // Sync state
  const [syncing, setSyncing] = useState(false);

  // ── Sync ADs from FAA ──────────────────────────────────

  async function handleSyncAds() {
    setSyncing(true);
    try {
      const res = await api.post<{
        synced: number;
        classified: { recurring: number; oneTime: number; needsReview: number };
        errors: string[];
      }>('/api/admin/maintenance/ads/sync', {});

      if (res.errors && res.errors.length > 0) {
        toast.warning(`Synced ${res.synced} ADs with ${res.errors.length} error(s)`);
      } else if (res.synced === 0) {
        toast.info('No new ADs found');
      } else {
        const c = res.classified;
        toast.success(`Synced ${res.synced} ADs — ${c.recurring} recurring, ${c.oneTime} one-time, ${c.needsReview} need review`);
      }
      fetchItems();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to sync ADs from FAA');
    } finally {
      setSyncing(false);
    }
  }

  // ── Fetch ────────────────────────────────────────────────

  const fetchItems = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      params.set('page', page.toString());
      params.set('pageSize', PAGE_SIZE.toString());
      params.set('aircraftId', String(aircraftId));
      if (statusFilter === 'needs_review') {
        params.set('needsReview', 'true');
      } else if (statusFilter !== 'all') {
        params.set('status', statusFilter);
      }

      const res = await api.get<{ directives: AirworthinessDirective[]; total: number }>(
        `/api/admin/maintenance/ads?${params.toString()}`,
      );
      setItems(res.directives);
      setTotal(res.total);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to load airworthiness directives');
    } finally {
      setLoading(false);
    }
  }, [page, aircraftId, statusFilter]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  useEffect(() => {
    setPage(1);
  }, [statusFilter]);

  // ── Delete ───────────────────────────────────────────────

  async function handleDelete() {
    if (!deleteItem) return;
    try {
      await api.delete(`/api/admin/maintenance/ads/${deleteItem.id}`);
      toast.success(`Deleted AD ${deleteItem.adNumber}`);
      setDeleteItem(null);
      fetchItems();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to delete AD');
    }
  }

  // ── Derived ──────────────────────────────────────────────

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // ── Render ────────────────────────────────────────────────

  if (loading) {
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

  return (
    <>
      {/* Filter / action bar */}
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
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="text-caption" style={{ width: 160 }}>
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="needs_review">
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <AlertTriangle size={11} style={{ color: 'var(--accent-amber)' }} />
                Needs Review
              </span>
            </SelectItem>
            {ALL_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {STATUS_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div style={{ flex: 1 }} />

        <button
          onClick={handleSyncAds}
          disabled={syncing}
          className="text-caption"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 14px',
            background: 'none',
            color: syncing ? 'var(--text-tertiary)' : 'var(--text-secondary)',
            border: '1px solid var(--border-primary)',
            borderRadius: 6,
            fontWeight: 600,
            cursor: syncing ? 'default' : 'pointer',
            transition: 'color 120ms, border-color 120ms',
            opacity: syncing ? 0.6 : 1,
          }}
          onMouseEnter={(e) => { if (!syncing) e.currentTarget.style.borderColor = 'var(--accent-blue)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-primary)'; }}
        >
          {syncing ? (
            <Loader2 size={13} className="animate-spin" />
          ) : (
            <RefreshCw size={13} />
          )}
          {syncing ? 'Syncing...' : 'Sync from FAA'}
        </button>

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
          Add AD
        </button>
      </div>

      {/* Empty state */}
      {items.length === 0 && (
        <div
          className="text-body"
          style={{ padding: '60px 24px', textAlign: 'center', color: 'var(--text-tertiary)' }}
        >
          No airworthiness directives found. Sync from FAA or add one manually.
        </div>
      )}

      {/* Table */}
      {items.length > 0 && (
        <>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th className={COL_HEADER_CLASS} style={colHeaderStyle}>AD Number</th>
                  <th className={COL_HEADER_CLASS} style={{ ...colHeaderStyle, width: 72 }}>Source</th>
                  <th className={COL_HEADER_CLASS} style={colHeaderStyle}>Title</th>
                  <th className={COL_HEADER_CLASS} style={{ ...colHeaderStyle, textAlign: 'center' }}>Status</th>
                  <th className={COL_HEADER_CLASS} style={colHeaderStyle}>Compliance Date</th>
                  <th className={COL_HEADER_CLASS} style={colHeaderStyle}>Next Due</th>
                  <th className={COL_HEADER_CLASS} style={{ ...colHeaderStyle, textAlign: 'right' }}>Recurring Int.</th>
                  <th className={COL_HEADER_CLASS} style={{ ...colHeaderStyle, width: 48 }} />
                  <th className={COL_HEADER_CLASS} style={{ ...colHeaderStyle, width: 36 }} />
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const exp = expandedId === item.id;
                  return (
                    <React.Fragment key={item.id}>
                      <tr
                        onClick={() => setExpandedId(exp ? null : item.id)}
                        style={{
                          cursor: 'pointer',
                          background: exp ? 'var(--accent-blue-bg)' : 'transparent',
                          outline: exp ? '1px solid var(--accent-blue)' : 'none',
                          outlineOffset: -1,
                          transition: 'background 80ms',
                        }}
                        onMouseEnter={(e) => { if (!exp) e.currentTarget.style.background = 'var(--tint-subtle)'; }}
                        onMouseLeave={(e) => { if (!exp) e.currentTarget.style.background = 'transparent'; }}
                      >
                        {/* AD Number */}
                        <td className={`${CELL_CLASS} ${MONO_CLASS}`} style={{ ...cellStyle, fontWeight: 600, color: 'var(--text-primary)' }}>
                          {item.adNumber}
                        </td>

                        {/* Source */}
                        <td className={CELL_CLASS} style={cellStyle}>
                          {item.source === 'faa_sync' ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 6px', borderRadius: 3, fontSize: 10, fontWeight: 600, lineHeight: '14px', background: 'var(--accent-cyan-bg)', color: 'var(--accent-cyan)', whiteSpace: 'nowrap' }}>FAA</span>
                          ) : (
                            <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 6px', borderRadius: 3, fontSize: 10, fontWeight: 600, lineHeight: '14px', background: 'var(--surface-2)', color: 'var(--text-quaternary)', whiteSpace: 'nowrap' }}>Manual</span>
                          )}
                        </td>

                        {/* Title */}
                        <td className={CELL_CLASS} style={{ ...cellStyle, maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {item.title}
                        </td>

                        {/* Status */}
                        <td className={CELL_CLASS} style={{ ...cellStyle, textAlign: 'center' }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <AdStatusBadge status={item.complianceStatus} />
                            <span
                              title={item.needsReview ? (item.classificationReason || 'Manual review required') : undefined}
                              style={{ width: 12, height: 12, flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                            >
                              {item.needsReview && <AlertTriangle size={12} style={{ color: 'var(--accent-amber)' }} />}
                            </span>
                          </div>
                        </td>

                        {/* Compliance Date */}
                        <td className={`${CELL_CLASS} ${MONO_CLASS}`} style={cellStyle}>
                          {formatDate(item.complianceDate)}
                        </td>

                        {/* Next Due */}
                        <td className={`${CELL_CLASS} ${MONO_CLASS}`} style={cellStyle}>
                          {item.nextDueHours != null
                            ? `${item.nextDueHours.toLocaleString()}h`
                            : item.nextDueDate
                              ? formatDate(item.nextDueDate)
                              : '\u2014'}
                        </td>

                        {/* Recurring Interval */}
                        <td className={`${CELL_CLASS} ${MONO_CLASS}`} style={{ ...cellStyle, textAlign: 'right' }}>
                          {item.recurringIntervalHours != null
                            ? `${item.recurringIntervalHours.toLocaleString()}h`
                            : '\u2014'}
                        </td>

                        {/* Actions */}
                        <td className={CELL_CLASS} style={{ ...cellStyle, padding: '6px 8px' }} onClick={(e) => e.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, background: 'none', border: '1px solid var(--border-primary)', borderRadius: 4, color: 'var(--text-tertiary)', cursor: 'pointer' }}>
                                <MoreVertical size={14} />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => setEditItem(item)}>
                                <Pencil size={13} style={{ marginRight: 6 }} /> Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setDeleteItem(item)}>
                                <Trash2 size={13} style={{ marginRight: 6 }} /> Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>

                        {/* Chevron */}
                        <td className={CELL_CLASS} style={{ ...cellStyle, textAlign: 'center', color: 'var(--text-quaternary)' }}>
                          {exp ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </td>
                      </tr>

                      {/* ── Expanded detail panel ── */}
                      {exp && (
                        <tr>
                          <td colSpan={9} style={{ padding: 0, borderBottom: '1px solid var(--border-primary)' }}>
                            <AdDetailPanel item={item} />
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
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
            <span className="text-caption">
              {total === 0
                ? 'No results'
                : `${(page - 1) * PAGE_SIZE + 1}\u2013${Math.min(page * PAGE_SIZE, total)} of ${total}`}
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

      {/* ── Create Dialog ─────────────────────────────────────── */}
      <ADFormDialog
        open={createOpen}
        mode="create"
        aircraftId={aircraftId}
        onClose={() => setCreateOpen(false)}
        onSaved={() => {
          setCreateOpen(false);
          fetchItems();
        }}
      />

      {/* ── Edit Dialog ───────────────────────────────────────── */}
      <ADFormDialog
        open={!!editItem}
        mode="edit"
        aircraftId={aircraftId}
        item={editItem ?? undefined}
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
            <DialogTitle>Delete Airworthiness Directive</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete AD{' '}
              <span className={MONO_CLASS} style={{ fontWeight: 600 }}>
                {deleteItem?.adNumber}
              </span>
              ? This action cannot be undone.
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
// ADFormDialog — create/edit form (aircraft pre-scoped)
// ═══════════════════════════════════════════════════════════════

function ADFormDialog({
  open,
  mode,
  aircraftId,
  item,
  onClose,
  onSaved,
}: {
  open: boolean;
  mode: 'create' | 'edit';
  aircraftId: number;
  item?: AirworthinessDirective;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [adNumber, setAdNumber] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [complianceStatus, setComplianceStatus] = useState<ComplianceStatus>('open');
  const [complianceMethod, setComplianceMethod] = useState('');
  const [complianceDate, setComplianceDate] = useState('');
  const [complianceNotes, setComplianceNotes] = useState('');
  const [nextDueHours, setNextDueHours] = useState('');
  const [nextDueDate, setNextDueDate] = useState('');
  const [recurringIntervalHours, setRecurringIntervalHours] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (mode === 'edit' && item) {
      setAdNumber(item.adNumber);
      setTitle(item.title);
      setDescription(item.description ?? '');
      setComplianceStatus(item.complianceStatus);
      setComplianceMethod(item.complianceMethod ?? '');
      setComplianceDate(item.complianceDate ?? '');
      setComplianceNotes(item.complianceNotes ?? '');
      setNextDueHours(item.nextDueHours?.toString() ?? '');
      setNextDueDate(item.nextDueDate ?? '');
      setRecurringIntervalHours(item.recurringIntervalHours?.toString() ?? '');
    } else if (mode === 'create') {
      resetForm();
    }
  }, [mode, item]);

  function resetForm() {
    setAdNumber('');
    setTitle('');
    setDescription('');
    setComplianceStatus('open');
    setComplianceMethod('');
    setComplianceDate('');
    setComplianceNotes('');
    setNextDueHours('');
    setNextDueDate('');
    setRecurringIntervalHours('');
  }

  async function handleSave() {
    if (!adNumber.trim() || !title.trim()) return;
    setSaving(true);
    try {
      const payload = {
        aircraftId,
        adNumber: adNumber.trim(),
        title: title.trim(),
        description: description.trim() || null,
        complianceStatus,
        complianceMethod: complianceMethod.trim() || null,
        complianceDate: complianceDate || null,
        complianceNotes: complianceNotes.trim() || null,
        nextDueHours: nextDueHours ? parseFloat(nextDueHours) : null,
        nextDueDate: nextDueDate || null,
        recurringIntervalHours: recurringIntervalHours ? parseFloat(recurringIntervalHours) : null,
      };

      if (mode === 'create') {
        await api.post('/api/admin/maintenance/ads', payload);
        toast.success('Airworthiness directive created');
      } else if (item) {
        await api.patch(`/api/admin/maintenance/ads/${item.id}`, payload);
        toast.success('Airworthiness directive updated');
      }
      resetForm();
      onSaved();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : `Failed to ${mode} AD`);
    } finally {
      setSaving(false);
    }
  }

  const isEdit = mode === 'edit';
  const canSave = adNumber.trim() && title.trim();

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
          <DialogTitle>{isEdit ? 'Edit Airworthiness Directive' : 'Add Airworthiness Directive'}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Update airworthiness directive compliance details.'
              : 'Add a new airworthiness directive to track compliance.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2" style={{ maxHeight: 420, overflowY: 'auto' }}>
          {/* AD Number */}
          <div className="space-y-2">
            <Label>AD Number *</Label>
            <Input
              value={adNumber}
              onChange={(e) => setAdNumber(e.target.value)}
              placeholder="e.g. 2024-15-06"
              className={MONO_CLASS}
            />
          </div>

          {/* Title */}
          <div className="space-y-2">
            <Label>Title *</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="AD title / subject"
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
              rows={2}
            />
          </div>

          {/* Compliance Status */}
          <div className="space-y-2">
            <Label>Compliance Status *</Label>
            <Select value={complianceStatus} onValueChange={(v) => setComplianceStatus(v as ComplianceStatus)}>
              <SelectTrigger className="text-caption">
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

          {/* Compliance Method */}
          <div className="space-y-2">
            <Label>Compliance Method</Label>
            <Input
              value={complianceMethod}
              onChange={(e) => setComplianceMethod(e.target.value)}
              placeholder="e.g. Inspection, Modification"
            />
          </div>

          {/* Compliance Date */}
          <div className="space-y-2">
            <Label>Compliance Date</Label>
            <Input
              type="date"
              value={complianceDate}
              onChange={(e) => setComplianceDate(e.target.value)}
            />
          </div>

          {/* Compliance Notes */}
          <div className="space-y-2">
            <Label>Compliance Notes</Label>
            <Textarea
              value={complianceNotes}
              onChange={(e) => setComplianceNotes(e.target.value)}
              placeholder="Optional notes"
              rows={2}
            />
          </div>

          {/* Next Due row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="space-y-2">
              <Label>Next Due Hours</Label>
              <Input
                type="number"
                value={nextDueHours}
                onChange={(e) => setNextDueHours(e.target.value)}
                placeholder="0"
                min={0}
              />
            </div>
            <div className="space-y-2">
              <Label>Next Due Date</Label>
              <Input
                type="date"
                value={nextDueDate}
                onChange={(e) => setNextDueDate(e.target.value)}
              />
            </div>
          </div>

          {/* Recurring Interval */}
          <div className="space-y-2">
            <Label>Recurring Interval (Hours)</Label>
            <Input
              type="number"
              value={recurringIntervalHours}
              onChange={(e) => setRecurringIntervalHours(e.target.value)}
              placeholder="e.g. 5000"
              min={0}
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
