import { useCallback, useEffect, useMemo, useState } from 'react';
import { type ColumnDef, type RowSelectionState } from '@tanstack/react-table';
import { motion } from 'motion/react';
import {
  ClipboardCheck,
  Search,
  MoreVertical,
  Eye,
  Calendar,
  Clock,
  MapPin,
  CheckCircle2,
  XCircle,
  Users as UsersIcon,
  ChevronDown,
} from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { toast } from '@/stores/toastStore';
import {
  pageVariants,
  staggerContainer,
  staggerItem,
  fadeUp,
  tableContainer,
  tableRow,
  cardHover,
} from '@/lib/motion';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { DataTable } from '@/components/shared/DataTable';
import { DataTablePagination } from '@/components/shared/DataTablePagination';
import { DataTableColumnHeader } from '@/components/shared/DataTableColumnHeader';
import { DetailPanel } from '@/components/shared/DetailPanel';
import { StatusBadge, SectionHeader, DataRow } from '@/components/primitives';

// ── Types ───────────────────────────────────────────────────────

interface FlightPnl {
  logbook_id: number;
  cargo_revenue: number;
  pax_revenue: number;
  charter_premium: number;
  fuel_surcharge: number;
  total_revenue: number;
  fuel_cost: number;
  fuel_service_fee: number;
  landing_fee: number;
  handling_fee: number;
  nav_fee: number;
  authority_fees: number;
  parking_fee: number;
  crew_cost: number;
  dep_handler: string | null;
  arr_handler: string | null;
  total_variable_cost: number;
  maint_reserve: number;
  lease_alloc: number;
  insurance_alloc: number;
  depreciation_alloc: number;
  total_fixed_alloc: number;
  gross_profit: number;
  net_profit: number;
  margin_pct: number;
  block_hours: number;
  distance_nm: number;
  payload_lbs: number;
  load_factor: number;
  fuel_price_snapshot: number;
  lane_rate_snapshot: number;
  demand_multiplier: number;
}

type PirepStatus = 'pending' | 'approved' | 'completed' | 'diverted' | 'rejected' | 'cancelled';

interface PirepEntry {
  id: number;
  userId: number;
  flightNumber: string;
  depIcao: string;
  arrIcao: string;
  aircraftType: string;
  aircraftRegistration: string | null;
  scheduledDep: string | null;
  scheduledArr: string | null;
  actualDep: string;
  actualArr: string;
  flightTimeMin: number;
  distanceNm: number;
  fuelUsedLbs: number | null;
  fuelPlannedLbs: number | null;
  route: string | null;
  cruiseAltitude: string | null;
  paxCount: number;
  cargoLbs: number;
  landingRateFpm: number | null;
  score: number | null;
  status: PirepStatus;
  remarks: string | null;
  createdAt: string;
  reviewerId: number | null;
  reviewedAt: string | null;
  reviewNotes: string | null;
  reviewerCallsign: string | null;
  reviewerName: string | null;
  vatsimConnected: boolean;
  vatsimCallsign: string | null;
  vatsimCid: number | null;
  oooiOut: string | null;
  oooiOff: string | null;
  oooiOn: string | null;
  oooiIn: string | null;
  blockTimeMin: number | null;
  pilotCallsign?: string;
  pilotName?: string;
  depName?: string;
  arrName?: string;
}

interface PirepListResponse {
  entries: PirepEntry[];
  total: number;
  page: number;
  pageSize: number;
  pendingCount: number;
}

// ── Helpers ─────────────────────────────────────────────────────

function formatMinutes(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}h ${m.toString().padStart(2, '0')}m`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatCurrency(val: number): string {
  return '$' + val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatMarginPct(val: number): string {
  const sign = val >= 0 ? '+' : '';
  return `${sign}${val.toFixed(1)}%`;
}

function marginColor(val: number): string {
  return val >= 0 ? 'var(--accent-emerald)' : 'var(--accent-red)';
}

function landingRateColor(fpm: number | null): string {
  if (fpm === null) return 'var(--text-quaternary)';
  const abs = Math.abs(fpm);
  if (abs <= 150) return 'var(--accent-emerald)';
  if (abs <= 300) return 'var(--accent-amber)';
  return 'var(--accent-red)';
}

function landingRateLabel(fpm: number | null): string {
  if (fpm === null) return 'N/A';
  const abs = Math.abs(fpm);
  if (abs <= 100) return 'Butter';
  if (abs <= 200) return 'Smooth';
  if (abs <= 300) return 'Normal';
  if (abs <= 400) return 'Firm';
  return 'Hard';
}

function scoreDisplay(score: number | null) {
  if (score === null) return <span style={{ color: 'var(--text-quaternary)' }}>N/A</span>;
  let color = 'var(--accent-emerald)';
  if (score < 60) color = 'var(--accent-red)';
  else if (score < 80) color = 'var(--accent-amber)';
  return <span style={{ color, fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums', fontWeight: 700 }}>{score}</span>;
}

// ── Status badge (inline for table) ─────────────────────────────

function InlineStatusBadge({ status }: { status: string }) {
  const config: Record<string, { bg: string; text: string }> = {
    approved: { bg: 'var(--accent-emerald-bg)', text: 'var(--accent-emerald)' },
    completed: { bg: 'var(--accent-blue-bg)', text: 'var(--accent-blue-bright)' },
    pending: { bg: 'var(--accent-amber-bg)', text: 'var(--accent-amber)' },
    rejected: { bg: 'var(--accent-red-bg)', text: 'var(--accent-red)' },
    diverted: { bg: 'var(--accent-blue-bg)', text: 'var(--accent-blue-bright)' },
    cancelled: { bg: 'var(--surface-3)', text: 'var(--text-quaternary)' },
  };
  const c = config[status] ?? { bg: 'var(--accent-blue-bg)', text: 'var(--accent-blue-bright)' };
  const label = status.charAt(0).toUpperCase() + status.slice(1);
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 8px',
        borderRadius: 3,
        fontSize: 10,
        fontWeight: 600,
        backgroundColor: c.bg,
        color: c.text,
        lineHeight: '16px',
      }}
    >
      {label}
    </span>
  );
}

// ── Page ────────────────────────────────────────────────────────

const STATUS_TABS = ['all', 'pending', 'approved', 'rejected'] as const;

export function PirepsPage() {
  const [pireps, setPireps] = useState<PirepEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  // Filters
  const [search, setSearch] = useState('');
  const [searchDebounced, setSearchDebounced] = useState('');
  const [statusTab, setStatusTab] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Selection (TanStack Table row selection state)
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [bulkLoading, setBulkLoading] = useState(false);

  // Detail panel
  const [detailPirep, setDetailPirep] = useState<PirepEntry | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  // Review form state (inside detail panel)
  const [reviewNotes, setReviewNotes] = useState('');
  const [reviewSubmitting, setReviewSubmitting] = useState(false);

  // Flight P&L data (keyed by pirepId for table columns)
  const [pnlMap, setPnlMap] = useState<Map<number, FlightPnl>>(new Map());
  const [detailPnl, setDetailPnl] = useState<FlightPnl | null>(null);
  const [detailPnlLoading, setDetailPnlLoading] = useState(false);

  // ── Debounce search ──────────────────────────────────────────

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchDebounced(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Reset page on filter change
  useEffect(() => {
    setPage(1);
  }, [statusTab, dateFrom, dateTo]);

  // ── Fetch ────────────────────────────────────────────────────

  const fetchPireps = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      params.set('page', page.toString());
      params.set('pageSize', pageSize.toString());
      if (statusTab !== 'all') params.set('status', statusTab);
      if (searchDebounced) params.set('search', searchDebounced);
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo) params.set('dateTo', dateTo);

      const res = await api.get<PirepListResponse>(`/api/admin/pireps?${params.toString()}`);
      setPireps(res.entries);
      setTotal(res.total);
      setPendingCount(res.pendingCount);
      setRowSelection({});
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to load PIREPs';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, statusTab, searchDebounced, dateFrom, dateTo]);

  useEffect(() => {
    fetchPireps();
  }, [fetchPireps]);

  // ── Fetch P&L for visible PIREPs (table columns) ──────────

  useEffect(() => {
    if (pireps.length === 0) {
      setPnlMap(new Map());
      return;
    }
    let cancelled = false;
    const ids = pireps.map((p) => p.id);
    Promise.allSettled(
      ids.map((id) =>
        api.get<FlightPnl>(`/api/admin/economics/flight-pnl/${id}`)
          .then((pnl) => ({ id, pnl }))
      )
    ).then((results) => {
      if (cancelled) return;
      const map = new Map<number, FlightPnl>();
      for (const r of results) {
        if (r.status === 'fulfilled') {
          map.set(r.value.id, r.value.pnl);
        }
      }
      setPnlMap(map);
    });
    return () => { cancelled = true; };
  }, [pireps]);

  // ── Stats ───────────────────────────────────────────────────

  const stats = useMemo(() => {
    const approved = pireps.filter((p) => p.status === 'approved' || p.status === 'completed').length;
    const rejected = pireps.filter((p) => p.status === 'rejected').length;
    return { approved, rejected };
  }, [pireps]);

  // ── Selection helpers ─────────────────────────────────────────

  const selectedIds = useMemo(() => {
    return Object.keys(rowSelection)
      .filter((id) => rowSelection[id])
      .map(Number)
      .filter((id) => pireps.find((p) => p.id === id)?.status === 'pending');
  }, [rowSelection, pireps]);

  // ── Bulk Actions ────────────────────────────────────────────

  async function handleBulkReview(status: 'approved' | 'rejected') {
    if (selectedIds.length === 0) return;
    setBulkLoading(true);
    try {
      const res = await api.post<{ ok: boolean; count: number }>('/api/admin/pireps/bulk-review', {
        ids: selectedIds,
        status,
      });
      toast.success(`${res.count} PIREP${res.count !== 1 ? 's' : ''} ${status}`);
      setRowSelection({});
      fetchPireps();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : `Failed to ${status} PIREPs`);
    } finally {
      setBulkLoading(false);
    }
  }

  // ── Row Click ───────────────────────────────────────────────

  function handleRowClick(pirep: PirepEntry) {
    setDetailPirep(pirep);
    setDetailOpen(true);
    setReviewNotes('');
    // Fetch P&L for detail panel
    setDetailPnl(null);
    setDetailPnlLoading(true);
    api.get<FlightPnl>(`/api/admin/economics/flight-pnl/${pirep.id}`)
      .then((pnl) => setDetailPnl(pnl))
      .catch(() => setDetailPnl(null))
      .finally(() => setDetailPnlLoading(false));
  }

  function handleCloseDetail() {
    setDetailOpen(false);
    setDetailPirep(null);
    setReviewNotes('');
    setDetailPnl(null);
  }

  // ── Single Actions ──────────────────────────────────────────

  async function handleQuickReview(pirep: PirepEntry, status: 'approved' | 'rejected') {
    try {
      await api.post(`/api/admin/pireps/${pirep.id}/review`, { status });
      toast.success(`${pirep.flightNumber} ${status}`);
      fetchPireps();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : `Failed to ${status} PIREP`);
    }
  }

  // ── Detail Panel Review ──────────────────────────────────────

  async function handleDetailReview(status: 'approved' | 'rejected') {
    if (!detailPirep) return;
    setReviewSubmitting(true);
    try {
      await api.post(`/api/admin/pireps/${detailPirep.id}/review`, {
        status,
        notes: reviewNotes.trim() || undefined,
      });
      toast.success(`PIREP ${detailPirep.flightNumber} ${status}`);
      setReviewNotes('');
      handleCloseDetail();
      fetchPireps();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : `Failed to ${status} PIREP`);
    } finally {
      setReviewSubmitting(false);
    }
  }

  // ── Date display for filter ──────────────────────────────────

  const dateDisplay = useMemo(() => {
    if (dateFrom && dateTo) return `${dateFrom} - ${dateTo}`;
    if (dateFrom) return `From ${dateFrom}`;
    if (dateTo) return `Until ${dateTo}`;
    return 'All Dates';
  }, [dateFrom, dateTo]);

  // ── Column Definitions ────────────────────────────────────────

  const columns: ColumnDef<PirepEntry, unknown>[] = useMemo(
    () => [
      {
        accessorKey: 'flightNumber',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Flight" />,
        cell: ({ row }) => (
          <span
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: 'var(--text-primary)',
              fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums',
            }}
          >
            {row.original.flightNumber}
          </span>
        ),
        size: 70,
      },
      {
        accessorKey: 'pilotCallsign',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Pilot" />,
        cell: ({ row }) => (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <span style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 500, fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums' }}>
              {row.original.pilotCallsign || `Pilot #${row.original.userId}`}
            </span>
            {row.original.pilotName && (
              <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
                {row.original.pilotName}
              </span>
            )}
          </div>
        ),
        size: 120,
      },
      {
        id: 'route',
        header: 'Route',
        cell: ({ row }) => (
          <span style={{ fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums', fontSize: 12 }}>
            <span style={{ color: 'var(--accent-blue-bright)' }}>{row.original.depIcao}</span>
            <span style={{ color: 'var(--text-quaternary)', margin: '0 4px' }}>&rarr;</span>
            <span style={{ color: 'var(--accent-blue-bright)' }}>{row.original.arrIcao}</span>
          </span>
        ),
        enableSorting: false,
        size: 110,
      },
      {
        accessorKey: 'landingRateFpm',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Landing" />,
        cell: ({ row }) => {
          const fpm = row.original.landingRateFpm;
          return (
            <span
              style={{
                fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums',
                fontSize: 12,
                fontWeight: 600,
                color: landingRateColor(fpm),
              }}
            >
              {fpm !== null ? `${Math.abs(fpm)} fpm` : 'N/A'}
            </span>
          );
        },
        size: 90,
      },
      {
        accessorKey: 'flightTimeMin',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Time" />,
        cell: ({ row }) => (
          <span style={{ fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums', fontSize: 12, color: 'var(--text-secondary)' }}>
            {formatMinutes(row.original.flightTimeMin)}
          </span>
        ),
        size: 80,
      },
      {
        accessorKey: 'score',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Score" />,
        cell: ({ row }) => scoreDisplay(row.original.score),
        size: 60,
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => <InlineStatusBadge status={row.original.status} />,
        enableSorting: false,
        size: 90,
      },
      {
        id: 'revenue',
        header: 'Revenue',
        cell: ({ row }) => {
          const pnl = pnlMap.get(row.original.id);
          if (!pnl) return <span style={{ fontSize: 11, color: 'var(--text-quaternary)' }}>--</span>;
          return (
            <span style={{ fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums', fontSize: 12, fontWeight: 600, color: 'var(--accent-emerald)' }}>
              ${pnl.total_revenue.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </span>
          );
        },
        enableSorting: false,
        size: 90,
      },
      {
        id: 'cost',
        header: 'Cost',
        cell: ({ row }) => {
          const pnl = pnlMap.get(row.original.id);
          const totalDoc = pnl ? pnl.total_variable_cost + pnl.total_fixed_alloc : null;
          if (!pnl || totalDoc === null) return <span style={{ fontSize: 11, color: 'var(--text-quaternary)' }}>--</span>;
          return (
            <span style={{ fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums', fontSize: 12, color: 'var(--text-secondary)' }}>
              ${totalDoc.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </span>
          );
        },
        enableSorting: false,
        size: 90,
      },
      {
        id: 'margin',
        header: 'Margin',
        cell: ({ row }) => {
          const pnl = pnlMap.get(row.original.id);
          if (!pnl) return <span style={{ fontSize: 11, color: 'var(--text-quaternary)' }}>--</span>;
          return (
            <span style={{ fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums', fontSize: 12, fontWeight: 600, color: marginColor(pnl.margin_pct) }}>
              {formatMarginPct(pnl.margin_pct)}
            </span>
          );
        },
        enableSorting: false,
        size: 80,
      },
      {
        id: 'actions',
        enableHiding: false,
        enableSorting: false,
        size: 40,
        cell: ({ row }) => {
          const pirep = row.original;
          const isPending = pirep.status === 'pending';
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 28,
                    height: 28,
                    borderRadius: 4,
                    border: 'none',
                    background: 'transparent',
                    color: 'var(--text-tertiary)',
                    cursor: 'pointer',
                  }}
                >
                  <MoreVertical size={14} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleRowClick(pirep)}>
                  <Eye size={14} />
                  View Details
                </DropdownMenuItem>
                {isPending && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => handleQuickReview(pirep, 'approved')}>
                      <CheckCircle2 size={14} style={{ color: 'var(--accent-emerald)' }} />
                      Approve
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => handleQuickReview(pirep, 'rejected')}
                      style={{ color: 'var(--accent-red)' }}
                    >
                      <XCircle size={14} />
                      Reject
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          );
        },
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pnlMap]
  );

  // ── Render ──────────────────────────────────────────────────

  return (
    <motion.div
      style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}
      variants={pageVariants}
      initial="hidden"
      animate="visible"
    >
      {/* ═══ Page Header ═══ */}
      <div style={{ padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Title Row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <ClipboardCheck size={20} style={{ color: 'var(--accent-blue-bright)', flexShrink: 0 }} />
          <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>PIREPs</span>
          {pendingCount > 0 && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '2px 8px',
                borderRadius: 3,
                fontSize: 10,
                fontWeight: 600,
                backgroundColor: 'var(--accent-blue-bg)',
                color: 'var(--accent-blue-bright)',
                lineHeight: '16px',
              }}
            >
              {pendingCount} pending
            </span>
          )}
          <div style={{ flex: 1 }} />
          <button
            type="button"
            className="btn-glow"
            onClick={() => handleBulkReview('approved')}
            disabled={selectedIds.length === 0 || bulkLoading}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 16px',
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 600,
              border: 'none',
              cursor: selectedIds.length === 0 ? 'not-allowed' : 'pointer',
              backgroundColor: selectedIds.length > 0 ? 'var(--accent-emerald)' : 'var(--surface-3)',
              color: selectedIds.length > 0 ? '#fff' : 'var(--text-quaternary)',
              opacity: selectedIds.length === 0 ? 0.5 : 1,
              transition: 'opacity 150ms',
            }}
          >
            <CheckCircle2 size={13} />
            Approve Selected
          </button>
          <button
            type="button"
            className="btn-glow"
            onClick={() => handleBulkReview('rejected')}
            disabled={selectedIds.length === 0 || bulkLoading}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 16px',
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 600,
              border: '1px solid var(--accent-red-bg)',
              cursor: selectedIds.length === 0 ? 'not-allowed' : 'pointer',
              backgroundColor: selectedIds.length > 0 ? 'var(--accent-red-bg)' : 'transparent',
              color: selectedIds.length > 0 ? 'var(--accent-red)' : 'var(--text-quaternary)',
              opacity: selectedIds.length === 0 ? 0.5 : 1,
              transition: 'opacity 150ms',
            }}
          >
            <XCircle size={13} />
            Reject Selected
          </button>
        </div>

        {/* Status Tabs */}
        <motion.div
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          style={{
            display: 'flex',
            gap: 0,
            borderBottom: '1px solid var(--border-primary)',
          }}
        >
          {STATUS_TABS.map((tab) => {
            const isActive = statusTab === tab;
            const label = tab === 'all' ? 'All' : tab.charAt(0).toUpperCase() + tab.slice(1);
            const showCount = tab === 'pending' && pendingCount > 0;
            return (
              <button
                key={tab}
                type="button"
                onClick={() => setStatusTab(tab)}
                style={{
                  position: 'relative',
                  padding: '8px 16px',
                  fontSize: 12,
                  fontWeight: 500,
                  background: 'none',
                  border: 'none',
                  borderBottom: isActive ? '2px solid var(--accent-blue-bright)' : '2px solid transparent',
                  color: isActive ? 'var(--accent-blue-bright)' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  transition: 'color 150ms, border-color 150ms',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                {label}
                {showCount && (
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '1px 6px',
                      borderRadius: 3,
                      fontSize: 9,
                      fontWeight: 600,
                      backgroundColor: 'var(--accent-amber-bg)',
                      color: 'var(--accent-amber)',
                      lineHeight: '14px',
                    }}
                  >
                    {pendingCount}
                  </span>
                )}
              </button>
            );
          })}
        </motion.div>

        {/* Stats Row */}
        <motion.div
          style={{ display: 'flex', gap: 12 }}
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
        >
          {[
            { label: 'Total PIREPs', value: total, color: 'var(--text-primary)' },
            { label: 'Pending', value: pendingCount, color: 'var(--accent-amber)' },
            { label: 'Approved', value: stats.approved, color: 'var(--text-primary)' },
            { label: 'Rejected', value: stats.rejected, color: 'var(--accent-red)' },
          ].map((stat) => (
            <motion.div
              key={stat.label}
              variants={staggerItem}
              style={{
                flex: 1,
                borderRadius: 6,
                backgroundColor: 'var(--surface-2)',
                border: '1px solid var(--border-primary)',
                padding: '12px 16px',
              }}
            >
              <div style={{ fontSize: 10, fontWeight: 500, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
                {stat.label}
              </div>
              <div style={{ fontSize: 22, fontWeight: 700, color: stat.color, fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums' }}>
                {stat.value}
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>

      {/* ═══ Filter Bar ═══ */}
      <div
        style={{
          padding: '12px 24px',
          borderBottom: '1px solid var(--border-primary)',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}
      >
        {/* Search Input */}
        <div style={{ position: 'relative', width: 220 }}>
          <Search
            size={14}
            style={{
              position: 'absolute',
              left: 10,
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-tertiary)',
              pointerEvents: 'none',
            }}
          />
          <input
            type="text"
            className="input-glow"
            placeholder="Search flight #, pilots..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: '100%',
              height: 32,
              paddingLeft: 32,
              paddingRight: 10,
              fontSize: 12,
              borderRadius: 6,
              border: '1px solid var(--input-border)',
              backgroundColor: 'var(--input-bg)',
              color: 'var(--text-primary)',
              outline: 'none',
            }}
          />
        </div>

        {/* Date Filter */}
        <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  height: 32,
                  padding: '0 12px',
                  fontSize: 12,
                  borderRadius: 6,
                  border: '1px solid var(--input-border)',
                  backgroundColor: 'var(--input-bg)',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                }}
              >
                <Calendar size={13} style={{ color: 'var(--text-tertiary)' }} />
                {dateDisplay}
                <ChevronDown size={12} style={{ color: 'var(--text-tertiary)' }} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" style={{ padding: 12, minWidth: 240 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <label style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 500 }}>
                  From
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    style={{
                      display: 'block',
                      width: '100%',
                      height: 30,
                      marginTop: 4,
                      padding: '0 8px',
                      fontSize: 12,
                      borderRadius: 4,
                      border: '1px solid var(--input-border)',
                      backgroundColor: 'var(--input-bg)',
                      color: 'var(--text-primary)',
                      outline: 'none',
                    }}
                  />
                </label>
                <label style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 500 }}>
                  To
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    style={{
                      display: 'block',
                      width: '100%',
                      height: 30,
                      marginTop: 4,
                      padding: '0 8px',
                      fontSize: 12,
                      borderRadius: 4,
                      border: '1px solid var(--input-border)',
                      backgroundColor: 'var(--input-bg)',
                      color: 'var(--text-primary)',
                      outline: 'none',
                    }}
                  />
                </label>
                {(dateFrom || dateTo) && (
                  <button
                    type="button"
                    onClick={() => { setDateFrom(''); setDateTo(''); }}
                    style={{
                      fontSize: 11,
                      color: 'var(--accent-blue-bright)',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: '4px 0',
                      textAlign: 'left',
                    }}
                  >
                    Clear dates
                  </button>
                )}
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Status Dropdown (secondary filter) */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                height: 32,
                padding: '0 12px',
                fontSize: 12,
                borderRadius: 6,
                border: '1px solid var(--input-border)',
                backgroundColor: 'var(--input-bg)',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
              }}
            >
              Status: {statusTab === 'all' ? 'All' : statusTab.charAt(0).toUpperCase() + statusTab.slice(1)}
              <ChevronDown size={12} style={{ color: 'var(--text-tertiary)' }} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {STATUS_TABS.map((tab) => (
              <DropdownMenuItem
                key={tab}
                onClick={() => setStatusTab(tab)}
                style={{
                  fontWeight: statusTab === tab ? 600 : 400,
                  color: statusTab === tab ? 'var(--accent-blue-bright)' : undefined,
                }}
              >
                {tab === 'all' ? 'All' : tab.charAt(0).toUpperCase() + tab.slice(1)}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* ═══ Table + Detail Split ═══ */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <motion.div
          variants={tableContainer}
          initial="hidden"
          animate="visible"
          style={{
            width: detailOpen ? '55%' : '100%',
            display: 'flex',
            flexDirection: 'column',
            transition: 'width 200ms ease-out',
            overflow: 'hidden',
          }}
        >
          <DataTable
            columns={columns}
            data={pireps}
            onRowClick={handleRowClick}
            selectedRowId={detailPirep?.id}
            enableRowSelection
            rowSelection={rowSelection}
            onRowSelectionChange={setRowSelection}
            loading={loading}
            emptyMessage="No PIREPs found"
            getRowId={(row) => String(row.id)}
          />
          <DataTablePagination
            page={page}
            pageSize={pageSize}
            total={total}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        </motion.div>

        {detailOpen && detailPirep && (
          <DetailPanel
            open={detailOpen}
            onClose={handleCloseDetail}
            title={detailPirep.flightNumber}
            subtitle={`${detailPirep.pilotCallsign ?? ''} -- ${detailPirep.depIcao} \u2192 ${detailPirep.arrIcao}`}
            actions={
              detailPirep.status === 'pending' ? (
                <>
                  <Button
                    size="sm"
                    className="bg-[var(--accent-emerald)] hover:brightness-110 text-white"
                    onClick={() => handleDetailReview('approved')}
                    disabled={reviewSubmitting}
                  >
                    <CheckCircle2 size={14} />
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleDetailReview('rejected')}
                    disabled={reviewSubmitting}
                  >
                    <XCircle size={14} />
                    Reject
                  </Button>
                </>
              ) : undefined
            }
          >
            {/* ── Detail Content ────────────────────────────── */}
            <div className="space-y-5">
              {/* Status Badge */}
              <div><StatusBadge status={detailPirep.status} /></div>

              {/* ── Flight Info ─────────────────────────────── */}
              <section>
                <SectionHeader title="Flight Info" />
                <div className="space-y-0.5">
                  <DataRow
                    label="Route"
                    value={
                      <span style={{ fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums', fontWeight: 500 }}>
                        <span style={{ color: 'var(--accent-blue-bright)' }}>{detailPirep.depIcao}</span>
                        {' '}
                        <span style={{ color: 'var(--text-quaternary)', margin: '0 4px' }}>&rarr;</span>
                        {' '}
                        <span style={{ color: 'var(--accent-blue-bright)' }}>{detailPirep.arrIcao}</span>
                      </span>
                    }
                  />
                  {detailPirep.depName && detailPirep.arrName && (
                    <DataRow
                      label="Airports"
                      value={
                        <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                          {detailPirep.depName} &mdash; {detailPirep.arrName}
                        </span>
                      }
                    />
                  )}
                  <DataRow
                    label="Aircraft"
                    value={
                      <span>
                        <span style={{ fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums' }}>{detailPirep.aircraftType}</span>
                        {detailPirep.aircraftRegistration && (
                          <span style={{ color: 'var(--text-tertiary)', marginLeft: 4 }}>
                            ({detailPirep.aircraftRegistration})
                          </span>
                        )}
                      </span>
                    }
                  />
                  {detailPirep.route && (
                    <DataRow
                      label="Route String"
                      value={<span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums', wordBreak: 'break-all' }}>{detailPirep.route}</span>}
                    />
                  )}
                  {detailPirep.cruiseAltitude && (
                    <DataRow label="Cruise Alt" value={detailPirep.cruiseAltitude} mono />
                  )}
                  <DataRow label="Filed" value={formatDateTime(detailPirep.createdAt)} />
                </div>
              </section>

              {/* ── Performance ──────────────────────────────── */}
              <section>
                <SectionHeader title="Performance" />

                {/* Landing Rate - large display */}
                <div
                  style={{
                    backgroundColor: 'var(--surface-3)',
                    borderRadius: 6,
                    padding: 16,
                    marginBottom: 12,
                    textAlign: 'center',
                  }}
                >
                  <p style={{ fontSize: 10, color: 'var(--text-quaternary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
                    Landing Rate
                  </p>
                  <p
                    style={{
                      fontSize: 28,
                      fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums',
                      fontWeight: 700,
                      color: landingRateColor(detailPirep.landingRateFpm),
                    }}
                  >
                    {detailPirep.landingRateFpm !== null
                      ? `${detailPirep.landingRateFpm} fpm`
                      : 'N/A'}
                  </p>
                  <p style={{ fontSize: 11, marginTop: 2, color: landingRateColor(detailPirep.landingRateFpm) }}>
                    {landingRateLabel(detailPirep.landingRateFpm)}
                  </p>
                </div>

                <div className="space-y-0.5">
                  <DataRow
                    label="Flight Time"
                    value={
                      <span style={{ fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Clock size={13} style={{ color: 'var(--text-tertiary)' }} />
                        {formatMinutes(detailPirep.flightTimeMin)}
                      </span>
                    }
                  />
                  {detailPirep.blockTimeMin !== null && (
                    <DataRow label="Block Time" value={formatMinutes(detailPirep.blockTimeMin)} mono />
                  )}
                  <DataRow
                    label="Distance"
                    value={
                      <span style={{ fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <MapPin size={13} style={{ color: 'var(--text-tertiary)' }} />
                        {detailPirep.distanceNm.toLocaleString()} nm
                      </span>
                    }
                  />
                </div>
              </section>

              {/* ── Fuel ─────────────────────────────────────── */}
              <section>
                <SectionHeader title="Fuel" />
                <div className="space-y-0.5">
                  <DataRow
                    label="Fuel Used"
                    value={detailPirep.fuelUsedLbs !== null
                      ? `${detailPirep.fuelUsedLbs.toLocaleString()} lbs`
                      : 'N/A'}
                    mono
                  />
                  <DataRow
                    label="Fuel Planned"
                    value={detailPirep.fuelPlannedLbs !== null
                      ? `${detailPirep.fuelPlannedLbs.toLocaleString()} lbs`
                      : 'N/A'}
                    mono
                  />
                  {detailPirep.fuelUsedLbs !== null &&
                    detailPirep.fuelPlannedLbs !== null &&
                    detailPirep.fuelPlannedLbs > 0 && (
                      <DataRow
                        label="Fuel Variance"
                        value={
                          <span
                            style={{
                              fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums',
                              color: detailPirep.fuelUsedLbs <= detailPirep.fuelPlannedLbs
                                ? 'var(--accent-emerald)'
                                : 'var(--accent-amber)',
                            }}
                          >
                            {detailPirep.fuelUsedLbs <= detailPirep.fuelPlannedLbs ? '-' : '+'}
                            {Math.abs(
                              detailPirep.fuelUsedLbs - detailPirep.fuelPlannedLbs
                            ).toLocaleString()}{' '}
                            lbs
                          </span>
                        }
                      />
                    )}
                </div>
              </section>

              {/* ── Load (Cargo first!) ─────────────────────── */}
              <section>
                <SectionHeader title="Load" />
                <div className="space-y-0.5">
                  <DataRow
                    label="Cargo"
                    value={`${detailPirep.cargoLbs.toLocaleString()} lbs`}
                    mono
                  />
                  <DataRow
                    label="Passengers"
                    value={
                      <span style={{ fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <UsersIcon size={13} style={{ color: 'var(--text-tertiary)' }} />
                        {detailPirep.paxCount}
                      </span>
                    }
                  />
                </div>
              </section>

              {/* ── Flight Economics ──────────────────────────── */}
              <section>
                <SectionHeader title="Flight Economics" />
                {detailPnlLoading ? (
                  <p style={{ fontSize: 12, color: 'var(--text-quaternary)', padding: '8px 0' }}>Loading financial data...</p>
                ) : !detailPnl ? (
                  <p style={{ fontSize: 12, color: 'var(--text-quaternary)', padding: '8px 0' }}>No financial data</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {/* Revenue & Cost two-column layout */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      {/* Revenue side */}
                      <div style={{ backgroundColor: 'var(--surface-3)', borderRadius: 6, padding: 12 }}>
                        <p style={{ fontSize: 10, color: 'var(--text-quaternary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8, fontWeight: 600 }}>Revenue</p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                            <span style={{ color: 'var(--text-tertiary)' }}>Cargo Revenue</span>
                            <span style={{ fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums', color: 'var(--text-secondary)' }}>{formatCurrency(detailPnl.cargo_revenue)}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                            <span style={{ color: 'var(--text-tertiary)' }}>Fuel Surcharge</span>
                            <span style={{ fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums', color: 'var(--text-secondary)' }}>{formatCurrency(detailPnl.fuel_surcharge)}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                            <span style={{ color: 'var(--text-tertiary)' }}>Demand Multiplier</span>
                            <span style={{ fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums', color: 'var(--text-secondary)' }}>{detailPnl.demand_multiplier.toFixed(2)}x</span>
                          </div>
                          <div style={{ borderTop: '1px solid var(--border-primary)', marginTop: 4, paddingTop: 4, display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                            <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>Total Revenue</span>
                            <span style={{ fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums', color: 'var(--accent-emerald)', fontWeight: 700 }}>{formatCurrency(detailPnl.total_revenue)}</span>
                          </div>
                        </div>
                      </div>

                      {/* Cost side */}
                      <div style={{ backgroundColor: 'var(--surface-3)', borderRadius: 6, padding: 12 }}>
                        <p style={{ fontSize: 10, color: 'var(--text-quaternary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8, fontWeight: 600 }}>Costs</p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                            <span style={{ color: 'var(--text-tertiary)' }}>Fuel</span>
                            <span style={{ fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums', color: 'var(--text-secondary)' }}>{formatCurrency(detailPnl.fuel_cost)}</span>
                          </div>
                          {detailPnl.fuel_service_fee > 0 && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                              <span style={{ color: 'var(--text-tertiary)' }}>Fuel Service</span>
                              <span style={{ fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums', color: 'var(--text-secondary)' }}>{formatCurrency(detailPnl.fuel_service_fee)}</span>
                            </div>
                          )}
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                            <span style={{ color: 'var(--text-tertiary)' }}>Crew</span>
                            <span style={{ fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums', color: 'var(--text-secondary)' }}>{formatCurrency(detailPnl.crew_cost)}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                            <span style={{ color: 'var(--text-tertiary)' }}>Landing Fees</span>
                            <span style={{ fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums', color: 'var(--text-secondary)' }}>{formatCurrency(detailPnl.landing_fee)}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, alignItems: 'flex-start' }}>
                            <span style={{ color: 'var(--text-tertiary)' }}>Handling (Dep)</span>
                            <div style={{ textAlign: 'right' }}>
                              <span style={{ fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums', color: 'var(--text-secondary)' }}>{formatCurrency(detailPnl.handling_fee / 2)}</span>
                              {detailPnl.dep_handler && (
                                <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>({detailPnl.dep_handler})</div>
                              )}
                            </div>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, alignItems: 'flex-start' }}>
                            <span style={{ color: 'var(--text-tertiary)' }}>Handling (Arr)</span>
                            <div style={{ textAlign: 'right' }}>
                              <span style={{ fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums', color: 'var(--text-secondary)' }}>{formatCurrency(detailPnl.handling_fee / 2)}</span>
                              {detailPnl.arr_handler && (
                                <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>({detailPnl.arr_handler})</div>
                              )}
                            </div>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                            <span style={{ color: 'var(--text-tertiary)' }}>Nav Fees</span>
                            <span style={{ fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums', color: 'var(--text-secondary)' }}>{formatCurrency(detailPnl.nav_fee)}</span>
                          </div>
                          {detailPnl.authority_fees > 0 && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                              <span style={{ color: 'var(--text-tertiary)' }}>Authority Fees</span>
                              <span style={{ fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums', color: 'var(--text-secondary)' }}>{formatCurrency(detailPnl.authority_fees)}</span>
                            </div>
                          )}
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                            <span style={{ color: 'var(--text-tertiary)' }}>Maint Reserve</span>
                            <span style={{ fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums', color: 'var(--text-secondary)' }}>{formatCurrency(detailPnl.maint_reserve)}</span>
                          </div>
                          <div style={{ borderTop: '1px solid var(--border-primary)', marginTop: 4, paddingTop: 4, display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                            <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>Total DOC</span>
                            <span style={{ fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums', color: 'var(--text-secondary)', fontWeight: 700 }}>{formatCurrency(detailPnl.total_variable_cost + detailPnl.total_fixed_alloc)}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Bottom line */}
                    <div style={{ backgroundColor: 'var(--surface-3)', borderRadius: 6, padding: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <span style={{ fontSize: 10, color: 'var(--text-quaternary)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Operating Margin</span>
                        <span style={{ fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums', fontSize: 18, fontWeight: 700, color: marginColor(detailPnl.net_profit) }}>
                          {formatCurrency(detailPnl.net_profit)}
                        </span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                        <span style={{ fontSize: 10, color: 'var(--text-quaternary)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Margin</span>
                        <span style={{ fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums', fontSize: 18, fontWeight: 700, color: marginColor(detailPnl.margin_pct) }}>
                          {formatMarginPct(detailPnl.margin_pct)}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </section>

              {/* ── Score ─────────────────────────────────────── */}
              {detailPirep.score !== null && (
                <section>
                  <SectionHeader title="Score" />
                  <div
                    style={{
                      backgroundColor: 'var(--surface-3)',
                      borderRadius: 6,
                      padding: 16,
                      textAlign: 'center',
                    }}
                  >
                    <p style={{ fontSize: 32, fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums', fontWeight: 700 }}>
                      {scoreDisplay(detailPirep.score)}
                    </p>
                    <p style={{ fontSize: 11, color: 'var(--text-quaternary)', marginTop: 4 }}>/ 100</p>
                  </div>
                </section>
              )}

              {/* ── VATSIM ────────────────────────────────────── */}
              {detailPirep.vatsimConnected && (
                <section>
                  <SectionHeader title="VATSIM" />
                  <div className="space-y-0.5">
                    {detailPirep.vatsimCallsign && (
                      <DataRow label="Callsign" value={detailPirep.vatsimCallsign} mono />
                    )}
                    {detailPirep.vatsimCid && (
                      <DataRow label="CID" value={detailPirep.vatsimCid} mono />
                    )}
                  </div>
                </section>
              )}

              {/* ── OOOI Timestamps ───────────────────────────── */}
              {(detailPirep.oooiOut ||
                detailPirep.oooiOff ||
                detailPirep.oooiOn ||
                detailPirep.oooiIn) && (
                <section>
                  <SectionHeader title="OOOI Timestamps" />
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, textAlign: 'center' }}>
                    {[
                      { label: 'OUT', value: detailPirep.oooiOut },
                      { label: 'OFF', value: detailPirep.oooiOff },
                      { label: 'ON', value: detailPirep.oooiOn },
                      { label: 'IN', value: detailPirep.oooiIn },
                    ].map(({ label, value }) => (
                      <div key={label} style={{ backgroundColor: 'var(--surface-3)', borderRadius: 6, padding: 8 }}>
                        <p style={{ fontSize: 10, textTransform: 'uppercase', color: 'var(--text-quaternary)' }}>{label}</p>
                        <p style={{ fontSize: 12, fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums', marginTop: 2, color: 'var(--text-primary)' }}>
                          {value
                            ? new Date(value).toLocaleTimeString('en-US', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : '--:--'}
                        </p>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* ── Remarks ───────────────────────────────────── */}
              {detailPirep.remarks && (
                <section>
                  <SectionHeader title="Pilot Remarks" />
                  <p style={{ fontSize: 13, backgroundColor: 'var(--surface-3)', borderRadius: 6, padding: 12, color: 'var(--text-secondary)' }}>{detailPirep.remarks}</p>
                </section>
              )}

              {/* ── Previous Review ───────────────────────────── */}
              {detailPirep.reviewedAt && (
                <section>
                  <SectionHeader title="Review History" />
                  <div style={{ backgroundColor: 'var(--surface-3)', borderRadius: 6, padding: 12 }}>
                    <p style={{ fontSize: 13, color: 'var(--text-primary)' }}>
                      <span style={{ color: 'var(--text-tertiary)' }}>Reviewed by </span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums', fontWeight: 500 }}>
                        {detailPirep.reviewerCallsign || 'Unknown'}
                      </span>
                      <span style={{ color: 'var(--text-tertiary)' }}> on </span>
                      {formatDateTime(detailPirep.reviewedAt)}
                    </p>
                    {detailPirep.reviewNotes && (
                      <p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginTop: 4 }}>
                        {detailPirep.reviewNotes}
                      </p>
                    )}
                  </div>
                </section>
              )}

              {/* ── Review Form ───────────────────────────────── */}
              {detailPirep.status === 'pending' && (
                <section>
                  <SectionHeader title="Review" />
                  <div className="space-y-3">
                    <Textarea
                      placeholder="Admin notes (optional)..."
                      value={reviewNotes}
                      onChange={(e) => setReviewNotes(e.target.value)}
                      rows={3}
                      disabled={reviewSubmitting}
                    />
                    <div style={{ display: 'flex', gap: 8 }}>
                      <Button
                        className="flex-1 bg-[var(--accent-emerald)] hover:brightness-110 text-white"
                        onClick={() => handleDetailReview('approved')}
                        disabled={reviewSubmitting}
                      >
                        <CheckCircle2 size={16} />
                        Approve
                      </Button>
                      <Button
                        variant="destructive"
                        className="flex-1"
                        onClick={() => handleDetailReview('rejected')}
                        disabled={reviewSubmitting}
                      >
                        <XCircle size={16} />
                        Reject
                      </Button>
                    </div>
                  </div>
                </section>
              )}
            </div>
          </DetailPanel>
        )}
      </div>
    </motion.div>
  );
}
