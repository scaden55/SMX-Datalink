import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  ArrowLeft,
  Plane,
  Pencil,
  Save,
  X,
  Wrench,
  FileText,
  BarChart3,
  AlertTriangle,
  CheckCircle,
  Package,
  Users,
  Gauge,
  Weight,
  Fuel,
  Navigation,
  Trash2,
} from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from '@/stores/toastStore';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  pageVariants,
  fadeUp,
  staggerContainer,
  staggerItem,
} from '@/lib/motion';
import type {
  FleetAircraft,
  UpdateFleetAircraftRequest,
  FleetMaintenanceStatus,
  CheckDueStatus,
} from '@acars/shared';
import { StatusBadge } from '@/components/primitives/StatusBadge';
import { formatDate, fmtNum, fmtTime } from '@/lib/formatters';

// ── Types ──────────────────────────────────────────────

interface AircraftStats {
  totalFlights: number;
  totalHours: number;
  lastFlightDate: string | null;
  avgScore: number | null;
  avgLandingRate: number | null;
}

interface FlightRecord {
  id: number;
  flightNumber: string;
  depIcao: string;
  arrIcao: string;
  pilotCallsign: string;
  blockTimeMin: number;
  fuelUsedLbs: number | null;
  landingRateFpm: number | null;
  status: string;
  createdAt: string;
}

// ── Helpers ────────────────────────────────────────────

// formatDate, fmtNum, fmtTime imported from @/lib/formatters

// ── Component ──────────────────────────────────────────

export function AircraftDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [aircraft, setAircraft] = useState<FleetAircraft | null>(null);
  const [stats, setStats] = useState<AircraftStats | null>(null);
  const [flights, setFlights] = useState<FlightRecord[]>([]);
  const [maintenance, setMaintenance] = useState<FleetMaintenanceStatus | null>(null);
  const [loading, setLoading] = useState(true);

  // Edit state
  const [editingInfo, setEditingInfo] = useState(false);
  const [editingSpecs, setEditingSpecs] = useState(false);
  const [infoForm, setInfoForm] = useState<Partial<UpdateFleetAircraftRequest>>({});
  const [specsForm, setSpecsForm] = useState<Partial<UpdateFleetAircraftRequest>>({});
  const [saving, setSaving] = useState(false);

  // Delete state
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const fetchAll = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [acRes, statsRes, flightsRes, maintRes] = await Promise.allSettled([
        api.get<FleetAircraft>(`/api/fleet/manage/${id}`),
        api.get<AircraftStats>(`/api/fleet/manage/${id}/stats`),
        api.get<FlightRecord[]>(`/api/fleet/manage/${id}/flights?limit=10`),
        api.get<FleetMaintenanceStatus>(`/api/fleet/manage/${id}/maintenance`),
      ]);

      if (acRes.status === 'fulfilled') setAircraft(acRes.value);
      else { toast.error('Aircraft not found'); navigate('/fleet'); return; }

      if (statsRes.status === 'fulfilled') setStats(statsRes.value);
      if (flightsRes.status === 'fulfilled') setFlights(flightsRes.value);
      if (maintRes.status === 'fulfilled') setMaintenance(maintRes.value);
    } finally {
      setLoading(false);
    }
  }, [id, navigate]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── Edit handlers ──────────────────────────────────

  const startEditInfo = () => {
    if (!aircraft) return;
    setInfoForm({
      icaoType: aircraft.icaoType,
      iataType: aircraft.iataType ?? '',
      name: aircraft.name,
      registration: aircraft.registration,
      airline: aircraft.airline,
      configuration: aircraft.configuration ?? '',
      baseIcao: aircraft.baseIcao ?? '',
      locationIcao: aircraft.locationIcao ?? '',
      status: aircraft.status,
      isCargo: aircraft.isCargo,
      engines: aircraft.engines ?? '',
      equipCode: aircraft.equipCode ?? '',
      transponderCode: aircraft.transponderCode ?? '',
      pbn: aircraft.pbn ?? '',
      cat: aircraft.cat ?? '',
      selcal: aircraft.selcal ?? '',
      hexCode: aircraft.hexCode ?? '',
      aircraftClass: aircraft.aircraftClass ?? 'I',
      remarks: aircraft.remarks ?? '',
    });
    setEditingInfo(true);
  };

  const startEditSpecs = () => {
    if (!aircraft) return;
    setSpecsForm({
      oewLbs: aircraft.oewLbs,
      mzfwLbs: aircraft.mzfwLbs,
      mtowLbs: aircraft.mtowLbs,
      mlwLbs: aircraft.mlwLbs,
      maxFuelLbs: aircraft.maxFuelLbs,
      rangeNm: aircraft.rangeNm,
      cruiseSpeed: aircraft.cruiseSpeed,
      ceilingFt: aircraft.ceilingFt,
      paxCapacity: aircraft.paxCapacity,
      cargoCapacityLbs: aircraft.cargoCapacityLbs,
    });
    setEditingSpecs(true);
  };

  const saveSection = async (section: 'info' | 'specs') => {
    if (!aircraft) return;
    setSaving(true);
    try {
      const body = section === 'info' ? infoForm : specsForm;
      const updated = await api.patch<FleetAircraft>(`/api/fleet/manage/${aircraft.id}`, body);
      setAircraft(updated);
      if (section === 'info') setEditingInfo(false);
      else setEditingSpecs(false);
      toast.success(`${section === 'info' ? 'Aircraft info' : 'Specifications'} updated`);
    } catch {
      toast.error('Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!aircraft) return;
    setDeleting(true);
    try {
      await api.delete(`/api/fleet/manage/${aircraft.id}`);
      toast.success(`${aircraft.registration} deleted`);
      navigate('/fleet');
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to delete aircraft');
    } finally {
      setDeleting(false);
    }
  };

  // ── Render ────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex flex-col h-full" style={{ padding: 24, gap: 16 }}>
        <div className="shimmer" style={{ height: 32, width: 300, borderRadius: 6 }} />
        <div className="flex" style={{ gap: 16 }}>
          <div className="shimmer flex-1" style={{ height: 400, borderRadius: 6 }} />
          <div className="shimmer flex-1" style={{ height: 400, borderRadius: 6 }} />
        </div>
      </div>
    );
  }

  if (!aircraft) return null;

  return (
    <motion.div
      className="flex flex-col h-full overflow-y-auto"
      variants={pageVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Header */}
      <motion.div
        className="flex items-center page-header" style={{ flexDirection: 'row' }}
        variants={fadeUp}
        initial="hidden"
        animate="visible"
      >
        <button
          onClick={() => navigate('/fleet')}
          className="flex items-center border-none bg-transparent cursor-pointer btn-glow"
          style={{
            gap: 6,
            padding: '6px 12px',
            borderRadius: 6,
            color: 'var(--text-secondary)',
            border: '1px solid transparent',
          }}
        >
          <ArrowLeft size={14} />
          <span className="text-caption">Back to Fleet</span>
        </button>

        <div className="flex-1" />

        <Plane size={18} style={{ color: 'var(--accent-blue)' }} />
        <span className="text-heading" style={{ fontSize: 18, fontWeight: 700 }}>
          {aircraft.registration}
        </span>
        <span className="text-body" style={{ color: 'var(--text-secondary)' }}>
          {aircraft.name}
        </span>
        <StatusBadge status={aircraft.status} />

        <button
          onClick={() => setDeleteOpen(true)}
          className="flex items-center border-none cursor-pointer btn-glow"
          style={{
            gap: 6,
            padding: '6px 12px',
            borderRadius: 6,
            color: 'var(--accent-red)',
            backgroundColor: 'transparent',
            border: '1px solid rgba(239, 68, 68, 0.2)',
            marginLeft: 8,
          }}
        >
          <Trash2 size={13} />
          <span className="text-caption">Delete</span>
        </button>
      </motion.div>

      {/* Content */}
      <div className="flex flex-col" style={{ padding: '0 24px 24px 24px', gap: 16 }}>
        {/* Top row: Info + Specs */}
        <motion.div
          className="flex"
          style={{ gap: 16 }}
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
        >
          {/* Aircraft Info */}
          <motion.div
            className="flex flex-col flex-1"
            style={{
              borderRadius: 6,
              background: 'transparent',
              border: '1px solid var(--panel-border)',
            }}
            variants={staggerItem}
          >
            <SectionHeader
              icon={Plane}
              title="Aircraft Info"
              editing={editingInfo}
              saving={saving}
              onEdit={startEditInfo}
              onSave={() => saveSection('info')}
              onCancel={() => setEditingInfo(false)}
            />
            <div className="flex flex-col" style={{ padding: '0 16px 16px 16px', gap: 0 }}>
              <FieldRow label="ICAO Type" value={aircraft.icaoType} editing={editingInfo}
                editValue={infoForm.icaoType} onChange={(v) => setInfoForm((p) => ({ ...p, icaoType: v }))} />
              <FieldRow label="IATA Type" value={aircraft.iataType} editing={editingInfo}
                editValue={infoForm.iataType as string} onChange={(v) => setInfoForm((p) => ({ ...p, iataType: v }))} />
              <FieldRow label="Name" value={aircraft.name} editing={editingInfo}
                editValue={infoForm.name} onChange={(v) => setInfoForm((p) => ({ ...p, name: v }))} />
              <FieldRow label="Registration" value={aircraft.registration} editing={editingInfo}
                editValue={infoForm.registration} onChange={(v) => setInfoForm((p) => ({ ...p, registration: v }))} />
              <FieldRow label="Airline" value={aircraft.airline} editing={editingInfo}
                editValue={infoForm.airline} onChange={(v) => setInfoForm((p) => ({ ...p, airline: v }))} />
              <FieldRow label="Configuration" value={aircraft.configuration} editing={editingInfo}
                editValue={infoForm.configuration as string} onChange={(v) => setInfoForm((p) => ({ ...p, configuration: v }))} />
              <FieldRow label="Base ICAO" value={aircraft.baseIcao} editing={editingInfo}
                editValue={infoForm.baseIcao as string} onChange={(v) => setInfoForm((p) => ({ ...p, baseIcao: v }))} />
              <FieldRow label="Location ICAO" value={aircraft.locationIcao} editing={editingInfo}
                editValue={infoForm.locationIcao as string} onChange={(v) => setInfoForm((p) => ({ ...p, locationIcao: v }))} />
              <FieldRow label="Status" value={aircraft.status} editing={editingInfo}
                editValue={infoForm.status} onChange={(v) => setInfoForm((p) => ({ ...p, status: v as FleetAircraft['status'] }))}
                options={['active', 'maintenance', 'stored', 'retired']} />
              <FieldRow label="Cargo" value={aircraft.isCargo ? 'Yes' : 'No'} editing={editingInfo}
                editValue={infoForm.isCargo ? 'Yes' : 'No'}
                onChange={(v) => setInfoForm((p) => ({ ...p, isCargo: v === 'Yes' }))}
                options={['Yes', 'No']} />
              <FieldRow label="Engines" value={aircraft.engines} editing={editingInfo}
                editValue={infoForm.engines as string} onChange={(v) => setInfoForm((p) => ({ ...p, engines: v }))} />
              <FieldRow label="Equipment Code" value={aircraft.equipCode} editing={editingInfo}
                editValue={infoForm.equipCode as string} onChange={(v) => setInfoForm((p) => ({ ...p, equipCode: v }))} />
              <FieldRow label="Transponder" value={aircraft.transponderCode} editing={editingInfo}
                editValue={infoForm.transponderCode as string} onChange={(v) => setInfoForm((p) => ({ ...p, transponderCode: v }))} />
              <FieldRow label="PBN" value={aircraft.pbn} editing={editingInfo}
                editValue={infoForm.pbn as string} onChange={(v) => setInfoForm((p) => ({ ...p, pbn: v }))} />
              <FieldRow label="CAT" value={aircraft.cat} editing={editingInfo}
                editValue={infoForm.cat as string} onChange={(v) => setInfoForm((p) => ({ ...p, cat: v }))} />
              <FieldRow label="SELCAL" value={aircraft.selcal} editing={editingInfo}
                editValue={infoForm.selcal as string} onChange={(v) => setInfoForm((p) => ({ ...p, selcal: v }))} />
              <FieldRow label="Hex Code" value={aircraft.hexCode} editing={editingInfo}
                editValue={infoForm.hexCode as string} onChange={(v) => setInfoForm((p) => ({ ...p, hexCode: v }))} />
              <FieldRow label="Aircraft Class" value={aircraft.aircraftClass ? `Class ${aircraft.aircraftClass}` : '—'} editing={editingInfo}
                editValue={infoForm.aircraftClass ?? aircraft.aircraftClass ?? 'I'}
                onChange={(v) => setInfoForm((p) => ({ ...p, aircraftClass: v as 'I' | 'II' | 'III' }))}
                options={['I', 'II', 'III']}
                optionLabels={['Class I (Regional)', 'Class II (Narrowbody)', 'Class III (Widebody)']} />
              <FieldRow label="Remarks" value={aircraft.remarks} editing={editingInfo}
                editValue={infoForm.remarks as string} onChange={(v) => setInfoForm((p) => ({ ...p, remarks: v }))} />
            </div>
          </motion.div>

          {/* Specifications */}
          <motion.div
            className="flex flex-col flex-1"
            style={{
              borderRadius: 6,
              background: 'transparent',
              border: '1px solid var(--panel-border)',
            }}
            variants={staggerItem}
          >
            <SectionHeader
              icon={Weight}
              title="Specifications"
              editing={editingSpecs}
              saving={saving}
              onEdit={startEditSpecs}
              onSave={() => saveSection('specs')}
              onCancel={() => setEditingSpecs(false)}
            />
            <div className="flex flex-col" style={{ padding: '0 16px 16px 16px', gap: 0 }}>
              <NumFieldRow label="Basic Empty Weight (OEW)" value={aircraft.oewLbs} unit="lbs" editing={editingSpecs}
                editValue={specsForm.oewLbs} onChange={(v) => setSpecsForm((p) => ({ ...p, oewLbs: v }))} />
              <NumFieldRow label="Max Zero Fuel Weight" value={aircraft.mzfwLbs} unit="lbs" editing={editingSpecs}
                editValue={specsForm.mzfwLbs} onChange={(v) => setSpecsForm((p) => ({ ...p, mzfwLbs: v }))} />
              <NumFieldRow label="Max Takeoff Weight" value={aircraft.mtowLbs} unit="lbs" editing={editingSpecs}
                editValue={specsForm.mtowLbs} onChange={(v) => setSpecsForm((p) => ({ ...p, mtowLbs: v }))} />
              <NumFieldRow label="Max Landing Weight" value={aircraft.mlwLbs} unit="lbs" editing={editingSpecs}
                editValue={specsForm.mlwLbs} onChange={(v) => setSpecsForm((p) => ({ ...p, mlwLbs: v }))} />
              <NumFieldRow label="Fuel Capacity" value={aircraft.maxFuelLbs} unit="lbs" editing={editingSpecs}
                editValue={specsForm.maxFuelLbs} onChange={(v) => setSpecsForm((p) => ({ ...p, maxFuelLbs: v }))} />
              <NumFieldRow label="Range" value={aircraft.rangeNm} unit="nm" editing={editingSpecs}
                editValue={specsForm.rangeNm} onChange={(v) => setSpecsForm((p) => ({ ...p, rangeNm: v ?? undefined }))} />
              <NumFieldRow label="Cruise Speed" value={aircraft.cruiseSpeed} unit="kts" editing={editingSpecs}
                editValue={specsForm.cruiseSpeed} onChange={(v) => setSpecsForm((p) => ({ ...p, cruiseSpeed: v ?? undefined }))} />
              <NumFieldRow label="Ceiling" value={aircraft.ceilingFt} unit="ft" editing={editingSpecs}
                editValue={specsForm.ceilingFt} onChange={(v) => setSpecsForm((p) => ({ ...p, ceilingFt: v }))} />
              <NumFieldRow label="Passenger Capacity" value={aircraft.paxCapacity} unit="pax" editing={editingSpecs}
                editValue={specsForm.paxCapacity} onChange={(v) => setSpecsForm((p) => ({ ...p, paxCapacity: v ?? undefined }))} />
              <NumFieldRow label="Cargo Capacity" value={aircraft.cargoCapacityLbs} unit="lbs" editing={editingSpecs}
                editValue={specsForm.cargoCapacityLbs} onChange={(v) => setSpecsForm((p) => ({ ...p, cargoCapacityLbs: v ?? undefined }))} />
            </div>
          </motion.div>
        </motion.div>

        {/* Maintenance */}
        <motion.div
          style={{
            borderRadius: 6,
            background: 'transparent',
            border: '1px solid var(--panel-border)',
          }}
          variants={fadeUp}
          initial="hidden"
          animate="visible"
        >
          <SectionHeader icon={Wrench} title="Maintenance" />
          {maintenance ? (
            <div className="flex flex-col" style={{ padding: '0 16px 16px 16px', gap: 12 }}>
              {/* Overall health bar */}
              <div className="flex items-center" style={{ gap: 12, paddingBottom: 4 }}>
                <span className="data-xs" style={{ color: 'var(--text-tertiary)' }}>
                  Total: {fmtNum(maintenance.totalHours)} hrs · {fmtNum(maintenance.totalCycles)} cycles
                </span>
                <div className="flex-1" />
                {maintenance.hasOverdueChecks && (
                  <span className="flex items-center data-xs" style={{ gap: 4, color: 'var(--accent-red)' }}>
                    <AlertTriangle size={12} /> Overdue checks
                  </span>
                )}
                {!maintenance.hasOverdueChecks && (
                  <span className="flex items-center data-xs" style={{ gap: 4, color: 'var(--accent-emerald)' }}>
                    <CheckCircle size={12} /> All checks current
                  </span>
                )}
              </div>

              {/* Check cards */}
              {maintenance.checksDue.length > 0 ? (
                <div className="flex" style={{ gap: 12 }}>
                  {maintenance.checksDue.map((check) => (
                    <CheckCard key={check.checkType} check={check} />
                  ))}
                </div>
              ) : (
                <div className="text-caption" style={{ fontSize: 11 }}>
                  No check schedules configured for this aircraft type
                </div>
              )}
            </div>
          ) : (
            <div className="text-caption" style={{ padding: '0 16px 16px 16px', fontSize: 11 }}>
              No maintenance data available
            </div>
          )}
        </motion.div>

        {/* Flight Reports */}
        <motion.div
          style={{
            borderRadius: 6,
            background: 'transparent',
            border: '1px solid var(--panel-border)',
          }}
          variants={fadeUp}
          initial="hidden"
          animate="visible"
        >
          <SectionHeader icon={FileText} title={`Flight Reports (${flights.length})`} />
          {flights.length > 0 ? (
            <div style={{ padding: '0 16px 16px 16px' }}>
              <div style={{ borderRadius: 4, overflow: 'hidden', border: '1px solid var(--border-primary)' }}>
                {/* Table header */}
                <div
                  className="flex items-center"
                  style={{
                    padding: '8px 12px',
                    gap: 12,
                    backgroundColor: 'var(--surface-1)',
                    borderBottom: '1px solid var(--border-primary)',
                  }}
                >
                  <span style={{ width: 80, fontWeight: 600, color: 'var(--text-tertiary)', letterSpacing: 0.5, fontSize: 9, textTransform: 'uppercase' as const }}>FLIGHT</span>
                  <span style={{ width: 100, fontWeight: 600, color: 'var(--text-tertiary)', letterSpacing: 0.5, fontSize: 9, textTransform: 'uppercase' as const }}>ROUTE</span>
                  <span style={{ width: 70, fontWeight: 600, color: 'var(--text-tertiary)', letterSpacing: 0.5, fontSize: 9, textTransform: 'uppercase' as const }}>TIME</span>
                  <span style={{ width: 70, fontWeight: 600, color: 'var(--text-tertiary)', letterSpacing: 0.5, fontSize: 9, textTransform: 'uppercase' as const }}>FUEL</span>
                  <span style={{ width: 70, fontWeight: 600, color: 'var(--text-tertiary)', letterSpacing: 0.5, fontSize: 9, textTransform: 'uppercase' as const }}>LANDING</span>
                  <span className="flex-1" style={{ fontWeight: 600, color: 'var(--text-tertiary)', letterSpacing: 0.5, fontSize: 9, textTransform: 'uppercase' as const }}>PILOT</span>
                  <span style={{ width: 80, fontWeight: 600, color: 'var(--text-tertiary)', letterSpacing: 0.5, fontSize: 9, textTransform: 'uppercase' as const, textAlign: 'right' }}>DATE</span>
                </div>
                {/* Rows */}
                {flights.map((f, i) => (
                  <div
                    key={f.id}
                    className="flex items-center row-interactive"
                    style={{
                      padding: '8px 12px',
                      gap: 12,
                      borderBottom: i < flights.length - 1 ? '1px solid var(--border-primary)' : 'none',
                    }}
                  >
                    <span className="text-caption" style={{ width: 80, fontSize: 11, fontWeight: 600, color: 'var(--accent-blue-bright)' }}>{f.flightNumber}</span>
                    <span className="text-caption" style={{ width: 100, fontSize: 11, color: 'var(--text-primary)' }}>{f.depIcao} → {f.arrIcao}</span>
                    <span className="text-caption" style={{ width: 70, fontSize: 11, color: 'var(--text-secondary)' }}>{fmtTime(f.blockTimeMin)}</span>
                    <span className="text-caption" style={{ width: 70, fontSize: 11, color: 'var(--text-secondary)' }}>{f.fuelUsedLbs != null ? `${fmtNum(f.fuelUsedLbs)} lbs` : '—'}</span>
                    <span className="text-caption" style={{ width: 70, fontSize: 11, color: landingColor(f.landingRateFpm) }}>{f.landingRateFpm != null ? `${f.landingRateFpm} fpm` : '—'}</span>
                    <span className="flex-1 text-caption" style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{f.pilotCallsign}</span>
                    <span className="data-xs" style={{ width: 80, color: 'var(--text-tertiary)', textAlign: 'right' }}>{formatDate(f.createdAt)}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-caption" style={{ padding: '0 16px 16px 16px', fontSize: 11 }}>
              No flight reports yet
            </div>
          )}
        </motion.div>

        {/* Statistics */}
        <motion.div
          style={{
            borderRadius: 6,
            background: 'transparent',
            border: '1px solid var(--panel-border)',
          }}
          variants={fadeUp}
          initial="hidden"
          animate="visible"
        >
          <SectionHeader icon={BarChart3} title="Statistics" />
          <div className="flex" style={{ padding: '0 16px 16px 16px', gap: 12 }}>
            <StatBlock icon={FileText} label="Total Flights" value={fmtNum(stats?.totalFlights)} />
            <StatBlock icon={Gauge} label="Total Hours" value={stats?.totalHours != null ? `${stats.totalHours.toLocaleString()}h` : '—'} />
            <StatBlock icon={Fuel} label="Avg Landing Rate" value={stats?.avgLandingRate != null ? `${stats.avgLandingRate} fpm` : '—'} />
            <StatBlock icon={BarChart3} label="Avg Score" value={stats?.avgScore != null ? `${stats.avgScore}%` : '—'} />
            <StatBlock icon={Navigation} label="Last Flight" value={formatDate(stats?.lastFlightDate)} />
          </div>
        </motion.div>
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent
          style={{
            backgroundColor: 'var(--surface-2)',
            border: '1px solid var(--border-primary)',
            color: 'var(--text-primary)',
            maxWidth: 420,
          }}
        >
          <DialogHeader>
            <DialogTitle className="text-heading" style={{ fontSize: 16, fontWeight: 700 }}>Delete Aircraft</DialogTitle>
            <DialogDescription className="text-caption" style={{ color: 'var(--text-secondary)' }}>
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col" style={{ gap: 16 }}>
            <div
              className="flex items-center"
              style={{
                gap: 12,
                padding: '12px 16px',
                borderRadius: 6,
                backgroundColor: 'rgba(239, 68, 68, 0.06)',
                border: '1px solid rgba(239, 68, 68, 0.15)',
              }}
            >
              <Trash2 size={16} style={{ color: 'var(--accent-red)', flexShrink: 0 }} />
              <div className="flex flex-col" style={{ gap: 2 }}>
                <span className="text-body" style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: 13 }}>{aircraft.registration}</span>
                <span className="text-caption" style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{aircraft.name} · {aircraft.icaoType}</span>
              </div>
            </div>

            <div className="flex items-center justify-end" style={{ gap: 8 }}>
              <button
                onClick={() => setDeleteOpen(false)}
                className="border-none cursor-pointer"
                style={{
                  padding: '8px 16px',
                  borderRadius: 6,
                  background: 'var(--tint-subtle)',
                  border: '1px solid var(--panel-border)',
                  color: 'var(--text-secondary)',
                  fontWeight: 600,
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="border-none cursor-pointer"
                style={{
                  padding: '8px 16px',
                  borderRadius: 6,
                  backgroundColor: 'var(--accent-red)',
                  color: '#fff',
                  fontWeight: 600,
                  opacity: deleting ? 0.6 : 1,
                }}
              >
                {deleting ? 'Deleting...' : 'Delete Aircraft'}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}

// ── Sub-components ────────────────────────────────────

function SectionHeader({
  icon: Icon,
  title,
  editing,
  saving,
  onEdit,
  onSave,
  onCancel,
}: {
  icon: React.FC<{ size?: number; style?: React.CSSProperties }>;
  title: string;
  editing?: boolean;
  saving?: boolean;
  onEdit?: () => void;
  onSave?: () => void;
  onCancel?: () => void;
}) {
  return (
    <div className="flex items-center" style={{ padding: '12px 16px', gap: 8 }}>
      <Icon size={14} style={{ color: 'var(--accent-blue)' }} />
      <span className="text-subheading" style={{ fontSize: 11 }}>{title.toUpperCase()}</span>
      <div className="flex-1" />
      {onEdit && !editing && (
        <button
          onClick={onEdit}
          className="flex items-center border-none bg-transparent cursor-pointer btn-glow"
          style={{ gap: 4, padding: '4px 8px', borderRadius: 4, color: 'var(--text-tertiary)', border: '1px solid transparent' }}
        >
          <Pencil size={10} /> Edit
        </button>
      )}
      {editing && (
        <div className="flex items-center" style={{ gap: 4 }}>
          <button
            onClick={onCancel}
            className="flex items-center border-none bg-transparent cursor-pointer btn-glow"
            style={{ gap: 4, padding: '4px 8px', borderRadius: 4, color: 'var(--text-tertiary)', border: '1px solid transparent' }}
          >
            <X size={10} /> Cancel
          </button>
          <button
            onClick={onSave}
            disabled={saving}
            className="flex items-center border-none cursor-pointer"
            style={{
              gap: 4,
              padding: '4px 10px',
              borderRadius: 4,
              fontWeight: 600,
              backgroundColor: 'var(--accent-blue)',
              color: '#fff',
              opacity: saving ? 0.6 : 1,
            }}
          >
            <Save size={10} /> {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      )}
    </div>
  );
}

function FieldRow({
  label,
  value,
  editing,
  editValue,
  onChange,
  options,
  optionLabels,
}: {
  label: string;
  value: string | null | undefined;
  editing: boolean;
  editValue?: string;
  onChange?: (v: string) => void;
  options?: string[];
  optionLabels?: string[];
}) {
  return (
    <div
      className="flex items-center"
      style={{ padding: '6px 0', borderBottom: '1px solid var(--border-primary)' }}
    >
      <span className="data-xs" style={{ width: 140, color: 'var(--text-tertiary)', flexShrink: 0 }}>{label}</span>
      {editing && onChange ? (
        options ? (
          <select
            value={editValue ?? ''}
            onChange={(e) => onChange(e.target.value)}
            style={{
              flex: 1,
              padding: '4px 8px',
              borderRadius: 4,
              fontSize: 11,
              backgroundColor: 'var(--input-bg)',
              border: '1px solid var(--input-border)',
              color: 'var(--text-primary)',
              outline: 'none',
            }}
          >
            {options.map((o, i) => (
              <option key={o} value={o}>{optionLabels ? optionLabels[i] : o}</option>
            ))}
          </select>
        ) : (
          <input
            type="text"
            value={editValue ?? ''}
            onChange={(e) => onChange(e.target.value)}
            className="input-glow"
            style={{
              flex: 1,
              padding: '4px 8px',
              borderRadius: 4,
              fontSize: 11,
              backgroundColor: 'var(--input-bg)',
              border: '1px solid var(--input-border)',
              color: 'var(--text-primary)',
              outline: 'none',
            }}
          />
        )
      ) : (
        <span className="text-caption" style={{ flex: 1, fontSize: 11, color: 'var(--text-primary)' }}>{value ?? '—'}</span>
      )}
    </div>
  );
}

function NumFieldRow({
  label,
  value,
  unit,
  editing,
  editValue,
  onChange,
}: {
  label: string;
  value: number | null | undefined;
  unit: string;
  editing: boolean;
  editValue?: number | null;
  onChange?: (v: number | null) => void;
}) {
  return (
    <div
      className="flex items-center"
      style={{ padding: '6px 0', borderBottom: '1px solid var(--border-primary)' }}
    >
      <span className="data-xs" style={{ width: 180, color: 'var(--text-tertiary)', flexShrink: 0 }}>{label}</span>
      {editing && onChange ? (
        <div className="flex items-center" style={{ flex: 1, gap: 6 }}>
          <input
            type="number"
            value={editValue ?? ''}
            onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
            className="input-glow"
            style={{
              flex: 1,
              padding: '4px 8px',
              borderRadius: 4,
              fontSize: 11,
              backgroundColor: 'var(--input-bg)',
              border: '1px solid var(--input-border)',
              color: 'var(--text-primary)',
              outline: 'none',
            }}
          />
          <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{unit}</span>
        </div>
      ) : (
        <span className="text-caption" style={{ flex: 1, fontSize: 11, color: 'var(--text-primary)' }}>
          {value != null ? `${fmtNum(value)} ${unit}` : '—'}
        </span>
      )}
    </div>
  );
}

const CHECK_COLORS: Record<string, { bar: string; label: string; border: string }> = {
  A: { bar: 'var(--accent-blue)', label: 'var(--accent-blue)', border: 'var(--accent-blue)' },
  B: { bar: 'var(--accent-cyan, #22d3ee)', label: 'var(--accent-cyan, #22d3ee)', border: 'var(--accent-cyan, #22d3ee)' },
  C: { bar: 'var(--accent-amber)', label: 'var(--accent-amber)', border: 'var(--accent-amber)' },
  D: { bar: 'var(--accent-purple, #a78bfa)', label: 'var(--accent-purple, #a78bfa)', border: 'var(--accent-purple, #a78bfa)' },
};

function CheckCard({ check }: { check: CheckDueStatus }) {
  const isOverdue = check.isOverdue;
  const colors = CHECK_COLORS[check.checkType] ?? { bar: 'var(--accent-blue)', label: 'var(--accent-blue)', border: 'var(--accent-blue)' };
  const borderColor = isOverdue ? 'var(--accent-red)' : check.isInOverflight ? colors.border : 'var(--border-primary)';
  const pct = check.remainingHours != null && check.dueAtHours != null
    ? Math.max(0, Math.min(100, ((check.dueAtHours - check.remainingHours) / check.dueAtHours) * 100))
    : 0;
  const barColor = isOverdue ? 'var(--accent-red)' : colors.bar;

  return (
    <div
      className="flex flex-col flex-1"
      style={{
        padding: 12,
        borderRadius: 6,
        backgroundColor: 'var(--surface-1)',
        border: `1px solid ${borderColor}`,
        gap: 8,
      }}
    >
      <div className="flex items-center" style={{ gap: 6 }}>
        <span className="text-caption" style={{ fontWeight: 700, color: isOverdue ? 'var(--accent-red)' : colors.label }}>
          {check.checkType}-Check
        </span>
        {isOverdue && <AlertTriangle size={12} style={{ color: 'var(--accent-red)' }} />}
      </div>
      {check.checkType === 'D' ? (
        <div className="flex items-center" style={{ gap: 8 }}>
          <span className="data-xs" style={{ fontSize: 9, color: 'var(--text-tertiary)', width: 70 }}>Due Date</span>
          <span className="text-caption" style={{ fontSize: 11, fontWeight: 600, color: isOverdue ? 'var(--accent-red)' : 'var(--text-primary)' }}>
            {check.dueAtDate ? formatDate(check.dueAtDate) : '—'}
          </span>
        </div>
      ) : (
        <>
          <div className="flex flex-col" style={{ gap: 4 }}>
            <div className="flex items-center" style={{ gap: 8 }}>
              <span className="data-xs" style={{ fontSize: 9, color: 'var(--text-tertiary)', width: 70 }}>Rem. Hours</span>
              <span className="text-caption" style={{ fontSize: 11, fontWeight: 600, color: isOverdue ? 'var(--accent-red)' : 'var(--text-primary)' }}>
                {check.remainingHours != null ? fmtNum(check.remainingHours) : '—'}
              </span>
            </div>
            <div className="flex items-center" style={{ gap: 8 }}>
              <span className="data-xs" style={{ fontSize: 9, color: 'var(--text-tertiary)', width: 70 }}>Rem. Cycles</span>
              <span className="text-caption" style={{ fontSize: 11, fontWeight: 600, color: isOverdue ? 'var(--accent-red)' : 'var(--text-primary)' }}>
                {check.remainingCycles != null ? fmtNum(check.remainingCycles) : '—'}
              </span>
            </div>
          </div>
          <div style={{ height: 3, borderRadius: 2, backgroundColor: 'var(--input-bg)' }}>
            <div
              className="bar-animate"
              style={{ height: '100%', width: `${pct}%`, borderRadius: 2, backgroundColor: barColor }}
            />
          </div>
        </>
      )}
    </div>
  );
}

function StatBlock({
  icon: Icon,
  label,
  value,
}: {
  icon: React.FC<{ size?: number; style?: React.CSSProperties }>;
  label: string;
  value: string;
}) {
  return (
    <div
      className="flex flex-col flex-1 items-center"
      style={{
        padding: 16,
        borderRadius: 6,
        backgroundColor: 'var(--surface-1)',
        border: '1px solid var(--border-primary)',
        gap: 6,
      }}
    >
      <Icon size={16} style={{ color: 'var(--accent-blue)' }} />
      <span className="text-heading" style={{ fontSize: 18, fontWeight: 700 }}>{value}</span>
      <span className="data-xs" style={{ fontSize: 9, color: 'var(--text-tertiary)', letterSpacing: 0.5 }}>{label.toUpperCase()}</span>
    </div>
  );
}

function landingColor(rate: number | null | undefined): string {
  if (rate == null) return 'var(--text-tertiary)';
  const abs = Math.abs(rate);
  if (abs <= 200) return 'var(--accent-emerald)';
  if (abs <= 400) return 'var(--accent-amber)';
  return 'var(--accent-red)';
}
