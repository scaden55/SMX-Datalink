import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  Wrench,
  Search,
  Pencil,
  MoreVertical,
  RotateCw,
  AlertTriangle,
  BookOpen,
} from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { toast } from '@/stores/toastStore';
import { pageVariants, fadeUp, tableContainer, tableRow } from '@/lib/motion';
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
import { DetailPanel } from '@/components/shared/DetailPanel';
import { SectionHeader, DataRow } from '@/components/primitives';
import { ComplianceTab } from '@/pages/maintenance/ComplianceTab';
import { DiscrepanciesTab } from '@/pages/maintenance/DiscrepanciesTab';
import { MelDeferralsTab } from '@/pages/maintenance/MelDeferralsTab';
import { AircraftLogbook } from '@/pages/maintenance/AircraftLogbook';
import { ConfigurationTab } from '@/pages/maintenance/ConfigurationTab';

// ── Types (mirroring @acars/shared) ──────────────────────────

type MaintenanceCheckType = 'A' | 'B' | 'C' | 'D';
type MaintenanceLogType = 'A' | 'B' | 'C' | 'D' | 'LINE' | 'UNSCHEDULED' | 'AD' | 'MEL' | 'SFP';

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
  openDiscrepancies: number;
  activeMELs: number;
  nextCheckType: string | null;
  nextCheckDueIn: number | null;
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

// ── Badge Component ─────────────────────────────────────────

function TypeBadge({ type }: { type: MaintenanceLogType }) {
  const config: Record<string, { bg: string; text: string; label: string }> = {
    A: { bg: 'var(--accent-blue-bg)', text: 'var(--accent-blue-bright)', label: 'A Check' },
    B: { bg: 'var(--accent-emerald-bg)', text: 'var(--accent-emerald)', label: 'B Check' },
    C: { bg: 'var(--accent-amber-bg)', text: 'var(--accent-amber)', label: 'C Check' },
    D: { bg: 'var(--accent-red-bg)', text: 'var(--accent-red)', label: 'D Check' },
    LINE: { bg: 'var(--accent-cyan-bg)', text: 'var(--accent-cyan)', label: 'Line' },
    UNSCHEDULED: { bg: 'var(--accent-red-bg)', text: 'var(--accent-red)', label: 'Unscheduled' },
    AD: { bg: 'var(--accent-amber-bg)', text: 'var(--accent-amber)', label: 'AD' },
    MEL: { bg: 'var(--accent-blue-bg)', text: 'var(--accent-blue-bright)', label: 'MEL' },
    SFP: { bg: 'var(--accent-cyan-bg)', text: 'var(--accent-cyan)', label: 'SFP' },
  };
  const c = config[type] ?? { bg: 'var(--surface-2)', text: 'var(--text-secondary)', label: type };
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
      {c.label}
    </span>
  );
}

function StatusBadgeInline({ status }: { status: string }) {
  const normalized = status.toLowerCase().replace(/_/g, ' ');
  let bg = 'var(--surface-2)';
  let text = 'var(--text-secondary)';

  if (normalized === 'completed' || normalized === 'active' || normalized === 'ok') {
    bg = 'var(--accent-emerald-bg)';
    text = 'var(--accent-emerald)';
  } else if (normalized === 'overdue' || normalized === 'critical' || normalized === 'expired') {
    bg = 'var(--accent-red-bg)';
    text = 'var(--accent-red)';
  } else if (normalized === 'scheduled' || normalized === 'open' || normalized === 'complied') {
    bg = 'var(--accent-blue-bg)';
    text = 'var(--accent-blue-bright)';
  } else if (normalized === 'in progress' || normalized === 'in_progress' || normalized === 'deferred' || normalized === 'maintenance' || normalized === 'warning') {
    bg = 'var(--accent-amber-bg)';
    text = 'var(--accent-amber)';
  }

  const label = normalized.charAt(0).toUpperCase() + normalized.slice(1);

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

// ── Column Header Style ──────────────────────────────────────

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

// (AircraftDetailPanel content is rendered inside the shared DetailPanel below)

// ═══════════════════════════════════════════════════════════════
// Fleet Status Tab Content
// ═══════════════════════════════════════════════════════════════

function FleetStatusContent() {
  const [fleet, setFleet] = useState<FleetMaintenanceStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedAircraft, setSelectedAircraft] = useState<FleetMaintenanceStatus | null>(null);
  const [logbookAircraftId, setLogbookAircraftId] = useState<number | null>(null);

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
    let list = fleet;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (a) =>
          a.registration.toLowerCase().includes(q) ||
          a.icaoType.toLowerCase().includes(q) ||
          a.name.toLowerCase().includes(q),
      );
    }
    if (statusFilter !== 'all') {
      list = list.filter((a) => a.status === statusFilter);
    }
    return list;
  }, [fleet, search, statusFilter]);

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
      setSelectedAircraft(null);
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
      setSelectedAircraft(null);
      fetchFleet();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to return aircraft to service');
    }
  }

  function getFleetStatusLabel(aircraft: FleetMaintenanceStatus): string {
    if (aircraft.hasOverdueChecks || aircraft.hasOverdueADs || aircraft.hasExpiredMEL) return 'Overdue';
    if (aircraft.checksDue.some((c) => c.isInOverflight)) return 'Warning';
    return aircraft.status;
  }

  if (loading) return <TableSkeleton />;

  if (logbookAircraftId !== null) {
    return <AircraftLogbook aircraftId={logbookAircraftId} onBack={() => setLogbookAircraftId(null)} />;
  }

  const detailOpen = selectedAircraft !== null;

  const statusLabel = selectedAircraft
    ? selectedAircraft.hasOverdueChecks || selectedAircraft.hasOverdueADs || selectedAircraft.hasExpiredMEL
      ? 'Overdue'
      : selectedAircraft.checksDue.some((c) => c.isInOverflight)
      ? 'Warning'
      : selectedAircraft.status
    : '';

  return (
    <>
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
            placeholder="Search aircraft..."
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
        <Select value={statusFilter} onValueChange={setStatusFilter}>
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
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="maintenance">Maintenance</SelectItem>
            <SelectItem value="storage">Storage</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* ═══ Table + Detail Split ═══ */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <div
          style={{
            width: detailOpen ? '55%' : '100%',
            display: 'flex',
            flexDirection: 'column',
            transition: 'width 200ms ease-out',
            overflow: 'hidden',
          }}
        >
          <div style={{ padding: '0 24px', flex: 1, overflow: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={colHeaderStyle}>REGISTRATION</th>
                  <th style={colHeaderStyle}>TYPE</th>
                  <th style={colHeaderStyle}>NAME</th>
                  <th style={colHeaderStyle}>HOURS</th>
                  <th style={colHeaderStyle}>CYCLES</th>
                  <th style={colHeaderStyle}>DISCREP</th>
                  <th style={colHeaderStyle}>MELs</th>
                  <th style={colHeaderStyle}>NEXT CHECK</th>
                  <th style={colHeaderStyle}>REMAINING</th>
                  <th style={colHeaderStyle}>STATUS</th>
                  <th style={{ ...colHeaderStyle, width: 50 }} />
                </tr>
              </thead>
              <motion.tbody variants={tableContainer} initial="hidden" animate="visible">
                {filtered.length === 0 ? (
                  <tr>
                    <td
                      colSpan={11}
                      style={{ padding: '40px 16px', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}
                    >
                      No aircraft found
                    </td>
                  </tr>
                ) : (
                  filtered.map((aircraft) => {
                    const isSelected = selectedAircraft?.aircraftId === aircraft.aircraftId;
                    return (
                    <motion.tr
                      key={aircraft.aircraftId}
                      variants={tableRow}
                      onClick={() => setSelectedAircraft(isSelected ? null : aircraft)}
                      style={{
                        cursor: 'pointer',
                        background: isSelected ? 'rgba(79,108,205,0.08)' : undefined,
                        transition: 'background 0.15s ease',
                      }}
                      className="row-interactive"
                    >
                      <td style={{ ...cellStyle, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums' }}>
                        {aircraft.registration}
                      </td>
                      <td style={cellStyle}>
                        <span style={{ fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums', fontSize: 11 }}>{aircraft.icaoType}</span>
                      </td>
                      <td style={{ ...cellStyle, color: 'var(--text-secondary)', fontSize: 11 }}>
                        {aircraft.name}
                      </td>
                      <td style={{ ...cellStyle, fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums' }}>
                        {formatHours(aircraft.totalHours)}
                      </td>
                      <td style={{ ...cellStyle, fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums' }}>
                        {aircraft.totalCycles.toLocaleString()}
                      </td>
                      <td style={{ ...cellStyle, fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums', textAlign: 'center' }}>
                        {aircraft.openDiscrepancies > 0 ? (
                          <span style={{ color: 'var(--accent-amber)', fontWeight: 600 }}>{aircraft.openDiscrepancies}</span>
                        ) : (
                          <span style={{ color: 'var(--text-tertiary)' }}>0</span>
                        )}
                      </td>
                      <td style={{ ...cellStyle, fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums', textAlign: 'center' }}>
                        {aircraft.activeMELs > 0 ? (
                          <span style={{ color: 'var(--accent-amber)', fontWeight: 600 }}>{aircraft.activeMELs}</span>
                        ) : (
                          <span style={{ color: 'var(--text-tertiary)' }}>0</span>
                        )}
                      </td>
                      <td style={cellStyle}>
                        {aircraft.nextCheckType ? (
                          <TypeBadge type={aircraft.nextCheckType as MaintenanceLogType} />
                        ) : (
                          <span style={{ color: 'var(--text-tertiary)' }}>--</span>
                        )}
                      </td>
                      <td style={{ ...cellStyle, fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums' }}>
                        {aircraft.nextCheckDueIn !== null ? (
                          <span
                            style={{
                              color:
                                aircraft.hasOverdueChecks
                                  ? 'var(--accent-red)'
                                  : aircraft.checksDue.some((c) => c.isInOverflight)
                                  ? 'var(--accent-amber)'
                                  : 'var(--text-secondary)',
                            }}
                          >
                            {formatHours(aircraft.nextCheckDueIn)} hrs
                          </span>
                        ) : (
                          '--'
                        )}
                      </td>
                      <td style={cellStyle}>
                        <StatusBadgeInline status={getFleetStatusLabel(aircraft)} />
                      </td>
                      <td style={cellStyle}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              onClick={(e) => e.stopPropagation()}
                              style={{
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                padding: 4,
                                borderRadius: 4,
                                color: 'var(--text-tertiary)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              <MoreVertical size={16} />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => {
                                setAdjustTarget(aircraft);
                                setAdjustHours(aircraft.totalHours.toString());
                                setAdjustCycles(aircraft.totalCycles.toString());
                              }}
                            >
                              <Pencil size={14} /> Adjust Hours
                            </DropdownMenuItem>
                            {aircraft.status === 'maintenance' && (
                              <DropdownMenuItem onClick={() => handleReturnToService(aircraft)}>
                                <RotateCw size={14} /> Return to Service
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </motion.tr>
                    );
                  })
                )}
              </motion.tbody>
            </table>
          </div>
        </div>

        {/* ═══ Aircraft Detail Panel ═══ */}
        {detailOpen && selectedAircraft && (
          <DetailPanel
            open={detailOpen}
            onClose={() => setSelectedAircraft(null)}
            title={selectedAircraft.registration}
            subtitle={`${selectedAircraft.icaoType} — ${selectedAircraft.name}`}
            actions={
              <div style={{ display: 'flex', gap: 8, width: '100%' }}>
                <button
                  onClick={() => {
                    setAdjustTarget(selectedAircraft);
                    setAdjustHours(selectedAircraft.totalHours.toString());
                    setAdjustCycles(selectedAircraft.totalCycles.toString());
                  }}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    padding: '6px 10px',
                    borderRadius: 6,
                    border: '1px solid var(--border-primary)',
                    background: 'var(--surface-3)',
                    color: 'var(--text-primary)',
                    fontSize: 11,
                    fontWeight: 500,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  <Pencil size={12} /> Adjust Hours
                </button>
                {selectedAircraft.status === 'maintenance' && (
                  <button
                    onClick={() => handleReturnToService(selectedAircraft)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 5,
                      padding: '6px 10px',
                      borderRadius: 6,
                      border: '1px solid var(--border-primary)',
                      background: 'var(--surface-3)',
                      color: 'var(--accent-emerald)',
                      fontSize: 11,
                      fontWeight: 500,
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                    }}
                  >
                    <RotateCw size={12} /> Return to Service
                  </button>
                )}
                <button
                  onClick={() => { setSelectedAircraft(null); setLogbookAircraftId(selectedAircraft.aircraftId); }}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    padding: '6px 10px',
                    borderRadius: 6,
                    border: '1px solid var(--accent-blue-ring, var(--border-primary))',
                    background: 'var(--accent-blue-bg)',
                    color: 'var(--accent-blue-bright)',
                    fontSize: 11,
                    fontWeight: 500,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  <BookOpen size={12} /> Full Logbook
                </button>
              </div>
            }
          >
            <div className="space-y-5">
              {/* Status */}
              <div>
                <StatusBadgeInline status={statusLabel} />
              </div>

              {/* Aircraft Info */}
              <section>
                <SectionHeader title="Aircraft Info" />
                <div className="space-y-0.5">
                  <DataRow label="Total Hours" value={formatHours(selectedAircraft.totalHours)} mono />
                  <DataRow label="Total Cycles" value={selectedAircraft.totalCycles.toLocaleString()} mono />
                  <DataRow label="Status" value={statusLabel} />
                  <DataRow
                    label="Open Discrepancies"
                    value={
                      <span style={{ color: selectedAircraft.openDiscrepancies > 0 ? 'var(--accent-amber)' : undefined, fontWeight: selectedAircraft.openDiscrepancies > 0 ? 600 : undefined }}>
                        {selectedAircraft.openDiscrepancies}
                      </span>
                    }
                    mono
                  />
                  <DataRow
                    label="Active MELs"
                    value={
                      <span style={{ color: selectedAircraft.activeMELs > 0 ? 'var(--accent-amber)' : undefined, fontWeight: selectedAircraft.activeMELs > 0 ? 600 : undefined }}>
                        {selectedAircraft.activeMELs}
                      </span>
                    }
                    mono
                  />
                </div>
              </section>

              {/* Check Status */}
              {selectedAircraft.checksDue.length > 0 && (
                <section>
                  <SectionHeader title="Check Status" />
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    {selectedAircraft.checksDue.map((check) => {
                      const color = check.isOverdue
                        ? 'var(--accent-red)'
                        : check.isInOverflight
                        ? 'var(--accent-amber)'
                        : 'var(--accent-emerald)';
                      return (
                        <div
                          key={check.checkType}
                          style={{
                            borderRadius: 6,
                            border: '1px solid var(--border-primary)',
                            background: 'var(--surface-3)',
                            padding: '10px 12px',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{check.checkType}</span>
                            <StatusBadgeInline status={check.isOverdue ? 'Overdue' : check.isInOverflight ? 'Warning' : 'Ok'} />
                          </div>
                          <div style={{ fontSize: 11, color, fontFamily: 'var(--font-mono, monospace)' }}>
                            {check.remainingHours != null ? `${formatHours(check.remainingHours)} hrs remaining` : '--'}
                          </div>
                          {check.remainingCycles != null && (
                            <div style={{ fontSize: 10, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono, monospace)', marginTop: 2 }}>
                              {check.remainingCycles.toLocaleString()} cycles remaining
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}

              {/* Alerts */}
              {(selectedAircraft.hasOverdueChecks || selectedAircraft.hasOverdueADs || selectedAircraft.hasExpiredMEL) && (
                <section>
                  <SectionHeader title="Alerts" />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {selectedAircraft.hasOverdueChecks && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--accent-red)' }}>
                        <AlertTriangle size={14} /> Overdue maintenance checks
                      </div>
                    )}
                    {selectedAircraft.hasOverdueADs && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--accent-red)' }}>
                        <AlertTriangle size={14} /> Overdue airworthiness directives
                      </div>
                    )}
                    {selectedAircraft.hasExpiredMEL && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--accent-amber)' }}>
                        <AlertTriangle size={14} /> Expired MEL deferrals
                      </div>
                    )}
                  </div>
                </section>
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
    </>
  );
}

// ═══════════════════════════════════════════════════════════════
// Main Page
// ═══════════════════════════════════════════════════════════════

export function MaintenancePage() {
  const [activeTab, setActiveTab] = useState<'fleet' | 'discrepancies' | 'mel' | 'compliance' | 'configuration'>('fleet');

  const tabs: { key: typeof activeTab; label: string }[] = [
    { key: 'fleet', label: 'Fleet Status' },
    { key: 'discrepancies', label: 'Discrepancies' },
    { key: 'mel', label: 'MEL Deferrals' },
    { key: 'compliance', label: 'Compliance' },
    { key: 'configuration', label: 'Configuration' },
  ];

  return (
    <motion.div
      variants={pageVariants}
      initial="hidden"
      animate="visible"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
        color: 'var(--text-primary)',
      }}
    >
      {/* ── Page Header ──────────────────────────────────────── */}
      <motion.div
        variants={fadeUp}
        style={{
          padding: '16px 24px',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        {/* Title Row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Wrench size={20} style={{ color: 'var(--accent-blue)' }} />
          <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>
            Maintenance
          </span>
        </div>

        {/* Tabs */}
        <div
          style={{
            display: 'flex',
            gap: 0,
            borderBottom: '1px solid var(--border-primary)',
          }}
        >
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                background: 'none',
                border: 'none',
                borderBottom: activeTab === tab.key ? '2px solid var(--accent-blue)' : '2px solid transparent',
                padding: '8px 16px',
                fontSize: 13,
                fontWeight: 500,
                color: activeTab === tab.key ? 'var(--accent-blue-bright)' : 'var(--text-tertiary)',
                cursor: 'pointer',
                transition: 'color 120ms',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </motion.div>

      {/* ── Tab Content ──────────────────────────────────────── */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {activeTab === 'fleet' && <FleetStatusContent />}
        {activeTab === 'discrepancies' && <DiscrepanciesTab />}
        {activeTab === 'mel' && <MelDeferralsTab />}
        {activeTab === 'compliance' && <ComplianceTab />}
        {activeTab === 'configuration' && <ConfigurationTab />}
      </div>
    </motion.div>
  );
}
