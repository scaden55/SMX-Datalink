import { Fragment, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  CalendarDays,
  Search,
  RotateCcw,
  Loader2,
  Plane,
  X,
  Clock,
  ArrowRight,
  ChevronDown,
  MapPin,
  Ruler,
  Timer,
  PlaneTakeoff,
  PlaneLanding,
  Plus,
  Package,
  Users,
  RotateCw,
} from 'lucide-react';
import { MapContainer, TileLayer, CircleMarker, Polyline, Tooltip, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { api } from '../lib/api';
import type {
  Airport,
  ScheduleListItem,
  BidWithDetails,
  ScheduleListResponse,
  BidResponse,
  MyBidsResponse,
  CharterType,
  CreateCharterResponse,
} from '@acars/shared';

// ─── Helpers ────────────────────────────────────────────────────

function formatDuration(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}h ${String(m).padStart(2, '0')}m`;
}

const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'] as const;

function DaysIndicator({ days }: { days: string }) {
  return (
    <div className="flex gap-0.5">
      {DAY_LABELS.map((label, i) => {
        const active = days.includes(String(i + 1));
        return (
          <div
            key={i}
            className={`w-3.5 h-3.5 rounded-sm flex items-center justify-center text-[8px] font-semibold ${
              active
                ? 'bg-acars-blue/20 text-acars-blue border border-acars-blue/30'
                : 'bg-acars-bg text-acars-muted/40 border border-acars-border/50'
            }`}
            title={active ? `Day ${i + 1} active` : `Day ${i + 1} inactive`}
          >
            {label}
          </div>
        );
      })}
    </div>
  );
}

// ─── Charter Types ──────────────────────────────────────────────

const CHARTER_TYPES: { value: CharterType; label: string; icon: typeof Plane; desc: string }[] = [
  { value: 'reposition', label: 'Reposition', icon: RotateCw, desc: 'Ferry flight — no payload' },
  { value: 'cargo', label: 'Cargo Charter', icon: Package, desc: 'Freight / cargo operations' },
  { value: 'passenger', label: 'Passenger Charter', icon: Users, desc: 'Passenger charter service' },
];

// ─── Airport Search ─────────────────────────────────────────────

interface AirportSearchProps {
  airports: Airport[];
  value: string;
  onChange: (icao: string) => void;
  label: string;
  placeholder?: string;
}

function AirportSearch({ airports, value, onChange, label, placeholder = 'Type ICAO or city...' }: AirportSearchProps) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = airports.find(a => a.icao === value);

  const filtered = useMemo(() => {
    if (!query) return airports;
    const q = query.toLowerCase();
    return airports.filter(a =>
      a.icao.toLowerCase().includes(q) ||
      a.name.toLowerCase().includes(q) ||
      a.city.toLowerCase().includes(q)
    );
  }, [airports, query]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSelect = (icao: string) => {
    onChange(icao);
    setQuery('');
    setOpen(false);
  };

  const handleClear = () => {
    onChange('');
    setQuery('');
    inputRef.current?.focus();
  };

  return (
    <div ref={wrapperRef} className="relative">
      <label className="text-[10px] uppercase tracking-wider text-acars-muted font-medium mb-1.5 block">{label}</label>
      {selected && !open ? (
        <button
          type="button"
          onClick={() => { setOpen(true); setQuery(''); setTimeout(() => inputRef.current?.focus(), 0); }}
          className="w-full h-9 rounded-md border border-acars-border bg-acars-bg text-xs text-left px-2.5 flex items-center gap-2 hover:border-acars-muted/50 transition-colors"
        >
          <span className="font-mono font-semibold text-acars-text">{selected.icao}</span>
          <span className="text-acars-muted truncate">— {selected.city}</span>
          <X
            className="w-3 h-3 text-acars-muted hover:text-acars-text ml-auto shrink-0"
            onClick={e => { e.stopPropagation(); handleClear(); }}
          />
        </button>
      ) : (
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-acars-muted" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => { setQuery(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            placeholder={placeholder}
            className="w-full h-9 rounded-md border border-acars-magenta bg-acars-bg text-xs text-acars-text pl-8 pr-2.5 outline-none transition-colors placeholder:text-acars-muted/50"
            autoComplete="off"
          />
        </div>
      )}
      {open && (
        <div className="absolute z-50 top-full mt-1 w-full max-h-[200px] overflow-auto rounded-md border border-acars-border bg-acars-panel shadow-xl">
          {filtered.length === 0 ? (
            <div className="px-3 py-4 text-center text-[11px] text-acars-muted">No airports match "{query}"</div>
          ) : (
            filtered.map(a => (
              <button
                key={a.icao}
                type="button"
                onClick={() => handleSelect(a.icao)}
                className={`w-full text-left px-3 py-2 flex items-center gap-2 text-xs hover:bg-acars-blue/10 transition-colors ${
                  a.icao === value ? 'bg-acars-blue/10 text-acars-blue' : 'text-acars-text'
                }`}
              >
                <span className="font-mono font-semibold w-10 shrink-0">{a.icao}</span>
                <span className="text-acars-muted truncate">{a.name}</span>
                <span className="text-acars-muted/60 text-[10px] ml-auto shrink-0">{a.city}, {a.state}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ─── Charter Modal ──────────────────────────────────────────────

interface CharterModalProps {
  airports: Airport[];
  aircraftTypes: string[];
  onClose: () => void;
  onCreated: (res: CreateCharterResponse) => void;
}

function CharterModal({ airports, aircraftTypes, onClose, onCreated }: CharterModalProps) {
  const [charterType, setCharterType] = useState<CharterType>('passenger');
  const [depIcao, setDepIcao] = useState('');
  const [arrIcao, setArrIcao] = useState('');
  const [aircraftType, setAircraftType] = useState('');
  const [depTime, setDepTime] = useState('08:00');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const canSubmit = depIcao && arrIcao && aircraftType && depTime && depIcao !== arrIcao && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError('');
    try {
      const res = await api.post<CreateCharterResponse>('/api/charters', {
        charterType,
        depIcao,
        arrIcao,
        aircraftType,
        depTime,
      });
      onCreated(res);
    } catch (err: any) {
      setError(err?.message || 'Failed to create charter');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative w-[520px] max-h-[90vh] overflow-auto rounded-xl border border-acars-border bg-acars-panel shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-acars-border">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-acars-magenta/10 border border-acars-magenta/20">
              <Plus className="w-4.5 h-4.5 text-acars-magenta" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-acars-text">Create Charter Flight</h2>
              <p className="text-[10px] text-acars-muted">Fly anywhere — your flight, your rules</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-acars-bg text-acars-muted hover:text-acars-text transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4">
          {/* Charter type */}
          <div>
            <label className="text-[10px] uppercase tracking-wider text-acars-muted font-medium mb-2 block">Charter Type</label>
            <div className="grid grid-cols-3 gap-2">
              {CHARTER_TYPES.map(ct => {
                const Icon = ct.icon;
                const active = charterType === ct.value;
                return (
                  <button
                    key={ct.value}
                    onClick={() => setCharterType(ct.value)}
                    className={`flex flex-col items-center gap-1.5 p-3 rounded-lg border transition-all text-center ${
                      active
                        ? 'border-acars-magenta bg-acars-magenta/10 text-acars-magenta'
                        : 'border-acars-border bg-acars-bg text-acars-muted hover:border-acars-muted/50'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="text-[11px] font-semibold">{ct.label}</span>
                    <span className="text-[9px] opacity-70">{ct.desc}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Route */}
          <div className="grid grid-cols-2 gap-3">
            <AirportSearch
              airports={airports}
              value={depIcao}
              onChange={setDepIcao}
              label="Departure"
              placeholder="Type ICAO or city..."
            />
            <AirportSearch
              airports={airports}
              value={arrIcao}
              onChange={setArrIcao}
              label="Arrival"
              placeholder="Type ICAO or city..."
            />
          </div>

          {depIcao && arrIcao && depIcao === arrIcao && (
            <p className="text-[11px] text-acars-red">Departure and arrival must be different airports</p>
          )}

          {/* Aircraft + Time */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] uppercase tracking-wider text-acars-muted font-medium mb-1.5 block">Aircraft</label>
              <select
                value={aircraftType}
                onChange={e => setAircraftType(e.target.value)}
                className="w-full h-9 rounded-md border border-acars-border bg-acars-bg text-xs text-acars-text px-2.5 outline-none focus:border-acars-magenta transition-colors"
              >
                <option value="">Select aircraft</option>
                {aircraftTypes.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider text-acars-muted font-medium mb-1.5 block">Departure Time (Z)</label>
              <input
                type="time"
                value={depTime}
                onChange={e => setDepTime(e.target.value)}
                className="w-full h-9 rounded-md border border-acars-border bg-acars-bg text-xs text-acars-text font-mono px-2.5 outline-none focus:border-acars-magenta transition-colors"
              />
            </div>
          </div>

          {/* Error */}
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
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-xs font-semibold text-white bg-acars-magenta hover:bg-acars-magenta/80 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
            Create Charter
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Route Map Helpers ──────────────────────────────────────────

function FitBounds({ dep, arr }: { dep: [number, number]; arr: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    const bounds: [[number, number], [number, number]] = [dep, arr];
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 7 });
  }, [map, dep, arr]);
  return null;
}

interface FlightPreviewProps {
  schedule: ScheduleListItem;
  depAirport: Airport | undefined;
  arrAirport: Airport | undefined;
  hasBid: boolean;
  isBidding: boolean;
  onBid: () => void;
  onRemoveBid: () => void;
}

function FlightPreviewPanel({ schedule: s, depAirport, arrAirport, hasBid, isBidding, onBid, onRemoveBid }: FlightPreviewProps) {
  const depPos: [number, number] | null = depAirport ? [depAirport.lat, depAirport.lon] : null;
  const arrPos: [number, number] | null = arrAirport ? [arrAirport.lat, arrAirport.lon] : null;

  return (
    <div className="flex gap-4 p-4 animate-in fade-in slide-in-from-top-1 duration-200">
      {/* Route map */}
      <div className="w-[320px] h-[200px] rounded-lg overflow-hidden border border-acars-border shrink-0">
        {depPos && arrPos ? (
          <MapContainer
            center={depPos}
            zoom={5}
            className="h-full w-full"
            zoomControl={false}
            attributionControl={false}
            style={{ background: '#0d1117' }}
            scrollWheelZoom={false}
            dragging={false}
            doubleClickZoom={false}
            touchZoom={false}
          >
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
              maxZoom={19}
            />
            <FitBounds dep={depPos} arr={arrPos} />
            <Polyline
              positions={[depPos, arrPos]}
              pathOptions={{ color: '#58a6ff', weight: 2, opacity: 0.8, dashArray: '6 4' }}
            />
            <CircleMarker
              center={depPos}
              radius={6}
              pathOptions={{ color: '#3fb950', fillColor: '#3fb950', fillOpacity: 0.9, weight: 1.5 }}
            >
              <Tooltip direction="top" offset={[0, -8]} permanent className="hub-tooltip">
                <span style={{ fontFamily: 'JetBrains Mono, Consolas, monospace', fontSize: '10px' }}>
                  {s.depIcao}
                </span>
              </Tooltip>
            </CircleMarker>
            <CircleMarker
              center={arrPos}
              radius={6}
              pathOptions={{ color: '#f85149', fillColor: '#f85149', fillOpacity: 0.9, weight: 1.5 }}
            >
              <Tooltip direction="top" offset={[0, -8]} permanent className="hub-tooltip">
                <span style={{ fontFamily: 'JetBrains Mono, Consolas, monospace', fontSize: '10px' }}>
                  {s.arrIcao}
                </span>
              </Tooltip>
            </CircleMarker>
          </MapContainer>
        ) : (
          <div className="h-full flex items-center justify-center bg-acars-bg">
            <span className="text-[10px] text-acars-muted">Map unavailable</span>
          </div>
        )}
      </div>

      {/* Flight details */}
      <div className="flex-1 min-w-0 grid grid-cols-2 gap-x-6 gap-y-3 content-start">
        {/* Departure */}
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-acars-muted font-medium">
            <PlaneTakeoff className="w-3 h-3 text-acars-green" /> Departure
          </div>
          <p className="text-sm font-mono font-semibold text-acars-text">{s.depIcao}</p>
          <p className="text-[11px] text-acars-muted truncate">{depAirport?.name ?? '—'}</p>
          <p className="text-[10px] text-acars-muted">{depAirport?.city}, {depAirport?.state}</p>
          <p className="text-xs font-mono text-acars-text tabular-nums mt-1">{s.depTime}Z</p>
        </div>

        {/* Arrival */}
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-acars-muted font-medium">
            <PlaneLanding className="w-3 h-3 text-acars-red" /> Arrival
          </div>
          <p className="text-sm font-mono font-semibold text-acars-text">{s.arrIcao}</p>
          <p className="text-[11px] text-acars-muted truncate">{arrAirport?.name ?? '—'}</p>
          <p className="text-[10px] text-acars-muted">{arrAirport?.city}, {arrAirport?.state}</p>
          <p className="text-xs font-mono text-acars-text tabular-nums mt-1">{s.arrTime}Z</p>
        </div>

        {/* Stats row */}
        <div className="col-span-2 flex items-center gap-5 pt-1 border-t border-acars-border/50">
          <div className="flex items-center gap-1.5 text-[11px] text-acars-muted">
            <Ruler className="w-3.5 h-3.5 text-acars-blue" />
            <span className="font-mono tabular-nums text-acars-text">{s.distanceNm.toLocaleString()}</span> nm
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-acars-muted">
            <Timer className="w-3.5 h-3.5 text-acars-amber" />
            <span className="font-mono tabular-nums text-acars-text">{formatDuration(s.flightTimeMin)}</span>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-acars-muted">
            <Plane className="w-3.5 h-3.5 text-acars-cyan" />
            <span className="text-acars-text">{s.aircraftType}</span>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-acars-muted">
            <CalendarDays className="w-3.5 h-3.5 text-acars-magenta" />
            <DaysIndicator days={s.daysOfWeek} />
          </div>
          <div className="ml-auto">
            {hasBid ? (
              <button
                disabled={isBidding}
                onClick={(e) => { e.stopPropagation(); onRemoveBid(); }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-[11px] font-semibold uppercase tracking-wide bg-acars-red/10 text-acars-red border border-acars-red/20 hover:bg-acars-red/20 transition-colors disabled:opacity-50"
              >
                {isBidding ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Remove Bid'}
              </button>
            ) : (
              <button
                disabled={isBidding}
                onClick={(e) => { e.stopPropagation(); onBid(); }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-[11px] font-semibold uppercase tracking-wide bg-acars-blue/10 text-acars-blue border border-acars-blue/20 hover:bg-acars-blue/20 transition-colors disabled:opacity-50"
              >
                {isBidding ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Place Bid'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Schedule Page ──────────────────────────────────────────────

export function SchedulePage() {
  // Filter state
  const [airports, setAirports] = useState<Airport[]>([]);
  const [aircraftTypes, setAircraftTypes] = useState<string[]>([]);
  const [depFilter, setDepFilter] = useState('');
  const [arrFilter, setArrFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // Data state
  const [schedules, setSchedules] = useState<ScheduleListItem[]>([]);
  const [myBids, setMyBids] = useState<BidWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [bidLoading, setBidLoading] = useState<number | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [charterOpen, setCharterOpen] = useState(false);

  // Airport lookup by ICAO
  const airportMap = useMemo(() => {
    const map = new Map<string, Airport>();
    airports.forEach(a => map.set(a.icao, a));
    return map;
  }, [airports]);

  const searchTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // ── Load filter options on mount ───────────────────────────
  useEffect(() => {
    Promise.all([
      api.get<Airport[]>('/api/airports'),
      api.get<string[]>('/api/fleet/types'),
      api.get<MyBidsResponse>('/api/bids/my'),
    ]).then(([airportsData, typesData, bidsData]) => {
      setAirports(airportsData);
      setAircraftTypes(typesData);
      setMyBids(bidsData.bids);
    }).catch(err => console.error('[Schedule] Failed to load filter data:', err));
  }, []);

  // ── Fetch schedules whenever filters change ────────────────
  const fetchSchedules = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (depFilter) params.set('dep_icao', depFilter);
      if (arrFilter) params.set('arr_icao', arrFilter);
      if (typeFilter) params.set('aircraft_type', typeFilter);
      if (searchTerm) params.set('search', searchTerm);

      const qs = params.toString();
      const data = await api.get<ScheduleListResponse>(`/api/schedules${qs ? `?${qs}` : ''}`);
      setSchedules(data.schedules);
    } catch (err) {
      console.error('[Schedule] Failed to fetch schedules:', err);
    } finally {
      setLoading(false);
    }
  }, [depFilter, arrFilter, typeFilter, searchTerm]);

  useEffect(() => { fetchSchedules(); }, [fetchSchedules]);

  // ── Search debounce ────────────────────────────────────────
  const handleSearchChange = (value: string) => {
    setSearchInput(value);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setSearchTerm(value), 300);
  };

  // ── Reset filters ──────────────────────────────────────────
  const resetFilters = () => {
    setDepFilter('');
    setArrFilter('');
    setTypeFilter('');
    setSearchInput('');
    setSearchTerm('');
  };

  const hasFilters = depFilter || arrFilter || typeFilter || searchTerm;

  // ── Bid / Unbid (optimistic) ───────────────────────────────
  const handleBid = async (scheduleId: number) => {
    setBidLoading(scheduleId);

    // Optimistic: mark as bid in table
    setSchedules(prev => prev.map(s =>
      s.id === scheduleId ? { ...s, hasBid: true, bidCount: s.bidCount + 1 } : s
    ));

    try {
      const data = await api.post<BidResponse>('/api/bids', { scheduleId });
      setMyBids(prev => [...prev, data.bid]);
    } catch (err) {
      console.error('[Schedule] Bid failed:', err);
      // Revert optimistic update
      setSchedules(prev => prev.map(s =>
        s.id === scheduleId ? { ...s, hasBid: false, bidCount: s.bidCount - 1 } : s
      ));
    } finally {
      setBidLoading(null);
    }
  };

  const handleRemoveBid = async (bidId: number, scheduleId: number) => {
    setBidLoading(scheduleId);

    // Check if this is a charter — charters are deleted when their bid is removed
    const isCharter = schedules.find(s => s.id === scheduleId)?.charterType != null;

    // Optimistic: remove bid from sidebar, update or remove schedule
    if (isCharter) {
      setSchedules(prev => prev.filter(s => s.id !== scheduleId));
      if (expandedId === scheduleId) setExpandedId(null);
    } else {
      setSchedules(prev => prev.map(s =>
        s.id === scheduleId ? { ...s, hasBid: false, bidCount: Math.max(0, s.bidCount - 1) } : s
      ));
    }
    setMyBids(prev => prev.filter(b => b.id !== bidId));

    try {
      await api.delete('/api/bids/' + bidId);
    } catch (err) {
      console.error('[Schedule] Remove bid failed:', err);
      // Revert: re-fetch everything
      fetchSchedules();
      api.get<MyBidsResponse>('/api/bids/my').then(d => setMyBids(d.bids));
    } finally {
      setBidLoading(null);
    }
  };

  const findBidForSchedule = (scheduleId: number) =>
    myBids.find(b => b.scheduleId === scheduleId);

  // ── Charter created ──────────────────────────────────────────
  const handleCharterCreated = (res: CreateCharterResponse) => {
    setSchedules(prev => [...prev, res.schedule]);
    setMyBids(prev => [...prev, res.bid]);
    setCharterOpen(false);
    setExpandedId(res.schedule.id);
  };

  // ── Render ─────────────────────────────────────────────────
  return (
    <div className="flex h-full overflow-hidden">
      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Filter bar */}
        <div className="panel m-5 mb-0">
          <div className="flex items-center justify-between px-4 py-3 border-b border-acars-border">
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-acars-amber/10 border border-acars-amber/20">
                <CalendarDays className="w-4 h-4 text-acars-amber" />
              </div>
              <h2 className="text-sm font-semibold text-acars-text">Flight Schedule</h2>
              <span className="text-[11px] text-acars-muted tabular-nums">
                {loading ? '' : `${schedules.length} flights`}
              </span>
              {loading && <Loader2 className="w-3.5 h-3.5 text-acars-blue animate-spin" />}
            </div>
            <button
              onClick={() => setCharterOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-semibold text-acars-magenta bg-acars-magenta/10 border border-acars-magenta/20 hover:bg-acars-magenta/20 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> Create Charter
            </button>
          </div>
          <div className="flex items-center gap-3 px-4 py-3">
            {/* Departure */}
            <select
              value={depFilter}
              onChange={e => setDepFilter(e.target.value)}
              className="h-8 rounded-md border border-acars-border bg-acars-bg text-xs text-acars-text px-2 outline-none focus:border-acars-blue transition-colors min-w-[140px]"
            >
              <option value="">All Departures</option>
              {airports.map(a => (
                <option key={a.icao} value={a.icao}>{a.icao} — {a.city}</option>
              ))}
            </select>

            {/* Arrival */}
            <select
              value={arrFilter}
              onChange={e => setArrFilter(e.target.value)}
              className="h-8 rounded-md border border-acars-border bg-acars-bg text-xs text-acars-text px-2 outline-none focus:border-acars-blue transition-colors min-w-[140px]"
            >
              <option value="">All Arrivals</option>
              {airports.map(a => (
                <option key={a.icao} value={a.icao}>{a.icao} — {a.city}</option>
              ))}
            </select>

            {/* Aircraft type */}
            <select
              value={typeFilter}
              onChange={e => setTypeFilter(e.target.value)}
              className="h-8 rounded-md border border-acars-border bg-acars-bg text-xs text-acars-text px-2 outline-none focus:border-acars-blue transition-colors min-w-[120px]"
            >
              <option value="">All Aircraft</option>
              {aircraftTypes.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>

            {/* Search */}
            <div className="relative flex-1 max-w-[240px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-acars-muted" />
              <input
                type="text"
                value={searchInput}
                onChange={e => handleSearchChange(e.target.value)}
                placeholder="Search flights..."
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

        {/* Schedule table */}
        <div className="flex-1 mx-5 mt-4 mb-5 panel flex flex-col overflow-hidden">
          <div className="flex-1 overflow-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 z-10 bg-acars-panel">
                <tr className="text-[10px] uppercase tracking-wider text-acars-muted border-b border-acars-border">
                  <th className="text-left px-4 py-2.5 font-medium">Flight #</th>
                  <th className="text-left px-4 py-2.5 font-medium">Route</th>
                  <th className="text-left px-4 py-2.5 font-medium">Aircraft</th>
                  <th className="text-left px-4 py-2.5 font-medium">Dep (Z)</th>
                  <th className="text-left px-4 py-2.5 font-medium">Arr (Z)</th>
                  <th className="text-right px-4 py-2.5 font-medium">Distance</th>
                  <th className="text-right px-4 py-2.5 font-medium">Duration</th>
                  <th className="text-center px-4 py-2.5 font-medium">Days</th>
                  <th className="text-center px-4 py-2.5 font-medium">Bids</th>
                  <th className="text-right px-4 py-2.5 font-medium">Action</th>
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
                      <CalendarDays className="w-6 h-6 text-acars-muted/40 mx-auto mb-2" />
                      <span className="text-xs text-acars-muted">No flights match your filters</span>
                    </td>
                  </tr>
                ) : (
                  schedules.map((s, i) => {
                    const bid = findBidForSchedule(s.id);
                    const isBidding = bidLoading === s.id;
                    const isExpanded = expandedId === s.id;
                    return (
                      <Fragment key={s.id}>
                        <tr
                          onClick={() => setExpandedId(isExpanded ? null : s.id)}
                          className={`border-b border-acars-border/50 hover:bg-[#1c2433] transition-colors cursor-pointer ${
                            isExpanded ? 'bg-[#1c2433]' : i % 2 === 0 ? 'bg-acars-panel' : 'bg-acars-bg'
                          }`}
                        >
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-2">
                              <ChevronDown className={`w-3.5 h-3.5 text-acars-muted/50 transition-transform duration-200 shrink-0 ${isExpanded ? 'rotate-0' : '-rotate-90'}`} />
                              <span className="font-mono font-medium text-acars-text">{s.flightNumber}</span>
                              {s.charterType && (
                                <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wide ${
                                  s.charterType === 'reposition' ? 'bg-acars-cyan/10 text-acars-cyan border border-acars-cyan/20' :
                                  s.charterType === 'cargo' ? 'bg-acars-amber/10 text-acars-amber border border-acars-amber/20' :
                                  'bg-acars-magenta/10 text-acars-magenta border border-acars-magenta/20'
                                }`}>
                                  {s.charterType === 'reposition' ? 'REPO' : s.charterType === 'cargo' ? 'CARGO' : 'PAX'}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-2.5">
                            <span className="text-acars-text font-mono">{s.depIcao}</span>
                            <ArrowRight className="w-3 h-3 text-acars-muted/50 inline mx-1.5" />
                            <span className="text-acars-text font-mono">{s.arrIcao}</span>
                          </td>
                          <td className="px-4 py-2.5 text-acars-muted">{s.aircraftType}</td>
                          <td className="px-4 py-2.5 font-mono text-acars-muted tabular-nums">{s.depTime}</td>
                          <td className="px-4 py-2.5 font-mono text-acars-muted tabular-nums">{s.arrTime}</td>
                          <td className="px-4 py-2.5 text-right font-mono text-acars-muted tabular-nums">{s.distanceNm.toLocaleString()} nm</td>
                          <td className="px-4 py-2.5 text-right font-mono text-acars-muted tabular-nums">{formatDuration(s.flightTimeMin)}</td>
                          <td className="px-4 py-2.5">
                            <div className="flex justify-center">
                              <DaysIndicator days={s.daysOfWeek} />
                            </div>
                          </td>
                          <td className="px-4 py-2.5 text-center">
                            <span className="inline-flex items-center justify-center w-6 h-5 rounded bg-acars-bg border border-acars-border text-[10px] font-semibold text-acars-muted tabular-nums">
                              {s.bidCount}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            {s.hasBid ? (
                              <button
                                disabled={isBidding}
                                onClick={(e) => { e.stopPropagation(); bid && handleRemoveBid(bid.id, s.id); }}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-[10px] font-semibold uppercase tracking-wide bg-acars-red/10 text-acars-red border border-acars-red/20 hover:bg-acars-red/20 transition-colors disabled:opacity-50"
                              >
                                {isBidding ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Remove'}
                              </button>
                            ) : (
                              <button
                                disabled={isBidding}
                                onClick={(e) => { e.stopPropagation(); handleBid(s.id); }}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-[10px] font-semibold uppercase tracking-wide bg-acars-blue/10 text-acars-blue border border-acars-blue/20 hover:bg-acars-blue/20 transition-colors disabled:opacity-50"
                              >
                                {isBidding ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Bid'}
                              </button>
                            )}
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr className="bg-[#141b27] border-b border-acars-border">
                            <td colSpan={10}>
                              <FlightPreviewPanel
                                schedule={s}
                                depAirport={airportMap.get(s.depIcao)}
                                arrAirport={airportMap.get(s.arrIcao)}
                                hasBid={s.hasBid}
                                isBidding={isBidding}
                                onBid={() => handleBid(s.id)}
                                onRemoveBid={() => bid && handleRemoveBid(bid.id, s.id)}
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
      </div>

      {/* Right sidebar: My Bids */}
      <div className="w-[300px] shrink-0 border-l border-acars-border flex flex-col bg-acars-panel overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-acars-border">
          <h3 className="text-sm font-semibold text-acars-text">My Bids</h3>
          <span className="inline-flex items-center justify-center min-w-[20px] h-5 rounded-full bg-acars-blue/10 border border-acars-blue/20 text-[10px] font-semibold text-acars-blue tabular-nums px-1.5">
            {myBids.length}
          </span>
        </div>
        <div className="flex-1 overflow-auto">
          {myBids.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-4">
              <Plane className="w-8 h-8 text-acars-muted/30 mb-3" />
              <p className="text-xs text-acars-muted">No active bids</p>
              <p className="text-[10px] text-acars-muted/60 mt-1">Browse the schedule and place a bid to get started</p>
            </div>
          ) : (
            <div className="p-3 space-y-2">
              {myBids.map(bid => (
                <div
                  key={bid.id}
                  className="group relative rounded-md border border-acars-border bg-acars-bg p-3 hover:border-acars-blue/30 transition-colors"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-mono font-semibold text-xs text-acars-text">{bid.flightNumber}</span>
                    <button
                      onClick={() => handleRemoveBid(bid.id, bid.scheduleId)}
                      className="opacity-0 group-hover:opacity-100 flex items-center justify-center w-5 h-5 rounded bg-acars-red/10 text-acars-red hover:bg-acars-red/20 transition-all"
                      title="Remove bid"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px] text-acars-muted mb-1">
                    <span className="font-mono text-acars-text">{bid.depIcao}</span>
                    <ArrowRight className="w-3 h-3 text-acars-muted/40" />
                    <span className="font-mono text-acars-text">{bid.arrIcao}</span>
                  </div>
                  <div className="flex items-center gap-3 text-[10px] text-acars-muted">
                    <span>{bid.aircraftType}</span>
                    <span className="flex items-center gap-0.5 tabular-nums">
                      <Clock className="w-3 h-3" />
                      {bid.depTime}Z
                    </span>
                    <span className="tabular-nums">{formatDuration(bid.flightTimeMin)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Charter modal */}
      {charterOpen && (
        <CharterModal
          airports={airports}
          aircraftTypes={aircraftTypes}
          onClose={() => setCharterOpen(false)}
          onCreated={handleCharterCreated}
        />
      )}
    </div>
  );
}
