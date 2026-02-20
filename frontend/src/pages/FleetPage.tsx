import { Fragment, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  Plane,
  Search,
  RotateCcw,
  Loader2,
  ChevronDown,
  Plus,
  X,
  Save,
  Trash2,
  MapPin,
  Gauge,
  Users,
  Package,
  Ruler,
  AlertTriangle,
  MessageSquare,
  Weight,
  Fuel,
  CloudCog,
  BarChart3,
  FileText,
  Wrench,
  Settings2,
  ArrowUpDown,
  Shield,
  Radio,
} from 'lucide-react';
import { api } from '../lib/api';
import { useAuthStore } from '../stores/authStore';
import type {
  FleetAircraft,
  FleetStatus,
  FleetListResponse,
  CreateFleetAircraftRequest,
  UpdateFleetAircraftRequest,
  SimBriefAircraftType,
  SimBriefAircraftSearchResponse,
} from '@acars/shared';

// ─── Helpers ────────────────────────────────────────────────────

const STATUS_CONFIG: Record<FleetStatus, { label: string; bg: string; text: string; border: string }> = {
  active:      { label: 'Active',      bg: 'bg-acars-green/10',  text: 'text-acars-green',  border: 'border-acars-green/20' },
  stored:      { label: 'Stored',      bg: 'bg-acars-amber/10',  text: 'text-acars-amber',  border: 'border-acars-amber/20' },
  retired:     { label: 'Retired',     bg: 'bg-acars-red/10',    text: 'text-acars-red',    border: 'border-acars-red/20' },
  maintenance: { label: 'Maintenance', bg: 'bg-acars-cyan/10',   text: 'text-acars-cyan',   border: 'border-acars-cyan/20' },
};

function StatusBadge({ status }: { status: FleetStatus }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.active;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${cfg.bg} ${cfg.text} border ${cfg.border}`}>
      {cfg.label}
    </span>
  );
}

function fmt(val: number | null | undefined, suffix = ''): string {
  if (val == null) return '—';
  return val.toLocaleString() + (suffix ? ` ${suffix}` : '');
}

const INPUT_CLS = 'w-full h-9 rounded-md border border-acars-border bg-acars-bg text-xs text-acars-text px-2.5 font-mono outline-none focus:border-acars-green transition-colors placeholder:text-acars-muted/50';
const LABEL_CLS = 'text-[10px] uppercase tracking-wider text-acars-muted font-medium mb-1.5 block';

// ─── Add Aircraft Modal ─────────────────────────────────────────

interface AddAircraftModalProps {
  onClose: () => void;
  onCreated: (aircraft: FleetAircraft) => void;
}

function AddAircraftModal({ onClose, onCreated }: AddAircraftModalProps) {
  const [form, setForm] = useState<Partial<CreateFleetAircraftRequest>>({
    airline: 'SMA',
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
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative w-[640px] max-h-[90vh] overflow-auto rounded-xl border border-acars-border bg-acars-panel shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-acars-border">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-acars-green/10 border border-acars-green/20">
              <Plus className="w-4.5 h-4.5 text-acars-green" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-acars-text">Add Aircraft</h2>
              <p className="text-[10px] text-acars-muted">Search SimBrief or enter details manually</p>
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
            <label className={LABEL_CLS}>Search SimBrief Aircraft Database</label>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-acars-muted" />
              <input
                type="text"
                value={sbQuery}
                onChange={e => searchSimBrief(e.target.value)}
                placeholder='Type to search (e.g. "737", "A320", "CRJ")'
                className="w-full h-9 rounded-md border border-acars-border bg-acars-bg text-xs text-acars-text pl-8 pr-3 outline-none focus:border-acars-cyan transition-colors placeholder:text-acars-muted/50"
              />
              {sbLoading && <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-acars-cyan animate-spin" />}
            </div>
            {sbResults.length > 0 && (
              <div className="mt-1.5 max-h-[180px] overflow-auto rounded-md border border-acars-border bg-acars-bg">
                {sbResults.map(ac => (
                  <button
                    key={ac.aircraftIcao}
                    onClick={() => selectSimBrief(ac)}
                    className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-acars-panel transition-colors border-b border-acars-border/30 last:border-0"
                  >
                    <span className="font-mono font-bold text-xs text-acars-cyan w-[48px] shrink-0">{ac.aircraftIcao}</span>
                    <span className="text-xs text-acars-text flex-1 truncate">{ac.aircraftName}</span>
                    <span className="text-[10px] text-acars-muted truncate max-w-[100px]">{ac.engines}</span>
                    <span className="text-[10px] text-acars-muted tabular-nums w-[40px] text-right">{ac.maxPax} pax</span>
                    <span className="text-[10px] text-acars-muted tabular-nums w-[70px] text-right">{fmt(ac.mtowLbs, 'lbs')}</span>
                  </button>
                ))}
              </div>
            )}
            {sbSelected && (
              <div className="mt-1.5 flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-acars-cyan/10 border border-acars-cyan/20 text-[10px] text-acars-cyan">
                <Plane className="w-3 h-3" />
                Auto-filled from SimBrief: <span className="font-mono font-bold">{sbSelected.aircraftIcao}</span> — {sbSelected.aircraftName}
              </div>
            )}
          </div>

          <div className="relative flex items-center gap-3">
            <div className="flex-1 border-t border-acars-border/50" />
            <span className="text-[10px] text-acars-muted/60 uppercase tracking-wider">or enter details manually</span>
            <div className="flex-1 border-t border-acars-border/50" />
          </div>

          {/* Row 1: Type + Name */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL_CLS}>ICAO Type *</label>
              <input type="text" value={form.icaoType ?? ''} onChange={e => set('icaoType', e.target.value.toUpperCase())} placeholder="B738" className={INPUT_CLS} />
            </div>
            <div>
              <label className={LABEL_CLS}>Name *</label>
              <input type="text" value={form.name ?? ''} onChange={e => set('name', e.target.value)} placeholder="Boeing 737-800" className={INPUT_CLS.replace('font-mono ', '')} />
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
              <input type="text" value={form.airline ?? ''} onChange={e => set('airline', e.target.value.toUpperCase())} placeholder="SMA" className={INPUT_CLS} />
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
              <label className={LABEL_CLS}>Max Fuel (lbs)</label>
              <input type="number" value={form.maxFuelLbs ?? ''} onChange={e => set('maxFuelLbs', parseInt(e.target.value) || 0)} placeholder="46000" className={INPUT_CLS} />
            </div>
          </div>

          {/* Row 5: Airframe details */}
          <div className="grid grid-cols-4 gap-3">
            <div>
              <label className={LABEL_CLS}>Engines</label>
              <input type="text" value={form.engines ?? ''} onChange={e => set('engines', e.target.value)} placeholder="2x CFM56-7B" className={INPUT_CLS.replace('font-mono ', '')} />
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
              <select value={form.status ?? 'active'} onChange={e => set('status', e.target.value)} className={INPUT_CLS.replace('font-mono ', '')}>
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
              className="w-full rounded-md border border-acars-border bg-acars-bg text-xs text-acars-text px-2.5 py-2 outline-none focus:border-acars-green transition-colors placeholder:text-acars-muted/50 resize-none"
            />
          </div>

          {error && (
            <p className="text-[11px] text-acars-red bg-acars-red/10 border border-acars-red/20 rounded-md px-3 py-2">{error}</p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-acars-border">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-md text-xs font-medium text-acars-muted hover:text-acars-text hover:bg-acars-bg border border-acars-border transition-colors"
          >
            Cancel
          </button>
          <button
            disabled={!canSubmit}
            onClick={handleSubmit}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-xs font-semibold text-white bg-acars-green hover:bg-acars-green/80 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
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
    <div className="flex items-center justify-between py-1.5 border-b border-acars-border/30 last:border-0">
      <span className="text-[10px] text-acars-muted uppercase tracking-wider">{label}</span>
      <span className="text-xs font-mono font-semibold text-acars-text tabular-nums">{value}</span>
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
    <div className="rounded-lg border border-acars-border/50 bg-acars-panel/50 p-3">
      <div className="flex items-center gap-2 mb-3">
        <BarChart3 className="w-3.5 h-3.5 text-acars-cyan" />
        <span className="text-[10px] uppercase tracking-wider text-acars-muted font-medium">Utilization</span>
      </div>
      {loading ? (
        <div className="flex items-center gap-2 py-2">
          <Loader2 className="w-3.5 h-3.5 text-acars-muted animate-spin" />
          <span className="text-[11px] text-acars-muted">Loading stats...</span>
        </div>
      ) : !stats || stats.totalFlights === 0 ? (
        <p className="text-[11px] text-acars-muted/60 italic">No flights recorded for this aircraft</p>
      ) : (
        <div className="grid grid-cols-5 gap-3">
          <div>
            <div className="text-[10px] text-acars-muted">Total Flights</div>
            <div className="text-sm font-semibold text-acars-text">{stats.totalFlights}</div>
          </div>
          <div>
            <div className="text-[10px] text-acars-muted">Total Hours</div>
            <div className="text-sm font-semibold text-acars-text">{stats.totalHours.toFixed(1)}h</div>
          </div>
          <div>
            <div className="text-[10px] text-acars-muted">Avg Score</div>
            <div className="text-sm font-semibold text-acars-green">{stats.avgScore?.toFixed(0) ?? '—'}</div>
          </div>
          <div>
            <div className="text-[10px] text-acars-muted">Avg Landing</div>
            <div className={`text-sm font-semibold ${(stats.avgLandingRate ?? 999) < 200 ? 'text-acars-green' : (stats.avgLandingRate ?? 999) < 400 ? 'text-acars-amber' : 'text-acars-red'}`}>
              {stats.avgLandingRate?.toFixed(0) ?? '—'} fpm
            </div>
          </div>
          <div>
            <div className="text-[10px] text-acars-muted">Last Flight</div>
            <div className="text-sm font-semibold text-acars-text">
              {stats.lastFlightDate ? new Date(stats.lastFlightDate).toLocaleDateString() : '—'}
            </div>
          </div>
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

  const EDIT_INPUT = 'w-full h-8 rounded-md border border-acars-border bg-acars-bg text-xs text-acars-text px-2 font-mono outline-none focus:border-acars-blue transition-colors placeholder:text-acars-muted/50';

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
        <div className="rounded-lg border border-acars-border/50 bg-acars-panel/50 p-3">
          <div className="flex items-center gap-2 mb-3">
            <Plane className="w-3.5 h-3.5 text-acars-cyan" />
            <span className="text-[10px] uppercase tracking-wider text-acars-muted font-medium">Aircraft Info</span>
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
        <div className="rounded-lg border border-acars-border/50 bg-acars-panel/50 p-3">
          <div className="flex items-center gap-2 mb-3">
            <Weight className="w-3.5 h-3.5 text-acars-blue" />
            <span className="text-[10px] uppercase tracking-wider text-acars-muted font-medium">Specifications</span>
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
        <div className="rounded-lg border border-acars-border/50 bg-acars-panel/50 p-3">
          <div className="flex items-center gap-2 mb-3">
            <Radio className="w-3.5 h-3.5 text-acars-magenta" />
            <span className="text-[10px] uppercase tracking-wider text-acars-muted font-medium">Equipment Codes</span>
          </div>
          <div className="grid grid-cols-5 gap-3">
            {a.equipCode && <div><div className="text-[10px] text-acars-muted">Equipment</div><div className="text-xs font-mono text-acars-text">{a.equipCode}</div></div>}
            {a.transponderCode && <div><div className="text-[10px] text-acars-muted">Transponder</div><div className="text-xs font-mono text-acars-text">{a.transponderCode}</div></div>}
            {a.pbn && <div><div className="text-[10px] text-acars-muted">PBN</div><div className="text-xs font-mono text-acars-text">{a.pbn}</div></div>}
            {a.selcal && <div><div className="text-[10px] text-acars-muted">SELCAL</div><div className="text-xs font-mono text-acars-text">{a.selcal}</div></div>}
            {a.hexCode && <div><div className="text-[10px] text-acars-muted">Hex Code</div><div className="text-xs font-mono text-acars-text">{a.hexCode}</div></div>}
          </div>
        </div>
      )}

      {/* Section 2: Maintenance placeholder */}
      <div className="rounded-lg border border-acars-border/50 bg-acars-panel/50 p-3">
        <div className="flex items-center gap-2 mb-2">
          <Wrench className="w-3.5 h-3.5 text-acars-amber" />
          <span className="text-[10px] uppercase tracking-wider text-acars-muted font-medium">Maintenance</span>
        </div>
        <p className="text-[11px] text-acars-muted/60 italic">Maintenance tracking coming soon</p>
      </div>

      {/* Section 3: Flight Reports placeholder */}
      <div className="rounded-lg border border-acars-border/50 bg-acars-panel/50 p-3">
        <div className="flex items-center gap-2 mb-2">
          <FileText className="w-3.5 h-3.5 text-acars-green" />
          <span className="text-[10px] uppercase tracking-wider text-acars-muted font-medium">Flight Reports</span>
        </div>
        <p className="text-[11px] text-acars-muted/60 italic">No flights recorded for this aircraft</p>
      </div>

      {/* Section 4: Utilization Statistics */}
      <UtilizationStats aircraftId={a.id} />

      {/* Remarks (pilot view) */}
      {a.remarks && !isAdmin && (
        <div className="rounded-lg border border-acars-border/50 bg-acars-panel/50 p-3">
          <div className="flex items-center gap-1.5 text-[10px] text-acars-muted mb-1">
            <MessageSquare className="w-3 h-3" /> Remarks
          </div>
          <p className="text-[11px] text-acars-muted/80">{a.remarks}</p>
        </div>
      )}

      {/* Section 5: Admin Controls */}
      {isAdmin && (
        <div className="rounded-lg border border-acars-border/50 bg-acars-panel/50 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Settings2 className="w-3.5 h-3.5 text-acars-red" />
            <span className="text-[10px] uppercase tracking-wider text-acars-muted font-medium">Admin Controls</span>
          </div>

          <div className="space-y-3">
            {/* Row: Status + Base + Location */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-[10px] uppercase tracking-wider text-acars-muted font-medium mb-1 block">Status</label>
                <select value={editStatus} onChange={e => setEditStatus(e.target.value as FleetStatus)} className={EDIT_INPUT.replace('font-mono ', '')}>
                  <option value="active">Active</option>
                  <option value="stored">Stored</option>
                  <option value="maintenance">Maintenance</option>
                  <option value="retired">Retired</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wider text-acars-muted font-medium mb-1 block">Base</label>
                <input type="text" value={editBase} onChange={e => setEditBase(e.target.value.toUpperCase())} placeholder="KJFK" className={EDIT_INPUT} />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wider text-acars-muted font-medium mb-1 block">Location</label>
                <input type="text" value={editLocation} onChange={e => setEditLocation(e.target.value.toUpperCase())} placeholder="KJFK" className={EDIT_INPUT} />
              </div>
            </div>

            {/* Row: Weight specs */}
            <div className="grid grid-cols-5 gap-3">
              <div>
                <label className="text-[10px] uppercase tracking-wider text-acars-muted font-medium mb-1 block">OEW (lbs)</label>
                <input type="number" value={editOew} onChange={e => setEditOew(e.target.value)} placeholder="91300" className={EDIT_INPUT} />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wider text-acars-muted font-medium mb-1 block">MZFW (lbs)</label>
                <input type="number" value={editMzfw} onChange={e => setEditMzfw(e.target.value)} placeholder="128600" className={EDIT_INPUT} />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wider text-acars-muted font-medium mb-1 block">MTOW (lbs)</label>
                <input type="number" value={editMtow} onChange={e => setEditMtow(e.target.value)} placeholder="174200" className={EDIT_INPUT} />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wider text-acars-muted font-medium mb-1 block">MLW (lbs)</label>
                <input type="number" value={editMlw} onChange={e => setEditMlw(e.target.value)} placeholder="144000" className={EDIT_INPUT} />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wider text-acars-muted font-medium mb-1 block">Max Fuel (lbs)</label>
                <input type="number" value={editMaxFuel} onChange={e => setEditMaxFuel(e.target.value)} placeholder="46000" className={EDIT_INPUT} />
              </div>
            </div>

            {/* Row: Airframe details */}
            <div className="grid grid-cols-4 gap-3">
              <div>
                <label className="text-[10px] uppercase tracking-wider text-acars-muted font-medium mb-1 block">Engines</label>
                <input type="text" value={editEngines} onChange={e => setEditEngines(e.target.value)} placeholder="2x CFM56-7B" className={EDIT_INPUT} />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wider text-acars-muted font-medium mb-1 block">Ceiling (ft)</label>
                <input type="number" value={editCeiling} onChange={e => setEditCeiling(e.target.value)} placeholder="41000" className={EDIT_INPUT} />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wider text-acars-muted font-medium mb-1 block">Configuration</label>
                <input type="text" value={editConfig} onChange={e => setEditConfig(e.target.value)} placeholder="Y162" className={EDIT_INPUT} />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wider text-acars-muted font-medium mb-1 block">Wake Cat</label>
                <input type="text" value={editCat} onChange={e => setEditCat(e.target.value.toUpperCase())} placeholder="M" className={EDIT_INPUT} />
              </div>
            </div>

            {/* Row: Equipment codes */}
            <div className="grid grid-cols-5 gap-3">
              <div>
                <label className="text-[10px] uppercase tracking-wider text-acars-muted font-medium mb-1 block">Equip Code</label>
                <input type="text" value={editEquip} onChange={e => setEditEquip(e.target.value)} placeholder="SDE2E3FGHIJ2J3J5M1RWXY" className={EDIT_INPUT} />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wider text-acars-muted font-medium mb-1 block">Transponder</label>
                <input type="text" value={editTransponder} onChange={e => setEditTransponder(e.target.value)} placeholder="LB1" className={EDIT_INPUT} />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wider text-acars-muted font-medium mb-1 block">PBN</label>
                <input type="text" value={editPbn} onChange={e => setEditPbn(e.target.value)} placeholder="A1B1C1D1O1S1S2" className={EDIT_INPUT} />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wider text-acars-muted font-medium mb-1 block">SELCAL</label>
                <input type="text" value={editSelcal} onChange={e => setEditSelcal(e.target.value.toUpperCase())} placeholder="AB-CD" className={EDIT_INPUT} />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wider text-acars-muted font-medium mb-1 block">Hex Code</label>
                <input type="text" value={editHexCode} onChange={e => setEditHexCode(e.target.value.toUpperCase())} placeholder="A12345" className={EDIT_INPUT} />
              </div>
            </div>

            {/* Remarks */}
            <div>
              <label className="text-[10px] uppercase tracking-wider text-acars-muted font-medium mb-1 block">Remarks</label>
              <textarea
                value={editRemarks}
                onChange={e => setEditRemarks(e.target.value)}
                rows={2}
                placeholder="Add notes..."
                className="w-full rounded-md border border-acars-border bg-acars-bg text-xs text-acars-text px-2 py-1.5 outline-none focus:border-acars-blue transition-colors placeholder:text-acars-muted/50 resize-none"
              />
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2 pt-1">
              <button
                disabled={saving}
                onClick={handleSave}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-semibold text-white bg-acars-blue hover:bg-acars-blue/80 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                Save Changes
              </button>
              {!confirmDelete ? (
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-semibold text-acars-red bg-acars-red/10 border border-acars-red/20 hover:bg-acars-red/20 transition-colors"
                >
                  <Trash2 className="w-3 h-3" /> Delete
                </button>
              ) : (
                <div className="flex items-center gap-1.5">
                  <button
                    disabled={deleting}
                    onClick={handleDelete}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[10px] font-bold text-white bg-acars-red hover:bg-acars-red/80 transition-colors disabled:opacity-50"
                  >
                    {deleting ? <Loader2 className="w-3 h-3 animate-spin" /> : <AlertTriangle className="w-3 h-3" />}
                    Confirm
                  </button>
                  <button
                    onClick={() => setConfirmDelete(false)}
                    className="px-2.5 py-1.5 rounded-md text-[10px] font-medium text-acars-muted hover:text-acars-text border border-acars-border hover:bg-acars-bg transition-colors"
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
    const counts = { active: 0, stored: 0, retired: 0, maintenance: 0 };
    fleet.forEach(a => { if (counts[a.status] !== undefined) counts[a.status]++; });
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
        <div className="flex items-center justify-between px-4 py-3 border-b border-acars-border">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-acars-cyan/10 border border-acars-cyan/20">
              <Plane className="w-4 h-4 text-acars-cyan" />
            </div>
            <h2 className="text-sm font-semibold text-acars-text">Fleet Management</h2>
            <span className="text-[11px] text-acars-muted tabular-nums">
              {loading ? '' : `${fleet.length} aircraft`}
            </span>
            {!loading && (
              <div className="flex items-center gap-1.5 ml-2">
                <span className="text-[10px] text-acars-green tabular-nums">{statusCounts.active} active</span>
                {statusCounts.stored > 0 && <span className="text-[10px] text-acars-amber tabular-nums">{statusCounts.stored} stored</span>}
                {statusCounts.retired > 0 && <span className="text-[10px] text-acars-red tabular-nums">{statusCounts.retired} retired</span>}
              </div>
            )}
            {loading && <Loader2 className="w-3.5 h-3.5 text-acars-blue animate-spin" />}
          </div>
          {isAdmin && (
            <button
              onClick={() => setAddModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-semibold text-acars-green bg-acars-green/10 border border-acars-green/20 hover:bg-acars-green/20 transition-colors"
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
            className="h-8 rounded-md border border-acars-border bg-acars-bg text-xs text-acars-text px-2 outline-none focus:border-acars-blue transition-colors min-w-[140px]"
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
            className="h-8 rounded-md border border-acars-border bg-acars-bg text-xs text-acars-text px-2 outline-none focus:border-acars-blue transition-colors min-w-[120px]"
          >
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="stored">Stored</option>
            <option value="retired">Retired</option>
          </select>

          {/* Search */}
          <div className="relative flex-1 max-w-[240px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-acars-muted" />
            <input
              type="text"
              value={searchInput}
              onChange={e => handleSearchChange(e.target.value)}
              placeholder="Search registration, type..."
              className="w-full h-8 rounded-md border border-acars-border bg-acars-bg text-xs text-acars-text pl-8 pr-3 outline-none focus:border-acars-blue transition-colors placeholder:text-acars-muted/50"
            />
          </div>

          {/* Reset */}
          {hasFilters && (
            <button
              onClick={resetFilters}
              className="flex items-center gap-1.5 h-8 px-3 rounded-md text-[11px] font-medium text-acars-muted hover:text-acars-text hover:bg-acars-bg border border-acars-border transition-colors"
            >
              <RotateCcw className="w-3 h-3" /> Reset
            </button>
          )}
        </div>
      </div>

      {/* Fleet table */}
      <div className="flex-1 mx-5 mt-4 mb-5 panel flex flex-col overflow-hidden">
        <div className="flex-1 overflow-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 z-10 bg-acars-panel">
              <tr className="text-[10px] uppercase tracking-wider text-acars-muted border-b border-acars-border">
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
                    <Loader2 className="w-5 h-5 text-acars-blue animate-spin mx-auto mb-2" />
                    <span className="text-xs text-acars-muted">Loading fleet...</span>
                  </td>
                </tr>
              ) : fleet.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-16 text-center">
                    <img src="/logos/chevron-light.png" alt="SMA" className="h-10 w-auto opacity-10 mx-auto mb-3" />
                    <span className="text-xs text-acars-muted">No aircraft match your filters</span>
                  </td>
                </tr>
              ) : (
                fleet.map((a, i) => {
                  const isExpanded = expandedId === a.id;
                  return (
                    <Fragment key={a.id}>
                      <tr
                        onClick={() => setExpandedId(isExpanded ? null : a.id)}
                        className={`border-b border-acars-border/50 hover:bg-[#1c2433] transition-colors cursor-pointer ${
                          isExpanded ? 'bg-[#1c2433]' : i % 2 === 0 ? 'bg-acars-panel' : 'bg-acars-bg'
                        }`}
                      >
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2">
                            <ChevronDown className={`w-3.5 h-3.5 text-acars-muted/50 transition-transform duration-200 shrink-0 ${isExpanded ? 'rotate-0' : '-rotate-90'}`} />
                            <span className="font-mono font-semibold text-acars-text">{a.registration}</span>
                          </div>
                        </td>
                        <td className="px-4 py-2.5 font-mono text-acars-muted">{a.icaoType}</td>
                        <td className="px-4 py-2.5 text-acars-text">{a.name}</td>
                        <td className="px-4 py-2.5 font-mono text-acars-muted">{a.baseIcao ?? '—'}</td>
                        <td className="px-4 py-2.5 font-mono text-acars-muted">{a.locationIcao ?? '—'}</td>
                        <td className="px-4 py-2.5 text-right font-mono text-acars-muted tabular-nums">{a.rangeNm.toLocaleString()} nm</td>
                        <td className="px-4 py-2.5 text-right font-mono text-acars-muted tabular-nums">{a.paxCapacity}</td>
                        <td className="px-4 py-2.5 text-right font-mono text-acars-muted tabular-nums">{a.cargoCapacityLbs.toLocaleString()}</td>
                        <td className="px-4 py-2.5 text-center">
                          <StatusBadge status={a.status} />
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="bg-[#141b27] border-b border-acars-border">
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
