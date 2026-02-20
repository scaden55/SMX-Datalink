import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  CalendarDays,
  Search,
  RotateCcw,
  Loader2,
  Plus,
  X,
  Pencil,
  Trash2,
  Copy,
  ToggleLeft,
  ToggleRight,
  ChevronLeft,
  ChevronRight,
  Plane,
} from 'lucide-react';
import { api } from '../../lib/api';
import { AdminPageHeader } from '../../components/admin/AdminPageHeader';
import { ConfirmDialog } from '../../components/admin/ConfirmDialog';

// ─── Types ──────────────────────────────────────────────────────

interface ScheduleListItem {
  id: number;
  flightNumber: string;
  depIcao: string;
  arrIcao: string;
  depName: string;
  arrName: string;
  depTime: string;
  arrTime: string;
  aircraftType: string;
  distanceNm: number;
  flightTimeMin: number;
  daysOfWeek: string;
  isActive: boolean;
  bidCount: number;
  charterType?: string;
}

interface ScheduleListResponse {
  schedules: ScheduleListItem[];
  total: number;
  page: number;
  pageSize: number;
}

interface ScheduleFormData {
  flightNumber: string;
  depIcao: string;
  arrIcao: string;
  aircraftType: string;
  depTime: string;
  arrTime: string;
  distanceNm: number | '';
  flightTimeMin: number | '';
  daysOfWeek: string;
  charterType?: string;
}

const EMPTY_FORM: ScheduleFormData = {
  flightNumber: '',
  depIcao: '',
  arrIcao: '',
  aircraftType: '',
  depTime: '',
  arrTime: '',
  distanceNm: '',
  flightTimeMin: '',
  daysOfWeek: '1,2,3,4,5',
  charterType: '',
};

// ─── Constants ──────────────────────────────────────────────────

const DAY_LABELS = [
  { value: '1', short: 'Mon', full: 'Monday' },
  { value: '2', short: 'Tue', full: 'Tuesday' },
  { value: '3', short: 'Wed', full: 'Wednesday' },
  { value: '4', short: 'Thu', full: 'Thursday' },
  { value: '5', short: 'Fri', full: 'Friday' },
  { value: '6', short: 'Sat', full: 'Saturday' },
  { value: '7', short: 'Sun', full: 'Sunday' },
];

const INPUT_CLS =
  'w-full h-9 rounded-md border border-acars-border bg-acars-bg text-xs text-acars-text px-2.5 font-mono outline-none focus:border-acars-blue transition-colors placeholder:text-acars-muted/50';
const LABEL_CLS =
  'text-[10px] uppercase tracking-wider text-acars-muted font-medium mb-1.5 block';

// ─── Helpers ────────────────────────────────────────────────────

function formatDuration(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}:${String(m).padStart(2, '0')}`;
}

function parseDays(daysStr: string): Set<string> {
  if (!daysStr) return new Set();
  return new Set(daysStr.split(',').map(d => d.trim()).filter(Boolean));
}

function daysToString(days: Set<string>): string {
  return DAY_LABELS
    .filter(d => days.has(d.value))
    .map(d => d.value)
    .join(',');
}

// ─── Day Chips Component ────────────────────────────────────────

function DayChips({ daysOfWeek }: { daysOfWeek: string }) {
  const activeDays = parseDays(daysOfWeek);
  return (
    <div className="flex items-center gap-0.5">
      {DAY_LABELS.map(day => {
        const active = activeDays.has(day.value);
        return (
          <span
            key={day.value}
            title={day.full}
            className={`inline-flex items-center justify-center w-6 h-5 rounded text-[9px] font-bold tracking-wide transition-colors ${
              active
                ? 'bg-acars-blue/20 text-acars-blue border border-acars-blue/30'
                : 'bg-transparent text-acars-muted/30 border border-acars-border/30'
            }`}
          >
            {day.short[0]}
            {day.short[1]}
          </span>
        );
      })}
    </div>
  );
}

// ─── Day Checkbox Group ─────────────────────────────────────────

function DayCheckboxGroup({
  value,
  onChange,
}: {
  value: string;
  onChange: (val: string) => void;
}) {
  const activeDays = parseDays(value);

  const toggle = (dayValue: string) => {
    const next = new Set(activeDays);
    if (next.has(dayValue)) {
      next.delete(dayValue);
    } else {
      next.add(dayValue);
    }
    onChange(daysToString(next));
  };

  return (
    <div className="flex items-center gap-1.5">
      {DAY_LABELS.map(day => {
        const active = activeDays.has(day.value);
        return (
          <button
            key={day.value}
            type="button"
            onClick={() => toggle(day.value)}
            className={`flex items-center justify-center w-10 h-8 rounded-md text-[10px] font-bold tracking-wide transition-colors border ${
              active
                ? 'bg-acars-blue/20 text-acars-blue border-acars-blue/40 hover:bg-acars-blue/30'
                : 'bg-acars-bg text-acars-muted/50 border-acars-border hover:text-acars-muted hover:border-acars-border'
            }`}
          >
            {day.short}
          </button>
        );
      })}
    </div>
  );
}

// ─── Schedule Form Modal ────────────────────────────────────────

interface ScheduleFormModalProps {
  title: string;
  initialData: ScheduleFormData;
  aircraftTypes: string[];
  submitting: boolean;
  error: string;
  onSubmit: (data: ScheduleFormData) => void;
  onClose: () => void;
}

function ScheduleFormModal({
  title,
  initialData,
  aircraftTypes,
  submitting,
  error,
  onSubmit,
  onClose,
}: ScheduleFormModalProps) {
  const [form, setForm] = useState<ScheduleFormData>(initialData);

  const set = (key: keyof ScheduleFormData, value: string | number) =>
    setForm(prev => ({ ...prev, [key]: value }));

  const canSubmit =
    form.flightNumber &&
    form.depIcao.length === 4 &&
    form.arrIcao.length === 4 &&
    form.aircraftType &&
    form.depTime &&
    form.arrTime &&
    form.distanceNm !== '' &&
    form.flightTimeMin !== '' &&
    form.daysOfWeek &&
    !submitting;

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative w-[560px] max-h-[90vh] overflow-auto rounded-xl border border-acars-border bg-acars-panel shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-acars-border">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-acars-blue/10 border border-acars-blue/20">
              <CalendarDays className="w-4.5 h-4.5 text-acars-blue" />
            </div>
            <h2 className="text-sm font-semibold text-acars-text">{title}</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-acars-bg text-acars-muted hover:text-acars-text transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4">
          {/* Row 1: Flight Number */}
          <div>
            <label className={LABEL_CLS}>Flight Number *</label>
            <input
              type="text"
              value={form.flightNumber}
              onChange={e => set('flightNumber', e.target.value.toUpperCase())}
              placeholder="SMA101"
              className={INPUT_CLS}
            />
          </div>

          {/* Row 2: Dep / Arr ICAO */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL_CLS}>Departure ICAO *</label>
              <input
                type="text"
                value={form.depIcao}
                onChange={e => set('depIcao', e.target.value.toUpperCase().slice(0, 4))}
                placeholder="KJFK"
                maxLength={4}
                className={INPUT_CLS}
              />
            </div>
            <div>
              <label className={LABEL_CLS}>Arrival ICAO *</label>
              <input
                type="text"
                value={form.arrIcao}
                onChange={e => set('arrIcao', e.target.value.toUpperCase().slice(0, 4))}
                placeholder="KLAX"
                maxLength={4}
                className={INPUT_CLS}
              />
            </div>
          </div>

          {/* Row 3: Aircraft Type */}
          <div>
            <label className={LABEL_CLS}>Aircraft Type *</label>
            <select
              value={form.aircraftType}
              onChange={e => set('aircraftType', e.target.value)}
              className={INPUT_CLS.replace('font-mono ', '')}
            >
              <option value="">Select aircraft type...</option>
              {aircraftTypes.map(t => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          {/* Row 4: Times */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL_CLS}>Departure Time (UTC) *</label>
              <input
                type="time"
                value={form.depTime}
                onChange={e => set('depTime', e.target.value)}
                className={INPUT_CLS}
              />
            </div>
            <div>
              <label className={LABEL_CLS}>Arrival Time (UTC) *</label>
              <input
                type="time"
                value={form.arrTime}
                onChange={e => set('arrTime', e.target.value)}
                className={INPUT_CLS}
              />
            </div>
          </div>

          {/* Row 5: Distance + Flight Time */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL_CLS}>Distance (nm) *</label>
              <input
                type="number"
                value={form.distanceNm}
                onChange={e =>
                  set('distanceNm', e.target.value ? parseInt(e.target.value) : ('' as any))
                }
                placeholder="2475"
                className={INPUT_CLS}
              />
            </div>
            <div>
              <label className={LABEL_CLS}>Flight Time (min) *</label>
              <input
                type="number"
                value={form.flightTimeMin}
                onChange={e =>
                  set('flightTimeMin', e.target.value ? parseInt(e.target.value) : ('' as any))
                }
                placeholder="330"
                className={INPUT_CLS}
              />
            </div>
          </div>

          {/* Row 6: Days of Week */}
          <div>
            <label className={LABEL_CLS}>Days of Week *</label>
            <DayCheckboxGroup
              value={form.daysOfWeek}
              onChange={val => set('daysOfWeek', val)}
            />
          </div>

          {/* Row 7: Charter type (optional) */}
          <div>
            <label className={LABEL_CLS}>Charter Type (optional)</label>
            <input
              type="text"
              value={form.charterType ?? ''}
              onChange={e => set('charterType', e.target.value)}
              placeholder="e.g. cargo, passenger, medical"
              className={INPUT_CLS.replace('font-mono ', '')}
            />
          </div>

          {error && (
            <p className="text-[11px] text-acars-red bg-acars-red/10 border border-acars-red/20 rounded-md px-3 py-2">
              {error}
            </p>
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
            onClick={() => onSubmit(form)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-xs font-semibold text-white bg-acars-blue hover:bg-acars-blue/80 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {submitting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <CalendarDays className="w-3.5 h-3.5" />
            )}
            {title.includes('Edit') ? 'Save Changes' : 'Create Schedule'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Clone Modal ────────────────────────────────────────────────

interface CloneModalProps {
  schedule: ScheduleListItem;
  onClone: (flightNumber: string) => void;
  onClose: () => void;
  submitting: boolean;
  error: string;
}

function CloneModal({ schedule, onClone, onClose, submitting, error }: CloneModalProps) {
  const [flightNumber, setFlightNumber] = useState('');

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative w-[400px] rounded-xl border border-acars-border bg-acars-panel shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-acars-border">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-acars-amber/10 border border-acars-amber/20">
              <Copy className="w-4.5 h-4.5 text-acars-amber" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-acars-text">Clone Schedule</h2>
              <p className="text-[10px] text-acars-muted">
                Cloning {schedule.flightNumber} ({schedule.depIcao} → {schedule.arrIcao})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-acars-bg text-acars-muted hover:text-acars-text transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-3">
          <div>
            <label className={LABEL_CLS}>New Flight Number *</label>
            <input
              type="text"
              value={flightNumber}
              onChange={e => setFlightNumber(e.target.value.toUpperCase())}
              placeholder="SMA202"
              className={INPUT_CLS}
              autoFocus
            />
          </div>
          {error && (
            <p className="text-[11px] text-acars-red bg-acars-red/10 border border-acars-red/20 rounded-md px-3 py-2">
              {error}
            </p>
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
            disabled={!flightNumber.trim() || submitting}
            onClick={() => onClone(flightNumber.trim())}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-xs font-semibold text-white bg-acars-amber hover:bg-acars-amber/80 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Copy className="w-3.5 h-3.5" />}
            Clone
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Admin Schedules Page ───────────────────────────────────────

export function AdminSchedulesPage() {
  // Data
  const [schedules, setSchedules] = useState<ScheduleListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [aircraftTypes, setAircraftTypes] = useState<string[]>([]);

  // Filters
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);
  const searchTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Modals
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<ScheduleListItem | null>(null);
  const [cloneTarget, setCloneTarget] = useState<ScheduleListItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ScheduleListItem | null>(null);

  // Modal state
  const [modalSubmitting, setModalSubmitting] = useState(false);
  const [modalError, setModalError] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);

  // ── Load aircraft types on mount ──────────────────────────────
  useEffect(() => {
    api
      .get<string[]>('/api/fleet/manage/types')
      .then(setAircraftTypes)
      .catch(err => console.error('[Schedules] Failed to load types:', err));
  }, []);

  // ── Fetch schedules ───────────────────────────────────────────
  const fetchSchedules = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (typeFilter) params.set('aircraftType', typeFilter);
      if (activeFilter === 'active') params.set('isActive', 'true');
      if (activeFilter === 'inactive') params.set('isActive', 'false');
      if (searchTerm) params.set('search', searchTerm);
      params.set('page', String(page));
      params.set('pageSize', String(pageSize));

      const qs = params.toString();
      const data = await api.get<ScheduleListResponse>(`/api/admin/schedules?${qs}`);
      setSchedules(data.schedules);
      setTotal(data.total);
    } catch (err) {
      console.error('[Schedules] Failed to fetch:', err);
    } finally {
      setLoading(false);
    }
  }, [typeFilter, activeFilter, searchTerm, page, pageSize]);

  useEffect(() => {
    fetchSchedules();
  }, [fetchSchedules]);

  // ── Search debounce ───────────────────────────────────────────
  const handleSearchChange = (value: string) => {
    setSearchInput(value);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setSearchTerm(value);
      setPage(1);
    }, 300);
  };

  // ── Reset filters ─────────────────────────────────────────────
  const resetFilters = () => {
    setTypeFilter('');
    setActiveFilter('all');
    setSearchInput('');
    setSearchTerm('');
    setPage(1);
  };

  const hasFilters = typeFilter || activeFilter !== 'all' || searchTerm;

  // ── Stats ─────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const activeCount = schedules.filter(s => s.isActive).length;
    const totalBids = schedules.reduce((sum, s) => sum + s.bidCount, 0);
    return { activeCount, totalBids };
  }, [schedules]);

  // ── Create schedule ───────────────────────────────────────────
  const handleCreate = async (data: ScheduleFormData) => {
    setModalSubmitting(true);
    setModalError('');
    try {
      const body = {
        flightNumber: data.flightNumber,
        depIcao: data.depIcao,
        arrIcao: data.arrIcao,
        aircraftType: data.aircraftType,
        depTime: data.depTime,
        arrTime: data.arrTime,
        distanceNm: Number(data.distanceNm),
        flightTimeMin: Number(data.flightTimeMin),
        daysOfWeek: data.daysOfWeek,
        ...(data.charterType ? { charterType: data.charterType } : {}),
      };
      await api.post('/api/admin/schedules', body);
      setCreateOpen(false);
      setModalError('');
      fetchSchedules();
    } catch (err: any) {
      setModalError(err?.message || 'Failed to create schedule');
    } finally {
      setModalSubmitting(false);
    }
  };

  // ── Edit schedule ─────────────────────────────────────────────
  const handleEdit = async (data: ScheduleFormData) => {
    if (!editTarget) return;
    setModalSubmitting(true);
    setModalError('');
    try {
      const body = {
        flightNumber: data.flightNumber,
        depIcao: data.depIcao,
        arrIcao: data.arrIcao,
        aircraftType: data.aircraftType,
        depTime: data.depTime,
        arrTime: data.arrTime,
        distanceNm: Number(data.distanceNm),
        flightTimeMin: Number(data.flightTimeMin),
        daysOfWeek: data.daysOfWeek,
        ...(data.charterType ? { charterType: data.charterType } : {}),
      };
      const updated = await api.patch<ScheduleListItem>(
        `/api/admin/schedules/${editTarget.id}`,
        body
      );
      setSchedules(prev => prev.map(s => (s.id === editTarget.id ? updated : s)));
      setEditTarget(null);
      setModalError('');
    } catch (err: any) {
      setModalError(err?.message || 'Failed to update schedule');
    } finally {
      setModalSubmitting(false);
    }
  };

  // ── Toggle active ─────────────────────────────────────────────
  const handleToggle = async (schedule: ScheduleListItem) => {
    try {
      const updated = await api.post<ScheduleListItem>(
        `/api/admin/schedules/${schedule.id}/toggle`
      );
      setSchedules(prev => prev.map(s => (s.id === schedule.id ? updated : s)));
    } catch (err) {
      console.error('[Schedules] Toggle error:', err);
    }
  };

  // ── Clone schedule ────────────────────────────────────────────
  const handleClone = async (flightNumber: string) => {
    if (!cloneTarget) return;
    setModalSubmitting(true);
    setModalError('');
    try {
      await api.post(`/api/admin/schedules/${cloneTarget.id}/clone`, { flightNumber });
      setCloneTarget(null);
      setModalError('');
      fetchSchedules();
    } catch (err: any) {
      setModalError(err?.message || 'Failed to clone schedule');
    } finally {
      setModalSubmitting(false);
    }
  };

  // ── Delete schedule ───────────────────────────────────────────
  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      await api.delete(`/api/admin/schedules/${deleteTarget.id}`);
      setSchedules(prev => prev.filter(s => s.id !== deleteTarget.id));
      setTotal(prev => prev - 1);
      setDeleteTarget(null);
    } catch (err) {
      console.error('[Schedules] Delete error:', err);
    } finally {
      setDeleteLoading(false);
    }
  };

  // ── Close modals (reset error) ────────────────────────────────
  const closeCreate = () => {
    setCreateOpen(false);
    setModalError('');
    setModalSubmitting(false);
  };
  const closeEdit = () => {
    setEditTarget(null);
    setModalError('');
    setModalSubmitting(false);
  };
  const closeClone = () => {
    setCloneTarget(null);
    setModalError('');
    setModalSubmitting(false);
  };

  // ── Pagination ────────────────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  // ── Render ────────────────────────────────────────────────────
  return (
    <div className="h-full flex flex-col overflow-hidden p-6 gap-5">
      {/* Page Header */}
      <AdminPageHeader
        icon={CalendarDays}
        title="Schedule Management"
        subtitle="Manage scheduled flight routes"
        stats={[
          { label: 'Total Routes', value: total, color: 'text-acars-text' },
          { label: 'Active Routes', value: stats.activeCount, color: 'text-acars-green' },
          { label: 'Total Bids', value: stats.totalBids, color: 'text-acars-blue' },
        ]}
        actions={
          <button
            onClick={() => setCreateOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-semibold text-acars-green bg-acars-green/10 border border-acars-green/20 hover:bg-acars-green/20 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> Add Route
          </button>
        }
      />

      {/* Filters Bar */}
      <div className="panel">
        <div className="flex items-center gap-3 px-4 py-3">
          {/* Search */}
          <div className="relative flex-1 max-w-[280px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-acars-muted pointer-events-none" />
            <input
              type="text"
              value={searchInput}
              onChange={e => handleSearchChange(e.target.value)}
              placeholder="Search flight #, ICAO..."
              className="w-full h-8 rounded-md border border-acars-border bg-acars-bg text-xs text-acars-text pl-8 pr-3 outline-none focus:border-acars-blue transition-colors placeholder:text-acars-muted/50 font-mono"
            />
          </div>

          {/* Aircraft Type */}
          <select
            value={typeFilter}
            onChange={e => {
              setTypeFilter(e.target.value);
              setPage(1);
            }}
            className="h-8 rounded-md border border-acars-border bg-acars-bg text-xs text-acars-text px-2 outline-none focus:border-acars-blue transition-colors min-w-[140px]"
          >
            <option value="">All Types</option>
            {aircraftTypes.map(t => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>

          {/* Active/Inactive/All Toggle */}
          <div className="flex items-center rounded-md border border-acars-border overflow-hidden">
            {(['all', 'active', 'inactive'] as const).map(val => (
              <button
                key={val}
                onClick={() => {
                  setActiveFilter(val);
                  setPage(1);
                }}
                className={`px-3 h-8 text-[10px] font-semibold uppercase tracking-wider transition-colors ${
                  activeFilter === val
                    ? 'bg-acars-blue/20 text-acars-blue'
                    : 'bg-acars-bg text-acars-muted hover:text-acars-text'
                }`}
              >
                {val}
              </button>
            ))}
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

          {/* Refresh */}
          <button
            onClick={() => fetchSchedules()}
            className="h-8 w-8 rounded-md border border-acars-border bg-acars-bg text-acars-muted hover:text-acars-text flex items-center justify-center transition-colors ml-auto"
            title="Refresh"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 panel flex flex-col overflow-hidden">
        <div className="flex-1 overflow-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 z-10 bg-acars-panel">
              <tr className="text-[10px] uppercase tracking-wider text-acars-muted border-b border-acars-border">
                <th className="text-left px-4 py-2.5 font-medium">Flight #</th>
                <th className="text-left px-3 py-2.5 font-medium">Dep</th>
                <th className="text-left px-3 py-2.5 font-medium">Arr</th>
                <th className="text-left px-3 py-2.5 font-medium">Aircraft</th>
                <th className="text-right px-3 py-2.5 font-medium">Distance</th>
                <th className="text-right px-3 py-2.5 font-medium">Duration</th>
                <th className="text-center px-3 py-2.5 font-medium">Days</th>
                <th className="text-right px-3 py-2.5 font-medium">Bids</th>
                <th className="text-center px-3 py-2.5 font-medium">Status</th>
                <th className="text-center px-3 py-2.5 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && schedules.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-16 text-center">
                    <Loader2 className="w-5 h-5 text-acars-blue animate-spin mx-auto mb-2" />
                    <span className="text-xs text-acars-muted">Loading schedules...</span>
                  </td>
                </tr>
              ) : schedules.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-16 text-center">
                    <Plane className="w-8 h-8 text-acars-muted/20 mx-auto mb-3" />
                    <span className="text-xs text-acars-muted">No schedules match your filters</span>
                  </td>
                </tr>
              ) : (
                schedules.map((s, i) => (
                  <tr
                    key={s.id}
                    className={`border-b border-acars-border/50 hover:bg-[#1c2433] transition-colors ${
                      i % 2 === 0 ? 'bg-acars-panel' : 'bg-acars-bg'
                    }`}
                  >
                    {/* Flight # */}
                    <td className="px-4 py-2.5">
                      <span className="font-mono font-semibold text-acars-text">
                        {s.flightNumber}
                      </span>
                      {s.charterType && (
                        <span className="ml-1.5 text-[9px] uppercase font-bold tracking-wide text-acars-amber bg-acars-amber/10 border border-acars-amber/20 px-1.5 py-0.5 rounded">
                          {s.charterType}
                        </span>
                      )}
                    </td>

                    {/* Dep */}
                    <td className="px-3 py-2.5">
                      <div className="font-mono font-semibold text-acars-text">{s.depIcao}</div>
                      <div className="text-[10px] text-acars-muted truncate max-w-[120px]" title={s.depName}>
                        {s.depName}
                      </div>
                      <div className="text-[10px] text-acars-muted/60 font-mono">{s.depTime}z</div>
                    </td>

                    {/* Arr */}
                    <td className="px-3 py-2.5">
                      <div className="font-mono font-semibold text-acars-text">{s.arrIcao}</div>
                      <div className="text-[10px] text-acars-muted truncate max-w-[120px]" title={s.arrName}>
                        {s.arrName}
                      </div>
                      <div className="text-[10px] text-acars-muted/60 font-mono">{s.arrTime}z</div>
                    </td>

                    {/* Aircraft */}
                    <td className="px-3 py-2.5">
                      <span className="font-mono text-acars-muted">{s.aircraftType}</span>
                    </td>

                    {/* Distance */}
                    <td className="px-3 py-2.5 text-right">
                      <span className="font-mono text-acars-muted tabular-nums">
                        {s.distanceNm.toLocaleString()} nm
                      </span>
                    </td>

                    {/* Duration */}
                    <td className="px-3 py-2.5 text-right">
                      <span className="font-mono text-acars-muted tabular-nums">
                        {formatDuration(s.flightTimeMin)}
                      </span>
                    </td>

                    {/* Days */}
                    <td className="px-3 py-2.5">
                      <DayChips daysOfWeek={s.daysOfWeek} />
                    </td>

                    {/* Bids */}
                    <td className="px-3 py-2.5 text-right">
                      <span
                        className={`font-mono font-semibold tabular-nums ${
                          s.bidCount > 0 ? 'text-acars-blue' : 'text-acars-muted/40'
                        }`}
                      >
                        {s.bidCount}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="px-3 py-2.5 text-center">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border ${
                          s.isActive
                            ? 'bg-acars-green/10 text-acars-green border-acars-green/20'
                            : 'bg-acars-red/10 text-acars-red border-acars-red/20'
                        }`}
                      >
                        {s.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="px-3 py-2.5">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => {
                            setModalError('');
                            setEditTarget(s);
                          }}
                          className="p-1.5 rounded-md text-acars-muted hover:text-acars-blue hover:bg-acars-blue/10 transition-colors"
                          title="Edit"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleToggle(s)}
                          className={`p-1.5 rounded-md transition-colors ${
                            s.isActive
                              ? 'text-acars-green hover:text-acars-red hover:bg-acars-red/10'
                              : 'text-acars-muted hover:text-acars-green hover:bg-acars-green/10'
                          }`}
                          title={s.isActive ? 'Deactivate' : 'Activate'}
                        >
                          {s.isActive ? (
                            <ToggleRight className="w-3.5 h-3.5" />
                          ) : (
                            <ToggleLeft className="w-3.5 h-3.5" />
                          )}
                        </button>
                        <button
                          onClick={() => {
                            setModalError('');
                            setCloneTarget(s);
                          }}
                          className="p-1.5 rounded-md text-acars-muted hover:text-acars-amber hover:bg-acars-amber/10 transition-colors"
                          title="Clone"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(s)}
                          className="p-1.5 rounded-md text-acars-muted hover:text-acars-red hover:bg-acars-red/10 transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {total > pageSize && (
          <div className="flex-none border-t border-acars-border px-4 py-2 flex items-center justify-between">
            <span className="text-xs text-acars-muted">
              Showing {(page - 1) * pageSize + 1}&ndash;{Math.min(page * pageSize, total)} of{' '}
              {total}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="h-7 w-7 rounded border border-acars-border bg-acars-panel text-acars-muted hover:text-acars-text disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <span className="text-xs text-acars-text px-2 font-mono">
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="h-7 w-7 rounded border border-acars-border bg-acars-panel text-acars-muted hover:text-acars-text disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Modals ────────────────────────────────────────────────── */}

      {/* Create Modal */}
      {createOpen && (
        <ScheduleFormModal
          title="Create Schedule"
          initialData={EMPTY_FORM}
          aircraftTypes={aircraftTypes}
          submitting={modalSubmitting}
          error={modalError}
          onSubmit={handleCreate}
          onClose={closeCreate}
        />
      )}

      {/* Edit Modal */}
      {editTarget && (
        <ScheduleFormModal
          title="Edit Schedule"
          initialData={{
            flightNumber: editTarget.flightNumber,
            depIcao: editTarget.depIcao,
            arrIcao: editTarget.arrIcao,
            aircraftType: editTarget.aircraftType,
            depTime: editTarget.depTime,
            arrTime: editTarget.arrTime,
            distanceNm: editTarget.distanceNm,
            flightTimeMin: editTarget.flightTimeMin,
            daysOfWeek: editTarget.daysOfWeek,
            charterType: editTarget.charterType ?? '',
          }}
          aircraftTypes={aircraftTypes}
          submitting={modalSubmitting}
          error={modalError}
          onSubmit={handleEdit}
          onClose={closeEdit}
        />
      )}

      {/* Clone Modal */}
      {cloneTarget && (
        <CloneModal
          schedule={cloneTarget}
          submitting={modalSubmitting}
          error={modalError}
          onClone={handleClone}
          onClose={closeClone}
        />
      )}

      {/* Delete Confirm Dialog */}
      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Schedule"
        message={
          deleteTarget
            ? `Are you sure you want to delete ${deleteTarget.flightNumber} (${deleteTarget.depIcao} → ${deleteTarget.arrIcao})?${
                deleteTarget.bidCount > 0
                  ? ` This route has ${deleteTarget.bidCount} active bid${deleteTarget.bidCount === 1 ? '' : 's'}.`
                  : ''
              }`
            : ''
        }
        variant="danger"
        confirmLabel="Delete"
        loading={deleteLoading}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
