import { Fragment, useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CalendarDots,
  MagnifyingGlass,
  ArrowCounterClockwise,
  SpinnerGap,
  AirplaneTilt,
  X,
  Clock,
  ArrowRight,
  CaretDown,
  MapPin,
  Ruler,
  Timer,
  AirplaneTakeoff,
  AirplaneLanding,
  Plus,
  Package,
  Users,
  ArrowClockwise,
  Path,
  Warning,
  Warehouse,
  Tag,
} from '@phosphor-icons/react';
import { MapContainer, TileLayer, CircleMarker, Polyline, Tooltip, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { api } from '../lib/api';
import { useFlightPlanStore } from '../stores/flightPlanStore';
import type {
  Airport,
  ScheduleListItem,
  BidWithDetails,
  ScheduleListResponse,
  BidResponse,
  MyBidsResponse,
  CharterType,
  CreateCharterResponse,
  FleetForBidItem,
  FleetForBidResponse,
} from '@acars/shared';
import { toast } from '../stores/toastStore';

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
            className={`w-3.5 h-3.5 rounded-md flex items-center justify-center text-[8px] font-semibold ${
              active
                ? 'bg-blue-500/20 text-blue-400 border border-blue-400/30'
                : 'bg-acars-bg text-acars-muted/40 border border-acars-border'
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

const CHARTER_TYPES: { value: CharterType; label: string; icon: typeof AirplaneTilt; desc: string }[] = [
  { value: 'cargo', label: 'Cargo Charter', icon: Package, desc: 'Freight / cargo operations' },
  { value: 'reposition', label: 'Reposition', icon: ArrowClockwise, desc: 'Ferry flight — no payload' },
  { value: 'passenger', label: 'Passenger Charter', icon: Users, desc: 'Pax charter service (non-scheduled)' },
];

// ─── Airport Search (server-side, worldwide) ────────────────────────────

interface AirportSearchResult {
  ident: string;
  name: string;
  iata_code: string | null;
  municipality: string | null;
  iso_country: string | null;
}

interface AirportSearchProps {
  value: string;
  onChange: (icao: string) => void;
  label: string;
  placeholder?: string;
}

function AirportSearch({ value, onChange, label, placeholder = 'Type ICAO or city...' }: AirportSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<AirportSearchResult[]>([]);
  const [selectedLabel, setSelectedLabel] = useState('');
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Debounced server-side search
  useEffect(() => {
    if (query.length < 2) { setResults([]); return; }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      api.get<AirportSearchResult[]>(`/api/airports/search?q=${encodeURIComponent(query)}&limit=20`)
        .then(setResults)
        .catch(() => setResults([]));
    }, 250);
    return () => clearTimeout(debounceRef.current);
  }, [query]);

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

  const handleSelect = (r: AirportSearchResult) => {
    onChange(r.ident);
    setSelectedLabel(r.municipality ?? r.name);
    setQuery('');
    setOpen(false);
  };

  const handleClear = () => {
    onChange('');
    setSelectedLabel('');
    setQuery('');
    inputRef.current?.focus();
  };

  return (
    <div ref={wrapperRef} className="relative">
      <label className="text-[10px] uppercase tracking-wider text-acars-muted font-medium mb-1.5 block">{label}</label>
      {value && !open ? (
        <button
          type="button"
          onClick={() => { setOpen(true); setQuery(''); setTimeout(() => inputRef.current?.focus(), 0); }}
          className="w-full h-9 rounded-md border border-acars-border bg-acars-bg text-xs text-left px-2.5 flex items-center gap-2 hover:border-acars-muted/50 transition-colors"
        >
          <span className="font-mono font-semibold text-acars-text">{value}</span>
          {selectedLabel && <span className="text-acars-muted truncate">— {selectedLabel}</span>}
          <X
            className="w-3 h-3 text-acars-muted hover:text-acars-text ml-auto shrink-0"
            onClick={e => { e.stopPropagation(); handleClear(); }}
          />
        </button>
      ) : (
        <div className="relative">
          <MagnifyingGlass className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-acars-muted" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => { setQuery(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            placeholder={placeholder}
            className="w-full h-9 rounded-md border border-blue-400 bg-acars-bg text-xs text-acars-text pl-8 pr-2.5 outline-none transition-colors placeholder:text-acars-muted/50"
            autoComplete="off"
          />
        </div>
      )}
      {open && (
        <div className="absolute z-50 top-full mt-1 w-full max-h-[200px] overflow-auto rounded-md border border-acars-border bg-acars-panel shadow-xl">
          {query.length < 2 ? (
            <div className="px-3 py-4 text-center text-[11px] text-acars-muted">Type at least 2 characters</div>
          ) : results.length === 0 ? (
            <div className="px-3 py-4 text-center text-[11px] text-acars-muted">No airports match "{query}"</div>
          ) : (
            results.map(r => (
              <button
                key={r.ident}
                type="button"
                onClick={() => handleSelect(r)}
                className={`w-full text-left px-3 py-2 flex items-center gap-2 text-xs hover:bg-blue-500/10 transition-colors ${
                  r.ident === value ? 'bg-blue-500/10 text-blue-400' : 'text-acars-text'
                }`}
              >
                <span className="font-mono font-semibold w-10 shrink-0">{r.ident}</span>
                <span className="text-acars-muted truncate">{r.name}</span>
                <span className="text-acars-muted/60 text-[10px] ml-auto shrink-0">{r.municipality}{r.iso_country ? `, ${r.iso_country}` : ''}</span>
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
  onClose: () => void;
  onCreated: (res: CreateCharterResponse) => void;
}

function CharterModal({ onClose, onCreated }: CharterModalProps) {
  const [charterType, setCharterType] = useState<CharterType>('cargo');
  const [depIcao, setDepIcao] = useState('');
  const [arrIcao, setArrIcao] = useState('');
  const [depTime, setDepTime] = useState('08:00');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const canSubmit = depIcao && arrIcao && depTime && depIcao !== arrIcao && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError('');
    try {
      const res = await api.post<CreateCharterResponse>('/api/charters', {
        charterType,
        depIcao,
        arrIcao,
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
      <div className="absolute inset-0 bg-black/60" />
      <div
        className="relative w-[520px] max-h-[90vh] overflow-auto rounded-md border border-acars-border bg-acars-panel shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-acars-border">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center w-9 h-9 rounded-md bg-blue-500/10 border border-blue-400/20">
              <Plus className="w-4.5 h-4.5 text-blue-400" />
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
                    className={`flex flex-col items-center gap-1.5 p-3 rounded-md border transition-all text-center ${
                      active
                        ? 'border-blue-400 bg-blue-500/10 text-blue-400'
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

          {/* Path */}
          <div className="grid grid-cols-2 gap-3">
            <AirportSearch
              value={depIcao}
              onChange={setDepIcao}
              label="Departure"
              placeholder="Type ICAO or city..."
            />
            <AirportSearch
              value={arrIcao}
              onChange={setArrIcao}
              label="Arrival"
              placeholder="Type ICAO or city..."
            />
          </div>

          {depIcao && arrIcao && depIcao === arrIcao && (
            <p className="text-[11px] text-red-400">Departure and arrival must be different airports</p>
          )}

          {/* Departure time */}
          <div>
            <label className="text-[10px] uppercase tracking-wider text-acars-muted font-medium mb-1.5 block">Departure Time (Z)</label>
            <input
              type="time"
              value={depTime}
              onChange={e => setDepTime(e.target.value)}
              className="w-full h-9 rounded-md border border-acars-border bg-acars-bg text-xs text-acars-text font-mono px-2.5 outline-none focus:border-blue-400 transition-colors"
            />
          </div>

          {/* Error */}
          {error && (
            <p className="text-[11px] text-red-400 bg-red-500/10 border border-red-400/20 rounded-md px-3 py-2">{error}</p>
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
            className="btn-primary btn-md"
          >
            {submitting ? <SpinnerGap className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
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
  hasBid: boolean;
  isBidding: boolean;
  onBid: () => void;
  onRemoveBid: () => void;
}

function FlightPreviewPanel({ schedule: s, hasBid, isBidding, onBid, onRemoveBid }: FlightPreviewProps) {
  const depPos: [number, number] | null = s.depLat != null && s.depLon != null ? [s.depLat, s.depLon] : null;
  const arrPos: [number, number] | null = s.arrLat != null && s.arrLon != null ? [s.arrLat, s.arrLon] : null;

  return (
    <div className="flex gap-4 p-4 animate-in fade-in slide-in-from-top-1 duration-200">
      {/* Path map */}
      <div className="w-[320px] h-[200px] rounded-md overflow-hidden border border-acars-border shrink-0">
        {depPos && arrPos ? (
          <MapContainer
            center={depPos}
            zoom={5}
            className="h-full w-full"
            zoomControl={false}
            attributionControl={false}
            style={{ background: 'var(--bg-map)' }}
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
              pathOptions={{ color: 'var(--cyan)', weight: 2, opacity: 0.8, dashArray: '6 4' }}
            />
            <CircleMarker
              center={depPos}
              radius={6}
              pathOptions={{ color: 'var(--status-green)', fillColor: 'var(--status-green)', fillOpacity: 0.9, weight: 1.5 }}
            >
              <Tooltip direction="top" offset={[0, -8]} permanent className="hub-tooltip">
                <span style={{ fontSize: '10px', fontFeatureSettings: '"tnum"' }}>
                  {s.depIcao}
                </span>
              </Tooltip>
            </CircleMarker>
            <CircleMarker
              center={arrPos}
              radius={6}
              pathOptions={{ color: 'var(--status-red)', fillColor: 'var(--status-red)', fillOpacity: 0.9, weight: 1.5 }}
            >
              <Tooltip direction="top" offset={[0, -8]} permanent className="hub-tooltip">
                <span style={{ fontSize: '10px', fontFeatureSettings: '"tnum"' }}>
                  {s.arrIcao}
                </span>
              </Tooltip>
            </CircleMarker>
          </MapContainer>
        ) : (
          <div className="h-full flex items-center justify-center bg-acars-bg">
            <span className="text-[10px] text-acars-muted">MapTrifold unavailable</span>
          </div>
        )}
      </div>

      {/* Flight details */}
      <div className="flex-1 min-w-0 grid grid-cols-2 gap-x-6 gap-y-3 content-start">
        {/* Departure */}
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-acars-muted font-medium">
            <AirplaneTakeoff className="w-3 h-3 text-emerald-400" /> Departure
          </div>
          <p className="text-sm font-mono font-semibold text-acars-text">{s.depIcao}</p>
          <p className="text-[11px] text-acars-muted truncate">{s.depName || '—'}</p>
          <p className="text-xs font-mono text-acars-muted tabular-nums mt-1">{s.depTime}Z</p>
        </div>

        {/* Arrival */}
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-acars-muted font-medium">
            <AirplaneLanding className="w-3 h-3 text-red-400" /> Arrival
          </div>
          <p className="text-sm font-mono font-semibold text-acars-text">{s.arrIcao}</p>
          <p className="text-[11px] text-acars-muted truncate">{s.arrName || '—'}</p>
          <p className="text-xs font-mono text-acars-muted tabular-nums mt-1">{s.arrTime}Z</p>
        </div>

        {/* Event name */}
        {s.eventName && (
          <div className="col-span-2 flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-purple-500/5 border border-purple-400/15">
            <CalendarDots className="w-3.5 h-3.5 text-purple-400 shrink-0" />
            <span className="text-[10px] uppercase tracking-wider text-purple-400/70 font-medium">VATSIM Event</span>
            <span className="text-[11px] text-purple-300 truncate">{s.eventName}</span>
          </div>
        )}

        {/* Ground Handlers */}
        {(s.originHandler || s.destHandler) && (
          <div className="col-span-2 space-y-2 pt-1 border-t border-acars-border">
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-acars-muted font-medium">
              <Warehouse className="w-3 h-3 text-amber-400" /> Ground Handling
            </div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1">
              {s.originHandler && (
                <div>
                  <p className="text-[10px] text-acars-muted uppercase tracking-wider">Origin Handler</p>
                  <p className="text-[11px] text-acars-text font-mono">{s.originHandler}</p>
                </div>
              )}
              {s.destHandler && (
                <div>
                  <p className="text-[10px] text-acars-muted uppercase tracking-wider">Dest Handler</p>
                  <p className="text-[11px] text-acars-text font-mono">{s.destHandler}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Stats row */}
        <div className="col-span-2 flex items-center gap-5 pt-1 border-t border-acars-border">
          <div className="flex items-center gap-1.5 text-[11px] text-acars-muted">
            <Ruler className="w-3.5 h-3.5 text-blue-400" />
            <span className="font-mono tabular-nums text-acars-text">{s.distanceNm.toLocaleString()}</span> nm
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-acars-muted">
            <Timer className="w-3.5 h-3.5 text-amber-400" />
            <span className="font-mono tabular-nums text-acars-text">{formatDuration(s.flightTimeMin)}</span>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-acars-muted">
            <AirplaneTilt className="w-3.5 h-3.5 text-sky-400" />
            <span className="text-acars-text">{s.aircraftType ?? 'Any'}</span>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-acars-muted">
            <CalendarDots className="w-3.5 h-3.5 text-blue-400" />
            <DaysIndicator days={s.daysOfWeek} />
          </div>
          {s.groupClass && (
            <div className="flex items-center gap-1.5 text-[11px] text-acars-muted">
              <Tag className="w-3.5 h-3.5 text-violet-400" />
              <span className="text-acars-text">{s.groupClass}</span>
            </div>
          )}
          <div className="ml-auto">
            {hasBid ? (
              <button
                disabled={isBidding}
                onClick={(e) => { e.stopPropagation(); onRemoveBid(); }}
                className="btn-danger btn-sm uppercase tracking-wide"
              >
                {isBidding ? <SpinnerGap className="w-3 h-3 animate-spin" /> : 'Remove Bid'}
              </button>
            ) : (
              <button
                disabled={isBidding}
                onClick={(e) => { e.stopPropagation(); onBid(); }}
                className="btn-primary btn-sm uppercase tracking-wide"
              >
                {isBidding ? <SpinnerGap className="w-3 h-3 animate-spin" /> : 'Place Bid'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Aircraft Selector Modal ─────────────────────────────────────

interface AircraftSelectorProps {
  schedule: ScheduleListItem;
  onClose: () => void;
  onBidPlaced: (bid: BidWithDetails, warnings: string[]) => void;
}

function AircraftSelectorModal({ schedule, onClose, onBidPlaced }: AircraftSelectorProps) {
  const [fleet, setFleet] = useState<FleetForBidItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState<number | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get<FleetForBidResponse>(`/api/fleet/for-bid?dep_icao=${schedule.depIcao}`)
      .then(data => setFleet(data.fleet))
      .catch(() => setError('Failed to load fleet'))
      .finally(() => setLoading(false));
  }, [schedule.depIcao]);

  const handleSelect = async (aircraftId: number) => {
    setSubmitting(aircraftId);
    setError('');
    try {
      const res = await api.post<BidResponse>('/api/bids', {
        scheduleId: schedule.id,
        aircraftId,
      });
      onBidPlaced(res.bid, res.warnings);
    } catch (err: any) {
      setError(err?.message || 'Failed to place bid');
    } finally {
      setSubmitting(null);
    }
  };

  // Sort: aircraft at departure first, then alphabetically by registration
  const sorted = [...fleet].sort((a, b) => {
    if (a.atDeparture !== b.atDeparture) return a.atDeparture ? -1 : 1;
    return a.registration.localeCompare(b.registration);
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60" />
      <div
        className="relative w-[600px] max-h-[80vh] flex flex-col rounded-md border border-acars-border bg-acars-panel shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-acars-border shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center w-9 h-9 rounded-md bg-blue-500/10 border border-blue-400/20">
              <AirplaneTilt className="w-4.5 h-4.5 text-blue-400" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-acars-text">Select Aircraft</h2>
              <p className="text-[10px] text-acars-muted">
                {schedule.flightNumber} · {schedule.depIcao} → {schedule.arrIcao} · {schedule.distanceNm.toLocaleString()} nm
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-acars-bg text-acars-muted hover:text-acars-text transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="mx-5 mt-3 text-[11px] text-red-400 bg-red-500/10 border border-red-400/20 rounded-md px-3 py-2">
            {error}
          </div>
        )}

        {/* Fleet list */}
        <div className="flex-1 overflow-auto p-3 space-y-1.5">
          {loading ? (
            <div className="py-12 text-center">
              <SpinnerGap className="w-5 h-5 text-blue-400 animate-spin mx-auto mb-2" />
              <span className="text-xs text-acars-muted">Loading fleet...</span>
            </div>
          ) : sorted.length === 0 ? (
            <div className="py-12 text-center text-xs text-acars-muted">No active aircraft found</div>
          ) : (
            sorted.map(ac => {
              const effectiveLocation = ac.locationIcao ?? ac.baseIcao ?? '?';
              const isSubmitting = submitting === ac.id;

              return (
                <button
                  key={ac.id}
                  disabled={submitting !== null}
                  onClick={() => handleSelect(ac.id)}
                  className={`w-full text-left rounded-md border p-3 transition-all cursor-pointer ${
                    ac.atDeparture
                      ? 'border-acars-border bg-acars-bg hover:border-blue-400/40 hover:bg-blue-500/5'
                      : 'border-amber-400/20 bg-amber-500/5 hover:border-amber-400/40 hover:bg-amber-500/10'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {/* Registration + type */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-mono font-semibold text-xs text-acars-text">{ac.registration}</span>
                        <span className="text-[10px] text-acars-muted">{ac.icaoType}</span>
                        {ac.isCargo && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wide bg-amber-500/10 text-amber-400 border border-amber-400/20">
                            CARGO
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-acars-muted truncate">{ac.name}</p>
                    </div>

                    {/* Location */}
                    <div className="text-right shrink-0">
                      {ac.atDeparture ? (
                        <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 font-medium">
                          <MapPin className="w-3 h-3" /> At {schedule.depIcao}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] text-amber-400 font-medium">
                          <Warning className="w-3 h-3" /> At {effectiveLocation}
                        </span>
                      )}
                      <p className="text-[10px] text-acars-muted tabular-nums mt-0.5">
                        Range: {ac.rangeNm.toLocaleString()} nm
                      </p>
                    </div>

                    {/* Select indicator */}
                    <div className="shrink-0 w-16 text-right">
                      {isSubmitting ? (
                        <SpinnerGap className="w-4 h-4 text-blue-400 animate-spin inline" />
                      ) : (
                        <span className="text-[10px] text-blue-400 font-medium uppercase">Select</span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Footer hint */}
        <div className="px-5 py-3 border-t border-acars-border text-[10px] text-acars-muted shrink-0">
          Aircraft at <span className="font-mono font-medium text-acars-text">{schedule.depIcao}</span> are ready to fly. <span className="text-amber-400">Amber</span> aircraft must be repositioned before starting the flight.
        </div>
      </div>
    </div>
  );
}

// ─── Schedule Page ──────────────────────────────────────────────

export function SchedulePage() {
  const navigate = useNavigate();
  // Filter state
  const [airports, setAirports] = useState<Airport[]>([]);
  const [aircraftTypes, setAircraftTypes] = useState<string[]>([]);
  const [depFilter, setDepFilter] = useState('');
  const [arrFilter, setArrFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [charterTypeFilter, setCharterTypeFilter] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // Data state
  const [schedules, setSchedules] = useState<ScheduleListItem[]>([]);
  const [myBids, setMyBids] = useState<BidWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [bidLoading, setBidLoading] = useState<number | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [charterOpen, setCharterOpen] = useState(false);
  const [bidModalSchedule, setBidModalSchedule] = useState<ScheduleListItem | null>(null);

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
      if (charterTypeFilter) params.set('charter_type', charterTypeFilter);
      if (searchTerm) params.set('search', searchTerm);

      const qs = params.toString();
      const data = await api.get<ScheduleListResponse>(`/api/schedules${qs ? `?${qs}` : ''}`);
      setSchedules(data.schedules);
    } catch (err) {
      console.error('[Schedule] Failed to fetch schedules:', err);
    } finally {
      setLoading(false);
    }
  }, [depFilter, arrFilter, typeFilter, charterTypeFilter, searchTerm]);

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
    setCharterTypeFilter('');
    setSearchInput('');
    setSearchTerm('');
  };

  const hasFilters = depFilter || arrFilter || typeFilter || charterTypeFilter || searchTerm;

  // ── Bid / Unbid ───────────────────────────────────────────
  const handleBid = (schedule: ScheduleListItem) => {
    setBidModalSchedule(schedule);
  };

  const handleBidPlaced = (bid: BidWithDetails, warnings: string[]) => {
    setMyBids(prev => [...prev, bid]);
    setSchedules(prev => prev.map(s =>
      s.id === bid.scheduleId ? { ...s, hasBid: true, bidCount: s.bidCount + 1 } : s
    ));
    setBidModalSchedule(null);
    warnings.forEach(w => toast.warning(w));
  };

  const handleRemoveBid = async (bidId: number, scheduleId: number) => {
    setBidLoading(scheduleId);

    // User-created charters (reposition/cargo/passenger) are deleted when unbid.
    // Generated and event charters persist for other pilots.
    const schedule = schedules.find(s => s.id === scheduleId);
    const isUserCharter = schedule?.charterType != null &&
      ['reposition', 'cargo', 'passenger'].includes(schedule.charterType);

    // Optimistic: remove bid from sidebar, update or remove schedule
    if (isUserCharter) {
      setSchedules(prev => prev.filter(s => s.id !== scheduleId));
      if (expandedId === scheduleId) setExpandedId(null);
    } else {
      setSchedules(prev => prev.map(s =>
        s.id === scheduleId ? { ...s, hasBid: false, bidCount: Math.max(0, s.bidCount - 1) } : s
      ));
    }
    setMyBids(prev => prev.filter(b => b.id !== bidId));

    // Clear flight planning store if this bid was the active one
    const planStore = useFlightPlanStore.getState();
    if (planStore.activeBidId === bidId) {
      planStore.clearActiveBid();
    }

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
              <div className="flex items-center justify-center w-8 h-8 rounded-md bg-amber-500/10 border border-amber-400/20">
                <CalendarDots className="w-4 h-4 text-amber-400" />
              </div>
              <h2 className="text-sm font-semibold text-acars-text">Flight Schedule</h2>
              <span className="text-[11px] text-acars-muted tabular-nums">
                {loading ? '' : `${schedules.length} flights`}
              </span>
              {loading && <SpinnerGap className="w-3.5 h-3.5 text-blue-400 animate-spin" />}
            </div>
            <button
              onClick={() => setCharterOpen(true)}
              className="btn-primary btn-sm"
            >
              <Plus className="w-3.5 h-3.5" /> Create Charter
            </button>
          </div>
          <div className="flex items-center gap-3 px-4 py-3">
            {/* Departure */}
            <select
              value={depFilter}
              onChange={e => setDepFilter(e.target.value)}
              className="select-field min-w-[140px]"
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
              className="select-field min-w-[140px]"
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
              className="select-field min-w-[140px]"
            >
              <option value="">All Aircraft</option>
              {aircraftTypes.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>

            {/* Charter type */}
            <select
              value={charterTypeFilter}
              onChange={e => setCharterTypeFilter(e.target.value)}
              className="select-field min-w-[140px]"
            >
              <option value="">All Types</option>
              <option value="generated">Monthly Charters</option>
              <option value="event">Event Flights</option>
              <option value="custom">Custom Charters</option>
            </select>

            {/* MagnifyingGlass */}
            <div className="relative flex-1 max-w-[240px]">
              <MagnifyingGlass className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-acars-muted" />
              <input
                type="text"
                value={searchInput}
                onChange={e => handleSearchChange(e.target.value)}
                placeholder="Search flights..."
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

        {/* Schedule table */}
        <div className="flex-1 mx-5 mt-4 mb-5 panel flex flex-col overflow-hidden">
          <div className="flex-1 overflow-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 z-10 bg-acars-panel">
                <tr className="text-[10px] uppercase tracking-wider text-acars-muted border-b border-acars-border">
                  <th className="text-left px-4 py-2.5 font-medium">Flight #</th>
                  <th className="text-left px-4 py-2.5 font-medium">Path</th>
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
                    <td colSpan={9} className="py-16 text-center">
                      <SpinnerGap className="w-5 h-5 text-blue-400 animate-spin mx-auto mb-2" />
                      <span className="text-xs text-acars-muted">Loading schedules...</span>
                    </td>
                  </tr>
                ) : schedules.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-16 text-center">
                      <img src="./logos/chevron-light.png" alt="SMX" className="h-10 w-auto opacity-10 mx-auto mb-3" />
                      <span className="text-xs text-acars-muted">No cargo routes match your filters</span>
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
                          className={`border-b border-acars-border hover:bg-acars-hover transition-colors cursor-pointer ${
                            isExpanded ? 'bg-acars-hover' : i % 2 === 0 ? 'bg-acars-panel' : 'bg-acars-bg'
                          }`}
                        >
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-2">
                              <CaretDown className={`w-3.5 h-3.5 text-acars-muted/50 transition-transform duration-200 shrink-0 ${isExpanded ? 'rotate-0' : '-rotate-90'}`} />
                              <span className="font-mono font-medium text-acars-text">{s.flightNumber}</span>
                              {s.charterType && s.charterType !== 'generated' && (
                                <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wide ${
                                  s.charterType === 'reposition' ? 'bg-sky-500/10 text-sky-400 border border-sky-400/20' :
                                  s.charterType === 'cargo' ? 'bg-amber-500/10 text-amber-400 border border-amber-400/20' :
                                  s.charterType === 'event' ? 'bg-purple-500/10 text-purple-400 border border-purple-400/20' :
                                  'bg-blue-500/10 text-blue-400 border border-blue-400/20'
                                }`}>
                                  {s.charterType === 'reposition' ? 'REPO' :
                                   s.charterType === 'cargo' ? 'CARGO' :
                                   s.charterType === 'event' ? 'EVENT' : 'PAX'}
                                </span>
                              )}
                              {s.eventTag && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wide bg-amber-500/10 text-amber-400 border border-amber-400/20">
                                  {s.eventTag}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-2.5">
                            <span className="text-acars-text font-mono">{s.depIcao}</span>
                            <ArrowRight className="w-3 h-3 text-sky-400/40 inline mx-1.5" />
                            <span className="text-acars-text font-mono">{s.arrIcao}</span>
                          </td>
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
                                className="btn-danger btn-sm text-[10px] uppercase tracking-wide"
                              >
                                {isBidding ? <SpinnerGap className="w-3 h-3 animate-spin" /> : 'Remove'}
                              </button>
                            ) : (
                              <button
                                disabled={isBidding}
                                onClick={(e) => { e.stopPropagation(); handleBid(s); }}
                                className="btn-primary btn-sm text-[10px] uppercase tracking-wide"
                              >
                                {isBidding ? <SpinnerGap className="w-3 h-3 animate-spin" /> : 'Bid'}
                              </button>
                            )}
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr className="bg-acars-panel border-b border-acars-border">
                            <td colSpan={9}>
                              <FlightPreviewPanel
                                schedule={s}
                                hasBid={s.hasBid}
                                isBidding={isBidding}
                                onBid={() => handleBid(s)}
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
          <span className="inline-flex items-center justify-center min-w-[20px] h-5 rounded-full bg-blue-500/10 border border-blue-400/20 text-[10px] font-semibold text-blue-400 tabular-nums px-1.5">
            {myBids.length}
          </span>
        </div>
        <div className="flex-1 overflow-auto">
          {myBids.length === 0 ? (
            <div className="empty-state h-full">
              <CalendarDots className="empty-state-icon" />
              <p className="empty-state-title">No Active Bids</p>
              <p className="empty-state-desc">Browse the cargo schedule and place a bid to get started</p>
            </div>
          ) : (
            <div className="p-3 space-y-2">
              {myBids.map(bid => (
                <div
                  key={bid.id}
                  className="group relative rounded-md border border-acars-border bg-acars-bg p-3 hover:border-blue-400/30 transition-colors"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-mono font-semibold text-xs text-acars-text">{bid.flightNumber}</span>
                    <button
                      onClick={() => handleRemoveBid(bid.id, bid.scheduleId)}
                      className="opacity-0 group-hover:opacity-100 flex items-center justify-center w-5 h-5 rounded bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all"
                      title="Remove bid"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px] text-acars-muted mb-1">
                    <span className="font-mono text-acars-text">{bid.depIcao}</span>
                    <ArrowRight className="w-3 h-3 text-sky-400/40" />
                    <span className="font-mono text-acars-text">{bid.arrIcao}</span>
                  </div>
                  <div className="flex items-center gap-3 text-[10px] text-acars-muted">
                    <span className="text-sky-400">{bid.aircraftRegistration ?? bid.aircraftType ?? 'Any'}</span>
                    <span className="flex items-center gap-0.5 tabular-nums">
                      <Clock className="w-3 h-3 text-amber-400" />
                      {bid.depTime}Z
                    </span>
                    <span className="tabular-nums">{formatDuration(bid.flightTimeMin)}</span>
                  </div>
                  <button
                    onClick={() => navigate(`/planning/${bid.id}`)}
                    className="mt-2 w-full btn-primary btn-sm text-[9px] uppercase tracking-wide"
                  >
                    <Path className="w-3 h-3" /> Plan Flight
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Charter modal */}
      {charterOpen && (
        <CharterModal
          onClose={() => setCharterOpen(false)}
          onCreated={handleCharterCreated}
        />
      )}

      {/* Aircraft selector modal */}
      {bidModalSchedule && (
        <AircraftSelectorModal
          schedule={bidModalSchedule}
          onClose={() => setBidModalSchedule(null)}
          onBidPlaced={handleBidPlaced}
        />
      )}
    </div>
  );
}
