import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ClipboardText,
  Hourglass,
  CheckCircle,
  XCircle,
  MagnifyingGlass,
  DotsThreeVertical,
  Eye,
  CalendarBlank,
} from '@phosphor-icons/react';
import { api, ApiError } from '@/lib/api';
import { toast } from '@/stores/toastStore';
import { Skeleton } from '@/components/ui/skeleton';
import { StatCard } from '@/components/widgets/StatCard';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PirepDetailPanel, type PirepEntry } from '@/components/panels/PirepDetailPanel';

// ── Types ───────────────────────────────────────────────────────

type PirepStatus = 'pending' | 'approved' | 'completed' | 'diverted' | 'rejected' | 'cancelled';

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

function landingRateColor(fpm: number | null): string {
  if (fpm === null) return 'text-muted-foreground';
  const abs = Math.abs(fpm);
  if (abs <= 200) return 'text-emerald-400';
  if (abs <= 400) return 'text-amber-400';
  return 'text-red-400';
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

// ── Skeleton ────────────────────────────────────────────────────

function PirepsPageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[110px] rounded-md" />
        ))}
      </div>
      <Skeleton className="h-10 w-full rounded-md" />
      <Skeleton className="h-[400px] rounded-md" />
    </div>
  );
}

// ── Page ────────────────────────────────────────────────────────

export function PirepsPage() {
  const [pireps, setPireps] = useState<PirepEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 50;

  // Filters
  const [search, setSearch] = useState('');
  const [searchDebounced, setSearchDebounced] = useState('');
  const [statusTab, setStatusTab] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Selection
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);

  // Detail panel
  const [detailPirep, setDetailPirep] = useState<PirepEntry | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

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
      setSelected(new Set());
      setError(null);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to load PIREPs';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [page, statusTab, searchDebounced, dateFrom, dateTo]);

  useEffect(() => {
    fetchPireps();
  }, [fetchPireps]);

  // ── Stats ───────────────────────────────────────────────────

  const stats = useMemo(() => {
    const approved = pireps.filter((p) => p.status === 'approved' || p.status === 'completed').length;
    const rejected = pireps.filter((p) => p.status === 'rejected').length;
    return { approved, rejected };
  }, [pireps]);

  // ── Selection ───────────────────────────────────────────────

  // Only pending PIREPs can be selected for bulk review
  const selectablePireps = useMemo(() => pireps.filter((p) => p.status === 'pending'), [pireps]);

  function toggleSelect(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selected.size === selectablePireps.length && selectablePireps.length > 0) {
      setSelected(new Set());
    } else {
      setSelected(new Set(selectablePireps.map((p) => p.id)));
    }
  }

  const allSelectableChecked = selectablePireps.length > 0 && selected.size === selectablePireps.length;
  const someSelected = selected.size > 0 && selected.size < selectablePireps.length;

  // ── Bulk Actions ────────────────────────────────────────────

  async function handleBulkReview(status: 'approved' | 'rejected') {
    if (selected.size === 0) return;
    setBulkLoading(true);
    try {
      const res = await api.post<{ ok: boolean; count: number }>('/api/admin/pireps/bulk-review', {
        ids: Array.from(selected),
        status,
      });
      toast.success(`${res.count} PIREP${res.count !== 1 ? 's' : ''} ${status}`);
      setSelected(new Set());
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

  // ── Pagination ──────────────────────────────────────────────

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  // ── Render ──────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-semibold mb-6">PIREPs</h1>
        <PirepsPageSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-semibold mb-6">PIREPs</h1>
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-6">PIREPs</h1>

      <div className="space-y-6">
        {/* Stat Cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Total PIREPs"
            value={total}
            icon={<ClipboardText size={22} weight="duotone" />}
          />
          <StatCard
            title="Pending Review"
            value={pendingCount}
            icon={<Hourglass size={22} weight="duotone" />}
          />
          <StatCard
            title="Approved (Page)"
            value={stats.approved}
            icon={<CheckCircle size={22} weight="duotone" />}
          />
          <StatCard
            title="Rejected (Page)"
            value={stats.rejected}
            icon={<XCircle size={22} weight="duotone" />}
          />
        </div>

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

        {/* Toolbar */}
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

        {/* Bulk Toolbar */}
        {selected.size > 0 && (
          <div className="flex items-center gap-3 rounded-md border border-border bg-muted/30 px-4 py-2.5">
            <span className="text-sm font-medium">
              {selected.size} selected
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
                onClick={() => setSelected(new Set())}
                disabled={bulkLoading}
              >
                Clear
              </Button>
            </div>
          </div>
        )}

        {/* Table */}
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40px]">
                  <Checkbox
                    checked={allSelectableChecked}
                    ref={(el) => {
                      if (el) {
                        // Set indeterminate state for "some selected"
                        (el as unknown as HTMLInputElement).indeterminate = someSelected;
                      }
                    }}
                    onCheckedChange={toggleSelectAll}
                    aria-label="Select all pending"
                  />
                </TableHead>
                <TableHead className="w-[110px]">Flight #</TableHead>
                <TableHead className="w-[90px]">Pilot</TableHead>
                <TableHead className="w-[120px]">Route</TableHead>
                <TableHead className="w-[100px]">Landing Rate</TableHead>
                <TableHead className="w-[90px]">Flight Time</TableHead>
                <TableHead className="w-[100px]">Status</TableHead>
                <TableHead className="w-[100px]">Date</TableHead>
                <TableHead className="w-[50px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {pireps.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-10 text-muted-foreground">
                    No PIREPs found
                  </TableCell>
                </TableRow>
              ) : (
                pireps.map((pirep) => {
                  const isPending = pirep.status === 'pending';
                  const isSelected = selected.has(pirep.id);

                  return (
                    <TableRow
                      key={pirep.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleRowClick(pirep)}
                    >
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleSelect(pirep.id)}
                          disabled={!isPending}
                          aria-label={`Select ${pirep.flightNumber}`}
                        />
                      </TableCell>
                      <TableCell className="font-mono font-medium">
                        {pirep.flightNumber}
                      </TableCell>
                      <TableCell className="font-mono text-muted-foreground">
                        {pirep.pilotCallsign || `#${pirep.userId}`}
                      </TableCell>
                      <TableCell>
                        <span className="font-mono text-sm">
                          {pirep.depIcao}
                          <span className="text-muted-foreground mx-1">&rarr;</span>
                          {pirep.arrIcao}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className={`font-mono ${landingRateColor(pirep.landingRateFpm)}`}>
                          {pirep.landingRateFpm !== null ? `${pirep.landingRateFpm} fpm` : 'N/A'}
                        </span>
                      </TableCell>
                      <TableCell className="font-mono text-muted-foreground">
                        {formatMinutes(pirep.flightTimeMin)}
                      </TableCell>
                      <TableCell>{statusBadge(pirep.status)}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {formatDate(pirep.createdAt)}
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
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
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Showing {((page - 1) * pageSize) + 1}-{Math.min(page * pageSize, total)} of {total} PIREPs
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
              >
                Previous
              </Button>
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                Page {page} of {totalPages}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Detail Panel */}
      <PirepDetailPanel
        pirep={detailPirep}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onReviewed={fetchPireps}
      />
    </div>
  );
}
