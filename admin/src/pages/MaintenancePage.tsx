import { useCallback, useEffect, useMemo, useState } from 'react';
import { type ColumnDef } from '@tanstack/react-table';
import {
  Airplane,
  Wrench,
  CalendarCheck,
  ShieldWarning,
  ListChecks,
  GearSix,
  MagnifyingGlass,
  Plus,
  PencilSimple,
  Trash,
  DotsThreeVertical,
  CheckCircle,
  ArrowClockwise,
  Warning,
} from '@phosphor-icons/react';
import { api, ApiError } from '@/lib/api';
import { toast } from '@/stores/toastStore';
import { Skeleton } from '@/components/ui/skeleton';
import { PageShell } from '@/components/shared/PageShell';
import { DataTable } from '@/components/shared/DataTable';
import { DataTableColumnHeader } from '@/components/shared/DataTableColumnHeader';
import { DataTablePagination } from '@/components/shared/DataTablePagination';
import { DetailPanel } from '@/components/shared/DetailPanel';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

// ── Types (mirroring @acars/shared) ──────────────────────────

type MaintenanceCheckType = 'A' | 'B' | 'C' | 'D';
type MaintenanceLogType = 'A' | 'B' | 'C' | 'D' | 'LINE' | 'UNSCHEDULED' | 'AD' | 'MEL' | 'SFP';
type MaintenanceLogStatus = 'scheduled' | 'in_progress' | 'completed' | 'deferred';
type ADComplianceStatus = 'open' | 'complied' | 'recurring' | 'not_applicable';
type MELCategory = 'A' | 'B' | 'C' | 'D';
type MELStatus = 'open' | 'rectified' | 'expired';
type ComponentType = 'ENGINE' | 'APU' | 'LANDING_GEAR' | 'PROP' | 'AVIONICS' | 'OTHER';
type ComponentStatus = 'installed' | 'removed' | 'in_shop' | 'scrapped';

interface CheckDueStatus {
  checkType: MaintenanceCheckType;
  dueAtHours: number | null;
  dueAtCycles: number | null;
  dueAtDate: string | null;
  currentHours: number;
  currentCycles: number;
  isOverdue: boolean;
  isInOverflight: boolean;
  remainingHours: number | null;
  remainingCycles: number | null;
  overflightPct: number;
}

interface FleetMaintenanceStatus {
  aircraftId: number;
  registration: string;
  icaoType: string;
  name: string;
  status: string;
  totalHours: number;
  totalCycles: number;
  checksDue: CheckDueStatus[];
  hasOverdueChecks: boolean;
  hasOverdueADs: boolean;
  hasExpiredMEL: boolean;
  nextCheckType: string | null;
  nextCheckDueIn: number | null;
}

interface MaintenanceLogEntry {
  id: number;
  aircraftId: number;
  aircraftRegistration?: string;
  checkType: MaintenanceLogType;
  title: string;
  description: string | null;
  performedBy: string | null;
  performedAt: string | null;
  hoursAtCheck: number | null;
  cyclesAtCheck: number | null;
  cost: number | null;
  status: MaintenanceLogStatus;
  sfpDestination: string | null;
  sfpExpiry: string | null;
  createdBy: number | null;
  createdAt: string;
  updatedAt: string;
}

interface MaintenanceCheckSchedule {
  id: number;
  icaoType: string;
  checkType: MaintenanceCheckType;
  intervalHours: number | null;
  intervalCycles: number | null;
  intervalMonths: number | null;
  overflightPct: number;
  estimatedDurationHours: number | null;
  description: string | null;
}

interface AirworthinessDirective {
  id: number;
  aircraftId: number;
  aircraftRegistration?: string;
  adNumber: string;
  title: string;
  description: string | null;
  complianceStatus: ADComplianceStatus;
  complianceDate: string | null;
  complianceMethod: string | null;
  recurringIntervalHours: number | null;
  nextDueHours: number | null;
  nextDueDate: string | null;
  createdBy: number | null;
  createdAt: string;
  updatedAt: string;
}

interface MELDeferral {
  id: number;
  aircraftId: number;
  aircraftRegistration?: string;
  itemNumber: string;
  title: string;
  category: MELCategory;
  deferralDate: string;
  expiryDate: string;
  rectifiedDate: string | null;
  status: MELStatus;
  remarks: string | null;
  createdBy: number | null;
  createdAt: string;
}

interface AircraftComponent {
  id: number;
  aircraftId: number;
  aircraftRegistration?: string;
  componentType: ComponentType;
  position: string | null;
  serialNumber: string | null;
  partNumber: string | null;
  hoursSinceNew: number;
  cyclesSinceNew: number;
  hoursSinceOverhaul: number;
  cyclesSinceOverhaul: number;
  overhaulIntervalHours: number | null;
  installedDate: string | null;
  status: ComponentStatus;
  remarks: string | null;
  createdAt: string;
  updatedAt: string;
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

function formatHours(h: number | null): string {
  if (h === null || h === undefined) return '--';
  return h.toLocaleString('en-US', { maximumFractionDigits: 1 });
}

// ── Badge helpers ────────────────────────────────────────────

function fleetStatusBadge(status: string) {
  switch (status) {
    case 'active':
      return <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30">Active</Badge>;
    case 'maintenance':
      return <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/30">Maintenance</Badge>;
    case 'stored':
      return <Badge variant="outline" className="text-muted-foreground">Stored</Badge>;
    case 'retired':
      return <Badge className="bg-red-500/15 text-red-400 border-red-500/30">Retired</Badge>;
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
}

function logStatusBadge(status: MaintenanceLogStatus) {
  switch (status) {
    case 'completed':
      return <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30">Completed</Badge>;
    case 'in_progress':
      return <Badge className="bg-blue-500/15 text-blue-400 border-blue-500/30">In Progress</Badge>;
    case 'scheduled':
      return <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/30">Scheduled</Badge>;
    case 'deferred':
      return <Badge variant="outline" className="text-muted-foreground">Deferred</Badge>;
  }
}

function adStatusBadge(status: ADComplianceStatus) {
  switch (status) {
    case 'complied':
      return <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30">Complied</Badge>;
    case 'open':
      return <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/30">Open</Badge>;
    case 'recurring':
      return <Badge className="bg-blue-500/15 text-blue-400 border-blue-500/30">Recurring</Badge>;
    case 'not_applicable':
      return <Badge variant="outline" className="text-muted-foreground">N/A</Badge>;
  }
}

function melStatusBadge(status: MELStatus) {
  switch (status) {
    case 'open':
      return <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/30">Open</Badge>;
    case 'rectified':
      return <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30">Rectified</Badge>;
    case 'expired':
      return <Badge className="bg-red-500/15 text-red-400 border-red-500/30">Expired</Badge>;
  }
}

function componentStatusBadge(status: ComponentStatus) {
  switch (status) {
    case 'installed':
      return <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30">Installed</Badge>;
    case 'removed':
      return <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/30">Removed</Badge>;
    case 'in_shop':
      return <Badge className="bg-blue-500/15 text-blue-400 border-blue-500/30">In Shop</Badge>;
    case 'scrapped':
      return <Badge className="bg-red-500/15 text-red-400 border-red-500/30">Scrapped</Badge>;
  }
}

// ── Detail helper ────────────────────────────────────────────

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1.5">
      <span className="text-sm text-muted-foreground shrink-0">{label}</span>
      <span className="text-sm text-right">{children}</span>
    </div>
  );
}

function formatCurrency(v: number | null): string {
  if (v === null || v === undefined) return '--';
  return `$${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ── Skeleton ─────────────────────────────────────────────────

function TabSkeleton() {
  return (
    <div className="space-y-4">
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
// Tab 1: Fleet Status
// ═══════════════════════════════════════════════════════════════

function FleetStatusTab() {
  const [fleet, setFleet] = useState<FleetMaintenanceStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Detail panel
  const [detailAircraft, setDetailAircraft] = useState<FleetMaintenanceStatus | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  // Adjust hours dialog
  const [adjustTarget, setAdjustTarget] = useState<FleetMaintenanceStatus | null>(null);
  const [adjustHours, setAdjustHours] = useState('');
  const [adjustCycles, setAdjustCycles] = useState('');
  const [adjustReason, setAdjustReason] = useState('');
  const [adjustLoading, setAdjustLoading] = useState(false);

  const fetchFleet = useCallback(async () => {
    try {
      const res = await api.get<{ fleet: FleetMaintenanceStatus[] }>('/api/admin/maintenance/fleet-status');
      setFleet(res.fleet);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to load fleet status');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchFleet(); }, [fetchFleet]);

  const filtered = useMemo(() => {
    if (!search) return fleet;
    const q = search.toLowerCase();
    return fleet.filter(
      (a) =>
        a.registration.toLowerCase().includes(q) ||
        a.icaoType.toLowerCase().includes(q) ||
        a.name.toLowerCase().includes(q),
    );
  }, [fleet, search]);

  async function handleAdjustHours() {
    if (!adjustTarget || !adjustReason.trim()) return;
    setAdjustLoading(true);
    try {
      await api.patch(`/api/admin/maintenance/aircraft/${adjustTarget.aircraftId}/hours`, {
        totalHours: adjustHours ? parseFloat(adjustHours) : undefined,
        totalCycles: adjustCycles ? parseInt(adjustCycles) : undefined,
        reason: adjustReason.trim(),
      });
      toast.success(`Hours adjusted for ${adjustTarget.registration}`);
      setAdjustTarget(null);
      setAdjustHours('');
      setAdjustCycles('');
      setAdjustReason('');
      fetchFleet();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to adjust hours');
    } finally {
      setAdjustLoading(false);
    }
  }

  async function handleReturnToService(aircraft: FleetMaintenanceStatus) {
    try {
      const res = await api.post<{ ok: boolean; message: string }>(
        `/api/admin/maintenance/aircraft/${aircraft.aircraftId}/return-to-service`,
      );
      if (res.ok) {
        toast.success(res.message);
      } else {
        toast.warning(res.message);
      }
      fetchFleet();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to return aircraft to service');
    }
  }

  if (loading) return <TabSkeleton />;

  function getCardBorderColor(aircraft: FleetMaintenanceStatus): string {
    if (aircraft.hasOverdueChecks || aircraft.hasOverdueADs || aircraft.hasExpiredMEL)
      return 'border-l-[3px] border-l-red-500';
    if (aircraft.checksDue.some((c) => c.isInOverflight))
      return 'border-l-[3px] border-l-amber-500';
    return 'border-l-[3px] border-l-emerald-500';
  }

  function handleCardClick(aircraft: FleetMaintenanceStatus) {
    setDetailAircraft(aircraft);
    setDetailOpen(true);
  }

  return (
    <div className="space-y-6">
      {/* Search */}
      <div className="relative max-w-sm">
        <MagnifyingGlass size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search registration, type..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="flex gap-0 overflow-hidden">
        {/* Fleet Cards */}
        <div className={`${detailOpen ? 'w-[60%]' : 'w-full'} transition-all duration-200`}>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filtered.length === 0 ? (
              <p className="col-span-full text-center py-10 text-muted-foreground">No aircraft found</p>
            ) : (
              filtered.map((aircraft) => (
                <Card
                  key={aircraft.aircraftId}
                  className={`border-border/50 cursor-pointer hover:bg-[#1f2538] transition-colors ${getCardBorderColor(aircraft)} ${
                    detailAircraft?.aircraftId === aircraft.aircraftId ? 'bg-blue-500/10 ring-1 ring-blue-500/30' : ''
                  }`}
                  onClick={() => handleCardClick(aircraft)}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base font-mono">{aircraft.registration}</CardTitle>
                      <div className="flex items-center gap-2">
                        {(aircraft.hasOverdueChecks || aircraft.hasOverdueADs || aircraft.hasExpiredMEL) && (
                          <Warning size={16} weight="fill" className="text-red-400" />
                        )}
                        {fleetStatusBadge(aircraft.status)}
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground">{aircraft.name} ({aircraft.icaoType})</p>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <p className="text-muted-foreground">Total Hours</p>
                        <p className="font-mono font-medium">{formatHours(aircraft.totalHours)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Total Cycles</p>
                        <p className="font-mono font-medium">{aircraft.totalCycles.toLocaleString()}</p>
                      </div>
                    </div>

                    {/* Check status indicators */}
                    {aircraft.checksDue.length > 0 && (
                      <div className="space-y-1">
                        {aircraft.checksDue.map((check) => (
                          <div key={check.checkType} className="flex items-center justify-between text-xs">
                            <span className="font-medium">{check.checkType}-Check</span>
                            <span className={
                              check.isOverdue
                                ? 'text-red-400 font-medium'
                                : check.isInOverflight
                                ? 'text-amber-400'
                                : 'text-muted-foreground'
                            }>
                              {check.isOverdue
                                ? 'OVERDUE'
                                : check.remainingHours !== null
                                ? `${formatHours(check.remainingHours)} hrs remaining`
                                : '--'}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {aircraft.nextCheckType && (
                      <p className="text-xs text-muted-foreground">
                        Next: {aircraft.nextCheckType}-Check in {formatHours(aircraft.nextCheckDueIn)} hrs
                      </p>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>

        {/* Detail Panel */}
        {detailOpen && detailAircraft && (
          <DetailPanel
            open={detailOpen}
            onClose={() => { setDetailOpen(false); setDetailAircraft(null); }}
            title={detailAircraft.registration}
            subtitle={`${detailAircraft.name} (${detailAircraft.icaoType})`}
            actions={
              <>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={(e) => {
                    e.stopPropagation();
                    setAdjustTarget(detailAircraft);
                    setAdjustHours(detailAircraft.totalHours.toString());
                    setAdjustCycles(detailAircraft.totalCycles.toString());
                  }}
                >
                  <PencilSimple size={12} /> Adjust Hours
                </Button>
                {detailAircraft.status === 'maintenance' && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => handleReturnToService(detailAircraft)}
                  >
                    <ArrowClockwise size={12} /> Return to Service
                  </Button>
                )}
              </>
            }
          >
            <div className="space-y-4">
              <div className="space-y-1">
                <DetailRow label="Status">{fleetStatusBadge(detailAircraft.status)}</DetailRow>
                <DetailRow label="Total Hours"><span className="font-mono">{formatHours(detailAircraft.totalHours)}</span></DetailRow>
                <DetailRow label="Total Cycles"><span className="font-mono">{detailAircraft.totalCycles.toLocaleString()}</span></DetailRow>
              </div>

              {detailAircraft.checksDue.length > 0 && (
                <div>
                  <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Checks Due</h3>
                  <div className="space-y-2">
                    {detailAircraft.checksDue.map((check) => (
                      <div key={check.checkType} className="rounded-md bg-[#141820] p-2.5 border border-border/30">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium">{check.checkType}-Check</span>
                          {check.isOverdue ? (
                            <Badge className="bg-red-500/15 text-red-400 border-red-500/30">Overdue</Badge>
                          ) : check.isInOverflight ? (
                            <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/30">Overflight</Badge>
                          ) : (
                            <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30">OK</Badge>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-1 text-xs text-muted-foreground">
                          {check.remainingHours !== null && (
                            <span>Hrs remaining: <span className="font-mono text-foreground">{formatHours(check.remainingHours)}</span></span>
                          )}
                          {check.remainingCycles !== null && (
                            <span>Cycles remaining: <span className="font-mono text-foreground">{check.remainingCycles}</span></span>
                          )}
                          {check.dueAtDate && (
                            <span>Due by: <span className="text-foreground">{formatDate(check.dueAtDate)}</span></span>
                          )}
                          <span>Overflight: <span className="font-mono text-foreground">{check.overflightPct}%</span></span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {detailAircraft.hasOverdueADs && (
                <div className="rounded-md bg-red-500/10 border border-red-500/30 p-2.5">
                  <p className="text-xs text-red-400 font-medium">Overdue ADs on this aircraft</p>
                </div>
              )}
              {detailAircraft.hasExpiredMEL && (
                <div className="rounded-md bg-red-500/10 border border-red-500/30 p-2.5">
                  <p className="text-xs text-red-400 font-medium">Expired MEL items on this aircraft</p>
                </div>
              )}
            </div>
          </DetailPanel>
        )}
      </div>

      {/* Adjust Hours Dialog */}
      <Dialog open={!!adjustTarget} onOpenChange={(open) => { if (!open) setAdjustTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adjust Hours &mdash; {adjustTarget?.registration}</DialogTitle>
            <DialogDescription>
              Update the total hours and cycles for this aircraft. A reason is required for audit purposes.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Total Hours</Label>
                <Input type="number" step="0.1" value={adjustHours} onChange={(e) => setAdjustHours(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Total Cycles</Label>
                <Input type="number" step="1" value={adjustCycles} onChange={(e) => setAdjustCycles(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Reason *</Label>
              <Textarea
                value={adjustReason}
                onChange={(e) => setAdjustReason(e.target.value)}
                placeholder="Reason for adjustment..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdjustTarget(null)} disabled={adjustLoading}>Cancel</Button>
            <Button onClick={handleAdjustHours} disabled={adjustLoading || !adjustReason.trim()}>
              {adjustLoading ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Tab 2: Maintenance Log
// ═══════════════════════════════════════════════════════════════

function MaintenanceLogTab() {
  const [entries, setEntries] = useState<MaintenanceLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  // Filters
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  // Detail panel
  const [detailEntry, setDetailEntry] = useState<MaintenanceLogEntry | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  // Dialogs
  const [createOpen, setCreateOpen] = useState(false);
  const [editEntry, setEditEntry] = useState<MaintenanceLogEntry | null>(null);
  const [deleteEntry, setDeleteEntry] = useState<MaintenanceLogEntry | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Form state
  const [formAircraftId, setFormAircraftId] = useState('');
  const [formCheckType, setFormCheckType] = useState<MaintenanceLogType>('LINE');
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formPerformedBy, setFormPerformedBy] = useState('');
  const [formStatus, setFormStatus] = useState<MaintenanceLogStatus>('scheduled');
  const [formCost, setFormCost] = useState('');
  const [formLoading, setFormLoading] = useState(false);

  const fetchEntries = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      params.set('page', page.toString());
      params.set('pageSize', pageSize.toString());
      if (typeFilter !== 'all') params.set('checkType', typeFilter);
      if (statusFilter !== 'all') params.set('status', statusFilter);

      const res = await api.get<{ entries: MaintenanceLogEntry[]; total: number; page: number; pageSize: number }>(
        `/api/admin/maintenance/log?${params.toString()}`,
      );
      setEntries(res.entries);
      setTotal(res.total);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to load maintenance log');
    } finally {
      setLoading(false);
    }
  }, [page, typeFilter, statusFilter]);

  useEffect(() => { fetchEntries(); }, [fetchEntries]);

  const filtered = useMemo(() => {
    if (!search) return entries;
    const q = search.toLowerCase();
    return entries.filter(
      (e) =>
        e.title.toLowerCase().includes(q) ||
        (e.aircraftRegistration?.toLowerCase().includes(q) ?? false) ||
        (e.performedBy?.toLowerCase().includes(q) ?? false),
    );
  }, [entries, search]);

  function resetForm() {
    setFormAircraftId('');
    setFormCheckType('LINE');
    setFormTitle('');
    setFormDescription('');
    setFormPerformedBy('');
    setFormStatus('scheduled');
    setFormCost('');
  }

  function openEdit(entry: MaintenanceLogEntry) {
    setEditEntry(entry);
    setFormAircraftId(entry.aircraftId.toString());
    setFormCheckType(entry.checkType);
    setFormTitle(entry.title);
    setFormDescription(entry.description ?? '');
    setFormPerformedBy(entry.performedBy ?? '');
    setFormStatus(entry.status);
    setFormCost(entry.cost?.toString() ?? '');
  }

  async function handleCreate() {
    if (!formAircraftId || !formTitle.trim()) return;
    setFormLoading(true);
    try {
      await api.post('/api/admin/maintenance/log', {
        aircraftId: parseInt(formAircraftId),
        checkType: formCheckType,
        title: formTitle.trim(),
        description: formDescription.trim() || undefined,
        performedBy: formPerformedBy.trim() || undefined,
        status: formStatus,
        cost: formCost ? parseFloat(formCost) : undefined,
      });
      toast.success('Log entry created');
      setCreateOpen(false);
      resetForm();
      fetchEntries();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to create log entry');
    } finally {
      setFormLoading(false);
    }
  }

  async function handleUpdate() {
    if (!editEntry || !formTitle.trim()) return;
    setFormLoading(true);
    try {
      await api.patch(`/api/admin/maintenance/log/${editEntry.id}`, {
        checkType: formCheckType,
        title: formTitle.trim(),
        description: formDescription.trim() || undefined,
        performedBy: formPerformedBy.trim() || undefined,
        status: formStatus,
        cost: formCost ? parseFloat(formCost) : undefined,
      });
      toast.success('Log entry updated');
      setEditEntry(null);
      resetForm();
      fetchEntries();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to update log entry');
    } finally {
      setFormLoading(false);
    }
  }

  async function handleComplete(entry: MaintenanceLogEntry) {
    try {
      await api.post(`/api/admin/maintenance/log/${entry.id}/complete`);
      toast.success('Check marked as completed');
      fetchEntries();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to complete check');
    }
  }

  async function handleDelete() {
    if (!deleteEntry) return;
    setDeleteLoading(true);
    try {
      await api.delete(`/api/admin/maintenance/log/${deleteEntry.id}`);
      toast.success('Log entry deleted');
      setDeleteEntry(null);
      fetchEntries();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to delete log entry');
    } finally {
      setDeleteLoading(false);
    }
  }

  const logTypes: MaintenanceLogType[] = ['A', 'B', 'C', 'D', 'LINE', 'UNSCHEDULED', 'AD', 'MEL', 'SFP'];
  const logStatuses: MaintenanceLogStatus[] = ['scheduled', 'in_progress', 'completed', 'deferred'];

  // Keep detail panel in sync
  useEffect(() => {
    if (detailEntry) {
      const updated = filtered.find((e) => e.id === detailEntry.id);
      if (updated) setDetailEntry(updated);
      else { setDetailEntry(null); setDetailOpen(false); }
    }
  }, [filtered]); // eslint-disable-line react-hooks/exhaustive-deps

  const logColumns: ColumnDef<MaintenanceLogEntry, unknown>[] = useMemo(() => [
    {
      accessorKey: 'createdAt',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Date" />,
      cell: ({ row }) => <span className="text-muted-foreground">{formatDate(row.original.createdAt)}</span>,
      size: 100,
    },
    {
      accessorKey: 'aircraftRegistration',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Aircraft" />,
      cell: ({ row }) => <span className="font-mono">{row.original.aircraftRegistration ?? `#${row.original.aircraftId}`}</span>,
      size: 100,
    },
    {
      accessorKey: 'checkType',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Type" />,
      cell: ({ row }) => <Badge variant="secondary" className="text-xs">{row.original.checkType}</Badge>,
      size: 90,
    },
    {
      accessorKey: 'title',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Title" />,
      cell: ({ row }) => <span className="max-w-[200px] truncate block">{row.original.title}</span>,
    },
    {
      accessorKey: 'performedBy',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Performed By" />,
      cell: ({ row }) => <span className="text-muted-foreground">{row.original.performedBy ?? '--'}</span>,
      size: 120,
    },
    {
      accessorKey: 'cost',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Cost" />,
      cell: ({ row }) => <span className="font-mono">{formatCurrency(row.original.cost)}</span>,
      size: 90,
    },
    {
      accessorKey: 'status',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
      cell: ({ row }) => logStatusBadge(row.original.status),
      size: 110,
    },
    {
      id: 'actions',
      enableHiding: false,
      enableSorting: false,
      size: 50,
      cell: ({ row }) => {
        const entry = row.original;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => e.stopPropagation()}>
                <DotsThreeVertical size={16} weight="bold" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => openEdit(entry)}>
                <PencilSimple size={14} /> Edit
              </DropdownMenuItem>
              {entry.status !== 'completed' && (
                <DropdownMenuItem onClick={() => handleComplete(entry)}>
                  <CheckCircle size={14} className="text-emerald-400" /> Complete
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-red-400 focus:text-red-400" onClick={() => setDeleteEntry(entry)}>
                <Trash size={14} /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ], []);

  function handleLogRowClick(entry: MaintenanceLogEntry) {
    setDetailEntry(entry);
    setDetailOpen(true);
  }

  if (loading) return <TabSkeleton />;

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 items-center gap-3">
          <div className="relative max-w-sm flex-1">
            <MagnifyingGlass size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search entries..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); setPage(1); }}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {logTypes.map((t) => (
                <SelectItem key={t} value={t}>{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              {logStatuses.map((s) => (
                <SelectItem key={s} value={s}>{s.replace('_', ' ')}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={() => { resetForm(); setCreateOpen(true); }}>
          <Plus size={16} weight="bold" />
          Add Entry
        </Button>
      </div>

      {/* Split view: DataTable + detail panel */}
      <div className="flex flex-1 gap-0 overflow-hidden rounded-md border border-border/50">
        <div className={`${detailOpen ? 'w-[55%]' : 'w-full'} flex flex-col transition-all duration-200`}>
          <DataTable
            columns={logColumns}
            data={filtered}
            onRowClick={handleLogRowClick}
            selectedRowId={detailEntry?.id}
            loading={false}
            emptyMessage="No log entries found"
            getRowId={(row) => String(row.id)}
          />
        </div>
        {detailOpen && detailEntry && (
          <DetailPanel
            open={detailOpen}
            onClose={() => { setDetailOpen(false); setDetailEntry(null); }}
            title={detailEntry.title}
            subtitle={`${detailEntry.checkType} -- ${detailEntry.aircraftRegistration ?? `#${detailEntry.aircraftId}`}`}
            actions={
              <>
                <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => openEdit(detailEntry)}>
                  <PencilSimple size={12} /> Edit
                </Button>
                {detailEntry.status !== 'completed' && (
                  <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => handleComplete(detailEntry)}>
                    <CheckCircle size={12} className="text-emerald-400" /> Complete
                  </Button>
                )}
              </>
            }
          >
            <div className="space-y-4">
              <div className="space-y-1">
                <DetailRow label="Status">{logStatusBadge(detailEntry.status)}</DetailRow>
                <DetailRow label="Type"><Badge variant="secondary" className="text-xs">{detailEntry.checkType}</Badge></DetailRow>
                <DetailRow label="Aircraft"><span className="font-mono">{detailEntry.aircraftRegistration ?? `#${detailEntry.aircraftId}`}</span></DetailRow>
                <DetailRow label="Date">{formatDate(detailEntry.createdAt)}</DetailRow>
                <DetailRow label="Performed By">{detailEntry.performedBy ?? '--'}</DetailRow>
                <DetailRow label="Cost"><span className="font-mono">{formatCurrency(detailEntry.cost)}</span></DetailRow>
                {detailEntry.hoursAtCheck !== null && (
                  <DetailRow label="Hours at Check"><span className="font-mono">{formatHours(detailEntry.hoursAtCheck)}</span></DetailRow>
                )}
                {detailEntry.cyclesAtCheck !== null && (
                  <DetailRow label="Cycles at Check"><span className="font-mono">{detailEntry.cyclesAtCheck}</span></DetailRow>
                )}
              </div>
              {detailEntry.description && (
                <div>
                  <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Description</h3>
                  <p className="text-sm whitespace-pre-wrap">{detailEntry.description}</p>
                </div>
              )}
              {detailEntry.sfpDestination && (
                <div className="space-y-1">
                  <DetailRow label="SFP Destination">{detailEntry.sfpDestination}</DetailRow>
                  <DetailRow label="SFP Expiry">{formatDate(detailEntry.sfpExpiry)}</DetailRow>
                </div>
              )}
            </div>
          </DetailPanel>
        )}
      </div>

      {/* Pagination */}
      <DataTablePagination
        page={page}
        pageSize={pageSize}
        total={total}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
      />

      {/* Create / Edit Dialog */}
      <Dialog
        open={createOpen || !!editEntry}
        onOpenChange={(open) => { if (!open) { setCreateOpen(false); setEditEntry(null); resetForm(); } }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editEntry ? 'Edit Log Entry' : 'New Log Entry'}</DialogTitle>
            <DialogDescription>
              {editEntry ? 'Update this maintenance log entry.' : 'Create a new maintenance log entry.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {!editEntry && (
              <div className="space-y-2">
                <Label>Aircraft ID *</Label>
                <Input type="number" value={formAircraftId} onChange={(e) => setFormAircraftId(e.target.value)} placeholder="Aircraft ID" />
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Check Type *</Label>
                <Select value={formCheckType} onValueChange={(v) => setFormCheckType(v as MaintenanceLogType)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {logTypes.map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={formStatus} onValueChange={(v) => setFormStatus(v as MaintenanceLogStatus)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {logStatuses.map((s) => (
                      <SelectItem key={s} value={s}>{s.replace('_', ' ')}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Title *</Label>
              <Input value={formTitle} onChange={(e) => setFormTitle(e.target.value)} placeholder="Maintenance action title" />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea value={formDescription} onChange={(e) => setFormDescription(e.target.value)} rows={3} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Performed By</Label>
                <Input value={formPerformedBy} onChange={(e) => setFormPerformedBy(e.target.value)} placeholder="Technician name" />
              </div>
              <div className="space-y-2">
                <Label>Cost</Label>
                <Input type="number" step="0.01" value={formCost} onChange={(e) => setFormCost(e.target.value)} placeholder="0.00" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setCreateOpen(false); setEditEntry(null); resetForm(); }} disabled={formLoading}>
              Cancel
            </Button>
            <Button onClick={editEntry ? handleUpdate : handleCreate} disabled={formLoading || !formTitle.trim() || (!editEntry && !formAircraftId)}>
              {formLoading ? 'Saving...' : editEntry ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <Dialog open={!!deleteEntry} onOpenChange={(open) => { if (!open) setDeleteEntry(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Log Entry</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &ldquo;{deleteEntry?.title}&rdquo;? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteEntry(null)} disabled={deleteLoading}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleteLoading}>
              {deleteLoading ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Tab 3: Check Schedules
// ═══════════════════════════════════════════════════════════════

function CheckSchedulesTab() {
  const [schedules, setSchedules] = useState<MaintenanceCheckSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Dialogs
  const [createOpen, setCreateOpen] = useState(false);
  const [editSchedule, setEditSchedule] = useState<MaintenanceCheckSchedule | null>(null);
  const [deleteSchedule, setDeleteSchedule] = useState<MaintenanceCheckSchedule | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Form
  const [formIcaoType, setFormIcaoType] = useState('');
  const [formCheckType, setFormCheckType] = useState<MaintenanceCheckType>('A');
  const [formIntervalHours, setFormIntervalHours] = useState('');
  const [formIntervalCycles, setFormIntervalCycles] = useState('');
  const [formIntervalMonths, setFormIntervalMonths] = useState('');
  const [formOverflightPct, setFormOverflightPct] = useState('10');
  const [formEstDuration, setFormEstDuration] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formLoading, setFormLoading] = useState(false);

  const fetchSchedules = useCallback(async () => {
    try {
      const res = await api.get<{ schedules: MaintenanceCheckSchedule[] }>('/api/admin/maintenance/check-schedules');
      setSchedules(res.schedules);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to load check schedules');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSchedules(); }, [fetchSchedules]);

  const filtered = useMemo(() => {
    if (!search) return schedules;
    const q = search.toLowerCase();
    return schedules.filter(
      (s) => s.icaoType.toLowerCase().includes(q) || s.checkType.toLowerCase().includes(q),
    );
  }, [schedules, search]);

  function resetForm() {
    setFormIcaoType('');
    setFormCheckType('A');
    setFormIntervalHours('');
    setFormIntervalCycles('');
    setFormIntervalMonths('');
    setFormOverflightPct('10');
    setFormEstDuration('');
    setFormDescription('');
  }

  function openEdit(s: MaintenanceCheckSchedule) {
    setEditSchedule(s);
    setFormIcaoType(s.icaoType);
    setFormCheckType(s.checkType);
    setFormIntervalHours(s.intervalHours?.toString() ?? '');
    setFormIntervalCycles(s.intervalCycles?.toString() ?? '');
    setFormIntervalMonths(s.intervalMonths?.toString() ?? '');
    setFormOverflightPct(s.overflightPct.toString());
    setFormEstDuration(s.estimatedDurationHours?.toString() ?? '');
    setFormDescription(s.description ?? '');
  }

  async function handleCreate() {
    if (!formIcaoType.trim()) return;
    setFormLoading(true);
    try {
      await api.post('/api/admin/maintenance/check-schedules', {
        icaoType: formIcaoType.trim().toUpperCase(),
        checkType: formCheckType,
        intervalHours: formIntervalHours ? parseFloat(formIntervalHours) : undefined,
        intervalCycles: formIntervalCycles ? parseInt(formIntervalCycles) : undefined,
        intervalMonths: formIntervalMonths ? parseInt(formIntervalMonths) : undefined,
        overflightPct: parseFloat(formOverflightPct) || 10,
        estimatedDurationHours: formEstDuration ? parseFloat(formEstDuration) : undefined,
        description: formDescription.trim() || undefined,
      });
      toast.success('Check schedule created');
      setCreateOpen(false);
      resetForm();
      fetchSchedules();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to create check schedule');
    } finally {
      setFormLoading(false);
    }
  }

  async function handleUpdate() {
    if (!editSchedule) return;
    setFormLoading(true);
    try {
      await api.patch(`/api/admin/maintenance/check-schedules/${editSchedule.id}`, {
        intervalHours: formIntervalHours ? parseFloat(formIntervalHours) : undefined,
        intervalCycles: formIntervalCycles ? parseInt(formIntervalCycles) : undefined,
        intervalMonths: formIntervalMonths ? parseInt(formIntervalMonths) : undefined,
        overflightPct: parseFloat(formOverflightPct) || 10,
        estimatedDurationHours: formEstDuration ? parseFloat(formEstDuration) : undefined,
        description: formDescription.trim() || undefined,
      });
      toast.success('Check schedule updated');
      setEditSchedule(null);
      resetForm();
      fetchSchedules();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to update check schedule');
    } finally {
      setFormLoading(false);
    }
  }

  async function handleDelete() {
    if (!deleteSchedule) return;
    setDeleteLoading(true);
    try {
      await api.delete(`/api/admin/maintenance/check-schedules/${deleteSchedule.id}`);
      toast.success('Check schedule deleted');
      setDeleteSchedule(null);
      fetchSchedules();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to delete check schedule');
    } finally {
      setDeleteLoading(false);
    }
  }

  const checkTypes: MaintenanceCheckType[] = ['A', 'B', 'C', 'D'];

  const scheduleColumns: ColumnDef<MaintenanceCheckSchedule, unknown>[] = useMemo(() => [
    {
      accessorKey: 'icaoType',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Aircraft Type" />,
      cell: ({ row }) => <span className="font-mono font-medium">{row.original.icaoType}</span>,
      size: 110,
    },
    {
      accessorKey: 'checkType',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Check Type" />,
      cell: ({ row }) => <Badge variant="secondary">{row.original.checkType}-Check</Badge>,
      size: 110,
    },
    {
      accessorKey: 'intervalHours',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Interval Hours" />,
      cell: ({ row }) => <span className="font-mono">{formatHours(row.original.intervalHours)}</span>,
    },
    {
      accessorKey: 'intervalCycles',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Interval Cycles" />,
      cell: ({ row }) => <span className="font-mono">{row.original.intervalCycles?.toLocaleString() ?? '--'}</span>,
    },
    {
      accessorKey: 'intervalMonths',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Interval Months" />,
      cell: ({ row }) => <span className="font-mono">{row.original.intervalMonths ?? '--'}</span>,
    },
    {
      accessorKey: 'overflightPct',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Overflight %" />,
      cell: ({ row }) => <span className="font-mono">{row.original.overflightPct}%</span>,
    },
    {
      accessorKey: 'description',
      header: 'Description',
      cell: ({ row }) => <span className="text-muted-foreground max-w-[200px] truncate block">{row.original.description ?? '--'}</span>,
    },
    {
      id: 'actions',
      enableHiding: false,
      enableSorting: false,
      size: 50,
      cell: ({ row }) => {
        const s = row.original;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => e.stopPropagation()}>
                <DotsThreeVertical size={16} weight="bold" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => openEdit(s)}>
                <PencilSimple size={14} /> Edit
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-red-400 focus:text-red-400" onClick={() => setDeleteSchedule(s)}>
                <Trash size={14} /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ], []);

  if (loading) return <TabSkeleton />;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-sm flex-1">
          <MagnifyingGlass size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search by ICAO type or check type..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Button onClick={() => { resetForm(); setCreateOpen(true); }}>
          <Plus size={16} weight="bold" /> Add Schedule
        </Button>
      </div>

      <DataTable
        columns={scheduleColumns}
        data={filtered}
        loading={false}
        emptyMessage="No check schedules found"
        getRowId={(row) => String(row.id)}
      />

      {/* Create / Edit Dialog */}
      <Dialog
        open={createOpen || !!editSchedule}
        onOpenChange={(open) => { if (!open) { setCreateOpen(false); setEditSchedule(null); resetForm(); } }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editSchedule ? 'Edit Check Schedule' : 'New Check Schedule'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>ICAO Type *</Label>
                <Input
                  value={formIcaoType}
                  onChange={(e) => setFormIcaoType(e.target.value)}
                  placeholder="e.g. B738"
                  disabled={!!editSchedule}
                />
              </div>
              <div className="space-y-2">
                <Label>Check Type *</Label>
                <Select value={formCheckType} onValueChange={(v) => setFormCheckType(v as MaintenanceCheckType)} disabled={!!editSchedule}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {checkTypes.map((t) => (
                      <SelectItem key={t} value={t}>{t}-Check</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Interval (hrs)</Label>
                <Input type="number" step="0.1" value={formIntervalHours} onChange={(e) => setFormIntervalHours(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Interval (cycles)</Label>
                <Input type="number" step="1" value={formIntervalCycles} onChange={(e) => setFormIntervalCycles(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Interval (months)</Label>
                <Input type="number" step="1" value={formIntervalMonths} onChange={(e) => setFormIntervalMonths(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Overflight %</Label>
                <Input type="number" step="1" value={formOverflightPct} onChange={(e) => setFormOverflightPct(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Est. Duration (hrs)</Label>
                <Input type="number" step="0.1" value={formEstDuration} onChange={(e) => setFormEstDuration(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea value={formDescription} onChange={(e) => setFormDescription(e.target.value)} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setCreateOpen(false); setEditSchedule(null); resetForm(); }} disabled={formLoading}>
              Cancel
            </Button>
            <Button
              onClick={editSchedule ? handleUpdate : handleCreate}
              disabled={formLoading || (!editSchedule && !formIcaoType.trim())}
            >
              {formLoading ? 'Saving...' : editSchedule ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <Dialog open={!!deleteSchedule} onOpenChange={(open) => { if (!open) setDeleteSchedule(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Check Schedule</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the {deleteSchedule?.checkType}-Check schedule for {deleteSchedule?.icaoType}?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteSchedule(null)} disabled={deleteLoading}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleteLoading}>
              {deleteLoading ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Tab 4: Airworthiness Directives
// ═══════════════════════════════════════════════════════════════

function AirworthinessDirectivesTab() {
  const [directives, setDirectives] = useState<AirworthinessDirective[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Dialogs
  const [createOpen, setCreateOpen] = useState(false);
  const [editAD, setEditAD] = useState<AirworthinessDirective | null>(null);
  const [deleteAD, setDeleteAD] = useState<AirworthinessDirective | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Form
  const [formAircraftId, setFormAircraftId] = useState('');
  const [formAdNumber, setFormAdNumber] = useState('');
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formComplianceStatus, setFormComplianceStatus] = useState<ADComplianceStatus>('open');
  const [formComplianceDate, setFormComplianceDate] = useState('');
  const [formComplianceMethod, setFormComplianceMethod] = useState('');
  const [formRecurringHours, setFormRecurringHours] = useState('');
  const [formNextDueHours, setFormNextDueHours] = useState('');
  const [formNextDueDate, setFormNextDueDate] = useState('');
  const [formLoading, setFormLoading] = useState(false);

  const fetchADs = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      params.set('page', page.toString());
      params.set('pageSize', pageSize.toString());
      if (statusFilter !== 'all') params.set('status', statusFilter);

      const res = await api.get<{ directives: AirworthinessDirective[]; total: number; page: number; pageSize: number }>(
        `/api/admin/maintenance/ads?${params.toString()}`,
      );
      setDirectives(res.directives);
      setTotal(res.total);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to load airworthiness directives');
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter]);

  useEffect(() => { fetchADs(); }, [fetchADs]);

  const filtered = useMemo(() => {
    if (!search) return directives;
    const q = search.toLowerCase();
    return directives.filter(
      (ad) =>
        ad.adNumber.toLowerCase().includes(q) ||
        ad.title.toLowerCase().includes(q) ||
        (ad.aircraftRegistration?.toLowerCase().includes(q) ?? false),
    );
  }, [directives, search]);

  function resetForm() {
    setFormAircraftId('');
    setFormAdNumber('');
    setFormTitle('');
    setFormDescription('');
    setFormComplianceStatus('open');
    setFormComplianceDate('');
    setFormComplianceMethod('');
    setFormRecurringHours('');
    setFormNextDueHours('');
    setFormNextDueDate('');
  }

  function openEdit(ad: AirworthinessDirective) {
    setEditAD(ad);
    setFormAircraftId(ad.aircraftId.toString());
    setFormAdNumber(ad.adNumber);
    setFormTitle(ad.title);
    setFormDescription(ad.description ?? '');
    setFormComplianceStatus(ad.complianceStatus);
    setFormComplianceDate(ad.complianceDate ?? '');
    setFormComplianceMethod(ad.complianceMethod ?? '');
    setFormRecurringHours(ad.recurringIntervalHours?.toString() ?? '');
    setFormNextDueHours(ad.nextDueHours?.toString() ?? '');
    setFormNextDueDate(ad.nextDueDate ?? '');
  }

  async function handleCreate() {
    if (!formAircraftId || !formAdNumber.trim() || !formTitle.trim()) return;
    setFormLoading(true);
    try {
      await api.post('/api/admin/maintenance/ads', {
        aircraftId: parseInt(formAircraftId),
        adNumber: formAdNumber.trim(),
        title: formTitle.trim(),
        description: formDescription.trim() || undefined,
        complianceStatus: formComplianceStatus,
        complianceDate: formComplianceDate || undefined,
        complianceMethod: formComplianceMethod.trim() || undefined,
        recurringIntervalHours: formRecurringHours ? parseFloat(formRecurringHours) : undefined,
        nextDueHours: formNextDueHours ? parseFloat(formNextDueHours) : undefined,
        nextDueDate: formNextDueDate || undefined,
      });
      toast.success('Airworthiness directive created');
      setCreateOpen(false);
      resetForm();
      fetchADs();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to create AD');
    } finally {
      setFormLoading(false);
    }
  }

  async function handleUpdate() {
    if (!editAD) return;
    setFormLoading(true);
    try {
      await api.patch(`/api/admin/maintenance/ads/${editAD.id}`, {
        adNumber: formAdNumber.trim(),
        title: formTitle.trim(),
        description: formDescription.trim() || undefined,
        complianceStatus: formComplianceStatus,
        complianceDate: formComplianceDate || undefined,
        complianceMethod: formComplianceMethod.trim() || undefined,
        recurringIntervalHours: formRecurringHours ? parseFloat(formRecurringHours) : undefined,
        nextDueHours: formNextDueHours ? parseFloat(formNextDueHours) : undefined,
        nextDueDate: formNextDueDate || undefined,
      });
      toast.success('Airworthiness directive updated');
      setEditAD(null);
      resetForm();
      fetchADs();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to update AD');
    } finally {
      setFormLoading(false);
    }
  }

  async function handleDelete() {
    if (!deleteAD) return;
    setDeleteLoading(true);
    try {
      await api.delete(`/api/admin/maintenance/ads/${deleteAD.id}`);
      toast.success('Airworthiness directive deleted');
      setDeleteAD(null);
      fetchADs();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to delete AD');
    } finally {
      setDeleteLoading(false);
    }
  }

  const adStatuses: ADComplianceStatus[] = ['open', 'complied', 'recurring', 'not_applicable'];

  const adColumns: ColumnDef<AirworthinessDirective, unknown>[] = useMemo(() => [
    {
      accessorKey: 'adNumber',
      header: ({ column }) => <DataTableColumnHeader column={column} title="AD Number" />,
      cell: ({ row }) => <span className="font-mono font-medium">{row.original.adNumber}</span>,
      size: 120,
    },
    {
      accessorKey: 'aircraftRegistration',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Aircraft" />,
      cell: ({ row }) => <span className="font-mono">{row.original.aircraftRegistration ?? `#${row.original.aircraftId}`}</span>,
      size: 100,
    },
    {
      accessorKey: 'title',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Title" />,
      cell: ({ row }) => <span className="max-w-[200px] truncate block">{row.original.title}</span>,
    },
    {
      accessorKey: 'complianceStatus',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
      cell: ({ row }) => adStatusBadge(row.original.complianceStatus),
      size: 110,
    },
    {
      accessorKey: 'complianceDate',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Compliance Date" />,
      cell: ({ row }) => <span className="text-muted-foreground">{formatDate(row.original.complianceDate)}</span>,
      size: 120,
    },
    {
      accessorKey: 'nextDueDate',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Next Due" />,
      cell: ({ row }) => <span className="text-muted-foreground">{formatDate(row.original.nextDueDate)}</span>,
      size: 100,
    },
    {
      id: 'actions',
      enableHiding: false,
      enableSorting: false,
      size: 50,
      cell: ({ row }) => {
        const ad = row.original;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => e.stopPropagation()}>
                <DotsThreeVertical size={16} weight="bold" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => openEdit(ad)}>
                <PencilSimple size={14} /> Edit
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-red-400 focus:text-red-400" onClick={() => setDeleteAD(ad)}>
                <Trash size={14} /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ], []);

  if (loading) return <TabSkeleton />;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 items-center gap-3">
          <div className="relative max-w-sm flex-1">
            <MagnifyingGlass size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search AD number, title, aircraft..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              {adStatuses.map((s) => (
                <SelectItem key={s} value={s}>{s.replace('_', ' ')}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={() => { resetForm(); setCreateOpen(true); }}>
          <Plus size={16} weight="bold" /> Add AD
        </Button>
      </div>

      <DataTable
        columns={adColumns}
        data={filtered}
        loading={false}
        emptyMessage="No airworthiness directives found"
        getRowId={(row) => String(row.id)}
      />

      <DataTablePagination
        page={page}
        pageSize={pageSize}
        total={total}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
      />

      {/* Create / Edit Dialog */}
      <Dialog
        open={createOpen || !!editAD}
        onOpenChange={(open) => { if (!open) { setCreateOpen(false); setEditAD(null); resetForm(); } }}
      >
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editAD ? 'Edit Airworthiness Directive' : 'New Airworthiness Directive'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {!editAD && (
              <div className="space-y-2">
                <Label>Aircraft ID *</Label>
                <Input type="number" value={formAircraftId} onChange={(e) => setFormAircraftId(e.target.value)} />
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>AD Number *</Label>
                <Input value={formAdNumber} onChange={(e) => setFormAdNumber(e.target.value)} placeholder="e.g. 2024-0123" />
              </div>
              <div className="space-y-2">
                <Label>Compliance Status</Label>
                <Select value={formComplianceStatus} onValueChange={(v) => setFormComplianceStatus(v as ADComplianceStatus)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {adStatuses.map((s) => (
                      <SelectItem key={s} value={s}>{s.replace('_', ' ')}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Title *</Label>
              <Input value={formTitle} onChange={(e) => setFormTitle(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea value={formDescription} onChange={(e) => setFormDescription(e.target.value)} rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Compliance Date</Label>
                <Input type="date" value={formComplianceDate} onChange={(e) => setFormComplianceDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Compliance Method</Label>
                <Input value={formComplianceMethod} onChange={(e) => setFormComplianceMethod(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Recurring (hrs)</Label>
                <Input type="number" value={formRecurringHours} onChange={(e) => setFormRecurringHours(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Next Due (hrs)</Label>
                <Input type="number" value={formNextDueHours} onChange={(e) => setFormNextDueHours(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Next Due Date</Label>
                <Input type="date" value={formNextDueDate} onChange={(e) => setFormNextDueDate(e.target.value)} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setCreateOpen(false); setEditAD(null); resetForm(); }} disabled={formLoading}>
              Cancel
            </Button>
            <Button
              onClick={editAD ? handleUpdate : handleCreate}
              disabled={formLoading || !formTitle.trim() || !formAdNumber.trim() || (!editAD && !formAircraftId)}
            >
              {formLoading ? 'Saving...' : editAD ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <Dialog open={!!deleteAD} onOpenChange={(open) => { if (!open) setDeleteAD(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Airworthiness Directive</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete AD {deleteAD?.adNumber}? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteAD(null)} disabled={deleteLoading}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleteLoading}>
              {deleteLoading ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Tab 5: MEL Deferrals
// ═══════════════════════════════════════════════════════════════

function MELDeferralsTab() {
  const [deferrals, setDeferrals] = useState<MELDeferral[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');

  // Dialogs
  const [createOpen, setCreateOpen] = useState(false);
  const [editMEL, setEditMEL] = useState<MELDeferral | null>(null);
  const [deleteMEL, setDeleteMEL] = useState<MELDeferral | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Form
  const [formAircraftId, setFormAircraftId] = useState('');
  const [formItemNumber, setFormItemNumber] = useState('');
  const [formTitle, setFormTitle] = useState('');
  const [formCategory, setFormCategory] = useState<MELCategory>('C');
  const [formDeferralDate, setFormDeferralDate] = useState('');
  const [formExpiryDate, setFormExpiryDate] = useState('');
  const [formStatus, setFormStatus] = useState<MELStatus>('open');
  const [formRectifiedDate, setFormRectifiedDate] = useState('');
  const [formRemarks, setFormRemarks] = useState('');
  const [formLoading, setFormLoading] = useState(false);

  const fetchMEL = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      params.set('page', page.toString());
      params.set('pageSize', pageSize.toString());
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (categoryFilter !== 'all') params.set('category', categoryFilter);

      const res = await api.get<{ deferrals: MELDeferral[]; total: number; page: number; pageSize: number }>(
        `/api/admin/maintenance/mel?${params.toString()}`,
      );
      setDeferrals(res.deferrals);
      setTotal(res.total);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to load MEL deferrals');
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, categoryFilter]);

  useEffect(() => { fetchMEL(); }, [fetchMEL]);

  const filtered = useMemo(() => {
    if (!search) return deferrals;
    const q = search.toLowerCase();
    return deferrals.filter(
      (m) =>
        m.itemNumber.toLowerCase().includes(q) ||
        m.title.toLowerCase().includes(q) ||
        (m.aircraftRegistration?.toLowerCase().includes(q) ?? false),
    );
  }, [deferrals, search]);

  function resetForm() {
    setFormAircraftId('');
    setFormItemNumber('');
    setFormTitle('');
    setFormCategory('C');
    setFormDeferralDate('');
    setFormExpiryDate('');
    setFormStatus('open');
    setFormRectifiedDate('');
    setFormRemarks('');
  }

  function openEdit(mel: MELDeferral) {
    setEditMEL(mel);
    setFormAircraftId(mel.aircraftId.toString());
    setFormItemNumber(mel.itemNumber);
    setFormTitle(mel.title);
    setFormCategory(mel.category);
    setFormDeferralDate(mel.deferralDate);
    setFormExpiryDate(mel.expiryDate);
    setFormStatus(mel.status);
    setFormRectifiedDate(mel.rectifiedDate ?? '');
    setFormRemarks(mel.remarks ?? '');
  }

  async function handleCreate() {
    if (!formAircraftId || !formItemNumber.trim() || !formTitle.trim() || !formDeferralDate || !formExpiryDate) return;
    setFormLoading(true);
    try {
      await api.post('/api/admin/maintenance/mel', {
        aircraftId: parseInt(formAircraftId),
        itemNumber: formItemNumber.trim(),
        title: formTitle.trim(),
        category: formCategory,
        deferralDate: formDeferralDate,
        expiryDate: formExpiryDate,
        remarks: formRemarks.trim() || undefined,
      });
      toast.success('MEL deferral created');
      setCreateOpen(false);
      resetForm();
      fetchMEL();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to create MEL deferral');
    } finally {
      setFormLoading(false);
    }
  }

  async function handleUpdate() {
    if (!editMEL) return;
    setFormLoading(true);
    try {
      await api.patch(`/api/admin/maintenance/mel/${editMEL.id}`, {
        itemNumber: formItemNumber.trim(),
        title: formTitle.trim(),
        category: formCategory,
        deferralDate: formDeferralDate,
        expiryDate: formExpiryDate,
        status: formStatus,
        rectifiedDate: formRectifiedDate || undefined,
        remarks: formRemarks.trim() || undefined,
      });
      toast.success('MEL deferral updated');
      setEditMEL(null);
      resetForm();
      fetchMEL();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to update MEL deferral');
    } finally {
      setFormLoading(false);
    }
  }

  async function handleRectify(mel: MELDeferral) {
    try {
      await api.patch(`/api/admin/maintenance/mel/${mel.id}`, {
        status: 'rectified',
        rectifiedDate: new Date().toISOString().split('T')[0],
      });
      toast.success(`MEL ${mel.itemNumber} rectified`);
      fetchMEL();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to rectify MEL');
    }
  }

  async function handleDelete() {
    if (!deleteMEL) return;
    setDeleteLoading(true);
    try {
      await api.delete(`/api/admin/maintenance/mel/${deleteMEL.id}`);
      toast.success('MEL deferral deleted');
      setDeleteMEL(null);
      fetchMEL();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to delete MEL deferral');
    } finally {
      setDeleteLoading(false);
    }
  }

  const melCategories: MELCategory[] = ['A', 'B', 'C', 'D'];
  const melStatuses: MELStatus[] = ['open', 'rectified', 'expired'];

  const melColumns: ColumnDef<MELDeferral, unknown>[] = useMemo(() => [
    {
      accessorKey: 'itemNumber',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Item #" />,
      cell: ({ row }) => <span className="font-mono font-medium">{row.original.itemNumber}</span>,
      size: 100,
    },
    {
      accessorKey: 'aircraftRegistration',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Aircraft" />,
      cell: ({ row }) => <span className="font-mono">{row.original.aircraftRegistration ?? `#${row.original.aircraftId}`}</span>,
      size: 100,
    },
    {
      accessorKey: 'title',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Title" />,
      cell: ({ row }) => <span className="max-w-[200px] truncate block">{row.original.title}</span>,
    },
    {
      accessorKey: 'category',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Category" />,
      cell: ({ row }) => <Badge variant="secondary">Cat {row.original.category}</Badge>,
      size: 90,
    },
    {
      accessorKey: 'deferralDate',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Deferral Date" />,
      cell: ({ row }) => <span className="text-muted-foreground">{formatDate(row.original.deferralDate)}</span>,
      size: 110,
    },
    {
      accessorKey: 'expiryDate',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Expiry Date" />,
      cell: ({ row }) => <span className="text-muted-foreground">{formatDate(row.original.expiryDate)}</span>,
      size: 110,
    },
    {
      accessorKey: 'status',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
      cell: ({ row }) => melStatusBadge(row.original.status),
      size: 100,
    },
    {
      id: 'actions',
      enableHiding: false,
      enableSorting: false,
      size: 50,
      cell: ({ row }) => {
        const mel = row.original;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => e.stopPropagation()}>
                <DotsThreeVertical size={16} weight="bold" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => openEdit(mel)}>
                <PencilSimple size={14} /> Edit
              </DropdownMenuItem>
              {mel.status === 'open' && (
                <DropdownMenuItem onClick={() => handleRectify(mel)}>
                  <CheckCircle size={14} className="text-emerald-400" /> Rectify
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-red-400 focus:text-red-400" onClick={() => setDeleteMEL(mel)}>
                <Trash size={14} /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ], []);

  if (loading) return <TabSkeleton />;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 items-center gap-3">
          <div className="relative max-w-sm flex-1">
            <MagnifyingGlass size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search item, title, aircraft..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={categoryFilter} onValueChange={(v) => { setCategoryFilter(v); setPage(1); }}>
            <SelectTrigger className="w-[130px]">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {melCategories.map((c) => (
                <SelectItem key={c} value={c}>Category {c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
            <SelectTrigger className="w-[130px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              {melStatuses.map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={() => { resetForm(); setCreateOpen(true); }}>
          <Plus size={16} weight="bold" /> Add Deferral
        </Button>
      </div>

      <DataTable
        columns={melColumns}
        data={filtered}
        loading={false}
        emptyMessage="No MEL deferrals found"
        getRowId={(row) => String(row.id)}
      />

      <DataTablePagination
        page={page}
        pageSize={pageSize}
        total={total}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
      />

      {/* Create / Edit Dialog */}
      <Dialog
        open={createOpen || !!editMEL}
        onOpenChange={(open) => { if (!open) { setCreateOpen(false); setEditMEL(null); resetForm(); } }}
      >
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editMEL ? 'Edit MEL Deferral' : 'New MEL Deferral'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {!editMEL && (
              <div className="space-y-2">
                <Label>Aircraft ID *</Label>
                <Input type="number" value={formAircraftId} onChange={(e) => setFormAircraftId(e.target.value)} />
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Item Number *</Label>
                <Input value={formItemNumber} onChange={(e) => setFormItemNumber(e.target.value)} placeholder="e.g. 28-01" />
              </div>
              <div className="space-y-2">
                <Label>Category *</Label>
                <Select value={formCategory} onValueChange={(v) => setFormCategory(v as MELCategory)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {melCategories.map((c) => (
                      <SelectItem key={c} value={c}>Category {c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Title *</Label>
              <Input value={formTitle} onChange={(e) => setFormTitle(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Deferral Date *</Label>
                <Input type="date" value={formDeferralDate} onChange={(e) => setFormDeferralDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Expiry Date *</Label>
                <Input type="date" value={formExpiryDate} onChange={(e) => setFormExpiryDate(e.target.value)} />
              </div>
            </div>
            {editMEL && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={formStatus} onValueChange={(v) => setFormStatus(v as MELStatus)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {melStatuses.map((s) => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Rectified Date</Label>
                  <Input type="date" value={formRectifiedDate} onChange={(e) => setFormRectifiedDate(e.target.value)} />
                </div>
              </div>
            )}
            <div className="space-y-2">
              <Label>Remarks</Label>
              <Textarea value={formRemarks} onChange={(e) => setFormRemarks(e.target.value)} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setCreateOpen(false); setEditMEL(null); resetForm(); }} disabled={formLoading}>
              Cancel
            </Button>
            <Button
              onClick={editMEL ? handleUpdate : handleCreate}
              disabled={
                formLoading ||
                !formTitle.trim() ||
                !formItemNumber.trim() ||
                !formDeferralDate ||
                !formExpiryDate ||
                (!editMEL && !formAircraftId)
              }
            >
              {formLoading ? 'Saving...' : editMEL ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <Dialog open={!!deleteMEL} onOpenChange={(open) => { if (!open) setDeleteMEL(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete MEL Deferral</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete MEL item {deleteMEL?.itemNumber}? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteMEL(null)} disabled={deleteLoading}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleteLoading}>
              {deleteLoading ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Tab 6: Components
// ═══════════════════════════════════════════════════════════════

function ComponentsTab() {
  const [components, setComponents] = useState<AircraftComponent[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  // Dialogs
  const [createOpen, setCreateOpen] = useState(false);
  const [editComp, setEditComp] = useState<AircraftComponent | null>(null);
  const [deleteComp, setDeleteComp] = useState<AircraftComponent | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Form
  const [formAircraftId, setFormAircraftId] = useState('');
  const [formCompType, setFormCompType] = useState<ComponentType>('ENGINE');
  const [formPosition, setFormPosition] = useState('');
  const [formSerial, setFormSerial] = useState('');
  const [formPartNumber, setFormPartNumber] = useState('');
  const [formHSN, setFormHSN] = useState('0');
  const [formCSN, setFormCSN] = useState('0');
  const [formHSO, setFormHSO] = useState('0');
  const [formCSO, setFormCSO] = useState('0');
  const [formOvhInterval, setFormOvhInterval] = useState('');
  const [formInstalledDate, setFormInstalledDate] = useState('');
  const [formStatus, setFormStatus] = useState<ComponentStatus>('installed');
  const [formRemarks, setFormRemarks] = useState('');
  const [formLoading, setFormLoading] = useState(false);

  const fetchComponents = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (typeFilter !== 'all') params.set('componentType', typeFilter);
      if (statusFilter !== 'all') params.set('status', statusFilter);

      const res = await api.get<{ components: AircraftComponent[] }>(
        `/api/admin/maintenance/components?${params.toString()}`,
      );
      setComponents(res.components);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to load components');
    } finally {
      setLoading(false);
    }
  }, [typeFilter, statusFilter]);

  useEffect(() => { fetchComponents(); }, [fetchComponents]);

  const filtered = useMemo(() => {
    if (!search) return components;
    const q = search.toLowerCase();
    return components.filter(
      (c) =>
        (c.partNumber?.toLowerCase().includes(q) ?? false) ||
        (c.serialNumber?.toLowerCase().includes(q) ?? false) ||
        c.componentType.toLowerCase().includes(q) ||
        (c.aircraftRegistration?.toLowerCase().includes(q) ?? false) ||
        (c.position?.toLowerCase().includes(q) ?? false),
    );
  }, [components, search]);

  function resetForm() {
    setFormAircraftId('');
    setFormCompType('ENGINE');
    setFormPosition('');
    setFormSerial('');
    setFormPartNumber('');
    setFormHSN('0');
    setFormCSN('0');
    setFormHSO('0');
    setFormCSO('0');
    setFormOvhInterval('');
    setFormInstalledDate('');
    setFormStatus('installed');
    setFormRemarks('');
  }

  function openEdit(c: AircraftComponent) {
    setEditComp(c);
    setFormAircraftId(c.aircraftId.toString());
    setFormCompType(c.componentType);
    setFormPosition(c.position ?? '');
    setFormSerial(c.serialNumber ?? '');
    setFormPartNumber(c.partNumber ?? '');
    setFormHSN(c.hoursSinceNew.toString());
    setFormCSN(c.cyclesSinceNew.toString());
    setFormHSO(c.hoursSinceOverhaul.toString());
    setFormCSO(c.cyclesSinceOverhaul.toString());
    setFormOvhInterval(c.overhaulIntervalHours?.toString() ?? '');
    setFormInstalledDate(c.installedDate ?? '');
    setFormStatus(c.status);
    setFormRemarks(c.remarks ?? '');
  }

  async function handleCreate() {
    if (!formAircraftId) return;
    setFormLoading(true);
    try {
      await api.post('/api/admin/maintenance/components', {
        aircraftId: parseInt(formAircraftId),
        componentType: formCompType,
        position: formPosition.trim() || undefined,
        serialNumber: formSerial.trim() || undefined,
        partNumber: formPartNumber.trim() || undefined,
        hoursSinceNew: parseFloat(formHSN) || 0,
        cyclesSinceNew: parseInt(formCSN) || 0,
        hoursSinceOverhaul: parseFloat(formHSO) || 0,
        cyclesSinceOverhaul: parseInt(formCSO) || 0,
        overhaulIntervalHours: formOvhInterval ? parseFloat(formOvhInterval) : undefined,
        installedDate: formInstalledDate || undefined,
        status: formStatus,
        remarks: formRemarks.trim() || undefined,
      });
      toast.success('Component created');
      setCreateOpen(false);
      resetForm();
      fetchComponents();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to create component');
    } finally {
      setFormLoading(false);
    }
  }

  async function handleUpdate() {
    if (!editComp) return;
    setFormLoading(true);
    try {
      await api.patch(`/api/admin/maintenance/components/${editComp.id}`, {
        componentType: formCompType,
        position: formPosition.trim() || undefined,
        serialNumber: formSerial.trim() || undefined,
        partNumber: formPartNumber.trim() || undefined,
        hoursSinceNew: parseFloat(formHSN) || 0,
        cyclesSinceNew: parseInt(formCSN) || 0,
        hoursSinceOverhaul: parseFloat(formHSO) || 0,
        cyclesSinceOverhaul: parseInt(formCSO) || 0,
        overhaulIntervalHours: formOvhInterval ? parseFloat(formOvhInterval) : undefined,
        installedDate: formInstalledDate || undefined,
        status: formStatus,
        remarks: formRemarks.trim() || undefined,
      });
      toast.success('Component updated');
      setEditComp(null);
      resetForm();
      fetchComponents();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to update component');
    } finally {
      setFormLoading(false);
    }
  }

  async function handleDelete() {
    if (!deleteComp) return;
    setDeleteLoading(true);
    try {
      await api.delete(`/api/admin/maintenance/components/${deleteComp.id}`);
      toast.success('Component deleted');
      setDeleteComp(null);
      fetchComponents();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to delete component');
    } finally {
      setDeleteLoading(false);
    }
  }

  const componentTypes: ComponentType[] = ['ENGINE', 'APU', 'LANDING_GEAR', 'PROP', 'AVIONICS', 'OTHER'];
  const componentStatuses: ComponentStatus[] = ['installed', 'removed', 'in_shop', 'scrapped'];

  function remainingHours(c: AircraftComponent): string {
    if (!c.overhaulIntervalHours) return '--';
    const remaining = c.overhaulIntervalHours - c.hoursSinceOverhaul;
    return formatHours(remaining);
  }

  if (loading) return <TabSkeleton />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 items-center gap-3">
          <div className="relative max-w-sm flex-1">
            <MagnifyingGlass size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search part, serial, aircraft..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {componentTypes.map((t) => (
                <SelectItem key={t} value={t}>{t.replace('_', ' ')}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[130px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              {componentStatuses.map((s) => (
                <SelectItem key={s} value={s}>{s.replace('_', ' ')}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={() => { resetForm(); setCreateOpen(true); }}>
          <Plus size={16} weight="bold" /> Add Component
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[100px]">Part #</TableHead>
              <TableHead className="w-[100px]">Serial #</TableHead>
              <TableHead className="w-[120px]">Type</TableHead>
              <TableHead className="w-[100px]">Aircraft</TableHead>
              <TableHead>Position</TableHead>
              <TableHead className="w-[100px]">HSO</TableHead>
              <TableHead className="w-[100px]">Remaining</TableHead>
              <TableHead className="w-[100px]">Status</TableHead>
              <TableHead className="w-[50px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-10 text-muted-foreground">
                  No components found
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((comp) => (
                <TableRow key={comp.id}>
                  <TableCell className="font-mono text-sm">{comp.partNumber ?? '--'}</TableCell>
                  <TableCell className="font-mono text-sm">{comp.serialNumber ?? '--'}</TableCell>
                  <TableCell><Badge variant="secondary" className="text-xs">{comp.componentType.replace('_', ' ')}</Badge></TableCell>
                  <TableCell className="font-mono text-sm">{comp.aircraftRegistration ?? `#${comp.aircraftId}`}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{comp.position ?? '--'}</TableCell>
                  <TableCell className="font-mono text-sm">{formatHours(comp.hoursSinceOverhaul)}</TableCell>
                  <TableCell className="font-mono text-sm">{remainingHours(comp)}</TableCell>
                  <TableCell>{componentStatusBadge(comp.status)}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <DotsThreeVertical size={16} weight="bold" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEdit(comp)}>
                          <PencilSimple size={14} /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-red-400 focus:text-red-400" onClick={() => setDeleteComp(comp)}>
                          <Trash size={14} /> Delete
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

      {/* Create / Edit Dialog */}
      <Dialog
        open={createOpen || !!editComp}
        onOpenChange={(open) => { if (!open) { setCreateOpen(false); setEditComp(null); resetForm(); } }}
      >
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editComp ? 'Edit Component' : 'New Component'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {!editComp && (
              <div className="space-y-2">
                <Label>Aircraft ID *</Label>
                <Input type="number" value={formAircraftId} onChange={(e) => setFormAircraftId(e.target.value)} />
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Component Type *</Label>
                <Select value={formCompType} onValueChange={(v) => setFormCompType(v as ComponentType)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {componentTypes.map((t) => (
                      <SelectItem key={t} value={t}>{t.replace('_', ' ')}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={formStatus} onValueChange={(v) => setFormStatus(v as ComponentStatus)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {componentStatuses.map((s) => (
                      <SelectItem key={s} value={s}>{s.replace('_', ' ')}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Part Number</Label>
                <Input value={formPartNumber} onChange={(e) => setFormPartNumber(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Serial Number</Label>
                <Input value={formSerial} onChange={(e) => setFormSerial(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Position</Label>
              <Input value={formPosition} onChange={(e) => setFormPosition(e.target.value)} placeholder="e.g. Left Engine, Nose Gear" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Hours Since New</Label>
                <Input type="number" step="0.1" value={formHSN} onChange={(e) => setFormHSN(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Cycles Since New</Label>
                <Input type="number" step="1" value={formCSN} onChange={(e) => setFormCSN(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Hours Since Overhaul</Label>
                <Input type="number" step="0.1" value={formHSO} onChange={(e) => setFormHSO(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Cycles Since Overhaul</Label>
                <Input type="number" step="1" value={formCSO} onChange={(e) => setFormCSO(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Overhaul Interval (hrs)</Label>
                <Input type="number" step="0.1" value={formOvhInterval} onChange={(e) => setFormOvhInterval(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Installed Date</Label>
                <Input type="date" value={formInstalledDate} onChange={(e) => setFormInstalledDate(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Remarks</Label>
              <Textarea value={formRemarks} onChange={(e) => setFormRemarks(e.target.value)} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setCreateOpen(false); setEditComp(null); resetForm(); }} disabled={formLoading}>
              Cancel
            </Button>
            <Button
              onClick={editComp ? handleUpdate : handleCreate}
              disabled={formLoading || (!editComp && !formAircraftId)}
            >
              {formLoading ? 'Saving...' : editComp ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <Dialog open={!!deleteComp} onOpenChange={(open) => { if (!open) setDeleteComp(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Component</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {deleteComp?.componentType} {deleteComp?.partNumber ?? deleteComp?.serialNumber ?? `#${deleteComp?.id}`}? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteComp(null)} disabled={deleteLoading}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleteLoading}>
              {deleteLoading ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Main Page
// ═══════════════════════════════════════════════════════════════

export function MaintenancePage() {
  const [activeTab, setActiveTab] = useState('fleet');

  // Track which tabs have been visited to enable lazy loading
  const [visited, setVisited] = useState<Set<string>>(new Set(['fleet']));

  function handleTabChange(value: string) {
    setActiveTab(value);
    setVisited((prev) => {
      if (prev.has(value)) return prev;
      const next = new Set(prev);
      next.add(value);
      return next;
    });
  }

  return (
    <PageShell
      title="Maintenance"
      subtitle="Fleet maintenance and compliance"
    >
      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList className="mb-6 flex-wrap h-auto gap-1">
          <TabsTrigger value="fleet" className="gap-1.5">
            <Airplane size={14} /> Fleet Status
          </TabsTrigger>
          <TabsTrigger value="log" className="gap-1.5">
            <Wrench size={14} /> Maintenance Log
          </TabsTrigger>
          <TabsTrigger value="checks" className="gap-1.5">
            <CalendarCheck size={14} /> Check Schedules
          </TabsTrigger>
          <TabsTrigger value="ads" className="gap-1.5">
            <ShieldWarning size={14} /> ADs
          </TabsTrigger>
          <TabsTrigger value="mel" className="gap-1.5">
            <ListChecks size={14} /> MEL
          </TabsTrigger>
          <TabsTrigger value="components" className="gap-1.5">
            <GearSix size={14} /> Components
          </TabsTrigger>
        </TabsList>

        <TabsContent value="fleet">
          {visited.has('fleet') && <FleetStatusTab />}
        </TabsContent>
        <TabsContent value="log">
          {visited.has('log') && <MaintenanceLogTab />}
        </TabsContent>
        <TabsContent value="checks">
          {visited.has('checks') && <CheckSchedulesTab />}
        </TabsContent>
        <TabsContent value="ads">
          {visited.has('ads') && <AirworthinessDirectivesTab />}
        </TabsContent>
        <TabsContent value="mel">
          {visited.has('mel') && <MELDeferralsTab />}
        </TabsContent>
        <TabsContent value="components">
          {visited.has('components') && <ComponentsTab />}
        </TabsContent>
      </Tabs>
    </PageShell>
  );
}
