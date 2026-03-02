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
  AirplaneTilt,
  MapPin,
  Clock,
  GasPump,
  Package,
  Users as UsersIcon,
  ArrowDown,
  Star,
  Globe,
} from '@phosphor-icons/react';
import { api, ApiError } from '@/lib/api';
import { toast } from '@/stores/toastStore';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
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
  if (fpm === null) return 'text-muted-foreground';
  const abs = Math.abs(fpm);
  if (abs <= 200) return 'text-emerald-400';
  if (abs <= 400) return 'text-amber-400';
  return 'text-red-400';
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

function statusBadge(status: PirepStatus) {
  switch (status) {
    case 'pending':
      return (
        <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/30 hover:bg-amber-500/20">
          Pending
        </Badge>
      );
    case 'approved':
    case 'completed':
      return (
        <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20">
          {status === 'approved' ? 'Approved' : 'Completed'}
        </Badge>
      );
    case 'rejected':
      return (
        <Badge className="bg-red-500/15 text-red-400 border-red-500/30 hover:bg-red-500/20">
          Rejected
        </Badge>
      );
    case 'diverted':
      return (
        <Badge className="bg-blue-500/15 text-blue-400 border-blue-500/30 hover:bg-blue-500/20">
          Diverted
        </Badge>
      );
    case 'cancelled':
      return (
        <Badge variant="outline" className="text-muted-foreground">
          Cancelled
        </Badge>
      );
  }
}

function scoreDisplay(score: number | null) {
  if (score === null) return <span className="text-muted-foreground">N/A</span>;
  let color = 'text-emerald-400';
  if (score < 60) color = 'text-red-400';
  else if (score < 80) color = 'text-amber-400';
  return <span className={`font-mono font-bold ${color}`}>{score}</span>;
}

// ── Detail Row ──────────────────────────────────────────────────

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1.5">
      <span className="text-sm text-muted-foreground shrink-0">{label}</span>
      <span className="text-sm text-right">{children}</span>
    </div>
  );
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
          <span className="font-mono font-medium">{row.original.flightNumber}</span>
        ),
        size: 110,
      },
      {
        accessorKey: 'pilotCallsign',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Pilot" />,
        cell: ({ row }) => (
          <span className="font-mono text-muted-foreground">
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
            {row.original.depIcao}
            <span className="text-muted-foreground mx-1">&rarr;</span>
            {row.original.arrIcao}
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
          <span className="font-mono text-muted-foreground">
            {formatMinutes(row.original.flightTimeMin)}
          </span>
        ),
        size: 90,
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => statusBadge(row.original.status),
        enableSorting: false,
        size: 100,
      },
      {
        accessorKey: 'createdAt',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Date" />,
        cell: ({ row }) => (
          <span className="text-muted-foreground text-sm">
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
                      <CheckCircle size={14} className="text-emerald-400" />
                      Approve
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-red-400 focus:text-red-400"
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
        { label: 'Total', value: total, icon: <ClipboardText size={13} weight="duotone" />, color: 'blue' },
        { label: 'Pending', value: pendingCount, icon: <Hourglass size={13} weight="duotone" />, color: 'amber' },
        { label: 'Approved', value: stats.approved, icon: <CheckCircle size={13} weight="duotone" />, color: 'emerald' },
        { label: 'Rejected', value: stats.rejected, icon: <XCircle size={13} weight="duotone" />, color: 'red' },
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
                <span className="inline-flex items-center justify-center rounded-full bg-amber-500/20 text-amber-400 text-[10px] font-bold min-w-[18px] h-[18px] px-1">
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
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                placeholder="Search flight #, callsign, ICAO..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex items-center gap-2">
              <CalendarBlank size={16} className="text-muted-foreground shrink-0" />
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-[140px]"
                placeholder="From"
              />
              <span className="text-muted-foreground text-sm">-</span>
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
          <div className="flex items-center gap-3 rounded-md border border-border bg-muted/30 px-4 py-2.5">
            <span className="text-sm font-medium">
              {selectedIds.length} selected
            </span>
            <div className="ml-auto flex gap-2">
              <Button
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
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
      <div className="flex flex-1 gap-0 overflow-hidden rounded-md border border-border/50">
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
                    className="bg-emerald-600 hover:bg-emerald-700 text-white"
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
            <div className="space-y-6">
              {/* Status Badge */}
              <div>{statusBadge(detailPirep.status)}</div>

              {/* ── Flight Info ─────────────────────────────── */}
              <section>
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                  <AirplaneTilt size={14} weight="duotone" />
                  Flight Info
                </h3>
                <div className="space-y-0.5">
                  <DetailRow label="Route">
                    <span className="font-mono font-medium">
                      {detailPirep.depIcao}{' '}
                      <span className="text-muted-foreground mx-1">&rarr;</span>{' '}
                      {detailPirep.arrIcao}
                    </span>
                  </DetailRow>
                  {detailPirep.depName && detailPirep.arrName && (
                    <DetailRow label="Airports">
                      <span className="text-xs text-muted-foreground">
                        {detailPirep.depName} &mdash; {detailPirep.arrName}
                      </span>
                    </DetailRow>
                  )}
                  <DetailRow label="Aircraft">
                    <span className="font-mono">{detailPirep.aircraftType}</span>
                    {detailPirep.aircraftRegistration && (
                      <span className="text-muted-foreground ml-1">
                        ({detailPirep.aircraftRegistration})
                      </span>
                    )}
                  </DetailRow>
                  {detailPirep.route && (
                    <DetailRow label="Route String">
                      <span className="text-xs font-mono break-all">{detailPirep.route}</span>
                    </DetailRow>
                  )}
                  {detailPirep.cruiseAltitude && (
                    <DetailRow label="Cruise Alt">
                      <span className="font-mono">{detailPirep.cruiseAltitude}</span>
                    </DetailRow>
                  )}
                  <DetailRow label="Filed">{formatDateTime(detailPirep.createdAt)}</DetailRow>
                </div>
              </section>

              <Separator />

              {/* ── Performance ──────────────────────────────── */}
              <section>
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                  <ArrowDown size={14} weight="duotone" />
                  Performance
                </h3>

                {/* Landing Rate - large display */}
                <div className="bg-muted/30 rounded-md p-4 mb-3 text-center">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
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
                  <DetailRow label="Flight Time">
                    <span className="font-mono flex items-center gap-1.5">
                      <Clock size={13} className="text-muted-foreground" />
                      {formatMinutes(detailPirep.flightTimeMin)}
                    </span>
                  </DetailRow>
                  {detailPirep.blockTimeMin !== null && (
                    <DetailRow label="Block Time">
                      <span className="font-mono">{formatMinutes(detailPirep.blockTimeMin)}</span>
                    </DetailRow>
                  )}
                  <DetailRow label="Distance">
                    <span className="font-mono flex items-center gap-1.5">
                      <MapPin size={13} className="text-muted-foreground" />
                      {detailPirep.distanceNm.toLocaleString()} nm
                    </span>
                  </DetailRow>
                </div>
              </section>

              <Separator />

              {/* ── Fuel ─────────────────────────────────────── */}
              <section>
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                  <GasPump size={14} weight="duotone" />
                  Fuel
                </h3>
                <div className="space-y-0.5">
                  <DetailRow label="Fuel Used">
                    <span className="font-mono">
                      {detailPirep.fuelUsedLbs !== null
                        ? `${detailPirep.fuelUsedLbs.toLocaleString()} lbs`
                        : 'N/A'}
                    </span>
                  </DetailRow>
                  <DetailRow label="Fuel Planned">
                    <span className="font-mono">
                      {detailPirep.fuelPlannedLbs !== null
                        ? `${detailPirep.fuelPlannedLbs.toLocaleString()} lbs`
                        : 'N/A'}
                    </span>
                  </DetailRow>
                  {detailPirep.fuelUsedLbs !== null &&
                    detailPirep.fuelPlannedLbs !== null &&
                    detailPirep.fuelPlannedLbs > 0 && (
                      <DetailRow label="Fuel Variance">
                        <span
                          className={`font-mono ${
                            detailPirep.fuelUsedLbs <= detailPirep.fuelPlannedLbs
                              ? 'text-emerald-400'
                              : 'text-amber-400'
                          }`}
                        >
                          {detailPirep.fuelUsedLbs <= detailPirep.fuelPlannedLbs ? '-' : '+'}
                          {Math.abs(
                            detailPirep.fuelUsedLbs - detailPirep.fuelPlannedLbs
                          ).toLocaleString()}{' '}
                          lbs
                        </span>
                      </DetailRow>
                    )}
                </div>
              </section>

              <Separator />

              {/* ── Load (Cargo first!) ─────────────────────── */}
              <section>
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Package size={14} weight="duotone" />
                  Load
                </h3>
                <div className="space-y-0.5">
                  <DetailRow label="Cargo">
                    <span className="font-mono">
                      {detailPirep.cargoLbs.toLocaleString()} lbs
                    </span>
                  </DetailRow>
                  <DetailRow label="Passengers">
                    <span className="font-mono flex items-center gap-1.5">
                      <UsersIcon size={13} className="text-muted-foreground" />
                      {detailPirep.paxCount}
                    </span>
                  </DetailRow>
                </div>
              </section>

              {/* ── Score ─────────────────────────────────────── */}
              {detailPirep.score !== null && (
                <>
                  <Separator />
                  <section>
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                      <Star size={14} weight="duotone" />
                      Score
                    </h3>
                    <div className="bg-muted/30 rounded-md p-4 text-center">
                      <p className="text-4xl font-mono font-bold">
                        {scoreDisplay(detailPirep.score)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">/ 100</p>
                    </div>
                  </section>
                </>
              )}

              {/* ── VATSIM ────────────────────────────────────── */}
              {detailPirep.vatsimConnected && (
                <>
                  <Separator />
                  <section>
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                      <Globe size={14} weight="duotone" />
                      VATSIM
                    </h3>
                    <div className="space-y-0.5">
                      {detailPirep.vatsimCallsign && (
                        <DetailRow label="Callsign">
                          <span className="font-mono">{detailPirep.vatsimCallsign}</span>
                        </DetailRow>
                      )}
                      {detailPirep.vatsimCid && (
                        <DetailRow label="CID">
                          <span className="font-mono">{detailPirep.vatsimCid}</span>
                        </DetailRow>
                      )}
                    </div>
                  </section>
                </>
              )}

              {/* ── OOOI Timestamps ───────────────────────────── */}
              {(detailPirep.oooiOut ||
                detailPirep.oooiOff ||
                detailPirep.oooiOn ||
                detailPirep.oooiIn) && (
                <>
                  <Separator />
                  <section>
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                      <Clock size={14} weight="duotone" />
                      OOOI Timestamps
                    </h3>
                    <div className="grid grid-cols-4 gap-2 text-center">
                      {[
                        { label: 'OUT', value: detailPirep.oooiOut },
                        { label: 'OFF', value: detailPirep.oooiOff },
                        { label: 'ON', value: detailPirep.oooiOn },
                        { label: 'IN', value: detailPirep.oooiIn },
                      ].map(({ label, value }) => (
                        <div key={label} className="bg-muted/30 rounded-md p-2">
                          <p className="text-[10px] uppercase text-muted-foreground">{label}</p>
                          <p className="text-xs font-mono mt-0.5">
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
                </>
              )}

              {/* ── Remarks ───────────────────────────────────── */}
              {detailPirep.remarks && (
                <>
                  <Separator />
                  <section>
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                      Pilot Remarks
                    </h3>
                    <p className="text-sm bg-muted/30 rounded-md p-3">{detailPirep.remarks}</p>
                  </section>
                </>
              )}

              {/* ── Previous Review ───────────────────────────── */}
              {detailPirep.reviewedAt && (
                <>
                  <Separator />
                  <section>
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                      Review History
                    </h3>
                    <div className="bg-muted/30 rounded-md p-3 space-y-1">
                      <p className="text-sm">
                        <span className="text-muted-foreground">Reviewed by </span>
                        <span className="font-mono font-medium">
                          {detailPirep.reviewerCallsign || 'Unknown'}
                        </span>
                        <span className="text-muted-foreground"> on </span>
                        {formatDateTime(detailPirep.reviewedAt)}
                      </p>
                      {detailPirep.reviewNotes && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {detailPirep.reviewNotes}
                        </p>
                      )}
                    </div>
                  </section>
                </>
              )}

              {/* ── Review Form ───────────────────────────────── */}
              {detailPirep.status === 'pending' && (
                <>
                  <Separator />
                  <section>
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                      Review
                    </h3>
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
                          className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
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
                </>
              )}
            </div>
          </DetailPanel>
        )}
      </div>
    </PageShell>
  );
}
