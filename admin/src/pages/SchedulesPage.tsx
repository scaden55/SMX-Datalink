import { useCallback, useEffect, useMemo, useState } from 'react';
import { type ColumnDef } from '@tanstack/react-table';
import {
  AirplaneTilt,
  Package,
  MagnifyingGlass,
  DotsThreeVertical,
  PencilSimple,
  Copy,
  ToggleLeft,
  Trash,
  Plus,
  MapPin,
  CalendarBlank,
  Lightning,
  ArrowsClockwise,
  Buildings,
  Clock,
} from '@phosphor-icons/react';
import { api, ApiError } from '@/lib/api';
import { toast } from '@/stores/toastStore';
import { StatusBadge, SectionHeader, DataRow, StatCard } from '@/components/primitives';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScheduleFormSheet, type ScheduleFormData } from '@/components/dialogs/ScheduleFormSheet';
import { DataTable } from '@/components/shared/DataTable';
import { DataTableColumnHeader } from '@/components/shared/DataTableColumnHeader';
import { DetailPanel } from '@/components/shared/DetailPanel';
import { PageShell } from '@/components/shared/PageShell';

// ── Types ───────────────────────────────────────────────────────

interface Schedule {
  id: number;
  flightNumber: string;
  depIcao: string;
  arrIcao: string;
  aircraftType: string;
  depTime: string;
  arrTime: string;
  distanceNm: number;
  flightTimeMin: number;
  daysOfWeek: string;
  isActive: boolean;
  flightType: string | null;
  depName?: string;
  arrName?: string;
  bidCount: number;
}

interface ScheduleListResponse {
  schedules: Schedule[];
  total: number;
  page: number;
  pageSize: number;
}

interface Airport {
  id: number;
  icao: string;
  name: string;
  city: string;
  state: string;
  country: string;
  lat: number;
  lon: number;
  elevation: number;
  timezone: string;
  isHub: boolean;
  handler: string | null;
}

interface AirportListResponse {
  airports: Airport[];
  total: number;
}

interface AirportSearchResult {
  ident: string;
  name: string;
  iata_code: string | null;
  municipality: string | null;
  iso_country: string | null;
}

interface CharterStatus {
  month: string;
  generatedAt: string | null;
  charterCount: number;
  eventCount: number;
}

interface VatsimEvent {
  id: number;
  name: string;
  eventType: string;
  startTime: string;
  endTime: string;
  airports: string[];
}

// ── Helpers ─────────────────────────────────────────────────────

function getFlightType(aircraftType: string, flightType: string | null): string {
  if (flightType === 'charter') return 'charter';
  if (aircraftType === 'Cargo') return 'cargo';
  return 'passenger';
}

function formatFlightTime(minutes: number): string {
  if (!minutes) return '--';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${String(m).padStart(2, '0')}m`;
}

function formatDistance(nm: number): string {
  if (!nm) return '--';
  return `${nm.toLocaleString()} nm`;
}

// ═══════════════════════════════════════════════════════════════
// ── Flights Tab ──────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════

function FlightsTab() {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);

  // Filters
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [activeFilter, setActiveFilter] = useState<string>('all');

  // Sheet / Dialogs
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editSchedule, setEditSchedule] = useState<ScheduleFormData | null>(null);
  const [isClone, setIsClone] = useState(false);
  const [deleteSchedule, setDeleteSchedule] = useState<Schedule | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [cloneDialogSchedule, setCloneDialogSchedule] = useState<Schedule | null>(null);
  const [cloneFlightNumber, setCloneFlightNumber] = useState('');
  const [cloneLoading, setCloneLoading] = useState(false);

  // Detail panel
  const [detailSchedule, setDetailSchedule] = useState<Schedule | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  // ── Fetch ──────────────────────────────────────────────────

  const fetchSchedules = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      params.set('pageSize', '100');
      if (search) params.set('search', search);
      if (typeFilter !== 'all') params.set('flightType', typeFilter === 'charter' ? 'charter' : '');
      if (activeFilter !== 'all') params.set('isActive', activeFilter === 'active' ? 'true' : 'false');

      const res = await api.get<ScheduleListResponse>(`/api/admin/schedules?${params}`);
      setSchedules(res.schedules);
      setTotalCount(res.total);
      setError(null);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to load schedules';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [search, typeFilter, activeFilter]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      fetchSchedules();
    }, search ? 300 : 0); // debounce search
    return () => clearTimeout(timeout);
  }, [fetchSchedules]);

  // ── Filtered list (client-side type filter for Cargo/Passenger) ──

  const filteredSchedules = useMemo(() => {
    if (typeFilter === 'all' || typeFilter === 'charter') return schedules;
    return schedules.filter((s) => {
      if (typeFilter === 'cargo') return s.aircraftType === 'Cargo';
      if (typeFilter === 'passenger') return s.aircraftType === 'Passenger';
      return true;
    });
  }, [schedules, typeFilter]);

  // ── Stats ─────────────────────────────────────────────────

  const stats = useMemo(() => {
    const total = totalCount;
    const active = schedules.filter((s) => s.isActive).length;
    const cargo = schedules.filter((s) => s.aircraftType === 'Cargo').length;
    const pax = schedules.filter((s) => s.aircraftType === 'Passenger').length;
    return { total, active, cargo, pax };
  }, [schedules, totalCount]);

  // ── Actions ────────────────────────────────────────────────

  function handleCreate() {
    setEditSchedule(null);
    setIsClone(false);
    setSheetOpen(true);
  }

  function handleEdit(schedule: Schedule) {
    setEditSchedule(scheduleToFormData(schedule));
    setIsClone(false);
    setSheetOpen(true);
  }

  function handleClone(schedule: Schedule) {
    setCloneDialogSchedule(schedule);
    setCloneFlightNumber('');
  }

  async function handleCloneSubmit() {
    if (!cloneDialogSchedule || !cloneFlightNumber.trim()) {
      toast.error('Flight number is required');
      return;
    }
    setCloneLoading(true);
    try {
      await api.post(`/api/admin/schedules/${cloneDialogSchedule.id}/clone`, {
        flightNumber: cloneFlightNumber.toUpperCase(),
      });
      toast.success(`Cloned as ${cloneFlightNumber.toUpperCase()}`);
      setCloneDialogSchedule(null);
      fetchSchedules();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to clone schedule');
    } finally {
      setCloneLoading(false);
    }
  }

  async function handleToggle(schedule: Schedule) {
    try {
      await api.post(`/api/admin/schedules/${schedule.id}/toggle`);
      toast.success(`${schedule.flightNumber} ${schedule.isActive ? 'deactivated' : 'activated'}`);
      fetchSchedules();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to toggle schedule');
    }
  }

  async function handleDelete() {
    if (!deleteSchedule) return;
    setDeleteLoading(true);
    try {
      await api.delete(`/api/admin/schedules/${deleteSchedule.id}`);
      toast.success(`${deleteSchedule.flightNumber} deleted`);
      setDeleteSchedule(null);
      fetchSchedules();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to delete schedule');
    } finally {
      setDeleteLoading(false);
    }
  }

  function scheduleToFormData(s: Schedule): ScheduleFormData {
    return {
      id: s.id,
      flightNumber: s.flightNumber,
      depIcao: s.depIcao,
      arrIcao: s.arrIcao,
      aircraftType: s.aircraftType,
      depTime: s.depTime,
      arrTime: s.arrTime,
      distanceNm: s.distanceNm,
      flightTimeMin: s.flightTimeMin,
      daysOfWeek: s.daysOfWeek,
      isActive: s.isActive,
    };
  }

  function handleRowClick(schedule: Schedule) {
    if (detailSchedule?.id === schedule.id) {
      setDetailOpen(false);
      setDetailSchedule(null);
    } else {
      setDetailSchedule(schedule);
      setDetailOpen(true);
    }
  }

  // ── Columns ─────────────────────────────────────────────────

  const columns: ColumnDef<Schedule, unknown>[] = useMemo(() => [
    {
      accessorKey: 'flightNumber',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Flight #" />,
      cell: ({ row }) => <span className="font-mono font-medium text-[var(--text-primary)]">{row.original.flightNumber}</span>,
      size: 110,
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
      size: 130,
    },
    {
      accessorKey: 'aircraftType',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Aircraft" />,
      cell: ({ row }) => <span className="font-mono text-[var(--text-tertiary)]">{row.original.aircraftType}</span>,
      size: 100,
    },
    {
      id: 'times',
      header: 'Dep / Arr',
      cell: ({ row }) => (
        <span className="text-sm text-[var(--text-tertiary)]">
          {row.original.depTime} - {row.original.arrTime}
        </span>
      ),
      enableSorting: false,
      size: 120,
    },
    {
      accessorKey: 'daysOfWeek',
      header: 'Days',
      cell: ({ row }) => <span className="text-xs text-[var(--text-tertiary)]">{row.original.daysOfWeek}</span>,
      enableSorting: false,
      size: 100,
    },
    {
      id: 'type',
      header: 'Type',
      cell: ({ row }) => <StatusBadge status={getFlightType(row.original.aircraftType, row.original.flightType)} />,
      enableSorting: false,
      size: 90,
    },
    {
      id: 'status',
      header: 'Status',
      cell: ({ row }) => <StatusBadge status={row.original.isActive ? 'active' : 'inactive'} />,
      enableSorting: false,
      size: 90,
    },
    {
      id: 'actions',
      enableHiding: false,
      enableSorting: false,
      size: 50,
      cell: ({ row }) => {
        const schedule = row.original;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => e.stopPropagation()}>
                <DotsThreeVertical size={16} weight="bold" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleEdit(schedule)}>
                <PencilSimple size={14} /> Edit
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleClone(schedule)}>
                <Copy size={14} /> Clone
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => handleToggle(schedule)}>
                <ToggleLeft size={14} /> {schedule.isActive ? 'Deactivate' : 'Activate'}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-[var(--accent-red)] focus:text-[var(--accent-red)]" onClick={() => setDeleteSchedule(schedule)}>
                <Trash size={14} /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], []);

  // ── Render ─────────────────────────────────────────────────

  if (error) {
    return (
      <div className="flex items-center justify-center py-20 text-[var(--text-tertiary)]">
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stat Cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={CalendarBlank}
          label="Total Schedules"
          value={stats.total}
          accent="blue"
        />
        <StatCard
          icon={Lightning}
          label="Active"
          value={stats.active}
          accent="emerald"
        />
        <StatCard
          icon={Package}
          label="Cargo Routes"
          value={stats.cargo}
          accent="amber"
        />
        <StatCard
          icon={Buildings}
          label="Passenger Routes"
          value={stats.pax}
          accent="cyan"
        />
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 items-center gap-3">
          <div className="relative max-w-sm flex-1">
            <MagnifyingGlass
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]"
            />
            <Input
              placeholder="Search flights..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="cargo">Cargo</SelectItem>
              <SelectItem value="passenger">Passenger</SelectItem>
              <SelectItem value="charter">Charter</SelectItem>
            </SelectContent>
          </Select>
          <Select value={activeFilter} onValueChange={setActiveFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button onClick={handleCreate}>
          <Plus size={16} weight="bold" />
          Add Schedule
        </Button>
      </div>

      {/* Split view: table + detail */}
      <div className="flex flex-1 gap-0 overflow-hidden rounded-md border border-[var(--border-primary)]">
        <div className={`${detailOpen ? 'w-[55%]' : 'w-full'} flex flex-col transition-all duration-200`}>
          <DataTable
            columns={columns}
            data={filteredSchedules}
            onRowClick={handleRowClick}
            selectedRowId={detailSchedule?.id}
            loading={loading}
            emptyMessage="No schedules found"
            getRowId={(row) => String(row.id)}
          />
        </div>
        {detailOpen && detailSchedule && (
          <DetailPanel
            open={detailOpen}
            onClose={() => { setDetailOpen(false); setDetailSchedule(null); }}
            title={detailSchedule.flightNumber}
            subtitle={`${detailSchedule.depIcao} \u2192 ${detailSchedule.arrIcao}`}
            actions={
              <>
                <Button size="sm" variant="outline" onClick={() => handleEdit(detailSchedule)}>
                  <PencilSimple size={14} /> Edit
                </Button>
                <Button size="sm" variant="outline" onClick={() => handleToggle(detailSchedule)}>
                  <ToggleLeft size={14} /> {detailSchedule.isActive ? 'Deactivate' : 'Activate'}
                </Button>
              </>
            }
          >
            <div className="space-y-1">
              <SectionHeader title="Route Information" />
              <DataRow
                label="Route"
                value={
                  <span className="font-mono">
                    <span className="text-[var(--accent-blue)]">{detailSchedule.depIcao}</span>
                    {' \u2192 '}
                    <span className="text-[var(--accent-cyan)]">{detailSchedule.arrIcao}</span>
                  </span>
                }
              />
              {detailSchedule.depName && <DataRow label="Departure" value={detailSchedule.depName} />}
              {detailSchedule.arrName && <DataRow label="Arrival" value={detailSchedule.arrName} />}
              <DataRow label="Distance" value={formatDistance(detailSchedule.distanceNm)} mono />

              <SectionHeader title="Schedule Details" className="mt-4" />
              <DataRow label="Aircraft Type" value={<span className="font-mono">{detailSchedule.aircraftType}</span>} />
              <DataRow label="Schedule" value={`${detailSchedule.depTime} - ${detailSchedule.arrTime}`} mono />
              <DataRow label="Days" value={detailSchedule.daysOfWeek} />
              <DataRow label="Flight Time" value={formatFlightTime(detailSchedule.flightTimeMin)} mono />

              <SectionHeader title="Status" className="mt-4" />
              <DataRow label="Type" value={<StatusBadge status={getFlightType(detailSchedule.aircraftType, detailSchedule.flightType)} />} />
              <DataRow label="Status" value={<StatusBadge status={detailSchedule.isActive ? 'active' : 'inactive'} />} />
              <DataRow label="Active Bids" value={detailSchedule.bidCount} mono />
            </div>
          </DetailPanel>
        )}
      </div>

      {/* Schedule Form Sheet */}
      <ScheduleFormSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onSaved={fetchSchedules}
        schedule={editSchedule}
        isClone={isClone}
      />

      {/* Clone Dialog — prompts for new flight number */}
      <Dialog open={!!cloneDialogSchedule} onOpenChange={(open) => { if (!open) setCloneDialogSchedule(null); }}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Clone Schedule</DialogTitle>
            <DialogDescription>
              Create a copy of{' '}
              <span className="font-semibold text-[var(--text-primary)] font-mono">
                {cloneDialogSchedule?.flightNumber}
              </span>{' '}
              ({cloneDialogSchedule?.depIcao} - {cloneDialogSchedule?.arrIcao}).
              Enter a new flight number for the clone.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Input
              value={cloneFlightNumber}
              onChange={(e) => setCloneFlightNumber(e.target.value.toUpperCase())}
              placeholder="SMA200"
              className="font-mono"
              autoFocus
              onKeyDown={(e) => { if (e.key === 'Enter') handleCloneSubmit(); }}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCloneDialogSchedule(null)}
              disabled={cloneLoading}
            >
              Cancel
            </Button>
            <Button onClick={handleCloneSubmit} disabled={cloneLoading || !cloneFlightNumber.trim()}>
              {cloneLoading ? 'Cloning...' : 'Clone'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteSchedule} onOpenChange={(open) => { if (!open) setDeleteSchedule(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Schedule</DialogTitle>
            <DialogDescription>
              Are you sure you want to permanently delete{' '}
              <span className="font-semibold text-[var(--text-primary)] font-mono">
                {deleteSchedule?.flightNumber}
              </span>{' '}
              ({deleteSchedule?.depIcao} - {deleteSchedule?.arrIcao})?
              This will also remove any active bids on this route.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteSchedule(null)}
              disabled={deleteLoading}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteLoading}
            >
              {deleteLoading ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// ── Airports Tab ─────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════

function AirportsTab() {
  const [airports, setAirports] = useState<Airport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  // Add airport dialog
  const [addOpen, setAddOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<AirportSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [addingIcao, setAddingIcao] = useState<string | null>(null);

  // Delete
  const [deleteAirport, setDeleteAirport] = useState<Airport | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // ── Fetch ──────────────────────────────────────────────────

  const fetchAirports = useCallback(async () => {
    try {
      const res = await api.get<AirportListResponse>('/api/admin/airports');
      setAirports(res.airports);
      setError(null);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to load airports';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAirports();
  }, [fetchAirports]);

  // ── Filtered list ──────────────────────────────────────────

  const filteredAirports = useMemo(() => {
    if (!search) return airports;
    const q = search.toLowerCase();
    return airports.filter(
      (a) =>
        a.icao.toLowerCase().includes(q) ||
        a.name.toLowerCase().includes(q) ||
        a.city.toLowerCase().includes(q) ||
        a.country.toLowerCase().includes(q),
    );
  }, [airports, search]);

  // ── Airport Search ─────────────────────────────────────────

  useEffect(() => {
    if (searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }
    const timeout = setTimeout(async () => {
      setSearching(true);
      try {
        const results = await api.get<AirportSearchResult[]>(
          `/api/airports/search?q=${encodeURIComponent(searchQuery)}&limit=15`,
        );
        setSearchResults(results);
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(timeout);
  }, [searchQuery]);

  async function handleAddAirport(icao: string) {
    setAddingIcao(icao);
    try {
      await api.post('/api/admin/airports', { icao });
      toast.success(`${icao} added to approved airports`);
      setSearchQuery('');
      setSearchResults([]);
      setAddOpen(false);
      fetchAirports();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : `Failed to add ${icao}`);
    } finally {
      setAddingIcao(null);
    }
  }

  // ── Actions ────────────────────────────────────────────────

  async function handleToggleHub(airport: Airport) {
    try {
      await api.patch(`/api/admin/airports/${airport.icao}/hub`);
      toast.success(`${airport.icao} ${airport.isHub ? 'removed from hubs' : 'set as hub'}`);
      fetchAirports();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to toggle hub status');
    }
  }

  async function handleDeleteAirport() {
    if (!deleteAirport) return;
    setDeleteLoading(true);
    try {
      await api.delete(`/api/admin/airports/${deleteAirport.icao}`);
      toast.success(`${deleteAirport.icao} removed`);
      setDeleteAirport(null);
      fetchAirports();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to delete airport');
    } finally {
      setDeleteLoading(false);
    }
  }

  // ── Render ─────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-[var(--text-tertiary)]">
        <p>Loading airports...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-20 text-[var(--text-tertiary)]">
        <p>{error}</p>
      </div>
    );
  }

  const hubCount = airports.filter((a) => a.isHub).length;

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          icon={MapPin}
          label="Total Airports"
          value={airports.length}
          accent="blue"
        />
        <StatCard
          icon={Buildings}
          label="Hub Airports"
          value={hubCount}
          accent="amber"
        />
        <StatCard
          icon={MapPin}
          label="Countries"
          value={new Set(airports.map((a) => a.country)).size}
          accent="cyan"
        />
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-sm flex-1">
          <MagnifyingGlass
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]"
          />
          <Input
            placeholder="Search airports..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button onClick={() => setAddOpen(true)}>
          <Plus size={16} weight="bold" />
          Add Airport
        </Button>
      </div>

      {/* Table */}
      <div className="rounded-md border border-[var(--border-primary)]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[80px]">ICAO</TableHead>
              <TableHead>Name</TableHead>
              <TableHead className="w-[140px]">City</TableHead>
              <TableHead className="w-[80px]">Country</TableHead>
              <TableHead className="w-[80px]">Hub</TableHead>
              <TableHead className="w-[60px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAirports.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-10 text-[var(--text-tertiary)]">
                  No airports found
                </TableCell>
              </TableRow>
            ) : (
              filteredAirports.map((airport) => (
                <TableRow key={airport.id}>
                  <TableCell className="font-mono font-medium text-[var(--text-primary)]">{airport.icao}</TableCell>
                  <TableCell>{airport.name}</TableCell>
                  <TableCell className="text-[var(--text-tertiary)]">{airport.city}</TableCell>
                  <TableCell className="font-mono text-[var(--text-tertiary)]">{airport.country}</TableCell>
                  <TableCell>
                    {airport.isHub ? (
                      <StatusBadge status="hub" />
                    ) : (
                      <span className="text-xs text-[var(--text-quaternary)]">--</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <DotsThreeVertical size={16} weight="bold" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleToggleHub(airport)}>
                          <Buildings size={14} />
                          {airport.isHub ? 'Remove Hub' : 'Set as Hub'}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-[var(--accent-red)] focus:text-[var(--accent-red)]"
                          onClick={() => setDeleteAirport(airport)}
                        >
                          <Trash size={14} />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Add Airport Dialog */}
      <Dialog open={addOpen} onOpenChange={(open) => { if (!open) { setAddOpen(false); setSearchQuery(''); setSearchResults([]); } else { setAddOpen(true); } }}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Add Airport</DialogTitle>
            <DialogDescription>
              Search by ICAO code or airport name to add to the approved list.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="relative">
              <MagnifyingGlass
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]"
              />
              <Input
                placeholder="Search ICAO or name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
                autoFocus
              />
            </div>
            <div className="max-h-[300px] overflow-y-auto rounded-md border border-[var(--border-primary)]">
              {searching && (
                <div className="p-4 text-center text-sm text-[var(--text-tertiary)]">Searching...</div>
              )}
              {!searching && searchQuery.length >= 2 && searchResults.length === 0 && (
                <div className="p-4 text-center text-sm text-[var(--text-tertiary)]">No airports found</div>
              )}
              {!searching && searchQuery.length < 2 && (
                <div className="p-4 text-center text-sm text-[var(--text-tertiary)]">Type at least 2 characters</div>
              )}
              {searchResults.map((result) => {
                const alreadyAdded = airports.some((a) => a.icao === result.ident);
                return (
                  <div
                    key={result.ident}
                    className="flex items-center justify-between px-4 py-2.5 border-b border-[var(--border-primary)] last:border-b-0 hover:bg-[var(--surface-3)]"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-medium text-[var(--text-primary)]">{result.ident}</span>
                        {result.iata_code && (
                          <span className="text-xs text-[var(--text-tertiary)]">({result.iata_code})</span>
                        )}
                      </div>
                      <p className="text-sm text-[var(--text-tertiary)] truncate">
                        {result.name}
                        {result.municipality && `, ${result.municipality}`}
                        {result.iso_country && ` (${result.iso_country})`}
                      </p>
                    </div>
                    {alreadyAdded ? (
                      <StatusBadge status="published" label="Added" className="ml-2 shrink-0" />
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        className="ml-2 shrink-0"
                        onClick={() => handleAddAirport(result.ident)}
                        disabled={addingIcao === result.ident}
                      >
                        {addingIcao === result.ident ? 'Adding...' : 'Add'}
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Airport Dialog */}
      <Dialog open={!!deleteAirport} onOpenChange={(open) => { if (!open) setDeleteAirport(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Airport</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove{' '}
              <span className="font-semibold text-[var(--text-primary)] font-mono">
                {deleteAirport?.icao}
              </span>{' '}
              ({deleteAirport?.name}) from the approved airports list?
              This will fail if the airport is used by active schedules.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteAirport(null)}
              disabled={deleteLoading}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteAirport}
              disabled={deleteLoading}
            >
              {deleteLoading ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// ── Charters Tab ─────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════

function ChartersTab() {
  const [charterStatus, setCharterStatus] = useState<CharterStatus | null>(null);
  const [events, setEvents] = useState<VatsimEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [statusRes, eventsRes] = await Promise.all([
        api.get<CharterStatus>('/api/admin/charters/status'),
        api.get<{ events: VatsimEvent[]; total: number }>('/api/admin/events'),
      ]);
      setCharterStatus(statusRes);
      setEvents(eventsRes.events);
    } catch {
      // Charter system might not be initialized yet
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function handleGenerate() {
    setGenerating(true);
    try {
      const result = await api.post<{ charterCount: number; eventCount: number }>('/api/admin/charters/generate');
      toast.success(`Generated ${result.charterCount} charter(s) from ${result.eventCount} event(s)`);
      fetchData();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to generate charters');
    } finally {
      setGenerating(false);
    }
  }

  async function handleRefreshEvents() {
    setRefreshing(true);
    try {
      const result = await api.post<{ eventsCached: number; chartersCreated: number }>('/api/admin/events/refresh');
      toast.success(`Refreshed: ${result.eventsCached} events cached, ${result.chartersCreated} charters created`);
      fetchData();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to refresh events');
    } finally {
      setRefreshing(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-[var(--text-tertiary)]">
        <p>Loading charters...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Charter Generation Status */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          icon={CalendarBlank}
          label="Current Month"
          value={charterStatus?.month ?? '--'}
          accent="blue"
        />
        <StatCard
          icon={AirplaneTilt}
          label="Generated Charters"
          value={charterStatus?.charterCount ?? 0}
          accent="emerald"
        />
        <StatCard
          icon={Lightning}
          label="VATSIM Events"
          value={events.length}
          accent="amber"
        />
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-3">
        <Button onClick={handleGenerate} disabled={generating}>
          {generating ? (
            <>
              <ArrowsClockwise size={16} className="animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Lightning size={16} weight="bold" />
              Generate Monthly Charters
            </>
          )}
        </Button>
        <Button variant="outline" onClick={handleRefreshEvents} disabled={refreshing}>
          {refreshing ? (
            <>
              <ArrowsClockwise size={16} className="animate-spin" />
              Refreshing...
            </>
          ) : (
            <>
              <ArrowsClockwise size={16} weight="bold" />
              Refresh VATSIM Events
            </>
          )}
        </Button>
      </div>

      {charterStatus?.generatedAt && (
        <p className="text-sm text-[var(--text-tertiary)]">
          Last generated: {new Date(charterStatus.generatedAt).toLocaleString()}
        </p>
      )}

      {/* Upcoming Events */}
      <div>
        <SectionHeader title="Active VATSIM Events" count={events.length} />
        {events.length === 0 ? (
          <div className="rounded-md border border-[var(--border-primary)] p-8 text-center text-[var(--text-tertiary)]">
            <Clock size={32} weight="duotone" className="mx-auto mb-2 opacity-50" />
            <p>No active VATSIM events at this time.</p>
            <p className="text-xs mt-1 text-[var(--text-quaternary)]">Events are polled automatically from the VATSIM API.</p>
          </div>
        ) : (
          <div className="rounded-md border border-[var(--border-primary)]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Event Name</TableHead>
                  <TableHead className="w-[100px]">Type</TableHead>
                  <TableHead className="w-[160px]">Start</TableHead>
                  <TableHead className="w-[160px]">End</TableHead>
                  <TableHead className="w-[120px]">Airports</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {events.map((event) => (
                  <TableRow key={event.id}>
                    <TableCell className="font-medium text-[var(--text-primary)]">{event.name}</TableCell>
                    <TableCell>
                      <StatusBadge status="info" label={event.eventType} />
                    </TableCell>
                    <TableCell className="font-mono text-sm text-[var(--text-tertiary)]">
                      {new Date(event.startTime).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </TableCell>
                    <TableCell className="font-mono text-sm text-[var(--text-tertiary)]">
                      {new Date(event.endTime).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {event.airports.slice(0, 3).map((icao) => (
                          <span
                            key={icao}
                            className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-medium ring-1 bg-[var(--surface-3)] text-[var(--text-secondary)] ring-[var(--border-secondary)]"
                          >
                            {icao}
                          </span>
                        ))}
                        {event.airports.length > 3 && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ring-1 bg-[var(--surface-3)] text-[var(--text-tertiary)] ring-[var(--border-secondary)]">
                            +{event.airports.length - 3}
                          </span>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// ── Main Page ────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════

export function SchedulesPage() {
  return (
    <PageShell
      title="Schedules"
      subtitle="Flight schedules, airports, and charters"
    >
      <Tabs defaultValue="flights" className="space-y-6">
        <TabsList>
          <TabsTrigger value="flights">Flights</TabsTrigger>
          <TabsTrigger value="airports">Airports</TabsTrigger>
          <TabsTrigger value="charters">Charters</TabsTrigger>
        </TabsList>

        <TabsContent value="flights">
          <FlightsTab />
        </TabsContent>

        <TabsContent value="airports">
          <AirportsTab />
        </TabsContent>

        <TabsContent value="charters">
          <ChartersTab />
        </TabsContent>
      </Tabs>
    </PageShell>
  );
}
