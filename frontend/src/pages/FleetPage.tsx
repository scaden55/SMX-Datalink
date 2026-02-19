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
} from 'lucide-react';
import { api } from '../lib/api';
import { useAuthStore } from '../stores/authStore';
import type {
  FleetAircraft,
  FleetStatus,
  FleetListResponse,
  CreateFleetAircraftRequest,
  UpdateFleetAircraftRequest,
} from '@acars/shared';

// ─── Helpers ────────────────────────────────────────────────────

const STATUS_CONFIG: Record<FleetStatus, { label: string; bg: string; text: string; border: string }> = {
  active:  { label: 'Active',  bg: 'bg-acars-green/10', text: 'text-acars-green', border: 'border-acars-green/20' },
  stored:  { label: 'Stored',  bg: 'bg-acars-amber/10', text: 'text-acars-amber', border: 'border-acars-amber/20' },
  retired: { label: 'Retired', bg: 'bg-acars-red/10',   text: 'text-acars-red',   border: 'border-acars-red/20' },
};

function StatusBadge({ status }: { status: FleetStatus }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.active;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${cfg.bg} ${cfg.text} border ${cfg.border}`}>
      {cfg.label}
    </span>
  );
}

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

  const set = (key: string, value: string | number) => setForm(prev => ({ ...prev, [key]: value }));

  const canSubmit = form.icaoType && form.name && form.registration &&
    form.rangeNm != null && form.cruiseSpeed != null &&
    form.paxCapacity != null && form.cargoCapacityLbs != null && !submitting;

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
        className="relative w-[560px] max-h-[90vh] overflow-auto rounded-xl border border-acars-border bg-acars-panel shadow-2xl"
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
              <p className="text-[10px] text-acars-muted">Register a new aircraft to the fleet</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-acars-bg text-acars-muted hover:text-acars-text transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4">
          {/* Row 1: Type + Name */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] uppercase tracking-wider text-acars-muted font-medium mb-1.5 block">ICAO Type *</label>
              <input
                type="text"
                value={form.icaoType ?? ''}
                onChange={e => set('icaoType', e.target.value.toUpperCase())}
                placeholder="B738"
                className="w-full h-9 rounded-md border border-acars-border bg-acars-bg text-xs text-acars-text px-2.5 font-mono outline-none focus:border-acars-green transition-colors placeholder:text-acars-muted/50"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider text-acars-muted font-medium mb-1.5 block">Name *</label>
              <input
                type="text"
                value={form.name ?? ''}
                onChange={e => set('name', e.target.value)}
                placeholder="Boeing 737-800"
                className="w-full h-9 rounded-md border border-acars-border bg-acars-bg text-xs text-acars-text px-2.5 outline-none focus:border-acars-green transition-colors placeholder:text-acars-muted/50"
              />
            </div>
          </div>

          {/* Row 2: Registration + Airline */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] uppercase tracking-wider text-acars-muted font-medium mb-1.5 block">Registration *</label>
              <input
                type="text"
                value={form.registration ?? ''}
                onChange={e => set('registration', e.target.value.toUpperCase())}
                placeholder="N801SM"
                className="w-full h-9 rounded-md border border-acars-border bg-acars-bg text-xs text-acars-text px-2.5 font-mono outline-none focus:border-acars-green transition-colors placeholder:text-acars-muted/50"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider text-acars-muted font-medium mb-1.5 block">Airline</label>
              <input
                type="text"
                value={form.airline ?? ''}
                onChange={e => set('airline', e.target.value.toUpperCase())}
                placeholder="SMA"
                className="w-full h-9 rounded-md border border-acars-border bg-acars-bg text-xs text-acars-text px-2.5 font-mono outline-none focus:border-acars-green transition-colors placeholder:text-acars-muted/50"
              />
            </div>
          </div>

          {/* Row 3: Performance specs */}
          <div className="grid grid-cols-4 gap-3">
            <div>
              <label className="text-[10px] uppercase tracking-wider text-acars-muted font-medium mb-1.5 block">Range (nm) *</label>
              <input
                type="number"
                value={form.rangeNm ?? ''}
                onChange={e => set('rangeNm', parseInt(e.target.value) || 0)}
                placeholder="2935"
                className="w-full h-9 rounded-md border border-acars-border bg-acars-bg text-xs text-acars-text px-2.5 font-mono outline-none focus:border-acars-green transition-colors placeholder:text-acars-muted/50"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider text-acars-muted font-medium mb-1.5 block">Cruise (kts) *</label>
              <input
                type="number"
                value={form.cruiseSpeed ?? ''}
                onChange={e => set('cruiseSpeed', parseInt(e.target.value) || 0)}
                placeholder="453"
                className="w-full h-9 rounded-md border border-acars-border bg-acars-bg text-xs text-acars-text px-2.5 font-mono outline-none focus:border-acars-green transition-colors placeholder:text-acars-muted/50"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider text-acars-muted font-medium mb-1.5 block">Pax *</label>
              <input
                type="number"
                value={form.paxCapacity ?? ''}
                onChange={e => set('paxCapacity', parseInt(e.target.value) || 0)}
                placeholder="162"
                className="w-full h-9 rounded-md border border-acars-border bg-acars-bg text-xs text-acars-text px-2.5 font-mono outline-none focus:border-acars-green transition-colors placeholder:text-acars-muted/50"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider text-acars-muted font-medium mb-1.5 block">Cargo (lbs) *</label>
              <input
                type="number"
                value={form.cargoCapacityLbs ?? ''}
                onChange={e => set('cargoCapacityLbs', parseInt(e.target.value) || 0)}
                placeholder="5200"
                className="w-full h-9 rounded-md border border-acars-border bg-acars-bg text-xs text-acars-text px-2.5 font-mono outline-none focus:border-acars-green transition-colors placeholder:text-acars-muted/50"
              />
            </div>
          </div>

          {/* Row 4: Status + Base + Location */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-[10px] uppercase tracking-wider text-acars-muted font-medium mb-1.5 block">Status</label>
              <select
                value={form.status ?? 'active'}
                onChange={e => set('status', e.target.value)}
                className="w-full h-9 rounded-md border border-acars-border bg-acars-bg text-xs text-acars-text px-2.5 outline-none focus:border-acars-green transition-colors"
              >
                <option value="active">Active</option>
                <option value="stored">Stored</option>
                <option value="retired">Retired</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider text-acars-muted font-medium mb-1.5 block">Base ICAO</label>
              <input
                type="text"
                value={form.baseIcao ?? ''}
                onChange={e => set('baseIcao', e.target.value.toUpperCase())}
                placeholder="KJFK"
                className="w-full h-9 rounded-md border border-acars-border bg-acars-bg text-xs text-acars-text px-2.5 font-mono outline-none focus:border-acars-green transition-colors placeholder:text-acars-muted/50"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider text-acars-muted font-medium mb-1.5 block">Location ICAO</label>
              <input
                type="text"
                value={form.locationIcao ?? ''}
                onChange={e => set('locationIcao', e.target.value.toUpperCase())}
                placeholder="KJFK"
                className="w-full h-9 rounded-md border border-acars-border bg-acars-bg text-xs text-acars-text px-2.5 font-mono outline-none focus:border-acars-green transition-colors placeholder:text-acars-muted/50"
              />
            </div>
          </div>

          {/* Remarks */}
          <div>
            <label className="text-[10px] uppercase tracking-wider text-acars-muted font-medium mb-1.5 block">Remarks</label>
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

// ─── Fleet Detail Panel (Expanded Row) ──────────────────────────

interface FleetDetailPanelProps {
  aircraft: FleetAircraft;
  isAdmin: boolean;
  onSave: (id: number, data: UpdateFleetAircraftRequest) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
}

function FleetDetailPanel({ aircraft, isAdmin, onSave, onDelete }: FleetDetailPanelProps) {
  const [editStatus, setEditStatus] = useState(aircraft.status);
  const [editBase, setEditBase] = useState(aircraft.baseIcao ?? '');
  const [editLocation, setEditLocation] = useState(aircraft.locationIcao ?? '');
  const [editRemarks, setEditRemarks] = useState(aircraft.remarks ?? '');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const hasChanges = editStatus !== aircraft.status ||
    editBase !== (aircraft.baseIcao ?? '') ||
    editLocation !== (aircraft.locationIcao ?? '') ||
    editRemarks !== (aircraft.remarks ?? '');

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(aircraft.id, {
        status: editStatus,
        baseIcao: editBase || null,
        locationIcao: editLocation || null,
        remarks: editRemarks || null,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await onDelete(aircraft.id);
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  return (
    <div className="flex gap-6 p-4 animate-in fade-in slide-in-from-top-1 duration-200">
      {/* Left: Aircraft specs grid */}
      <div className="flex-1 min-w-0">
        <div className="text-[10px] uppercase tracking-wider text-acars-muted font-medium mb-3">Aircraft Specifications</div>
        <div className="grid grid-cols-3 gap-x-6 gap-y-3">
          <div className="flex items-center gap-2">
            <Ruler className="w-3.5 h-3.5 text-acars-blue shrink-0" />
            <div>
              <div className="text-[10px] text-acars-muted">Range</div>
              <div className="text-xs font-mono font-semibold text-acars-text tabular-nums">{aircraft.rangeNm.toLocaleString()} nm</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Gauge className="w-3.5 h-3.5 text-acars-cyan shrink-0" />
            <div>
              <div className="text-[10px] text-acars-muted">Cruise Speed</div>
              <div className="text-xs font-mono font-semibold text-acars-text tabular-nums">{aircraft.cruiseSpeed} kts</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Users className="w-3.5 h-3.5 text-acars-magenta shrink-0" />
            <div>
              <div className="text-[10px] text-acars-muted">Passengers</div>
              <div className="text-xs font-mono font-semibold text-acars-text tabular-nums">{aircraft.paxCapacity}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Package className="w-3.5 h-3.5 text-acars-amber shrink-0" />
            <div>
              <div className="text-[10px] text-acars-muted">Cargo</div>
              <div className="text-xs font-mono font-semibold text-acars-text tabular-nums">{aircraft.cargoCapacityLbs.toLocaleString()} lbs</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <MapPin className="w-3.5 h-3.5 text-acars-green shrink-0" />
            <div>
              <div className="text-[10px] text-acars-muted">Home Base</div>
              <div className="text-xs font-mono font-semibold text-acars-text">{aircraft.baseIcao ?? '—'}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <MapPin className="w-3.5 h-3.5 text-acars-red shrink-0" />
            <div>
              <div className="text-[10px] text-acars-muted">Current Location</div>
              <div className="text-xs font-mono font-semibold text-acars-text">{aircraft.locationIcao ?? '—'}</div>
            </div>
          </div>
        </div>
        {aircraft.remarks && !isAdmin && (
          <div className="mt-3 pt-3 border-t border-acars-border/50">
            <div className="flex items-center gap-1.5 text-[10px] text-acars-muted mb-1">
              <MessageSquare className="w-3 h-3" /> Remarks
            </div>
            <p className="text-[11px] text-acars-muted/80">{aircraft.remarks}</p>
          </div>
        )}
      </div>

      {/* Right: Admin edit panel */}
      {isAdmin && (
        <div className="w-[280px] shrink-0 border-l border-acars-border/50 pl-6">
          <div className="text-[10px] uppercase tracking-wider text-acars-muted font-medium mb-3">Admin Controls</div>
          <div className="space-y-3">
            {/* Status */}
            <div>
              <label className="text-[10px] uppercase tracking-wider text-acars-muted font-medium mb-1 block">Status</label>
              <select
                value={editStatus}
                onChange={e => setEditStatus(e.target.value as FleetStatus)}
                className="w-full h-8 rounded-md border border-acars-border bg-acars-bg text-xs text-acars-text px-2 outline-none focus:border-acars-blue transition-colors"
              >
                <option value="active">Active</option>
                <option value="stored">Stored</option>
                <option value="retired">Retired</option>
              </select>
            </div>

            {/* Base + Location */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] uppercase tracking-wider text-acars-muted font-medium mb-1 block">Base</label>
                <input
                  type="text"
                  value={editBase}
                  onChange={e => setEditBase(e.target.value.toUpperCase())}
                  placeholder="KJFK"
                  className="w-full h-8 rounded-md border border-acars-border bg-acars-bg text-xs text-acars-text px-2 font-mono outline-none focus:border-acars-blue transition-colors placeholder:text-acars-muted/50"
                />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wider text-acars-muted font-medium mb-1 block">Location</label>
                <input
                  type="text"
                  value={editLocation}
                  onChange={e => setEditLocation(e.target.value.toUpperCase())}
                  placeholder="KJFK"
                  className="w-full h-8 rounded-md border border-acars-border bg-acars-bg text-xs text-acars-text px-2 font-mono outline-none focus:border-acars-blue transition-colors placeholder:text-acars-muted/50"
                />
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
                disabled={!hasChanges || saving}
                onClick={handleSave}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-semibold text-white bg-acars-blue hover:bg-acars-blue/80 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                Save
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
    const counts = { active: 0, stored: 0, retired: 0 };
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
