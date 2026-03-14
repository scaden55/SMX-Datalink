import { Fragment, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  AirplaneTilt,
  MagnifyingGlass,
  ArrowCounterClockwise,
  SpinnerGap,
  CaretDown,
  Plus,
  X,
  FloppyDisk,
  Trash,
  MapPin,
  Gauge,
  Users,
  Package,
  Ruler,
  Warning,
  ChatText,
  Scales,
  GasPump,
  Cloud,
  ChartBar,
  FileText,
  Wrench,
  GearSix,
  ArrowsDownUp,
  Shield,
  Broadcast,
  CheckCircle,
} from '@phosphor-icons/react';
import { api } from '../lib/api';
import { useAuthStore } from '../stores/authStore';
import { useSocketSubscription } from '../hooks/useSocketSubscription';
import type {
  FleetAircraft,
  FleetStatus,
  FleetListResponse,
  CreateFleetAircraftRequest,
  UpdateFleetAircraftRequest,
  SimBriefAircraftType,
  SimBriefAircraftSearchResponse,
  FleetMaintenanceStatus,
  CheckDueStatus,
} from '@acars/shared';

// ─── Helpers ────────────────────────────────────────────────────

const STATUS_CONFIG: Record<FleetStatus, { label: string; bg: string; text: string; border: string }> = {
  active:      { label: 'Active',      bg: 'bg-emerald-500/10',  text: 'text-emerald-400',  border: 'border-emerald-400/20' },
  stored:      { label: 'Stored',      bg: 'bg-amber-500/10',  text: 'text-amber-400',  border: 'border-amber-400/20' },
  retired:     { label: 'Retired',     bg: 'bg-red-500/10',    text: 'text-red-400',    border: 'border-red-400/20' },
  maintenance: { label: 'Maintenance', bg: 'bg-sky-500/10',   text: 'text-sky-400',   border: 'border-sky-400/20' },
};

function StatusBadge({ status }: { status: FleetStatus }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.active;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wide ${cfg.bg} ${cfg.text} border ${cfg.border}`}>
      {cfg.label}
    </span>
  );
}

function FleetStatusDisplay({ aircraft }: { aircraft: FleetAircraft }) {
  // If aircraft has an active flight (airborne or active phase)
  if (aircraft.bidFlightPhase === 'airborne' || aircraft.bidFlightPhase === 'active') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wide bg-blue-500/10 text-blue-400 border border-blue-400/20">
        In Flight
      </span>
    );
  }
  // If aircraft is reserved by a pilot (bid exists but not airborne)
  if (aircraft.reservedByPilot) {
    return (
      <div className="flex flex-col items-center gap-0.5">
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wide bg-amber-500/10 text-amber-400 border border-amber-400/20">
          Reserved
        </span>
        <span className="text-[9px] text-acars-muted">{aircraft.reservedByPilot}</span>
      </div>
    );
  }
  // Normal fleet status
  return <StatusBadge status={aircraft.status} />;
}

function fmt(val: number | null | undefined, suffix = ''): string {
  if (val == null) return '—';
  return val.toLocaleString() + (suffix ? ` ${suffix}` : '');
}

const INPUT_CLS = 'w-full h-9 rounded-md border border-acars-border bg-acars-bg text-xs text-acars-text px-2.5 tabular-nums outline-none focus:border-emerald-400 transition-colors placeholder:text-acars-muted/50';
const LABEL_CLS = 'text-[11px] uppercase tracking-wider text-acars-muted font-medium mb-1.5 block';

// ─── Add Aircraft Modal ─────────────────────────────────────────

interface AddAircraftModalProps {
  onClose: () => void;
  onCreated: (aircraft: FleetAircraft) => void;
}

function AddAircraftModal({ onClose, onCreated }: AddAircraftModalProps) {
  const [form, setForm] = useState<Partial<CreateFleetAircraftRequest>>({
    airline: 'SMX',
    status: 'active',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // SimBrief search state
  const [sbQuery, setSbQuery] = useState('');
  const [sbResults, setSbResults] = useState<SimBriefAircraftType[]>([]);
  const [sbLoading, setSbLoading] = useState(false);
  const [sbSelected, setSbSelected] = useState<SimBriefAircraftType | null>(null);
  const sbTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const set = (key: string, value: string | number | boolean) => setForm(prev => ({ ...prev, [key]: value }));

  const canSubmit = form.icaoType && form.name && form.registration &&
    form.rangeNm != null && form.cruiseSpeed != null &&
    form.paxCapacity != null && form.cargoCapacityLbs != null && !submitting;

  // SimBrief search with debounce
  const searchSimBrief = (query: string) => {
    setSbQuery(query);
    clearTimeout(sbTimer.current);
    if (query.length < 2) { setSbResults([]); return; }
    sbTimer.current = setTimeout(async () => {
      setSbLoading(true);
      try {
        const data = await api.get<SimBriefAircraftSearchResponse>(`/api/fleet/simbrief/aircraft?q=${encodeURIComponent(query)}`);
        setSbResults(data.aircraft);
      } catch { setSbResults([]); }
      finally { setSbLoading(false); }
    }, 300);
  };

  // Auto-fill from SimBrief selection
  const selectSimBrief = (ac: SimBriefAircraftType) => {
    setSbSelected(ac);
    setForm(prev => ({
      ...prev,
      icaoType: ac.aircraftIcao,
      name: ac.aircraftName,
      rangeNm: 0, // SimBrief doesn't provide range directly; user can fill
      cruiseSpeed: ac.speed,
      paxCapacity: ac.maxPax,
      cargoCapacityLbs: 0,
      oewLbs: ac.oewLbs || undefined,
      mzfwLbs: ac.mzfwLbs || undefined,
      mtowLbs: ac.mtowLbs || undefined,
      mlwLbs: ac.mlwLbs || undefined,
      maxFuelLbs: ac.maxFuelLbs || undefined,
      engines: ac.engines || undefined,
      ceilingFt: ac.ceilingFt || undefined,
      isCargo: ac.isCargo,
      cat: ac.cat || undefined,
      equipCode: ac.equipCode || undefined,
      transponderCode: ac.transponderCode || undefined,
      pbn: ac.pbn || undefined,
    }));
    setSbResults([]);
    setSbQuery('');
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError('');
    try {
      const aircraft = await api.post<FleetAircraft>('/api/fleet/manage', form as CreateFleetAircraftRequest);
      onCreated(aircraft);
    } catch (err: any) {
      setError(err?.message || 'Failed to create aircraft');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60" />
      <div
        className="relative w-[640px] max-h-[90vh] overflow-auto rounded-md border border-acars-border bg-acars-panel shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-acars-border">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center w-8 h-8 rounded-md bg-emerald-500/10 border border-emerald-400/20">
              <Plus className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-[13px] font-semibold text-acars-text">Add Aircraft</h2>
              <p className="text-[11px] text-acars-muted">MagnifyingGlass SimBrief or enter details manually</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-acars-bg text-acars-muted hover:text-acars-text transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4">

          {/* SimBrief Search */}
          <div>
            <label className={LABEL_CLS}>MagnifyingGlass SimBrief Aircraft Database</label>
            <div className="relative">
              <MagnifyingGlass className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-acars-muted" />
              <input
                type="text"
                value={sbQuery}
                onChange={e => searchSimBrief(e.target.value)}
                placeholder='Type to search (e.g. "737", "A320", "CRJ")'
                className="w-full h-9 rounded-md border border-acars-border bg-acars-bg text-xs text-acars-text pl-8 pr-3 outline-none focus:border-sky-400 transition-colors placeholder:text-acars-muted/50"
              />
              {sbLoading && <SpinnerGap className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-sky-400 animate-spin" />}
            </div>
            {sbResults.length > 0 && (
              <div className="mt-1.5 max-h-[180px] overflow-auto rounded-md border border-acars-border bg-acars-bg">
                {sbResults.map(ac => (
                  <button
                    key={ac.aircraftIcao}
                    onClick={() => selectSimBrief(ac)}
                    className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-acars-panel transition-colors border-b border-acars-border last:border-0"
                  >
                    <span className="font-mono tabular-nums font-bold text-xs text-sky-400 w-[48px] shrink-0">{ac.aircraftIcao}</span>
                    <span className="text-xs text-acars-text flex-1 truncate">{ac.aircraftName}</span>
                    <span className="text-[11px] text-acars-muted truncate max-w-[100px]">{ac.engines}</span>
                    <span className="text-[11px] text-acars-muted font-mono tabular-nums w-[40px] text-right">{ac.maxPax} pax</span>
                    <span className="text-[11px] text-acars-muted font-mono tabular-nums w-[70px] text-right">{fmt(ac.mtowLbs, 'lbs')}</span>
                  </button>
                ))}
              </div>
            )}
            {sbSelected && (
              <div className="mt-1.5 flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-sky-500/10 border border-sky-400/20 text-[11px] text-sky-400">
                <AirplaneTilt className="w-3 h-3" />
                Auto-filled from SimBrief: <span className="font-mono tabular-nums font-bold">{sbSelected.aircraftIcao}</span> — {sbSelected.aircraftName}
              </div>
            )}
          </div>

          <div className="relative flex items-center gap-3">
            <div className="flex-1 border-t border-acars-border" />
            <span className="text-[11px] text-acars-muted/60 uppercase tracking-wider">or enter details manually</span>
            <div className="flex-1 border-t border-acars-border" />
          </div>

          {/* Row 1: Type + Name */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL_CLS}>ICAO Type *</label>
              <input type="text" value={form.icaoType ?? ''} onChange={e => set('icaoType', e.target.value.toUpperCase())} placeholder="B738" className={INPUT_CLS} />
            </div>
            <div>
              <label className={LABEL_CLS}>Name *</label>
              <input type="text" value={form.name ?? ''} onChange={e => set('name', e.target.value)} placeholder="Boeing 737-800" className={INPUT_CLS.replace('tabular-nums ', '')} />
            </div>
          </div>

          {/* Row 2: Registration + Airline */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL_CLS}>Registration *</label>
              <input type="text" value={form.registration ?? ''} onChange={e => set('registration', e.target.value.toUpperCase())} placeholder="N801SM" className={INPUT_CLS} />
            </div>
            <div>
              <label className={LABEL_CLS}>Airline</label>
              <input type="text" value={form.airline ?? ''} onChange={e => set('airline', e.target.value.toUpperCase())} placeholder="SMX" className={INPUT_CLS} />
            </div>
          </div>

          {/* Row 3: Performance specs */}
          <div className="grid grid-cols-4 gap-3">
            <div>
              <label className={LABEL_CLS}>Range (nm) *</label>
              <input type="number" value={form.rangeNm ?? ''} onChange={e => set('rangeNm', parseInt(e.target.value) || 0)} placeholder="2935" className={INPUT_CLS} />
            </div>
            <div>
              <label className={LABEL_CLS}>Cruise (kts) *</label>
              <input type="number" value={form.cruiseSpeed ?? ''} onChange={e => set('cruiseSpeed', parseInt(e.target.value) || 0)} placeholder="453" className={INPUT_CLS} />
            </div>
            <div>
              <label className={LABEL_CLS}>Pax *</label>
              <input type="number" value={form.paxCapacity ?? ''} onChange={e => set('paxCapacity', parseInt(e.target.value) || 0)} placeholder="162" className={INPUT_CLS} />
            </div>
            <div>
              <label className={LABEL_CLS}>Cargo (lbs) *</label>
              <input type="number" value={form.cargoCapacityLbs ?? ''} onChange={e => set('cargoCapacityLbs', parseInt(e.target.value) || 0)} placeholder="5200" className={INPUT_CLS} />
            </div>
          </div>

          {/* Row 4: Weight specs */}
          <div className="grid grid-cols-5 gap-3">
            <div>
              <label className={LABEL_CLS}>OEW (lbs)</label>
              <input type="number" value={form.oewLbs ?? ''} onChange={e => set('oewLbs', parseInt(e.target.value) || 0)} placeholder="91300" className={INPUT_CLS} />
            </div>
            <div>
              <label className={LABEL_CLS}>MZFW (lbs)</label>
              <input type="number" value={form.mzfwLbs ?? ''} onChange={e => set('mzfwLbs', parseInt(e.target.value) || 0)} placeholder="128600" className={INPUT_CLS} />
            </div>
            <div>
              <label className={LABEL_CLS}>MTOW (lbs)</label>
              <input type="number" value={form.mtowLbs ?? ''} onChange={e => set('mtowLbs', parseInt(e.target.value) || 0)} placeholder="174200" className={INPUT_CLS} />
            </div>
            <div>
              <label className={LABEL_CLS}>MLW (lbs)</label>
              <input type="number" value={form.mlwLbs ?? ''} onChange={e => set('mlwLbs', parseInt(e.target.value) || 0)} placeholder="144000" className={INPUT_CLS} />
            </div>
            <div>
              <label className={LABEL_CLS}>Max GasPump (lbs)</label>
              <input type="number" value={form.maxFuelLbs ?? ''} onChange={e => set('maxFuelLbs', parseInt(e.target.value) || 0)} placeholder="46000" className={INPUT_CLS} />
            </div>
          </div>

          {/* Row 5: Airframe details */}
          <div className="grid grid-cols-4 gap-3">
            <div>
              <label className={LABEL_CLS}>Engines</label>
              <input type="text" value={form.engines ?? ''} onChange={e => set('engines', e.target.value)} placeholder="2x CFM56-7B" className={INPUT_CLS.replace('tabular-nums ', '')} />
            </div>
            <div>
              <label className={LABEL_CLS}>Ceiling (ft)</label>
              <input type="number" value={form.ceilingFt ?? ''} onChange={e => set('ceilingFt', parseInt(e.target.value) || 0)} placeholder="41000" className={INPUT_CLS} />
            </div>
            <div>
              <label className={LABEL_CLS}>Configuration</label>
              <input type="text" value={form.configuration ?? ''} onChange={e => set('configuration', e.target.value)} placeholder="Y162" className={INPUT_CLS} />
            </div>
            <div>
              <label className={LABEL_CLS}>Wake Cat</label>
              <input type="text" value={form.cat ?? ''} onChange={e => set('cat', e.target.value.toUpperCase())} placeholder="M" className={INPUT_CLS} />
            </div>
          </div>

          {/* Row 6: Status + Base + Location */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={LABEL_CLS}>Status</label>
              <select value={form.status ?? 'active'} onChange={e => set('status', e.target.value)} className={INPUT_CLS.replace('tabular-nums ', '')}>
                <option value="active">Active</option>
                <option value="stored">Stored</option>
                <option value="retired">Retired</option>
              </select>
            </div>
            <div>
              <label className={LABEL_CLS}>Base ICAO</label>
              <input type="text" value={form.baseIcao ?? ''} onChange={e => set('baseIcao', e.target.value.toUpperCase())} placeholder="KJFK" className={INPUT_CLS} />
            </div>
            <div>
              <label className={LABEL_CLS}>Location ICAO</label>
              <input type="text" value={form.locationIcao ?? ''} onChange={e => set('locationIcao', e.target.value.toUpperCase())} placeholder="KJFK" className={INPUT_CLS} />
            </div>
          </div>

          {/* Remarks */}
          <div>
            <label className={LABEL_CLS}>Remarks</label>
            <textarea
              value={form.remarks ?? ''}
              onChange={e => set('remarks', e.target.value)}
              rows={2}
              placeholder="Optional notes..."
              className="w-full rounded-md border border-acars-border bg-acars-bg text-xs text-acars-text px-2.5 py-2 outline-none focus:border-emerald-400 transition-colors placeholder:text-acars-muted/50 resize-none"
            />
          </div>

          {error && (
            <p className="text-[12px] text-red-400 bg-red-500/10 border border-red-400/20 rounded-md px-3 py-2">{error}</p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-acars-border">
          <button
            onClick={onClose}
            className="btn-secondary btn-md"
          >
            Cancel
          </button>
          <button
            disabled={!canSubmit}
            onClick={handleSubmit}
            className="btn-green btn-md"
          >
            {submitting ? <SpinnerGap className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
            Add Aircraft
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Spec Row Helper ────────────────────────────────────────────

function SpecRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-acars-border last:border-0">
      <span className="text-[11px] text-acars-muted uppercase tracking-wider">{label}</span>
      <span className="text-xs font-mono tabular-nums font-semibold text-acars-text">{value}</span>
    </div>
  );
}

// ─── Fleet Detail Panel (Expanded Row) ──────────────────────────

// ─── Utilization Stats ────────────────────────────────────────

interface UtilizationStatsData {
  totalFlights: number;
  totalHours: number;
  lastFlightDate: string | null;
  avgScore: number | null;
  avgLandingRate: number | null;
}

function UtilizationStats({ aircraftId }: { aircraftId: number }) {
  const [stats, setStats] = useState<UtilizationStatsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.get<UtilizationStatsData>(`/api/fleet/manage/${aircraftId}/stats`)
      .then(setStats)
      .catch(() => setStats(null))
      .finally(() => setLoading(false));
  }, [aircraftId]);

  return (
    <div className="rounded-md border border-acars-border bg-acars-panel/50 p-3">
      <div className="flex items-center gap-2 mb-3">
        <ChartBar className="w-3.5 h-3.5 text-sky-400" />
        <span className="text-[11px] uppercase tracking-wider text-acars-muted font-medium">Utilization</span>
      </div>
      {loading ? (
        <div className="flex items-center gap-2 py-2">
          <SpinnerGap className="w-3.5 h-3.5 text-acars-muted animate-spin" />
          <span className="text-[12px] text-acars-muted">Loading stats...</span>
        </div>
      ) : !stats || stats.totalFlights === 0 ? (
        <p className="text-[12px] text-acars-muted/60 italic">No flights recorded for this aircraft</p>
      ) : (
        <div className="grid grid-cols-5 gap-3">
          <div>
            <div className="text-[11px] text-acars-muted">Total Flights</div>
            <div className="text-sm font-mono font-semibold text-acars-text">{stats.totalFlights}</div>
          </div>
          <div>
            <div className="text-[11px] text-acars-muted">Total Hours</div>
            <div className="text-sm font-mono font-semibold text-acars-text">{stats.totalHours.toFixed(1)}h</div>
          </div>
          <div>
            <div className="text-[11px] text-acars-muted">Avg Score</div>
            <div className="text-sm font-mono font-semibold text-emerald-400">{stats.avgScore?.toFixed(0) ?? '—'}</div>
          </div>
          <div>
            <div className="text-[11px] text-acars-muted">Avg Landing</div>
            <div className={`text-sm font-mono font-semibold ${(stats.avgLandingRate ?? 999) < 200 ? 'text-emerald-400' : (stats.avgLandingRate ?? 999) < 400 ? 'text-amber-400' : 'text-red-400'}`}>
              {stats.avgLandingRate?.toFixed(0) ?? '—'} fpm
            </div>
          </div>
          <div>
            <div className="text-[11px] text-acars-muted">Last Flight</div>
            <div className="text-sm font-mono font-semibold text-acars-text">
              {stats.lastFlightDate ? new Date(stats.lastFlightDate).toLocaleDateString() : '—'}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Check Card (A/B/C/D) ──────────────────────────────────────

const CHECK_COLORS: Record<string, { bar: string; label: string; border: string }> = {
  A: { bar: 'bg-blue-500', label: 'text-blue-400', border: 'border-blue-500/40' },
  B: { bar: 'bg-cyan-500', label: 'text-cyan-400', border: 'border-cyan-500/40' },
  C: { bar: 'bg-amber-500', label: 'text-amber-400', border: 'border-amber-500/40' },
  D: { bar: 'bg-violet-500', label: 'text-violet-400', border: 'border-violet-500/40' },
};

function CheckCard({ check }: { check: CheckDueStatus }) {
  const isOverdue = check.isOverdue;
  const colors = CHECK_COLORS[check.checkType] ?? { bar: 'bg-blue-500', label: 'text-blue-400', border: 'border-blue-500/40' };
  const pct = check.remainingHours != null && check.dueAtHours != null && check.dueAtHours > 0
    ? Math.max(0, Math.min(100, ((check.dueAtHours - check.remainingHours) / check.dueAtHours) * 100))
    : 0;
  const barColor = isOverdue ? 'bg-red-500' : colors.bar;
  const borderColor = isOverdue ? 'border-red-500/40' : check.isInOverflight ? colors.border : 'border-acars-border';

  return (
    <div className={`flex flex-col flex-1 p-3 rounded-md bg-acars-bg border ${borderColor} gap-2`}>
      <div className="flex items-center gap-1.5">
        <span className={`text-xs font-bold ${isOverdue ? 'text-red-400' : colors.label}`}>{check.checkType}-Check</span>
        {isOverdue && <Warning className="w-3 h-3 text-red-400" />}
      </div>
      {check.checkType === 'D' ? (
        <div className="flex items-center justify-between">
          <span className="text-[9px] text-acars-muted">Due Date</span>
          <span className={`text-[12px] font-mono font-semibold tabular-nums ${isOverdue ? 'text-red-400' : 'text-acars-text'}`}>
            {check.dueAtDate ?? '—'}
          </span>
        </div>
      ) : (
        <>
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[9px] text-acars-muted">Rem. Hours</span>
              <span className={`text-[12px] font-mono font-semibold tabular-nums ${isOverdue ? 'text-red-400' : 'text-acars-text'}`}>
                {check.remainingHours != null ? check.remainingHours.toLocaleString() : '—'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[9px] text-acars-muted">Rem. Cycles</span>
              <span className={`text-[12px] font-mono font-semibold tabular-nums ${isOverdue ? 'text-red-400' : 'text-acars-text'}`}>
                {check.remainingCycles != null ? check.remainingCycles.toLocaleString() : '—'}
              </span>
            </div>
          </div>
          <div className="h-[3px] rounded-full bg-acars-border/50">
            <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
          </div>
        </>
      )}
    </div>
  );
}

// ─── Maintenance Section ───────────────────────────────────────

function MaintenanceSection({ aircraftId }: { aircraftId: number }) {
  const [maintenance, setMaintenance] = useState<FleetMaintenanceStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.get<FleetMaintenanceStatus>(`/api/fleet/manage/${aircraftId}/maintenance`)
      .then(setMaintenance)
      .catch(() => setMaintenance(null))
      .finally(() => setLoading(false));
  }, [aircraftId]);

  return (
    <div className="rounded-md border border-acars-border bg-acars-panel/50 p-3">
      <div className="flex items-center gap-2 mb-3">
        <Wrench className="w-3.5 h-3.5 text-amber-400" />
        <span className="text-[11px] uppercase tracking-wider text-acars-muted font-medium">Maintenance</span>
      </div>
      {loading ? (
        <div className="flex items-center gap-2 py-2">
          <SpinnerGap className="w-3.5 h-3.5 text-acars-muted animate-spin" />
          <span className="text-[12px] text-acars-muted">Loading maintenance data...</span>
        </div>
      ) : !maintenance ? (
        <p className="text-[12px] text-acars-muted/60 italic">No maintenance data available</p>
      ) : (
        <div className="space-y-3">
          {/* Summary row */}
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-acars-muted font-mono tabular-nums">
              {maintenance.totalHours.toLocaleString()} hrs · {maintenance.totalCycles.toLocaleString()} cycles
            </span>
            {maintenance.hasOverdueChecks ? (
              <span className="flex items-center gap-1 text-[11px] text-red-400">
                <Warning className="w-3 h-3" /> Overdue checks
              </span>
            ) : (
              <span className="flex items-center gap-1 text-[11px] text-emerald-400">
                <CheckCircle className="w-3 h-3" /> All checks current
              </span>
            )}
          </div>

          {/* Check cards grid */}
          {maintenance.checksDue.length > 0 ? (
            <div className="grid grid-cols-4 gap-2">
              {maintenance.checksDue.map((check) => (
                <CheckCard key={check.checkType} check={check} />
              ))}
            </div>
          ) : (
            <p className="text-[12px] text-acars-muted/60 italic">No check schedules configured for this aircraft type</p>
          )}
        </div>
      )}
    </div>
  );
}

interface FleetDetailPanelProps {
  aircraft: FleetAircraft;
  isAdmin: boolean;
  onSave: (id: number, data: UpdateFleetAircraftRequest) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
}

function FleetDetailPanel({ aircraft, isAdmin, onSave, onDelete }: FleetDetailPanelProps) {
  const a = aircraft;

  // Admin edit state
  const [editStatus, setEditStatus] = useState(a.status);
  const [editBase, setEditBase] = useState(a.baseIcao ?? '');
  const [editLocation, setEditLocation] = useState(a.locationIcao ?? '');
  const [editRemarks, setEditRemarks] = useState(a.remarks ?? '');
  const [editOew, setEditOew] = useState<string>(a.oewLbs?.toString() ?? '');
  const [editMzfw, setEditMzfw] = useState<string>(a.mzfwLbs?.toString() ?? '');
  const [editMtow, setEditMtow] = useState<string>(a.mtowLbs?.toString() ?? '');
  const [editMlw, setEditMlw] = useState<string>(a.mlwLbs?.toString() ?? '');
  const [editMaxFuel, setEditMaxFuel] = useState<string>(a.maxFuelLbs?.toString() ?? '');
  const [editEngines, setEditEngines] = useState(a.engines ?? '');
  const [editCeiling, setEditCeiling] = useState<string>(a.ceilingFt?.toString() ?? '');
  const [editConfig, setEditConfig] = useState(a.configuration ?? '');
  const [editCat, setEditCat] = useState(a.cat ?? '');
  const [editEquip, setEditEquip] = useState(a.equipCode ?? '');
  const [editTransponder, setEditTransponder] = useState(a.transponderCode ?? '');
  const [editPbn, setEditPbn] = useState(a.pbn ?? '');
  const [editSelcal, setEditSelcal] = useState(a.selcal ?? '');
  const [editHexCode, setEditHexCode] = useState(a.hexCode ?? '');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const EDIT_INPUT = 'w-full h-8 rounded-md border border-acars-border bg-acars-bg text-xs text-acars-text px-2 tabular-nums outline-none focus:border-blue-400 transition-colors placeholder:text-acars-muted/50';

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(a.id, {
        status: editStatus,
        baseIcao: editBase || null,
        locationIcao: editLocation || null,
        remarks: editRemarks || null,
        oewLbs: editOew ? parseInt(editOew) : null,
        mzfwLbs: editMzfw ? parseInt(editMzfw) : null,
        mtowLbs: editMtow ? parseInt(editMtow) : null,
        mlwLbs: editMlw ? parseInt(editMlw) : null,
        maxFuelLbs: editMaxFuel ? parseInt(editMaxFuel) : null,
        engines: editEngines || null,
        ceilingFt: editCeiling ? parseInt(editCeiling) : null,
        configuration: editConfig || null,
        cat: editCat || null,
        equipCode: editEquip || null,
        transponderCode: editTransponder || null,
        pbn: editPbn || null,
        selcal: editSelcal || null,
        hexCode: editHexCode || null,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await onDelete(a.id);
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  return (
    <div className="p-4 space-y-4 animate-in fade-in slide-in-from-top-1 duration-200">

      {/* Section 1: Aircraft Info + Specifications */}
      <div className="grid grid-cols-2 gap-4">
        {/* Left: Aircraft Info */}
        <div className="rounded-md border border-acars-border bg-acars-panel/50 p-3">
          <div className="flex items-center gap-2 mb-3">
            <AirplaneTilt className="w-3.5 h-3.5 text-sky-400" />
            <span className="text-[11px] uppercase tracking-wider text-acars-muted font-medium">Aircraft Info</span>
          </div>
          <div className="space-y-0">
            <SpecRow label="ICAO Type" value={a.icaoType} />
            <SpecRow label="IATA Type" value={a.iataType ?? '—'} />
            <SpecRow label="Configuration" value={a.configuration ?? '—'} />
            <SpecRow label="Engines" value={a.engines ?? '—'} />
            <SpecRow label="Airline" value={a.airline} />
            <SpecRow label="Home Base" value={a.baseIcao ?? '—'} />
            <SpecRow label="Status" value={a.status.charAt(0).toUpperCase() + a.status.slice(1)} />
            <SpecRow label="Location" value={a.locationIcao ?? '—'} />
            <SpecRow label="Wake Category" value={a.cat ?? '—'} />
            {a.isCargo && <SpecRow label="Type" value="Cargo" />}
          </div>
        </div>

        {/* Right: Specifications */}
        <div className="rounded-md border border-acars-border bg-acars-panel/50 p-3">
          <div className="flex items-center gap-2 mb-3">
            <Scales className="w-3.5 h-3.5 text-blue-400" />
            <span className="text-[11px] uppercase tracking-wider text-acars-muted font-medium">Specifications</span>
          </div>
          <div className="space-y-0">
            <SpecRow label="OEW" value={fmt(a.oewLbs, 'lbs')} />
            <SpecRow label="MZFW" value={fmt(a.mzfwLbs, 'lbs')} />
            <SpecRow label="MTOW" value={fmt(a.mtowLbs, 'lbs')} />
            <SpecRow label="MLW" value={fmt(a.mlwLbs, 'lbs')} />
            <SpecRow label="Fuel Capacity" value={fmt(a.maxFuelLbs, 'lbs')} />
            <SpecRow label="Range" value={fmt(a.rangeNm, 'nm')} />
            <SpecRow label="Cruise Speed" value={fmt(a.cruiseSpeed, 'kts')} />
            <SpecRow label="Ceiling" value={fmt(a.ceilingFt, 'ft')} />
            <SpecRow label="Passengers" value={a.paxCapacity?.toString() ?? '—'} />
            <SpecRow label="Cargo Capacity" value={fmt(a.cargoCapacityLbs, 'lbs')} />
          </div>
        </div>
      </div>

      {/* Equipment codes (if any exist) */}
      {(a.equipCode || a.transponderCode || a.pbn || a.selcal || a.hexCode) && (
        <div className="rounded-md border border-acars-border bg-acars-panel/50 p-3">
          <div className="flex items-center gap-2 mb-3">
            <Broadcast className="w-3.5 h-3.5 text-blue-400" />
            <span className="text-[11px] uppercase tracking-wider text-acars-muted font-medium">Equipment Codes</span>
          </div>
          <div className="grid grid-cols-5 gap-3">
            {a.equipCode && <div><div className="text-[11px] text-acars-muted">Equipment</div><div className="text-xs font-mono tabular-nums text-acars-text">{a.equipCode}</div></div>}
            {a.transponderCode && <div><div className="text-[11px] text-acars-muted">Transponder</div><div className="text-xs font-mono tabular-nums text-acars-text">{a.transponderCode}</div></div>}
            {a.pbn && <div><div className="text-[11px] text-acars-muted">PBN</div><div className="text-xs font-mono tabular-nums text-acars-text">{a.pbn}</div></div>}
            {a.selcal && <div><div className="text-[11px] text-acars-muted">SELCAL</div><div className="text-xs font-mono tabular-nums text-acars-text">{a.selcal}</div></div>}
            {a.hexCode && <div><div className="text-[11px] text-acars-muted">Hex Code</div><div className="text-xs font-mono tabular-nums text-acars-text">{a.hexCode}</div></div>}
          </div>
        </div>
      )}

      {/* Section 2: Maintenance */}
      <MaintenanceSection aircraftId={a.id} />

      {/* Section 3: Flight Reports placeholder */}
      <div className="rounded-md border border-acars-border bg-acars-panel/50 p-3">
        <div className="flex items-center gap-2 mb-2">
          <FileText className="w-3.5 h-3.5 text-emerald-400" />
          <span className="text-[11px] uppercase tracking-wider text-acars-muted font-medium">Flight Reports</span>
        </div>
        <p className="text-[12px] text-acars-muted/60 italic">No flights recorded for this aircraft</p>
      </div>

      {/* Section 4: Utilization Statistics */}
      <UtilizationStats aircraftId={a.id} />

      {/* Remarks (pilot view) */}
      {a.remarks && !isAdmin && (
        <div className="rounded-md border border-acars-border bg-acars-panel/50 p-3">
          <div className="flex items-center gap-1.5 text-[11px] text-acars-muted mb-1">
            <ChatText className="w-3 h-3" /> Remarks
          </div>
          <p className="text-[12px] text-acars-muted/80">{a.remarks}</p>
        </div>
      )}

      {/* Section 5: Admin Controls */}
      {isAdmin && (
        <div className="rounded-md border border-acars-border bg-acars-panel/50 p-4">
          <div className="flex items-center gap-2 mb-3">
            <GearSix className="w-3.5 h-3.5 text-red-400" />
            <span className="text-[11px] uppercase tracking-wider text-acars-muted font-medium">Admin Controls</span>
          </div>

          <div className="space-y-3">
            {/* Row: Status + Base + Location */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-[11px] uppercase tracking-wider text-acars-muted font-medium mb-1 block">Status</label>
                <select value={editStatus} onChange={e => setEditStatus(e.target.value as FleetStatus)} className={EDIT_INPUT.replace('tabular-nums ', '')}>
                  <option value="active">Active</option>
                  <option value="stored">Stored</option>
                  <option value="maintenance">Maintenance</option>
                  <option value="retired">Retired</option>
                </select>
              </div>
              <div>
                <label className="text-[11px] uppercase tracking-wider text-acars-muted font-medium mb-1 block">Base</label>
                <input type="text" value={editBase} onChange={e => setEditBase(e.target.value.toUpperCase())} placeholder="KJFK" className={EDIT_INPUT} />
              </div>
              <div>
                <label className="text-[11px] uppercase tracking-wider text-acars-muted font-medium mb-1 block">Location</label>
                <input type="text" value={editLocation} onChange={e => setEditLocation(e.target.value.toUpperCase())} placeholder="KJFK" className={EDIT_INPUT} />
              </div>
            </div>

            {/* Row: Weight specs */}
            <div className="grid grid-cols-5 gap-3">
              <div>
                <label className="text-[11px] uppercase tracking-wider text-acars-muted font-medium mb-1 block">OEW (lbs)</label>
                <input type="number" value={editOew} onChange={e => setEditOew(e.target.value)} placeholder="91300" className={EDIT_INPUT} />
              </div>
              <div>
                <label className="text-[11px] uppercase tracking-wider text-acars-muted font-medium mb-1 block">MZFW (lbs)</label>
                <input type="number" value={editMzfw} onChange={e => setEditMzfw(e.target.value)} placeholder="128600" className={EDIT_INPUT} />
              </div>
              <div>
                <label className="text-[11px] uppercase tracking-wider text-acars-muted font-medium mb-1 block">MTOW (lbs)</label>
                <input type="number" value={editMtow} onChange={e => setEditMtow(e.target.value)} placeholder="174200" className={EDIT_INPUT} />
              </div>
              <div>
                <label className="text-[11px] uppercase tracking-wider text-acars-muted font-medium mb-1 block">MLW (lbs)</label>
                <input type="number" value={editMlw} onChange={e => setEditMlw(e.target.value)} placeholder="144000" className={EDIT_INPUT} />
              </div>
              <div>
                <label className="text-[11px] uppercase tracking-wider text-acars-muted font-medium mb-1 block">Max GasPump (lbs)</label>
                <input type="number" value={editMaxFuel} onChange={e => setEditMaxFuel(e.target.value)} placeholder="46000" className={EDIT_INPUT} />
              </div>
            </div>

            {/* Row: Airframe details */}
            <div className="grid grid-cols-4 gap-3">
              <div>
                <label className="text-[11px] uppercase tracking-wider text-acars-muted font-medium mb-1 block">Engines</label>
                <input type="text" value={editEngines} onChange={e => setEditEngines(e.target.value)} placeholder="2x CFM56-7B" className={EDIT_INPUT} />
              </div>
              <div>
                <label className="text-[11px] uppercase tracking-wider text-acars-muted font-medium mb-1 block">Ceiling (ft)</label>
                <input type="number" value={editCeiling} onChange={e => setEditCeiling(e.target.value)} placeholder="41000" className={EDIT_INPUT} />
              </div>
              <div>
                <label className="text-[11px] uppercase tracking-wider text-acars-muted font-medium mb-1 block">Configuration</label>
                <input type="text" value={editConfig} onChange={e => setEditConfig(e.target.value)} placeholder="Y162" className={EDIT_INPUT} />
              </div>
              <div>
                <label className="text-[11px] uppercase tracking-wider text-acars-muted font-medium mb-1 block">Wake Cat</label>
                <input type="text" value={editCat} onChange={e => setEditCat(e.target.value.toUpperCase())} placeholder="M" className={EDIT_INPUT} />
              </div>
            </div>

            {/* Row: Equipment codes */}
            <div className="grid grid-cols-5 gap-3">
              <div>
                <label className="text-[11px] uppercase tracking-wider text-acars-muted font-medium mb-1 block">Equip Code</label>
                <input type="text" value={editEquip} onChange={e => setEditEquip(e.target.value)} placeholder="SDE2E3FGHIJ2J3J5M1RWXY" className={EDIT_INPUT} />
              </div>
              <div>
                <label className="text-[11px] uppercase tracking-wider text-acars-muted font-medium mb-1 block">Transponder</label>
                <input type="text" value={editTransponder} onChange={e => setEditTransponder(e.target.value)} placeholder="LB1" className={EDIT_INPUT} />
              </div>
              <div>
                <label className="text-[11px] uppercase tracking-wider text-acars-muted font-medium mb-1 block">PBN</label>
                <input type="text" value={editPbn} onChange={e => setEditPbn(e.target.value)} placeholder="A1B1C1D1O1S1S2" className={EDIT_INPUT} />
              </div>
              <div>
                <label className="text-[11px] uppercase tracking-wider text-acars-muted font-medium mb-1 block">SELCAL</label>
                <input type="text" value={editSelcal} onChange={e => setEditSelcal(e.target.value.toUpperCase())} placeholder="AB-CD" className={EDIT_INPUT} />
              </div>
              <div>
                <label className="text-[11px] uppercase tracking-wider text-acars-muted font-medium mb-1 block">Hex Code</label>
                <input type="text" value={editHexCode} onChange={e => setEditHexCode(e.target.value.toUpperCase())} placeholder="A12345" className={EDIT_INPUT} />
              </div>
            </div>

            {/* Remarks */}
            <div>
              <label className="text-[11px] uppercase tracking-wider text-acars-muted font-medium mb-1 block">Remarks</label>
              <textarea
                value={editRemarks}
                onChange={e => setEditRemarks(e.target.value)}
                rows={2}
                placeholder="Add notes..."
                className="w-full rounded-md border border-acars-border bg-acars-bg text-xs text-acars-text px-2 py-1.5 outline-none focus:border-blue-400 transition-colors placeholder:text-acars-muted/50 resize-none"
              />
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2 pt-1">
              <button
                disabled={saving}
                onClick={handleSave}
                className="btn-primary btn-sm"
              >
                {saving ? <SpinnerGap className="w-3 h-3 animate-spin" /> : <FloppyDisk className="w-3 h-3" />}
                Save Changes
              </button>
              {!confirmDelete ? (
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-semibold text-red-400 bg-red-500/10 border border-red-400/20 hover:bg-red-500/20 transition-colors"
                >
                  <Trash className="w-3 h-3" /> Delete
                </button>
              ) : (
                <div className="flex items-center gap-1.5">
                  <button
                    disabled={deleting}
                    onClick={handleDelete}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[11px] font-bold text-white bg-red-500 hover:bg-red-500/80 transition-colors disabled:opacity-50"
                  >
                    {deleting ? <SpinnerGap className="w-3 h-3 animate-spin" /> : <Warning className="w-3 h-3" />}
                    Confirm
                  </button>
                  <button
                    onClick={() => setConfirmDelete(false)}
                    className="btn-secondary btn-sm"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Fleet Page ─────────────────────────────────────────────────

export function FleetPage() {
  const user = useAuthStore(s => s.user);
  const isAdmin = user?.role === 'admin';

  // Filter state
  const [aircraftTypes, setAircraftTypes] = useState<string[]>([]);
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const searchTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Data state
  const [fleet, setFleet] = useState<FleetAircraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [addModalOpen, setAddModalOpen] = useState(false);

  // ── Load aircraft types on mount ────────────────────────────
  useEffect(() => {
    api.get<string[]>('/api/fleet/manage/types')
      .then(setAircraftTypes)
      .catch(err => console.error('[Fleet] Failed to load types:', err));
  }, []);

  // ── Fetch fleet whenever filters change ─────────────────────
  const fetchFleet = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (typeFilter) params.set('type', typeFilter);
      if (statusFilter) params.set('status', statusFilter);
      if (searchTerm) params.set('search', searchTerm);

      const qs = params.toString();
      const data = await api.get<FleetListResponse>(`/api/fleet/manage${qs ? `?${qs}` : ''}`);
      setFleet(data.fleet);
    } catch (err) {
      console.error('[Fleet] Failed to fetch fleet:', err);
    } finally {
      setLoading(false);
    }
  }, [typeFilter, statusFilter, searchTerm]);

  useEffect(() => { fetchFleet(); }, [fetchFleet]);

  // ── Live updates from admin fleet changes ─────────────────
  useSocketSubscription('fleet:updated', () => { fetchFleet(); });

  // ── Search debounce ─────────────────────────────────────────
  const handleSearchChange = (value: string) => {
    setSearchInput(value);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setSearchTerm(value), 300);
  };

  // ── Reset filters ───────────────────────────────────────────
  const resetFilters = () => {
    setTypeFilter('');
    setStatusFilter('');
    setSearchInput('');
    setSearchTerm('');
  };

  const hasFilters = typeFilter || statusFilter || searchTerm;

  // ── Status counts ───────────────────────────────────────────
  const statusCounts = useMemo(() => {
    const counts = { active: 0, stored: 0, retired: 0, maintenance: 0, reserved: 0, inFlight: 0 };
    fleet.forEach(a => {
      if (a.bidFlightPhase === 'airborne' || a.bidFlightPhase === 'active') {
        counts.inFlight++;
      } else if (a.reservedByPilot) {
        counts.reserved++;
      }
      if (counts[a.status as keyof typeof counts] !== undefined) {
        (counts as any)[a.status]++;
      }
    });
    return counts;
  }, [fleet]);

  // ── Admin: Save aircraft ────────────────────────────────────
  const handleSave = async (id: number, data: UpdateFleetAircraftRequest) => {
    try {
      const updated = await api.patch<FleetAircraft>(`/api/fleet/manage/${id}`, data);
      setFleet(prev => prev.map(a => a.id === id ? updated : a));
    } catch (err) {
      console.error('[Fleet] Save error:', err);
    }
  };

  // ── Admin: Delete aircraft ──────────────────────────────────
  const handleDelete = async (id: number) => {
    try {
      await api.delete(`/api/fleet/manage/${id}`);
      setFleet(prev => prev.filter(a => a.id !== id));
      if (expandedId === id) setExpandedId(null);
    } catch (err) {
      console.error('[Fleet] Delete error:', err);
    }
  };

  // ── Admin: Aircraft added ───────────────────────────────────
  const handleAircraftCreated = (aircraft: FleetAircraft) => {
    setFleet(prev => [...prev, aircraft].sort((a, b) =>
      a.icaoType.localeCompare(b.icaoType) || a.registration.localeCompare(b.registration)
    ));
    setAddModalOpen(false);
    setExpandedId(aircraft.id);
    // Refresh types in case a new type was added
    api.get<string[]>('/api/fleet/manage/types').then(setAircraftTypes).catch(() => {});
  };

  // ── Render ──────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Filter bar */}
      <div className="panel m-5 mb-0">
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-acars-border">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-7 h-7 rounded-md bg-sky-500/10 border border-sky-400/20">
              <AirplaneTilt className="w-3.5 h-3.5 text-sky-400" />
            </div>
            <h2 className="text-[13px] font-semibold text-acars-text">Fleet Management</h2>
            <span className="text-[11px] text-acars-muted font-mono tabular-nums">
              {loading ? '' : `${fleet.length} aircraft`}
            </span>
            {!loading && (
              <div className="flex items-center gap-1.5 ml-2">
                <span className="text-[11px] text-emerald-400 font-mono tabular-nums">{statusCounts.active} active</span>
                {statusCounts.stored > 0 && <span className="text-[11px] text-amber-400 font-mono tabular-nums">{statusCounts.stored} stored</span>}
                {statusCounts.retired > 0 && <span className="text-[11px] text-red-400 font-mono tabular-nums">{statusCounts.retired} retired</span>}
                {statusCounts.reserved > 0 && <span className="text-[11px] text-amber-400 font-mono tabular-nums">{statusCounts.reserved} reserved</span>}
                {statusCounts.inFlight > 0 && <span className="text-[11px] text-blue-400 font-mono tabular-nums">{statusCounts.inFlight} in flight</span>}
              </div>
            )}
            {loading && <SpinnerGap className="w-3.5 h-3.5 text-blue-400 animate-spin" />}
          </div>
          {isAdmin && (
            <button
              onClick={() => setAddModalOpen(true)}
              className="btn-green btn-sm"
            >
              <Plus className="w-3.5 h-3.5" /> Add Aircraft
            </button>
          )}
        </div>
        <div className="flex items-center gap-3 px-4 py-3">
          {/* Aircraft type */}
          <select
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value)}
            className="select-field min-w-[140px]"
          >
            <option value="">All Types</option>
            {aircraftTypes.map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>

          {/* Status */}
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="select-field min-w-[120px]"
          >
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="stored">Stored</option>
            <option value="retired">Retired</option>
          </select>

          {/* MagnifyingGlass */}
          <div className="relative flex-1 max-w-[240px]">
            <MagnifyingGlass className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-acars-muted" />
            <input
              type="text"
              value={searchInput}
              onChange={e => handleSearchChange(e.target.value)}
              placeholder="Search registration, type..."
              className="w-full h-8 rounded-md border border-acars-border bg-acars-bg text-xs text-acars-text pl-8 pr-3 outline-none focus:border-blue-400 transition-colors placeholder:text-acars-muted/50"
            />
          </div>

          {/* Reset */}
          {hasFilters && (
            <button
              onClick={resetFilters}
              className="btn-secondary btn-sm flex items-center gap-1.5 h-8"
            >
              <ArrowCounterClockwise className="w-3 h-3" /> Reset
            </button>
          )}
        </div>
      </div>

      {/* Fleet table */}
      <div className="flex-1 mx-5 mt-4 mb-5 panel flex flex-col overflow-hidden">
        <div className="flex-1 overflow-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 z-10 bg-acars-bg">
              <tr className="text-[11px] uppercase tracking-wider text-acars-muted border-b border-acars-border">
                <th className="text-left px-4 py-2.5 font-medium">Registration</th>
                <th className="text-left px-4 py-2.5 font-medium">Type</th>
                <th className="text-left px-4 py-2.5 font-medium">Aircraft</th>
                <th className="text-left px-4 py-2.5 font-medium">Base</th>
                <th className="text-left px-4 py-2.5 font-medium">Location</th>
                <th className="text-right px-4 py-2.5 font-medium">Range</th>
                <th className="text-right px-4 py-2.5 font-medium">Pax</th>
                <th className="text-right px-4 py-2.5 font-medium">Cargo</th>
                <th className="text-center px-4 py-2.5 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {loading && fleet.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-16 text-center">
                    <SpinnerGap className="w-5 h-5 text-blue-400 animate-spin mx-auto mb-2" />
                    <span className="text-xs text-acars-muted">Loading fleet...</span>
                  </td>
                </tr>
              ) : fleet.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-16">
                    <div className="empty-state">
                      <AirplaneTilt className="empty-state-icon" />
                      <p className="empty-state-title">No Aircraft Found</p>
                      <p className="empty-state-desc">No aircraft match your current filters</p>
                    </div>
                  </td>
                </tr>
              ) : (
                fleet.map((a, i) => {
                  const isExpanded = expandedId === a.id;
                  return (
                    <Fragment key={a.id}>
                      <tr
                        onClick={() => setExpandedId(isExpanded ? null : a.id)}
                        className={`border-b border-acars-border hover:bg-acars-hover transition-colors cursor-pointer ${
                          isExpanded ? 'bg-acars-hover' : i % 2 === 0 ? 'bg-acars-input' : 'bg-acars-bg'
                        }`}
                      >
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2">
                            <CaretDown className={`w-3.5 h-3.5 text-acars-muted/50 transition-transform duration-200 shrink-0 ${isExpanded ? 'rotate-0' : '-rotate-90'}`} />
                            <span className="font-mono tabular-nums font-semibold text-acars-text">{a.registration}</span>
                          </div>
                        </td>
                        <td className="px-4 py-2.5 font-mono tabular-nums text-acars-muted">{a.icaoType}</td>
                        <td className="px-4 py-2.5 text-acars-text">{a.name}</td>
                        <td className="px-4 py-2.5 font-mono tabular-nums text-acars-muted">{a.baseIcao ?? '—'}</td>
                        <td className="px-4 py-2.5 font-mono tabular-nums text-acars-muted">{a.locationIcao ?? '—'}</td>
                        <td className="px-4 py-2.5 text-right font-mono tabular-nums text-acars-muted">{a.rangeNm.toLocaleString()} nm</td>
                        <td className="px-4 py-2.5 text-right font-mono tabular-nums text-acars-muted">{a.paxCapacity}</td>
                        <td className="px-4 py-2.5 text-right font-mono tabular-nums text-acars-muted">{a.cargoCapacityLbs.toLocaleString()}</td>
                        <td className="px-4 py-2.5 text-center">
                          <FleetStatusDisplay aircraft={a} />
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="bg-acars-input border-b border-acars-border">
                          <td colSpan={9}>
                            <FleetDetailPanel
                              aircraft={a}
                              isAdmin={isAdmin}
                              onSave={handleSave}
                              onDelete={handleDelete}
                            />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Aircraft Modal */}
      {addModalOpen && (
        <AddAircraftModal
          onClose={() => setAddModalOpen(false)}
          onCreated={handleAircraftCreated}
        />
      )}
    </div>
  );
}
