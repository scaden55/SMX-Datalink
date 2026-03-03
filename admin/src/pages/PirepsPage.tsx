import { useCallback, useEffect, useMemo, useState } from 'react';
import { type ColumnDef, type RowSelectionState } from '@tanstack/react-table';
import {
  ClipboardText,
  Hourglass,
  CheckCircle,
  XCircle,
  MagnifyingGlass,
  DotsThreeVertical,
  Eye,
  CalendarBlank,
  Clock,
  MapPin,
  Users as UsersIcon,
} from '@phosphor-icons/react';
import { api, ApiError } from '@/lib/api';
import { toast } from '@/stores/toastStore';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageShell } from '@/components/shared/PageShell';
import { DataTable } from '@/components/shared/DataTable';
import { DataTablePagination } from '@/components/shared/DataTablePagination';
import { DataTableColumnHeader } from '@/components/shared/DataTableColumnHeader';
import { DetailPanel } from '@/components/shared/DetailPanel';
import { StatusBadge, SectionHeader, DataRow } from '@/components/primitives';

// ── Types ───────────────────────────────────────────────────────

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

function landingRateColor(fpm: number | null): string {
  if (fpm === null) return 'text-[var(--text-quaternary)]';
  const abs = Math.abs(fpm);
  if (abs <= 200) return 'text-[var(--accent-emerald)]';
  if (abs <= 400) return 'text-[var(--accent-amber)]';
  return 'text-[var(--accent-red)]';
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
  if (score === null) return <span className="text-[var(--text-quaternary)]">N/A</span>;
  let color = 'text-[var(--accent-emerald)]';
  if (score < 60) color = 'text-[var(--accent-red)]';
  else if (score < 80) color = 'text-[var(--accent-amber)]';
  return <span className={`font-mono font-bold ${color}`}>{score}</span>;
}

// ── Page ────────────────────────────────────────────────────────

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

  // ── Stats ───────────────────────────────────────────────────

  const stats = useMemo(() => {
    const approved = pireps.filter((p) => p.status === 'approved' || p.status === 'completed').length;
    const rejected = pireps.filter((p) => p.status === 'rejected').length;
    return { approved, rejected };
  }, [pireps]);

  // ── Selection helpers ─────────────────────────────────────────

  // Get selected IDs — only pending PIREPs are valid for bulk actions
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
  }

  function handleCloseDetail() {
    setDetailOpen(false);
    setDetailPirep(null);
    setReviewNotes('');
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

  // ── Column Definitions ────────────────────────────────────────

  const columns: ColumnDef<PirepEntry, unknown>[] = useMemo(
    () => [
      {
        accessorKey: 'flightNumber',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Flight" />,
        cell: ({ row }) => (
          <span className="font-mono font-medium text-[var(--text-primary)]">{row.original.flightNumber}</span>
        ),
        size: 110,
      },
      {
        accessorKey: 'pilotCallsign',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Pilot" />,
        cell: ({ row }) => (
          <span className="font-mono text-[var(--text-tertiary)]">
            {row.original.pilotCallsign || `#${row.original.userId}`}
          </span>
        ),
        size: 90,
      },
      {
        id: 'route',
        header: 'Route',
        cell: ({ row }) => (
          <span className="font-mono text-sm">
            <span className="text-[var(--accent-blue)]">{row.original.depIcao}</span>
            <span className="text-[var(--text-quaternary)] mx-1">&rarr;</span>
            <span className="text-[var(--accent-cyan)]">{row.original.arrIcao}</span>
          </span>
        ),
        enableSorting: false,
        size: 120,
      },
      {
        accessorKey: 'landingRateFpm',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Landing" />,
        cell: ({ row }) => {
          const fpm = row.original.landingRateFpm;
          return (
            <span className={`font-mono ${landingRateColor(fpm)}`}>
              {fpm !== null ? `${fpm} fpm` : 'N/A'}
            </span>
          );
        },
        size: 100,
      },
      {
        accessorKey: 'flightTimeMin',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Time" />,
        cell: ({ row }) => (
          <span className="font-mono text-[var(--text-tertiary)]">
            {formatMinutes(row.original.flightTimeMin)}
          </span>
        ),
        size: 90,
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
        enableSorting: false,
        size: 100,
      },
      {
        accessorKey: 'createdAt',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Date" />,
        cell: ({ row }) => (
          <span className="text-[var(--text-tertiary)] text-sm">
            {formatDate(row.original.createdAt)}
          </span>
        ),
        size: 100,
      },
      {
        id: 'actions',
        enableHiding: false,
        enableSorting: false,
        size: 50,
        cell: ({ row }) => {
          const pirep = row.original;
          const isPending = pirep.status === 'pending';
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={(e) => e.stopPropagation()}
                >
                  <DotsThreeVertical size={16} weight="bold" />
                </Button>
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
                      <CheckCircle size={14} className="text-[var(--accent-emerald)]" />
                      Approve
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-[var(--accent-red)] focus:text-[var(--accent-red)]"
                      onClick={() => handleQuickReview(pirep, 'rejected')}
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
    []
  );

  // ── Render ──────────────────────────────────────────────────

  return (
    <PageShell
      title="PIREPs"
      subtitle="Pilot reports"
      stats={[
        { label: 'Total', value: total, icon: ClipboardText, accent: 'blue' },
        { label: 'Pending', value: pendingCount, icon: Hourglass, accent: 'amber' },
        { label: 'Approved', value: stats.approved, icon: CheckCircle, accent: 'emerald' },
        { label: 'Rejected', value: stats.rejected, icon: XCircle, accent: 'red' },
      ]}
    >
      {/* Status Tabs + Toolbar */}
      <div className="space-y-3 mb-3">
        {/* Status Tabs */}
        <Tabs value={statusTab} onValueChange={setStatusTab}>
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="pending" className="gap-1.5">
              Pending
              {pendingCount > 0 && (
                <span className="inline-flex items-center justify-center rounded-full bg-[var(--accent-amber-bg)] text-[var(--accent-amber)] text-[10px] font-bold min-w-[18px] h-[18px] px-1">
                  {pendingCount}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="approved">Approved</TabsTrigger>
            <TabsTrigger value="rejected">Rejected</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Search + Date Filters */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-1 items-center gap-3">
            <div className="relative max-w-sm flex-1">
              <MagnifyingGlass
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]"
              />
              <Input
                placeholder="Search flight #, callsign, ICAO..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex items-center gap-2">
              <CalendarBlank size={16} className="text-[var(--text-tertiary)] shrink-0" />
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-[140px]"
                placeholder="From"
              />
              <span className="text-[var(--text-tertiary)] text-sm">-</span>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-[140px]"
                placeholder="To"
              />
            </div>
          </div>
        </div>

        {/* Bulk Action Bar */}
        {selectedIds.length > 0 && (
          <div className="flex items-center gap-3 rounded-md border border-[var(--border-primary)] bg-[var(--surface-3)] px-4 py-2.5">
            <span className="text-sm font-medium text-[var(--text-primary)]">
              {selectedIds.length} selected
            </span>
            <div className="ml-auto flex gap-2">
              <Button
                size="sm"
                className="bg-[var(--accent-emerald)] hover:brightness-110 text-white"
                onClick={() => handleBulkReview('approved')}
                disabled={bulkLoading}
              >
                <CheckCircle size={14} weight="bold" />
                Approve Selected
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => handleBulkReview('rejected')}
                disabled={bulkLoading}
              >
                <XCircle size={14} weight="bold" />
                Reject Selected
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setRowSelection({})}
                disabled={bulkLoading}
              >
                Clear
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Split view: table + detail */}
      <div className="flex flex-1 gap-0 overflow-hidden rounded-md border border-[var(--border-primary)]">
        <div className={`${detailOpen ? 'w-[55%]' : 'w-full'} flex flex-col transition-all duration-200`}>
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
        </div>

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
                    <CheckCircle size={14} weight="bold" />
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleDetailReview('rejected')}
                    disabled={reviewSubmitting}
                  >
                    <XCircle size={14} weight="bold" />
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
                      <span className="font-mono font-medium">
                        <span className="text-[var(--accent-blue)]">{detailPirep.depIcao}</span>
                        {' '}
                        <span className="text-[var(--text-quaternary)] mx-1">&rarr;</span>
                        {' '}
                        <span className="text-[var(--accent-cyan)]">{detailPirep.arrIcao}</span>
                      </span>
                    }
                  />
                  {detailPirep.depName && detailPirep.arrName && (
                    <DataRow
                      label="Airports"
                      value={
                        <span className="text-xs text-[var(--text-tertiary)]">
                          {detailPirep.depName} &mdash; {detailPirep.arrName}
                        </span>
                      }
                    />
                  )}
                  <DataRow
                    label="Aircraft"
                    value={
                      <span>
                        <span className="font-mono">{detailPirep.aircraftType}</span>
                        {detailPirep.aircraftRegistration && (
                          <span className="text-[var(--text-tertiary)] ml-1">
                            ({detailPirep.aircraftRegistration})
                          </span>
                        )}
                      </span>
                    }
                  />
                  {detailPirep.route && (
                    <DataRow
                      label="Route String"
                      value={<span className="text-xs font-mono break-all">{detailPirep.route}</span>}
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
                <div className="bg-[var(--surface-3)] rounded-md p-4 mb-3 text-center">
                  <p className="text-xs text-[var(--text-quaternary)] uppercase tracking-wider mb-1">
                    Landing Rate
                  </p>
                  <p
                    className={`text-3xl font-mono font-bold ${landingRateColor(detailPirep.landingRateFpm)}`}
                  >
                    {detailPirep.landingRateFpm !== null
                      ? `${detailPirep.landingRateFpm} fpm`
                      : 'N/A'}
                  </p>
                  <p className={`text-xs mt-1 ${landingRateColor(detailPirep.landingRateFpm)}`}>
                    {landingRateLabel(detailPirep.landingRateFpm)}
                  </p>
                </div>

                <div className="space-y-0.5">
                  <DataRow
                    label="Flight Time"
                    value={
                      <span className="font-mono flex items-center gap-1.5">
                        <Clock size={13} className="text-[var(--text-tertiary)]" />
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
                      <span className="font-mono flex items-center gap-1.5">
                        <MapPin size={13} className="text-[var(--text-tertiary)]" />
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
                            className={`font-mono ${
                              detailPirep.fuelUsedLbs <= detailPirep.fuelPlannedLbs
                                ? 'text-[var(--accent-emerald)]'
                                : 'text-[var(--accent-amber)]'
                            }`}
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
                      <span className="font-mono flex items-center gap-1.5">
                        <UsersIcon size={13} className="text-[var(--text-tertiary)]" />
                        {detailPirep.paxCount}
                      </span>
                    }
                  />
                </div>
              </section>

              {/* ── Score ─────────────────────────────────────── */}
              {detailPirep.score !== null && (
                <section>
                  <SectionHeader title="Score" />
                  <div className="bg-[var(--surface-3)] rounded-md p-4 text-center">
                    <p className="text-4xl font-mono font-bold">
                      {scoreDisplay(detailPirep.score)}
                    </p>
                    <p className="text-xs text-[var(--text-quaternary)] mt-1">/ 100</p>
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
                  <div className="grid grid-cols-4 gap-2 text-center">
                    {[
                      { label: 'OUT', value: detailPirep.oooiOut },
                      { label: 'OFF', value: detailPirep.oooiOff },
                      { label: 'ON', value: detailPirep.oooiOn },
                      { label: 'IN', value: detailPirep.oooiIn },
                    ].map(({ label, value }) => (
                      <div key={label} className="bg-[var(--surface-3)] rounded-md p-2">
                        <p className="text-[10px] uppercase text-[var(--text-quaternary)]">{label}</p>
                        <p className="text-xs font-mono mt-0.5 text-[var(--text-primary)]">
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
                  <p className="text-sm bg-[var(--surface-3)] rounded-md p-3 text-[var(--text-secondary)]">{detailPirep.remarks}</p>
                </section>
              )}

              {/* ── Previous Review ───────────────────────────── */}
              {detailPirep.reviewedAt && (
                <section>
                  <SectionHeader title="Review History" />
                  <div className="bg-[var(--surface-3)] rounded-md p-3 space-y-1">
                    <p className="text-sm text-[var(--text-primary)]">
                      <span className="text-[var(--text-tertiary)]">Reviewed by </span>
                      <span className="font-mono font-medium">
                        {detailPirep.reviewerCallsign || 'Unknown'}
                      </span>
                      <span className="text-[var(--text-tertiary)]"> on </span>
                      {formatDateTime(detailPirep.reviewedAt)}
                    </p>
                    {detailPirep.reviewNotes && (
                      <p className="text-sm text-[var(--text-tertiary)] mt-1">
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
                    <div className="flex gap-2">
                      <Button
                        className="flex-1 bg-[var(--accent-emerald)] hover:brightness-110 text-white"
                        onClick={() => handleDetailReview('approved')}
                        disabled={reviewSubmitting}
                      >
                        <CheckCircle size={16} weight="bold" />
                        Approve
                      </Button>
                      <Button
                        variant="destructive"
                        className="flex-1"
                        onClick={() => handleDetailReview('rejected')}
                        disabled={reviewSubmitting}
                      >
                        <XCircle size={16} weight="bold" />
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
    </PageShell>
  );
}
