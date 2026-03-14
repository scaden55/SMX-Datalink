import { useState, useEffect, useMemo } from 'react';
import {
  X,
  Broadcast,
  Ruler,
  Info,
  Lightbulb,
  CaretDown,
  AirplaneTakeoff,
  AirplaneLanding,
  AirplaneTilt,
  Clock,
  Cloud,
  Wind,
} from '@phosphor-icons/react';
import type { VatsimControllerWithPosition, VatsimPilot, VatsimFacilityType, VatsimAtis } from '@acars/shared';
import { getApiBase } from '../../lib/api';
import { fetchMetar } from '../../lib/weather-api';

// ── Types ────────────────────────────────────────────────────

interface AirportFrequency {
  type: string;
  description: string;
  frequency_mhz: number;
}

interface AirportRunway {
  le_ident: string;
  he_ident: string;
  length_ft: number;
  width_ft: number;
  surface: string;
  lighted: boolean;
  le_heading_degT: number | null;
}

interface AirportDetail {
  icao: string;
  name: string;
  type: string;
  latitude: number;
  longitude: number;
  elevation_ft: number | null;
  country: string | null;
  region: string | null;
  municipality: string | null;
  iata_code: string | null;
  frequencies: AirportFrequency[];
  runways: AirportRunway[];
}

interface MetarData {
  rawOb: string;
  temp: number | null;
  dewpoint: number | null;
  windDir: number | null;
  windSpeed: number | null;
  windGust: number | null;
  visibility: number | null;
  altimeter: number | null;
  flightCategory: string | null;
}

// ── Helpers ──────────────────────────────────────────────────

const FACILITY_NAMES: Record<VatsimFacilityType, string> = {
  0: 'OBS', 1: 'FSS', 2: 'DEL', 3: 'GND', 4: 'TWR', 5: 'APP', 6: 'CTR',
};

const FACILITY_COLORS: Record<VatsimFacilityType, string> = {
  0: '#6b7280', 1: '#4F6CCD', 2: '#60a5fa', 3: '#22c55e',
  4: '#ef4444', 5: '#f59e0b', 6: '#22d3ee',
};

const FREQ_TYPE_ORDER: Record<string, number> = {
  ATIS: 0, DELIVERY: 1, DEL: 1, GROUND: 2, GND: 2,
  TOWER: 3, TWR: 3, APPROACH: 4, APP: 4,
  DEPARTURE: 5, DEP: 5, CENTER: 6, CTR: 6,
};

function freqSortKey(type: string): number {
  const upper = type.toUpperCase().replace(/[^A-Z]/g, '');
  for (const [key, val] of Object.entries(FREQ_TYPE_ORDER)) {
    if (upper.includes(key)) return val;
  }
  return 99;
}

function formatLogonDuration(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  return `${h}h ${String(m).padStart(2, '0')}m`;
}

function formatAirportType(type: string): string {
  switch (type) {
    case 'large_airport': return 'Large Airport';
    case 'medium_airport': return 'Medium Airport';
    case 'small_airport': return 'Small Airport';
    case 'heliport': return 'Heliport';
    case 'seaplane_base': return 'Seaplane Base';
    case 'closed': return 'Closed';
    default: return type;
  }
}

const FLIGHT_CAT_COLORS: Record<string, { text: string; bg: string }> = {
  VFR:  { text: 'text-[#3fb950]', bg: 'bg-[#3fb950]/10' },
  MVFR: { text: 'text-[#58a6ff]', bg: 'bg-[#58a6ff]/10' },
  IFR:  { text: 'text-[#f85149]', bg: 'bg-[#f85149]/10' },
  LIFR: { text: 'text-[#d2a8ff]', bg: 'bg-[#d2a8ff]/10' },
};

// ── Tabs ─────────────────────────────────────────────────────

type Tab = 'traffic' | 'atc' | 'info';

// ── Component ────────────────────────────────────────────────

interface Props {
  icao: string;
  controllers: VatsimControllerWithPosition[];
  pilots: VatsimPilot[];
  atis: VatsimAtis[];
  onClose: () => void;
}

export function AirportDetailPanel({ icao, controllers, pilots, atis, onClose }: Props) {
  const [detail, setDetail] = useState<AirportDetail | null>(null);
  const [metar, setMetar] = useState<MetarData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('traffic');
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const toggle = (section: string) =>
    setCollapsed((prev) => ({ ...prev, [section]: !prev[section] }));

  // Fetch airport detail
  useEffect(() => {
    setLoading(true);
    setError(null);
    setDetail(null);
    setMetar(null);
    setTab('traffic');
    setCollapsed({});

    fetch(`${getApiBase()}/api/airports/${encodeURIComponent(icao)}`)
      .then((res) => {
        if (!res.ok) throw new Error(res.status === 404 ? 'Airport not found' : 'Failed to fetch');
        return res.json();
      })
      .then((data: AirportDetail) => {
        setDetail(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Unknown error');
        setLoading(false);
      });

    // Fetch METAR (fire-and-forget, don't block render)
    fetchMetar(icao).then((m) => { if (m) setMetar(m as MetarData); });
  }, [icao]);

  // Match VATSIM controllers to this airport
  const liveControllers = useMemo(() => {
    const prefix = icao.toUpperCase();
    return controllers.filter((c) => c.parsed.prefix === prefix && c.facility > 0);
  }, [icao, controllers]);

  // ATIS for this airport
  const airportAtis = useMemo(() => {
    const prefix = icao.toUpperCase();
    return atis.filter((a) => a.callsign.startsWith(prefix));
  }, [icao, atis]);

  // Traffic counts from VATSIM pilots
  const traffic = useMemo(() => {
    const prefix = icao.toUpperCase();
    let departing = 0;
    let arriving = 0;
    let ground = 0;

    for (const p of pilots) {
      const fp = p.flight_plan;
      if (!fp) continue;
      const isDep = fp.departure === prefix;
      const isArr = fp.arrival === prefix;
      if (!isDep && !isArr) continue;

      if (p.groundspeed < 50) {
        ground++;
      } else if (isDep) {
        departing++;
      } else {
        arriving++;
      }
    }

    return { departing, arriving, ground, total: departing + arriving + ground };
  }, [icao, pilots]);

  // Build a map of frequency → live controllers
  const liveByFreq = useMemo(() => {
    const map = new Map<string, VatsimControllerWithPosition[]>();
    for (const ctrl of liveControllers) {
      const freq = ctrl.frequency;
      const list = map.get(freq) ?? [];
      list.push(ctrl);
      map.set(freq, list);
    }
    return map;
  }, [liveControllers]);

  return (
    <div className="absolute top-3 right-3 bottom-3 w-[350px] z-[1000] bg-acars-input rounded-md border border-acars-border flex flex-col overflow-hidden animate-in slide-in-from-right duration-200">
      {/* ── Sticky Header ── */}
      <div className="px-4 py-3 border-b border-acars-border shrink-0">
        <div className="flex items-start justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-acars-text tabular-nums tracking-wide">{icao}</h2>
              {detail?.iata_code && (
                <span className="text-xs text-acars-muted tabular-nums">({detail.iata_code})</span>
              )}
            </div>
            {detail && (
              <p className="text-xs text-acars-muted truncate mt-0.5">
                {detail.name}
                {detail.municipality && ` — ${detail.municipality}`}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-acars-border transition-colors shrink-0 ml-2"
          >
            <X className="w-4 h-4 text-acars-muted" />
          </button>
        </div>

        {/* Traffic counters + ATC badge */}
        <div className="flex items-center gap-2 mt-2">
          {traffic.total > 0 && (
            <div className="flex items-center gap-3">
              <TrafficBadge icon={AirplaneTakeoff} count={traffic.departing} label="dep" color="#3fb950" />
              <TrafficBadge icon={AirplaneTilt} count={traffic.ground} label="gnd" color="#8e939b" />
              <TrafficBadge icon={AirplaneLanding} count={traffic.arriving} label="arr" color="#f0883e" />
            </div>
          )}
          {liveControllers.length > 0 && (
            <div className="flex items-center gap-1.5 ml-auto">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              <span className="text-[11px] font-bold text-green-400">
                {liveControllers.length} ATC
              </span>
            </div>
          )}
        </div>

        {/* METAR summary */}
        {metar?.rawOb && (
          <div className="mt-2 p-2 rounded-md bg-acars-bg/60 border border-acars-border">
            <div className="flex items-center gap-1.5 mb-1">
              <Cloud className="w-3 h-3 text-acars-muted" />
              <span className="text-[9px] text-acars-muted uppercase tracking-wider font-semibold">METAR</span>
              {metar.flightCategory && (
                <span className={`ml-auto px-1.5 py-0.5 rounded text-[9px] font-bold ${
                  FLIGHT_CAT_COLORS[metar.flightCategory]?.text ?? 'text-acars-muted'
                } ${FLIGHT_CAT_COLORS[metar.flightCategory]?.bg ?? 'bg-acars-muted/10'}`}>
                  {metar.flightCategory}
                </span>
              )}
            </div>
            <div className="text-[11px] tabular-nums text-acars-text leading-relaxed break-all">
              {metar.rawOb}
            </div>
            {/* Quick weather cards */}
            <div className="flex gap-2 mt-1.5">
              {metar.temp != null && (
                <MiniWeatherCard label="Temp" value={`${metar.temp}°C`} />
              )}
              {metar.windSpeed != null && (
                <MiniWeatherCard
                  label="Wind"
                  value={`${metar.windDir ?? '---'}° / ${metar.windSpeed}${metar.windGust ? `G${metar.windGust}` : ''} kt`}
                  icon={Wind}
                />
              )}
              {metar.visibility != null && (
                <MiniWeatherCard label="Vis" value={`${metar.visibility} SM`} />
              )}
              {metar.altimeter != null && (
                <MiniWeatherCard label="QNH" value={`${metar.altimeter.toFixed(2)}`} />
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Tabs ── */}
      <div className="flex border-b border-acars-border shrink-0">
        {([
          { key: 'traffic' as Tab, label: 'Traffic', icon: AirplaneTilt },
          { key: 'atc' as Tab, label: 'ATC', icon: Broadcast },
          { key: 'info' as Tab, label: 'Info', icon: Info },
        ]).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-2 text-[11px] font-semibold tracking-wider uppercase transition-colors ${
              tab === key
                ? 'text-sky-400 border-b-2 border-sky-400 bg-sky-500/5'
                : 'text-acars-muted hover:text-acars-text hover:bg-acars-border'
            }`}
          >
            <Icon className="w-3 h-3" />
            {label}
          </button>
        ))}
      </div>

      {/* ── Content ── */}
      <div className="flex-1 overflow-y-auto">
        {loading && (
          <div className="flex items-center justify-center py-12 text-xs text-acars-muted">
            Loading...
          </div>
        )}
        {error && (
          <div className="flex items-center justify-center py-12 text-xs text-red-400">
            {error}
          </div>
        )}
        {detail && !loading && (
          <>
            {tab === 'traffic' && <TrafficTab icao={icao} pilots={pilots} />}
            {tab === 'atc' && (
              <AtcTab
                detail={detail}
                liveByFreq={liveByFreq}
                liveControllers={liveControllers}
                airportAtis={airportAtis}
                collapsed={collapsed}
                toggle={toggle}
              />
            )}
            {tab === 'info' && <InfoTab detail={detail} collapsed={collapsed} toggle={toggle} />}
          </>
        )}
      </div>
    </div>
  );
}

// ── Traffic Badge ────────────────────────────────────────────

function TrafficBadge({
  icon: Icon,
  count,
  label,
  color,
}: {
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  count: number;
  label: string;
  color: string;
}) {
  return (
    <div className="flex items-center gap-1">
      <Icon className="w-3 h-3" style={{ color }} />
      <span className="text-[12px] font-bold tabular-nums" style={{ color }}>
        {count}
      </span>
      <span className="text-[9px] text-acars-muted uppercase">{label}</span>
    </div>
  );
}

// ── Mini Weather Card ────────────────────────────────────────

function MiniWeatherCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="flex items-center gap-1 text-[9px]">
      {Icon && <Icon className="w-2.5 h-2.5 text-acars-muted" />}
      <span className="text-acars-muted">{label}:</span>
      <span className="text-acars-text tabular-nums">{value}</span>
    </div>
  );
}

// ── Traffic Tab ──────────────────────────────────────────────

function TrafficTab({ icao, pilots }: { icao: string; pilots: VatsimPilot[] }) {
  const prefix = icao.toUpperCase();

  const { departures, arrivals, onGround } = useMemo(() => {
    const departures: VatsimPilot[] = [];
    const arrivals: VatsimPilot[] = [];
    const onGround: VatsimPilot[] = [];

    for (const p of pilots) {
      const fp = p.flight_plan;
      if (!fp) continue;
      const isDep = fp.departure === prefix;
      const isArr = fp.arrival === prefix;
      if (!isDep && !isArr) continue;

      if (p.groundspeed < 50) {
        onGround.push(p);
      } else if (isDep) {
        departures.push(p);
      } else {
        arrivals.push(p);
      }
    }

    return { departures, arrivals, onGround };
  }, [prefix, pilots]);

  const total = departures.length + arrivals.length + onGround.length;

  if (total === 0) {
    return (
      <div className="px-4 py-8 text-center text-xs text-acars-muted">
        No VATSIM traffic at this airport
      </div>
    );
  }

  return (
    <div className="p-2">
      {/* Departures */}
      {departures.length > 0 && (
        <TrafficSection
          label="Departing"
          count={departures.length}
          color="#3fb950"
          pilots={departures}
          showDest
        />
      )}

      {/* On Ground */}
      {onGround.length > 0 && (
        <TrafficSection
          label="On Ground"
          count={onGround.length}
          color="#8e939b"
          pilots={onGround}
          showDest
        />
      )}

      {/* Arrivals */}
      {arrivals.length > 0 && (
        <TrafficSection
          label="Arriving"
          count={arrivals.length}
          color="#f0883e"
          pilots={arrivals}
          showOrigin
        />
      )}
    </div>
  );
}

function TrafficSection({
  label,
  count,
  color,
  pilots,
  showDest,
  showOrigin,
}: {
  label: string;
  count: number;
  color: string;
  pilots: VatsimPilot[];
  showDest?: boolean;
  showOrigin?: boolean;
}) {
  return (
    <div className="mb-2">
      <div className="flex items-center gap-1.5 px-2 py-1">
        <span
          className="text-[9px] font-bold tracking-wider uppercase"
          style={{ color }}
        >
          {label}
        </span>
        <span className="text-[9px] text-acars-muted">({count})</span>
      </div>
      {pilots.map((p) => (
        <div
          key={p.cid}
          className="flex items-center gap-2 px-2.5 py-1.5 rounded mb-0.5 hover:bg-acars-border transition-colors"
        >
          <span className="text-[12px] font-bold tabular-nums text-acars-text w-16 shrink-0">
            {p.callsign}
          </span>
          <span className="text-[11px] tabular-nums text-acars-muted">
            {p.flight_plan?.aircraft_short || '—'}
          </span>
          <span className="text-[11px] text-acars-muted ml-auto tabular-nums">
            {showDest && p.flight_plan?.arrival && `→ ${p.flight_plan.arrival}`}
            {showOrigin && p.flight_plan?.departure && `${p.flight_plan.departure} →`}
          </span>
          <span className="text-[11px] tabular-nums text-acars-muted tabular-nums w-14 text-right">
            {p.groundspeed < 50
              ? 'GND'
              : `FL${Math.round(p.altitude / 100).toString().padStart(3, '0')}`}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── ATC Tab ──────────────────────────────────────────────────

function AtcTab({
  detail,
  liveByFreq,
  liveControllers,
  airportAtis,
  collapsed,
  toggle,
}: {
  detail: AirportDetail;
  liveByFreq: Map<string, VatsimControllerWithPosition[]>;
  liveControllers: VatsimControllerWithPosition[];
  airportAtis: VatsimAtis[];
  collapsed: Record<string, boolean>;
  toggle: (s: string) => void;
}) {
  const sortedFreqs = useMemo(
    () => [...detail.frequencies].sort((a, b) => freqSortKey(a.type) - freqSortKey(b.type)),
    [detail.frequencies],
  );

  const extraControllers = useMemo(() => {
    const publishedFreqs = new Set(detail.frequencies.map((f) => f.frequency_mhz.toFixed(3)));
    return liveControllers.filter((c) => !publishedFreqs.has(parseFloat(c.frequency).toFixed(3)));
  }, [detail.frequencies, liveControllers]);

  return (
    <div>
      {/* ATIS */}
      {airportAtis.length > 0 && (
        <div className="border-b border-acars-border">
          <CollapsibleSection
            title="ATIS"
            collapsed={collapsed.atis}
            onToggle={() => toggle('atis')}
          >
            {airportAtis.map((a) => (
              <div key={a.callsign} className="mb-2">
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 shrink-0" />
                  <span className="text-[12px] font-bold tabular-nums text-acars-text">{a.callsign}</span>
                  <span className="text-[12px] tabular-nums text-sky-400">{a.frequency}</span>
                  {a.atis_code && (
                    <span className="ml-auto px-1.5 py-0.5 rounded bg-sky-500/10 text-[11px] font-bold text-sky-400">
                      {a.atis_code}
                    </span>
                  )}
                </div>
                {a.text_atis && a.text_atis.length > 0 && (
                  <div className="p-2 rounded-md bg-acars-bg/60 border border-acars-border text-[11px] tabular-nums text-acars-muted leading-relaxed max-h-24 overflow-y-auto">
                    {a.text_atis.join(' ')}
                  </div>
                )}
              </div>
            ))}
          </CollapsibleSection>
        </div>
      )}

      {/* Live Controllers */}
      {liveControllers.length > 0 && (
        <div className="border-b border-acars-border">
          <CollapsibleSection
            title="Online Controllers"
            collapsed={collapsed.online}
            onToggle={() => toggle('online')}
          >
            {liveControllers.map((ctrl) => (
              <div
                key={ctrl.callsign}
                className="flex items-center gap-2 px-1 py-1.5 rounded mb-0.5"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 shrink-0" />
                <span
                  className="text-[9px] font-bold tracking-wider uppercase w-10 shrink-0 text-center"
                  style={{ color: FACILITY_COLORS[ctrl.facility] }}
                >
                  {FACILITY_NAMES[ctrl.facility]}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-[12px] tabular-nums text-acars-text">{ctrl.callsign}</div>
                  <div className="text-[9px] text-acars-muted">
                    {ctrl.name} &middot; {formatLogonDuration(ctrl.logon_time)}
                  </div>
                </div>
                <span className="text-[12px] tabular-nums text-sky-400 tabular-nums shrink-0">
                  {ctrl.frequency}
                </span>
              </div>
            ))}
          </CollapsibleSection>
        </div>
      )}

      {/* Published Frequencies */}
      <CollapsibleSection
        title="Published Frequencies"
        collapsed={collapsed.freqs}
        onToggle={() => toggle('freqs')}
      >
        {sortedFreqs.length === 0 ? (
          <div className="py-3 text-center text-[11px] text-acars-muted">No frequency data</div>
        ) : (
          sortedFreqs.map((freq, i) => {
            const freqStr = freq.frequency_mhz.toFixed(3);
            const live = liveByFreq.get(freqStr) ?? liveByFreq.get(freq.frequency_mhz.toFixed(2)) ?? [];

            return (
              <div
                key={`${freq.type}-${i}`}
                className={`flex items-center gap-2 px-1 py-1.5 rounded mb-0.5 ${
                  live.length > 0 ? 'bg-green-500/10' : 'hover:bg-acars-border'
                }`}
              >
                <span className="text-[9px] font-bold tracking-wider uppercase w-12 shrink-0 text-acars-muted">
                  {freq.type}
                </span>
                <span className="text-[12px] text-acars-text truncate flex-1">{freq.description}</span>
                <span className="text-[12px] tabular-nums text-sky-400 tabular-nums shrink-0">
                  {freqStr}
                </span>
                {live.length > 0 && (
                  <span className="flex items-center gap-1 shrink-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                    <span className="text-[9px] font-bold text-green-400">LIVE</span>
                  </span>
                )}
              </div>
            );
          })
        )}
      </CollapsibleSection>
    </div>
  );
}

// ── Info Tab ─────────────────────────────────────────────────

function InfoTab({
  detail,
  collapsed,
  toggle,
}: {
  detail: AirportDetail;
  collapsed: Record<string, boolean>;
  toggle: (s: string) => void;
}) {
  return (
    <div>
      {/* General Info */}
      <CollapsibleSection
        title="Airport Details"
        collapsed={collapsed.details}
        onToggle={() => toggle('details')}
      >
        <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
          <InfoRow label="Type" value={formatAirportType(detail.type)} />
          <InfoRow label="Elevation" value={detail.elevation_ft != null ? `${detail.elevation_ft.toLocaleString()} ft` : '—'} />
          <InfoRow label="Country" value={detail.country ?? '—'} />
          <InfoRow label="Region" value={detail.region ?? '—'} />
          <InfoRow label="Municipality" value={detail.municipality ?? '—'} />
          <InfoRow label="IATA Code" value={detail.iata_code ?? '—'} />
          <InfoRow label="Latitude" value={detail.latitude.toFixed(6)} />
          <InfoRow label="Longitude" value={detail.longitude.toFixed(6)} />
        </div>
      </CollapsibleSection>

      {/* Runways */}
      <CollapsibleSection
        title={`Runways (${detail.runways.length})`}
        collapsed={collapsed.runways}
        onToggle={() => toggle('runways')}
      >
        {detail.runways.length === 0 ? (
          <div className="py-3 text-center text-[11px] text-acars-muted">No runway data</div>
        ) : (
          <div className="space-y-1.5">
            {detail.runways.map((rwy, i) => (
              <div
                key={`${rwy.le_ident}-${rwy.he_ident}-${i}`}
                className="px-2.5 py-2 rounded-md bg-acars-bg/60 border border-acars-border"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm font-bold tabular-nums text-acars-text">
                    {rwy.le_ident}/{rwy.he_ident}
                  </span>
                  <div className="flex items-center gap-2">
                    {rwy.lighted && (
                      <Lightbulb className="w-3 h-3 text-amber-400" />
                    )}
                    {rwy.le_heading_degT != null && (
                      <span className="text-[11px] text-acars-muted tabular-nums">
                        {Math.round(rwy.le_heading_degT).toString().padStart(3, '0')}&deg;
                      </span>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 text-[11px]">
                  <div>
                    <span className="text-acars-muted">Length</span>
                    <div className="text-acars-text tabular-nums">{rwy.length_ft.toLocaleString()} ft</div>
                  </div>
                  <div>
                    <span className="text-acars-muted">Width</span>
                    <div className="text-acars-text tabular-nums">{rwy.width_ft} ft</div>
                  </div>
                  <div>
                    <span className="text-acars-muted">Surface</span>
                    <div className="text-acars-text tabular-nums capitalize">{rwy.surface.toLowerCase()}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CollapsibleSection>
    </div>
  );
}

// ── Shared Sub-components ────────────────────────────────────

function CollapsibleSection({
  title,
  collapsed,
  onToggle,
  children,
}: {
  title: string;
  collapsed?: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="border-b border-acars-border last:border-b-0">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-1.5 px-4 py-2.5 hover:bg-acars-border transition-colors"
      >
        <span className="text-[11px] font-semibold text-acars-muted tracking-wider uppercase">{title}</span>
        <div className="flex-1" />
        <CaretDown
          className={`w-3 h-3 text-acars-muted transition-transform duration-200 ${collapsed ? '-rotate-90' : ''}`}
        />
      </button>
      {!collapsed && (
        <div className="px-4 pb-3">
          {children}
        </div>
      )}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-0.5">
      <span className="text-[11px] text-acars-muted">{label}</span>
      <span className="text-[12px] text-acars-text tabular-nums">{value}</span>
    </div>
  );
}
