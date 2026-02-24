import { useState, useEffect, useCallback } from 'react';
import {
  ClipboardText,
  MagnifyingGlass,
  SpinnerGap,
  X,
  ArrowRight,
  Clock,
  GasPump,
  Ruler,
  AirplaneTilt,
  Calendar,
  Note,
  User,
  CheckCircle,
  XCircle,
  CaretLeft,
  CaretRight,
} from '@phosphor-icons/react';
import { api } from '../../lib/api';
import { AdminPageHeader } from '../../components/admin/AdminPageHeader';
import { StatusBadge } from '../../components/admin/StatusBadge';
import { ConfirmDialog } from '../../components/admin/ConfirmDialog';
import { AdminTable, type ColumnDef } from '../../components/admin/AdminTable';
import { VatsimBadge } from '../../components/common/VatsimBadge';
import type { LogbookEntry, LogbookStatus, PirepReviewRequest, BulkPirepReviewRequest } from '@acars/shared';

// ── Types ────────────────────────────────────────────────────────

interface PirepListResponse {
  entries: LogbookEntry[];
  total: number;
  page: number;
  pageSize: number;
  pendingCount: number;
}

type StatusTab = '' | 'pending' | 'approved' | 'rejected';

// ── Helpers ──────────────────────────────────────────────────────

function formatDuration(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}h ${String(m).padStart(2, '0')}m`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }) + 'z';
}

function formatDateTime(iso: string): string {
  return `${formatDate(iso)} ${formatTime(iso)}`;
}

function landingRateColor(fpm: number | null): string {
  if (fpm == null) return 'text-acars-muted';
  const abs = Math.abs(fpm);
  if (abs < 200) return 'text-emerald-400';
  if (abs <= 400) return 'text-amber-400';
  return 'text-red-400';
}

function scoreColor(score: number | null): string {
  if (score == null) return 'text-acars-muted';
  if (score >= 90) return 'text-emerald-400';
  if (score >= 75) return 'text-amber-400';
  return 'text-red-400';
}

const STATUS_BADGE_CONFIG: Record<string, { bg: string; text: string; dot: string; label?: string }> = {
  pending:   { bg: 'bg-amber-500/10', text: 'text-amber-400', dot: 'bg-amber-500' },
  approved:  { bg: 'bg-emerald-500/10', text: 'text-emerald-400', dot: 'bg-emerald-500' },
  rejected:  { bg: 'bg-red-500/10',   text: 'text-red-400',   dot: 'bg-red-500' },
  diverted:  { bg: 'bg-blue-500/10',  text: 'text-blue-400',  dot: 'bg-blue-500' },
  cancelled: { bg: 'bg-gray-500/10',    text: 'text-gray-400',    dot: 'bg-gray-400' },
};

const STATUS_TABS: { key: StatusTab; label: string }[] = [
  { key: '',         label: 'All' },
  { key: 'pending',  label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
];

// ── Component ────────────────────────────────────────────────────

export function AdminPirepsPage() {
  // ── List state ─────────────────────────────────────────────────
  const [entries, setEntries] = useState<LogbookEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pendingCount, setPendingCount] = useState(0);

  // ── Filters ────────────────────────────────────────────────────
  const [statusTab, setStatusTab] = useState<StatusTab>('');
  const [search, setSearch] = useState('');
  const [searchDebounced, setSearchDebounced] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // ── Selection ──────────────────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  // ── Detail panel ───────────────────────────────────────────────
  const [detailEntry, setDetailEntry] = useState<LogbookEntry | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // ── Review form state ──────────────────────────────────────────
  const [reviewStatus, setReviewStatus] = useState<'approved' | 'rejected'>('approved');
  const [reviewNotes, setReviewNotes] = useState('');
  const [reviewSubmitting, setReviewSubmitting] = useState(false);

  // ── Bulk action state ──────────────────────────────────────────
  const [bulkConfirm, setBulkConfirm] = useState<{ action: 'approved' | 'rejected' } | null>(null);
  const [bulkSubmitting, setBulkSubmitting] = useState(false);

  // ── Debounce search ────────────────────────────────────────────
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchDebounced(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // ── Fetch entries ──────────────────────────────────────────────
  const fetchEntries = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (statusTab) params.set('status', statusTab);
      if (searchDebounced) params.set('search', searchDebounced);
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo) params.set('dateTo', dateTo);
      params.set('page', String(page));
      params.set('pageSize', String(pageSize));

      const data = await api.get<PirepListResponse>(`/api/admin/pireps?${params}`);
      setEntries(data.entries);
      setTotal(data.total);
      setPendingCount(data.pendingCount);
    } catch (err: any) {
      setError(err?.message || 'Failed to load PIREPs');
    } finally {
      setLoading(false);
    }
  }, [statusTab, searchDebounced, dateFrom, dateTo, page, pageSize]);

  useEffect(() => { fetchEntries(); }, [fetchEntries]);

  // ── Open detail panel ──────────────────────────────────────────
  const openDetail = async (entry: LogbookEntry) => {
    setDetailLoading(true);
    setDetailEntry(entry);
    setReviewStatus('approved');
    setReviewNotes('');
    try {
      const full = await api.get<LogbookEntry>(`/api/admin/pireps/${entry.id}`);
      setDetailEntry(full);
    } catch {
      // Keep the list-level entry data if detail fetch fails
    } finally {
      setDetailLoading(false);
    }
  };

  const closeDetail = () => {
    setDetailEntry(null);
  };

  // ── Submit single review ───────────────────────────────────────
  const submitReview = async () => {
    if (!detailEntry) return;
    setReviewSubmitting(true);
    try {
      const body: PirepReviewRequest = { status: reviewStatus };
      if (reviewNotes.trim()) body.notes = reviewNotes.trim();
      await api.post(`/api/admin/pireps/${detailEntry.id}/review`, body);
      // Refresh detail
      const updated = await api.get<LogbookEntry>(`/api/admin/pireps/${detailEntry.id}`);
      setDetailEntry(updated);
      // Refresh list
      fetchEntries();
    } catch (err: any) {
      setError(err?.message || 'Failed to submit review');
    } finally {
      setReviewSubmitting(false);
    }
  };

  // ── Submit bulk review ─────────────────────────────────────────
  const submitBulkReview = async () => {
    if (!bulkConfirm || selectedIds.size === 0) return;
    setBulkSubmitting(true);
    try {
      const body: BulkPirepReviewRequest = {
        ids: Array.from(selectedIds),
        status: bulkConfirm.action,
      };
      await api.post('/api/admin/pireps/bulk-review', body);
      setSelectedIds(new Set());
      setBulkConfirm(null);
      fetchEntries();
    } catch (err: any) {
      setError(err?.message || 'Bulk review failed');
    } finally {
      setBulkSubmitting(false);
    }
  };

  // ── Derived stats ──────────────────────────────────────────────
  const approvedCount = entries.filter(e => e.status === 'approved').length;
  const rejectedCount = entries.filter(e => e.status === 'rejected').length;
  const approvedPct = total > 0 ? Math.round((approvedCount / entries.length) * 100) : 0;

  // ── Table columns ──────────────────────────────────────────────
  const columns: ColumnDef<LogbookEntry>[] = [
    {
      key: 'flight',
      header: 'Flight #',
      sortable: true,
      width: '100px',
      render: (row) => (
        <span className="font-mono font-semibold text-acars-text">
          {row.flightNumber || '---'}
        </span>
      ),
    },
    {
      key: 'pilot',
      header: 'Pilot',
      sortable: true,
      render: (row) => (
        <div>
          <div className="text-acars-text font-medium">{row.pilotCallsign || '---'}</div>
          <div className="text-[10px] text-acars-muted">{row.pilotName || ''}</div>
        </div>
      ),
    },
    {
      key: 'route',
      header: 'Route',
      sortable: true,
      render: (row) => (
        <div className="flex items-center gap-1.5">
          <span className="font-mono font-semibold text-acars-text">{row.depIcao}</span>
          <ArrowRight className="w-3 h-3 text-sky-400/40 shrink-0" />
          <span className="font-mono font-semibold text-acars-text">{row.arrIcao}</span>
        </div>
      ),
    },
    {
      key: 'aircraft',
      header: 'Aircraft',
      sortable: true,
      render: (row) => (
        <div>
          <div className="text-acars-text">{row.aircraftType}</div>
          {row.aircraftRegistration && (
            <div className="text-[10px] text-acars-muted font-mono">{row.aircraftRegistration}</div>
          )}
        </div>
      ),
    },
    {
      key: 'duration',
      header: 'Duration',
      sortable: true,
      width: '80px',
      render: (row) => (
        <span className="text-acars-text">{formatDuration(row.flightTimeMin)}</span>
      ),
    },
    {
      key: 'landing',
      header: 'Landing',
      sortable: true,
      width: '90px',
      render: (row) => (
        <span className={`font-mono font-semibold ${landingRateColor(row.landingRateFpm)}`}>
          {row.landingRateFpm != null ? `${row.landingRateFpm} fpm` : '---'}
        </span>
      ),
    },
    {
      key: 'score',
      header: 'Score',
      sortable: true,
      width: '60px',
      render: (row) => (
        <span className={`font-mono font-bold ${scoreColor(row.score)}`}>
          {row.score ?? '---'}
        </span>
      ),
    },
    {
      key: 'network',
      header: 'Net',
      width: '70px',
      render: (row) => (
        <VatsimBadge connected={row.vatsimConnected} callsign={row.vatsimCallsign} />
      ),
    },
    {
      key: 'status',
      header: 'Status',
      width: '100px',
      render: (row) => (
        <StatusBadge status={row.status} config={STATUS_BADGE_CONFIG} />
      ),
    },
    {
      key: 'date',
      header: 'Date',
      sortable: true,
      width: '110px',
      render: (row) => (
        <div>
          <div className="text-acars-text">{formatDate(row.actualDep)}</div>
          <div className="text-[10px] text-acars-muted">{formatTime(row.actualDep)}</div>
        </div>
      ),
    },
    {
      key: 'actions',
      header: '',
      width: '40px',
      render: (row) => (
        <button
          onClick={(e) => { e.stopPropagation(); openDetail(row); }}
          className="text-acars-muted hover:text-blue-400 transition-colors"
          title="View details"
        >
          <ClipboardText className="w-3.5 h-3.5" />
        </button>
      ),
    },
  ];

  // ── Render ─────────────────────────────────────────────────────
  return (
    <div className="p-6 space-y-4 h-full flex flex-col overflow-hidden relative">
      {/* ── Header ──────────────────────────────────────────────── */}
      <AdminPageHeader
        icon={ClipboardText}
        title="PIREP Review"
        subtitle="Review, approve, or reject pilot flight reports"
        stats={[
          { label: 'Pending', value: pendingCount, color: 'text-amber-400' },
          { label: 'Total', value: total },
          { label: 'Approved %', value: total > 0 ? `${approvedPct}%` : '---', color: 'text-emerald-400' },
          { label: 'Rejected', value: rejectedCount, color: 'text-red-400' },
        ]}
      />

      {/* ── Status tabs ─────────────────────────────────────────── */}
      <div className="flex items-center gap-1 border-b border-acars-border">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => { setStatusTab(tab.key); setPage(1); setSelectedIds(new Set()); }}
            className={`relative px-4 py-2 text-xs font-medium transition-colors ${
              statusTab === tab.key
                ? 'text-blue-400 border-b-2 border-blue-400 -mb-px'
                : 'text-acars-muted hover:text-acars-text'
            }`}
          >
            {tab.label}
            {tab.key === 'pending' && pendingCount > 0 && (
              <span className="ml-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-amber-500/20 text-amber-400 text-[10px] font-bold">
                {pendingCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Filters bar ─────────────────────────────────────────── */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <MagnifyingGlass className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-acars-muted pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search callsign, flight #, ICAO..."
            className="input-field text-xs font-mono h-8 pl-8"
          />
        </div>

        <div className="flex items-center gap-2">
          <label className="text-[10px] text-acars-muted uppercase tracking-wider">From</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
            className="input-field text-xs h-8 px-2"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-[10px] text-acars-muted uppercase tracking-wider">To</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
            className="input-field text-xs h-8 px-2"
          />
        </div>

        {(search || dateFrom || dateTo) && (
          <button
            onClick={() => { setSearch(''); setDateFrom(''); setDateTo(''); setPage(1); }}
            className="btn-secondary btn-sm flex items-center gap-1.5 h-8"
          >
            <X className="w-3 h-3" />
            Clear
          </button>
        )}
      </div>

      {/* ── Error message ───────────────────────────────────────── */}
      {error && (
        <div className="px-3 py-2 rounded-md bg-red-500/10 border border-red-400/20 text-xs text-red-400">
          {error}
        </div>
      )}

      {/* ── Table ───────────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 overflow-auto">
        <AdminTable<LogbookEntry>
          columns={columns}
          data={entries}
          total={total}
          page={page}
          pageSize={pageSize}
          onPageChange={setPage}
          loading={loading}
          selectable
          selectedIds={selectedIds}
          onSelectChange={(ids) => setSelectedIds(ids)}
          getRowId={(row) => row.id}
          onRowClick={(row) => openDetail(row)}
          emptyMessage="No PIREPs match the current filters"
        />
      </div>

      {/* ── Bulk action bar ─────────────────────────────────────── */}
      {selectedIds.size > 0 && (
        <div className="sticky bottom-0 left-0 right-0 flex items-center justify-between px-4 py-3 border-t border-acars-border bg-acars-panel z-50">
          <span className="text-xs text-acars-text font-medium">
            {selectedIds.size} selected
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setBulkConfirm({ action: 'approved' })}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-emerald-500/20 text-emerald-400 text-xs font-medium hover:bg-emerald-500/30 transition-colors"
            >
              <CheckCircle className="w-3.5 h-3.5" />
              Approve All
            </button>
            <button
              onClick={() => setBulkConfirm({ action: 'rejected' })}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-red-500/20 text-red-400 text-xs font-medium hover:bg-red-500/30 transition-colors"
            >
              <XCircle className="w-3.5 h-3.5" />
              Reject All
            </button>
            <button
              onClick={() => setSelectedIds(new Set())}
              className="btn-secondary btn-sm"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* ── Bulk confirm dialog ─────────────────────────────────── */}
      <ConfirmDialog
        open={bulkConfirm !== null}
        title={bulkConfirm?.action === 'approved' ? 'Approve PIREPs' : 'Reject PIREPs'}
        message={`Are you sure you want to ${bulkConfirm?.action === 'approved' ? 'approve' : 'reject'} ${selectedIds.size} selected PIREP${selectedIds.size !== 1 ? 's' : ''}?`}
        variant={bulkConfirm?.action === 'approved' ? 'default' : 'danger'}
        confirmLabel={bulkConfirm?.action === 'approved' ? 'Approve All' : 'Reject All'}
        loading={bulkSubmitting}
        onConfirm={submitBulkReview}
        onCancel={() => setBulkConfirm(null)}
      />

      {/* ── Detail slide-over panel ─────────────────────────────── */}
      {detailEntry && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/40 z-[9998]"
            onClick={closeDetail}
          />

          {/* Panel */}
          <div className="fixed top-0 right-0 bottom-0 w-96 bg-acars-panel border-l border-acars-border z-[9999] flex flex-col overflow-hidden shadow-2xl">
            {/* Panel header */}
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-acars-border bg-acars-bg">
              <div className="flex items-center gap-2">
                <ClipboardText className="w-3.5 h-3.5 text-blue-400" />
                <h2 className="text-[13px] font-semibold text-acars-text">PIREP Detail</h2>
              </div>
              <button
                onClick={closeDetail}
                className="text-acars-muted hover:text-acars-text p-1 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Panel content */}
            <div className="flex-1 overflow-y-auto">
              {detailLoading ? (
                <div className="flex items-center justify-center h-40">
                  <SpinnerGap className="w-5 h-5 text-acars-muted animate-spin" />
                </div>
              ) : (
                <div className="p-4 space-y-4">
                  {/* Status + Flight number */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-bold font-mono text-acars-text">
                        {detailEntry.flightNumber || 'No Flight #'}
                      </span>
                      <VatsimBadge connected={detailEntry.vatsimConnected} callsign={detailEntry.vatsimCallsign} />
                    </div>
                    <StatusBadge status={detailEntry.status} config={STATUS_BADGE_CONFIG} />
                  </div>

                  {/* Path */}
                  <div className="panel p-3 space-y-2">
                    <div className="flex items-center gap-2 text-xs text-acars-muted">
                      <AirplaneTilt className="w-3.5 h-3.5" />
                      <span className="uppercase tracking-wider font-medium">Path</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-center">
                        <div className="text-base font-bold font-mono text-acars-text">{detailEntry.depIcao}</div>
                        <div className="text-[10px] text-acars-muted">{detailEntry.depName || ''}</div>
                      </div>
                      <div className="flex-1 flex items-center justify-center">
                        <div className="h-px flex-1 bg-acars-border" />
                        <ArrowRight className="w-4 h-4 text-sky-400/40 mx-2 shrink-0" />
                        <div className="h-px flex-1 bg-acars-border" />
                      </div>
                      <div className="text-center">
                        <div className="text-base font-bold font-mono text-acars-text">{detailEntry.arrIcao}</div>
                        <div className="text-[10px] text-acars-muted">{detailEntry.arrName || ''}</div>
                      </div>
                    </div>
                    <div className="text-[10px] text-acars-muted text-center">
                      {detailEntry.distanceNm.toLocaleString()} nm
                    </div>
                  </div>

                  {/* Pilot */}
                  <div className="panel p-3 space-y-1.5">
                    <div className="flex items-center gap-2 text-xs text-acars-muted">
                      <User className="w-3.5 h-3.5" />
                      <span className="uppercase tracking-wider font-medium">Pilot</span>
                    </div>
                    <div className="text-sm text-acars-text font-medium">{detailEntry.pilotCallsign || '---'}</div>
                    <div className="text-xs text-acars-muted">{detailEntry.pilotName || ''}</div>
                  </div>

                  {/* Times */}
                  <div className="panel p-3 space-y-1.5">
                    <div className="flex items-center gap-2 text-xs text-acars-muted">
                      <Clock className="w-3.5 h-3.5" />
                      <span className="uppercase tracking-wider font-medium">Times</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-acars-muted">Departure</span>
                        <div className="text-acars-text font-mono">{formatDateTime(detailEntry.actualDep)}</div>
                      </div>
                      <div>
                        <span className="text-acars-muted">Arrival</span>
                        <div className="text-acars-text font-mono">{formatDateTime(detailEntry.actualArr)}</div>
                      </div>
                      <div>
                        <span className="text-acars-muted">Duration</span>
                        <div className="text-acars-text font-semibold">{formatDuration(detailEntry.flightTimeMin)}</div>
                      </div>
                      <div>
                        <span className="text-acars-muted">Aircraft</span>
                        <div className="text-acars-text">{detailEntry.aircraftType}</div>
                        {detailEntry.aircraftRegistration && (
                          <div className="text-[10px] text-acars-muted font-mono">{detailEntry.aircraftRegistration}</div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Flight data */}
                  <div className="panel p-3 space-y-1.5">
                    <div className="flex items-center gap-2 text-xs text-acars-muted">
                      <Ruler className="w-3.5 h-3.5" />
                      <span className="uppercase tracking-wider font-medium">Flight Data</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-acars-muted">GasPump Used</span>
                        <div className="text-acars-text font-mono">
                          {detailEntry.fuelUsedLbs != null ? `${detailEntry.fuelUsedLbs.toLocaleString()} lbs` : '---'}
                        </div>
                      </div>
                      <div>
                        <span className="text-acars-muted">Cruise Altitude</span>
                        <div className="text-acars-text font-mono">
                          {detailEntry.cruiseAltitude || '---'}
                        </div>
                      </div>
                      <div>
                        <span className="text-acars-muted">Landing Rate</span>
                        <div className={`font-mono font-semibold ${landingRateColor(detailEntry.landingRateFpm)}`}>
                          {detailEntry.landingRateFpm != null ? `${detailEntry.landingRateFpm} fpm` : '---'}
                        </div>
                      </div>
                      <div>
                        <span className="text-acars-muted">Score</span>
                        <div className={`font-mono font-bold text-base ${scoreColor(detailEntry.score)}`}>
                          {detailEntry.score ?? '---'}
                        </div>
                      </div>
                      <div>
                        <span className="text-acars-muted">Passengers</span>
                        <div className="text-acars-text font-mono">{detailEntry.paxCount}</div>
                      </div>
                      <div>
                        <span className="text-acars-muted">Cargo</span>
                        <div className="text-acars-text font-mono">
                          {detailEntry.cargoLbs > 0 ? `${detailEntry.cargoLbs.toLocaleString()} lbs` : '---'}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Pilot notes */}
                  {detailEntry.remarks && (
                    <div className="panel p-3 space-y-1.5">
                      <div className="flex items-center gap-2 text-xs text-acars-muted">
                        <Note className="w-3.5 h-3.5" />
                        <span className="uppercase tracking-wider font-medium">Pilot Notes</span>
                      </div>
                      <p className="text-xs text-acars-text leading-relaxed whitespace-pre-wrap">
                        {detailEntry.remarks}
                      </p>
                    </div>
                  )}

                  {/* Review section */}
                  {detailEntry.reviewerId != null && detailEntry.reviewedAt ? (
                    // ── Already reviewed ──────────────────────────
                    <div className="panel p-3 space-y-1.5 border-emerald-400/20">
                      <div className="flex items-center gap-2 text-xs text-acars-muted">
                        <CheckCircle className="w-3.5 h-3.5" />
                        <span className="uppercase tracking-wider font-medium">Review</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <StatusBadge status={detailEntry.status} config={STATUS_BADGE_CONFIG} />
                        <span className="text-[10px] text-acars-muted">{formatDateTime(detailEntry.reviewedAt)}</span>
                      </div>
                      <div className="text-xs text-acars-text">
                        <span className="text-acars-muted">Reviewed by </span>
                        <span className="font-medium">{detailEntry.reviewerCallsign || detailEntry.reviewerName || 'Unknown'}</span>
                      </div>
                      {detailEntry.reviewNotes && (
                        <p className="text-xs text-acars-muted leading-relaxed whitespace-pre-wrap mt-1 pt-1 border-t border-acars-border">
                          {detailEntry.reviewNotes}
                        </p>
                      )}
                    </div>
                  ) : (
                    // ── Review form ───────────────────────────────
                    <div className="panel p-3 space-y-3">
                      <div className="flex items-center gap-2 text-xs text-acars-muted">
                        <ClipboardText className="w-3.5 h-3.5" />
                        <span className="uppercase tracking-wider font-medium">Review PIREP</span>
                      </div>

                      {/* Status radios */}
                      <div className="flex items-center gap-4">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="reviewStatus"
                            checked={reviewStatus === 'approved'}
                            onChange={() => setReviewStatus('approved')}
                            className="text-emerald-400 focus:ring-emerald-400"
                          />
                          <span className="text-xs text-emerald-400 font-medium">Approve</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="reviewStatus"
                            checked={reviewStatus === 'rejected'}
                            onChange={() => setReviewStatus('rejected')}
                            className="text-red-400 focus:ring-red-400"
                          />
                          <span className="text-xs text-red-400 font-medium">Reject</span>
                        </label>
                      </div>

                      {/* Notes textarea */}
                      <textarea
                        value={reviewNotes}
                        onChange={(e) => setReviewNotes(e.target.value)}
                        placeholder="Review notes (optional)..."
                        rows={3}
                        className="input-field text-xs resize-none"
                      />

                      {/* Submit button */}
                      <button
                        onClick={submitReview}
                        disabled={reviewSubmitting}
                        className={`w-full py-2 rounded-md text-xs font-medium text-white transition-colors disabled:opacity-50 ${
                          reviewStatus === 'approved'
                            ? 'bg-emerald-500 hover:bg-emerald-500/80'
                            : 'bg-red-500 hover:bg-red-500/80'
                        }`}
                      >
                        {reviewSubmitting ? (
                          <span className="flex items-center justify-center gap-2">
                            <SpinnerGap className="w-3.5 h-3.5 animate-spin" />
                            Submitting...
                          </span>
                        ) : (
                          reviewStatus === 'approved' ? 'Approve PIREP' : 'Reject PIREP'
                        )}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
