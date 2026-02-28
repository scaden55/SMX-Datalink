import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { Skeleton } from '@/components/ui/skeleton';
import { StatCard } from '@/components/widgets/StatCard';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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

function typeBadge(aircraftType: string, flightType: string | null) {
  if (flightType === 'charter') {
    return (
      <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/30 hover:bg-amber-500/20">
        Charter
      </Badge>
    );
  }
  if (aircraftType === 'Cargo') {
    return (
      <Badge className="bg-blue-500/15 text-blue-400 border-blue-500/30 hover:bg-blue-500/20">
        Cargo
      </Badge>
    );
  }
  return (
    <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20">
      Passenger
    </Badge>
  );
}

function activeBadge(isActive: boolean) {
  if (isActive) {
    return (
      <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20">
        Active
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-muted-foreground">
      Inactive
    </Badge>
  );
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

// ── Skeleton ────────────────────────────────────────────────────

function SchedulesPageSkeleton() {
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

  // ── Render ─────────────────────────────────────────────────

  if (loading) return <SchedulesPageSkeleton />;

  if (error) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stat Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Schedules"
          value={stats.total}
          icon={<CalendarBlank size={22} weight="duotone" />}
        />
        <StatCard
          title="Active"
          value={stats.active}
          icon={<AirplaneTilt size={22} weight="duotone" />}
        />
        <StatCard
          title="Cargo Routes"
          value={stats.cargo}
          icon={<Package size={22} weight="duotone" />}
        />
        <StatCard
          title="Passenger Routes"
          value={stats.pax}
          icon={<AirplaneTilt size={22} weight="duotone" />}
        />
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 items-center gap-3">
          <div className="relative max-w-sm flex-1">
            <MagnifyingGlass
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
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

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[100px]">Flight #</TableHead>
              <TableHead className="w-[90px]">Type</TableHead>
              <TableHead className="w-[80px]">Dep</TableHead>
              <TableHead className="w-[80px]">Arr</TableHead>
              <TableHead className="w-[100px]">Distance</TableHead>
              <TableHead className="w-[100px]">Flight Time</TableHead>
              <TableHead className="w-[90px]">Status</TableHead>
              <TableHead className="w-[60px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredSchedules.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-10 text-muted-foreground">
                  No schedules found
                </TableCell>
              </TableRow>
            ) : (
              filteredSchedules.map((schedule) => (
                <TableRow key={schedule.id}>
                  <TableCell className="font-mono font-medium">
                    {schedule.flightNumber}
                  </TableCell>
                  <TableCell>{typeBadge(schedule.aircraftType, schedule.flightType)}</TableCell>
                  <TableCell>
                    <span className="font-mono font-medium">{schedule.depIcao}</span>
                    {schedule.depName && (
                      <p className="text-xs text-muted-foreground truncate max-w-[120px]">{schedule.depName}</p>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className="font-mono font-medium">{schedule.arrIcao}</span>
                    {schedule.arrName && (
                      <p className="text-xs text-muted-foreground truncate max-w-[120px]">{schedule.arrName}</p>
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-muted-foreground">
                    {formatDistance(schedule.distanceNm)}
                  </TableCell>
                  <TableCell className="font-mono text-muted-foreground">
                    {formatFlightTime(schedule.flightTimeMin)}
                  </TableCell>
                  <TableCell>{activeBadge(schedule.isActive)}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <DotsThreeVertical size={16} weight="bold" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEdit(schedule)}>
                          <PencilSimple size={14} />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleClone(schedule)}>
                          <Copy size={14} />
                          Clone
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => handleToggle(schedule)}>
                          <ToggleLeft size={14} />
                          {schedule.isActive ? 'Deactivate' : 'Activate'}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-red-400 focus:text-red-400"
                          onClick={() => setDeleteSchedule(schedule)}
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
              <span className="font-semibold text-foreground font-mono">
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
              <span className="font-semibold text-foreground font-mono">
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

  if (loading) return <SchedulesPageSkeleton />;

  if (error) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <p>{error}</p>
      </div>
    );
  }

  const hubCount = airports.filter((a) => a.isHub).length;

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          title="Total Airports"
          value={airports.length}
          icon={<MapPin size={22} weight="duotone" />}
        />
        <StatCard
          title="Hub Airports"
          value={hubCount}
          icon={<Buildings size={22} weight="duotone" />}
        />
        <StatCard
          title="Countries"
          value={new Set(airports.map((a) => a.country)).size}
          icon={<MapPin size={22} weight="duotone" />}
        />
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-sm flex-1">
          <MagnifyingGlass
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
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
      <div className="rounded-md border">
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
                <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                  No airports found
                </TableCell>
              </TableRow>
            ) : (
              filteredAirports.map((airport) => (
                <TableRow key={airport.id}>
                  <TableCell className="font-mono font-medium">{airport.icao}</TableCell>
                  <TableCell>{airport.name}</TableCell>
                  <TableCell className="text-muted-foreground">{airport.city}</TableCell>
                  <TableCell className="font-mono text-muted-foreground">{airport.country}</TableCell>
                  <TableCell>
                    {airport.isHub ? (
                      <Badge className="bg-blue-500/15 text-blue-400 border-blue-500/30 hover:bg-blue-500/20">
                        Hub
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">--</span>
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
                          className="text-red-400 focus:text-red-400"
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
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                placeholder="Search ICAO or name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
                autoFocus
              />
            </div>
            <div className="max-h-[300px] overflow-y-auto rounded-md border">
              {searching && (
                <div className="p-4 text-center text-sm text-muted-foreground">Searching...</div>
              )}
              {!searching && searchQuery.length >= 2 && searchResults.length === 0 && (
                <div className="p-4 text-center text-sm text-muted-foreground">No airports found</div>
              )}
              {!searching && searchQuery.length < 2 && (
                <div className="p-4 text-center text-sm text-muted-foreground">Type at least 2 characters</div>
              )}
              {searchResults.map((result) => {
                const alreadyAdded = airports.some((a) => a.icao === result.ident);
                return (
                  <div
                    key={result.ident}
                    className="flex items-center justify-between px-4 py-2.5 border-b last:border-b-0 hover:bg-muted/50"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-medium">{result.ident}</span>
                        {result.iata_code && (
                          <span className="text-xs text-muted-foreground">({result.iata_code})</span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground truncate">
                        {result.name}
                        {result.municipality && `, ${result.municipality}`}
                        {result.iso_country && ` (${result.iso_country})`}
                      </p>
                    </div>
                    {alreadyAdded ? (
                      <Badge variant="secondary" className="ml-2 shrink-0">Added</Badge>
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
              <span className="font-semibold text-foreground font-mono">
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

  if (loading) return <SchedulesPageSkeleton />;

  return (
    <div className="space-y-6">
      {/* Charter Generation Status */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          title="Current Month"
          value={charterStatus?.month ?? '--'}
          icon={<CalendarBlank size={22} weight="duotone" />}
        />
        <StatCard
          title="Generated Charters"
          value={charterStatus?.charterCount ?? 0}
          icon={<AirplaneTilt size={22} weight="duotone" />}
        />
        <StatCard
          title="VATSIM Events"
          value={events.length}
          icon={<Lightning size={22} weight="duotone" />}
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
        <p className="text-sm text-muted-foreground">
          Last generated: {new Date(charterStatus.generatedAt).toLocaleString()}
        </p>
      )}

      {/* Upcoming Events */}
      <div>
        <h3 className="text-lg font-semibold mb-3">Active VATSIM Events</h3>
        {events.length === 0 ? (
          <div className="rounded-md border p-8 text-center text-muted-foreground">
            <Clock size={32} weight="duotone" className="mx-auto mb-2 opacity-50" />
            <p>No active VATSIM events at this time.</p>
            <p className="text-xs mt-1">Events are polled automatically from the VATSIM API.</p>
          </div>
        ) : (
          <div className="rounded-md border">
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
                    <TableCell className="font-medium">{event.name}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{event.eventType}</Badge>
                    </TableCell>
                    <TableCell className="font-mono text-sm text-muted-foreground">
                      {new Date(event.startTime).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </TableCell>
                    <TableCell className="font-mono text-sm text-muted-foreground">
                      {new Date(event.endTime).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {event.airports.slice(0, 3).map((icao) => (
                          <Badge key={icao} variant="outline" className="font-mono text-xs">
                            {icao}
                          </Badge>
                        ))}
                        {event.airports.length > 3 && (
                          <Badge variant="outline" className="text-xs">
                            +{event.airports.length - 3}
                          </Badge>
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
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-6">Schedules</h1>
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
    </div>
  );
}
