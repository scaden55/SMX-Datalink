import { memo, useState, useCallback, useMemo } from 'react';
import {
  ComposableMap,
  Geographies,
  Geography,
  Marker,
  Line,
  ZoomableGroup,
} from 'react-simple-maps';
import { getAircraftIcon } from '@/lib/aircraft-icons';

const GEO_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';

interface TrackPt {
  lat: number;
  lon: number;
}

interface FlightData {
  latitude: number;
  longitude: number;
  heading: number;
  callsign: string;
  flightNumber?: string;
  aircraftType?: string;
  depIcao?: string;
  arrIcao?: string;
  depLat?: number;
  depLon?: number;
  arrLat?: number;
  arrLon?: number;
  altitude?: number;
  groundSpeed?: number;
  phase?: string;
  trackPoints?: TrackPt[];
  bidId?: number;
}

interface HistoricalRoute {
  callsign: string;
  depLat: number;
  depLon: number;
  arrLat: number;
  arrLon: number;
  trackPoints: TrackPt[];
}

interface HubData {
  lat: number;
  lon: number;
  icao?: string;
  coverage?: number;
}

interface RouteWaypoint {
  lat: number;
  lon: number;
  altitudeFt?: number;
  fixType?: string;
  ident?: string;
}

interface WorldMapProps {
  hubs?: HubData[];
  flights?: FlightData[];
  selectedCallsign?: string | null;
  onSelectCallsign?: (callsign: string | null) => void;
  historicalRoute?: HistoricalRoute | null;
  mode?: 'overview' | 'dispatch';
  onFlightClick?: (flight: FlightData, event: React.MouseEvent) => void;
  selectedRoute?: RouteWaypoint[];
}

const CENTER: [number, number] = [0, 30];

// ── Icon URI cache ───────────────────────────────────────────

const dataUriCache = new Map<string, string>();

function buildUri(typeCode: string | undefined, color: string, suffix = ''): string {
  const key = (typeCode?.toUpperCase().split('/')[0].trim() || 'generic') + color + suffix;
  let uri = dataUriCache.get(key);
  if (!uri) {
    const info = getAircraftIcon(typeCode);
    const colored = info.svgRaw
      .replace(/currentColor/g, color)
      .replace(/fill="currentColor"/g, `fill="${color}"`);
    uri = `data:image/svg+xml,${encodeURIComponent(colored)}`;
    dataUriCache.set(key, uri);
  }
  return uri;
}

// ── Phase color helper (dispatch mode) ───────────────────────

function getMarkerColor(flight: FlightData, mode: string | undefined): string {
  if (mode !== 'dispatch') return '#4ade80'; // default overview color (emerald)
  switch (flight.phase) {
    case 'planning': return '#f59e0b';   // amber
    case 'completed': return '#6b7280';  // gray
    default: return '#4ade80';           // flying/active — emerald
  }
}

// ── Route phase colors ───────────────────────────────────────

const CLR_CLIMB = '#d2a8ff';
const CLR_CRUISE = '#58a6ff';
const CLR_DESCENT = '#3fb950';

function findTocTod(steps: RouteWaypoint[]): { tocIndex: number; todIndex: number } {
  if (steps.length < 2) return { tocIndex: 0, todIndex: steps.length - 1 };

  const tocByType = steps.findIndex(s => s.fixType === 'toc');
  const todByType = steps.length - 1 - [...steps].reverse().findIndex(s => s.fixType === 'tod');
  const hasToc = tocByType >= 0;
  const hasTod = todByType < steps.length && steps.findIndex(s => s.fixType === 'tod') >= 0;

  if (hasToc && hasTod) return { tocIndex: tocByType, todIndex: todByType };

  // Fallback: altitude threshold (90% of max)
  const maxAlt = Math.max(...steps.map(s => s.altitudeFt ?? 0));
  const threshold = maxAlt * 0.9;

  let tocFallback = 0;
  let todFallback = steps.length - 1;
  for (let i = 0; i < steps.length; i++) {
    if ((steps[i].altitudeFt ?? 0) >= threshold) { tocFallback = i; break; }
  }
  for (let i = steps.length - 1; i >= 0; i--) {
    if ((steps[i].altitudeFt ?? 0) >= threshold) { todFallback = i; break; }
  }

  return {
    tocIndex: hasToc ? tocByType : tocFallback,
    todIndex: hasTod ? todByType : todFallback,
  };
}

function getPhaseColor(index: number, tocIndex: number, todIndex: number): string {
  if (index <= tocIndex) return CLR_CLIMB;
  if (index <= todIndex) return CLR_CRUISE;
  return CLR_DESCENT;
}

function hexPoints(r: number): string {
  return Array.from({ length: 6 }, (_, i) => {
    const angle = (Math.PI / 3) * i - Math.PI / 6;
    return `${r * Math.cos(angle)},${r * Math.sin(angle)}`;
  }).join(' ');
}

// ── Component ────────────────────────────────────────────────

export const WorldMap = memo(function WorldMap({
  hubs = [], flights = [],
  selectedCallsign, onSelectCallsign,
  historicalRoute,
  mode, onFlightClick,
  selectedRoute,
}: WorldMapProps) {
  const [hoveredHub, setHoveredHub] = useState<number | null>(null);
  const [position, setPosition] = useState<{ coordinates: [number, number]; zoom: number }>({
    coordinates: CENTER,
    zoom: 1,
  });

  const selectedIdx = useMemo(() => {
    if (!selectedCallsign) return null;
    const idx = flights.findIndex(f => f.callsign === selectedCallsign);
    return idx >= 0 ? idx : null;
  }, [selectedCallsign, flights]);

  const handleSelect = useCallback((idx: number | null) => {
    const callsign = idx !== null ? flights[idx]?.callsign ?? null : null;
    onSelectCallsign?.(callsign);
  }, [flights, onSelectCallsign]);

  const handleMoveEnd = useCallback((pos: { coordinates: [number, number]; zoom: number }) => {
    setPosition(pos.zoom <= 1 ? { coordinates: CENTER, zoom: 1 } : pos);
  }, []);

  const routeFlights = useMemo(
    () => flights.filter(f => f.phase !== 'completed' && f.depLat != null && f.depLon != null && f.arrLat != null && f.arrLon != null),
    [flights],
  );

  const selectedFlight = selectedIdx !== null ? flights[selectedIdx] : null;
  const z = position.zoom;

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', background: 'transparent' }}>
      <ComposableMap
        projection="geoMercator"
        projectionConfig={{ scale: 140, center: [0, 30] }}
        width={960}
        height={500}
        style={{ width: '100%', height: '100%' }}
      >
        <ZoomableGroup
          center={position.coordinates}
          zoom={z}
          onMoveEnd={handleMoveEnd}
          minZoom={1}
          maxZoom={8}
          translateExtent={[[-880, -200], [1840, 700]]}
        >
          {/* ── Geography rendered 3x for wrap-around effect ────── */}
          {/* Full world width for geoMercator = 2 * π * scale */}
          {[-(2 * Math.PI * 140), 0, (2 * Math.PI * 140)].map((offset) => (
            <g key={offset} transform={`translate(${offset}, 0)`}>
              <Geographies geography={GEO_URL}>
                {({ geographies }) =>
                  geographies.map((geo) => (
                    <Geography
                      key={geo.rsmKey}
                      geography={geo}
                      fill="#0a0e1a"
                      stroke="#151a28"
                      strokeWidth={0.3}
                      style={{
                        default: { outline: 'none' },
                        hover: { fill: '#0d1120', outline: 'none' },
                        pressed: { outline: 'none' },
                      }}
                    />
                  ))
                }
              </Geographies>
            </g>
          ))}

          {/* ── Hub airport badges ────────────────────────── */}
          {mode !== 'dispatch' && hubs.map((hub, i) => (
            <Marker
              key={`hub-${i}`}
              coordinates={[hub.lon, hub.lat]}
              onMouseEnter={() => setHoveredHub(i)}
              onMouseLeave={() => setHoveredHub(null)}
              style={{ cursor: 'pointer' }}
            >
              <circle r={2.5 / z} fill="var(--accent-blue)" opacity={0.2} />
              <circle r={1.2 / z} fill="var(--accent-blue)" opacity={0.8} />
              {hoveredHub === i && hub.icao && (
                <g transform={`scale(${1 / z})`}>
                  <rect
                    x={6}
                    y={-8}
                    width={hub.coverage != null ? 78 : 36}
                    height={16}
                    rx={2}
                    fill="rgba(3,7,38,0.85)"
                    stroke="rgba(255,255,255,0.06)"
                    strokeWidth={0.5}
                  />
                  <text
                    x={10}
                    y={4}
                    fill="#ffffff"
                    fontSize={8}
                    fontFamily="ui-monospace, Cascadia Mono, Consolas, monospace"
                    fontWeight={600}
                  >
                    {hub.icao}
                  </text>
                  {hub.coverage != null && (
                    <text
                      x={42}
                      y={4}
                      fill="rgba(255,255,255,0.45)"
                      fontSize={7.5}
                      fontFamily="ui-monospace, Cascadia Mono, Consolas, monospace"
                      fontWeight={400}
                    >
                      {hub.coverage}%
                    </text>
                  )}
                </g>
              )}
            </Marker>
          ))}

          {/* ── Route lines (unselected = very subtle) ───── */}
          {routeFlights.map((f, i) => {
            const flightIdx = flights.indexOf(f);
            const isSelected = flightIdx === selectedIdx;
            if (isSelected) return null; // rendered separately below
            return (
              <Line
                key={`route-${i}`}
                from={[f.depLon!, f.depLat!]}
                to={[f.arrLon!, f.arrLat!]}
                stroke="rgba(99,132,230,0.12)"
                strokeWidth={0.6 / z}
                strokeLinecap="round"
                strokeDasharray="3 3"
              />
            );
          })}

          {/* ── Selected flight route layers ──────────────── */}
          {selectedFlight && selectedFlight.depLat != null && (() => {
            const hasRoute = selectedRoute && selectedRoute.length >= 2;
            const toctod = hasRoute ? findTocTod(selectedRoute!) : null;
            const tocIdx = toctod?.tocIndex ?? 0;
            const todIdx = toctod?.todIndex ?? 0;

            return (
              <g>
                {/* Phase-colored route segments */}
                {hasRoute ? (
                  selectedRoute!.slice(0, -1).map((wp, j) => {
                    const next = selectedRoute![j + 1];
                    const color = getPhaseColor(j, tocIdx, todIdx);
                    return (
                      <Line
                        key={`route-wp-${j}`}
                        from={[wp.lon, wp.lat]}
                        to={[next.lon, next.lat]}
                        stroke={color}
                        strokeWidth={1.5 / z}
                        strokeLinecap="round"
                      />
                    );
                  })
                ) : (
                  <Line
                    from={[selectedFlight.depLon!, selectedFlight.depLat!]}
                    to={[selectedFlight.arrLon!, selectedFlight.arrLat!]}
                    stroke="#4F6CCD"
                    strokeWidth={1.5 / z}
                    strokeLinecap="round"
                  />
                )}

                {/* Waypoint markers and labels */}
                {hasRoute && selectedRoute!.map((wp, j) => {
                  const color = getPhaseColor(j, tocIdx, todIdx);
                  const ft = wp.fixType;
                  const isApt = ft === 'apt';
                  const isTocTod = ft === 'toc' || ft === 'tod';
                  const isVor = ft === 'vor';

                  return (
                    <Marker key={`wp-marker-${j}`} coordinates={[wp.lon, wp.lat]}>
                      {/* Waypoint label */}
                      <text
                        x={0}
                        y={-5 / z}
                        textAnchor="middle"
                        style={{
                          fontFamily: 'ui-monospace, monospace',
                          fontSize: 3 / z,
                          fill: color,
                          fontWeight: 500,
                        }}
                      >
                        {wp.ident ?? ft?.toUpperCase() ?? ''}
                      </text>

                      {/* Shape by fixType */}
                      {isApt ? (
                        <g>
                          <circle cx={0} cy={0} r={3 / z} fill="none" stroke={color} strokeWidth={0.6 / z} />
                          <rect x={-0.5 / z} y={-4.5 / z} width={1 / z} height={2 / z} fill={color} />
                          <rect x={-0.5 / z} y={2.5 / z} width={1 / z} height={2 / z} fill={color} />
                          <rect x={-4.5 / z} y={-0.5 / z} width={2 / z} height={1 / z} fill={color} />
                          <rect x={2.5 / z} y={-0.5 / z} width={2 / z} height={1 / z} fill={color} />
                        </g>
                      ) : isTocTod ? (
                        <polygon
                          points={`0,${-3 / z} ${3 / z},0 0,${3 / z} ${-3 / z},0`}
                          fill={color}
                          stroke="#000"
                          strokeWidth={0.3 / z}
                        />
                      ) : isVor ? (
                        <polygon
                          points={hexPoints(2.5 / z)}
                          fill={color}
                          stroke="#000"
                          strokeWidth={0.3 / z}
                        />
                      ) : (
                        <polygon
                          points={`0,${-2.5 / z} ${2.5 / z},0 0,${2.5 / z} ${-2.5 / z},0`}
                          fill="none"
                          stroke={color}
                          strokeWidth={0.5 / z}
                        />
                      )}
                    </Marker>
                  );
                })}

                {/* Actual flown track — solid emerald */}
                {selectedFlight.trackPoints && selectedFlight.trackPoints.length >= 2 &&
                  selectedFlight.trackPoints.slice(0, -1).map((pt, j) => {
                    const next = selectedFlight.trackPoints![j + 1];
                    return (
                      <Line
                        key={`track-${j}`}
                        from={[pt.lon, pt.lat]}
                        to={[next.lon, next.lat]}
                        stroke="#4ade80"
                        strokeWidth={1.2 / z}
                        strokeLinecap="round"
                      />
                    );
                  })
                }

                {/* Remaining route — dashed white */}
                <Line
                  from={[selectedFlight.longitude, selectedFlight.latitude]}
                  to={[selectedFlight.arrLon!, selectedFlight.arrLat!]}
                  stroke="rgba(255,255,255,0.2)"
                  strokeWidth={0.8 / z}
                  strokeLinecap="round"
                  strokeDasharray={`${5 / z} ${3 / z}`}
                />

                {/* Departure badge */}
                <Marker coordinates={[selectedFlight.depLon!, selectedFlight.depLat!]}>
                  <rect
                    x={-12 / z} y={-5 / z}
                    width={24 / z} height={10 / z}
                    rx={2 / z}
                    fill="rgba(74,222,128,0.15)"
                    stroke="rgba(74,222,128,0.4)"
                    strokeWidth={0.4 / z}
                  />
                  <text
                    textAnchor="middle" dominantBaseline="central"
                    style={{
                      fontFamily: 'ui-monospace, monospace',
                      fontSize: 4.5 / z,
                      fill: '#4ade80',
                      fontWeight: 700,
                    }}
                  >
                    {selectedFlight.depIcao}
                  </text>
                </Marker>

                {/* Arrival badge */}
                <Marker coordinates={[selectedFlight.arrLon!, selectedFlight.arrLat!]}>
                  <rect
                    x={-12 / z} y={-5 / z}
                    width={24 / z} height={10 / z}
                    rx={2 / z}
                    fill="rgba(248,113,113,0.15)"
                    stroke="rgba(248,113,113,0.4)"
                    strokeWidth={0.4 / z}
                  />
                  <text
                    textAnchor="middle" dominantBaseline="central"
                    style={{
                      fontFamily: 'ui-monospace, monospace',
                      fontSize: 4.5 / z,
                      fill: '#f87171',
                      fontWeight: 700,
                    }}
                  >
                    {selectedFlight.arrIcao}
                  </text>
                </Marker>
              </g>
            );
          })()}

          {/* ── Historical route (recent flight) ─────────── */}
          {historicalRoute && !selectedFlight && (
            <g>
              {historicalRoute.trackPoints.slice(0, -1).map((pt, j) => {
                const next = historicalRoute.trackPoints[j + 1];
                return (
                  <Line
                    key={`hist-${j}`}
                    from={[pt.lon, pt.lat]}
                    to={[next.lon, next.lat]}
                    stroke="var(--accent-cyan)"
                    strokeWidth={1 / z}
                    strokeLinecap="round"
                  />
                );
              })}
              <Marker coordinates={[historicalRoute.depLon, historicalRoute.depLat]}>
                <circle r={2.5 / z} fill="none" stroke="var(--accent-emerald)" strokeWidth={0.6 / z} />
                <circle r={1 / z} fill="var(--accent-emerald)" />
              </Marker>
              <Marker coordinates={[historicalRoute.arrLon, historicalRoute.arrLat]}>
                <circle r={2.5 / z} fill="none" stroke="var(--accent-red)" strokeWidth={0.6 / z} />
                <circle r={1 / z} fill="var(--accent-red)" />
              </Marker>
            </g>
          )}

          {/* ── Airport labels (unselected flights, subtle) ── */}
          {!selectedFlight && routeFlights.map((f, i) => (
            <g key={`apt-${i}`}>
              <Marker coordinates={[f.depLon!, f.depLat!]}>
                <rect
                  x={-10 / z} y={-4 / z}
                  width={20 / z} height={8 / z}
                  rx={1.5 / z}
                  fill="rgba(99,132,230,0.1)"
                  stroke="rgba(99,132,230,0.25)"
                  strokeWidth={0.3 / z}
                />
                <text
                  textAnchor="middle" dominantBaseline="central"
                  style={{
                    fontFamily: 'ui-monospace, monospace',
                    fontSize: 3.5 / z,
                    fill: 'rgba(99,132,230,0.7)',
                    fontWeight: 600,
                  }}
                >
                  {f.depIcao}
                </text>
              </Marker>
              <Marker coordinates={[f.arrLon!, f.arrLat!]}>
                <rect
                  x={-10 / z} y={-4 / z}
                  width={20 / z} height={8 / z}
                  rx={1.5 / z}
                  fill="rgba(99,132,230,0.1)"
                  stroke="rgba(99,132,230,0.25)"
                  strokeWidth={0.3 / z}
                />
                <text
                  textAnchor="middle" dominantBaseline="central"
                  style={{
                    fontFamily: 'ui-monospace, monospace',
                    fontSize: 3.5 / z,
                    fill: 'rgba(99,132,230,0.7)',
                    fontWeight: 600,
                  }}
                >
                  {f.arrIcao}
                </text>
              </Marker>
            </g>
          ))}

          {/* ── Aircraft icons + callsign labels ─────────── */}
          {flights.map((f, i) => {
            const isSelected = i === selectedIdx;
            const iconSize = 24 / z;
            const markerColor = getMarkerColor(f, mode);

            // Position fallback: planning flights → dep airport, completed → arr airport
            const lat = f.latitude || (f.phase === 'completed' ? (f.arrLat ?? 0) : (f.depLat ?? 0));
            const lon = f.longitude || (f.phase === 'completed' ? (f.arrLon ?? 0) : (f.depLon ?? 0));

            // Skip flights with no position data
            if (lat === 0 && lon === 0) return null;

            const isPlanning = f.phase === 'planning';
            const isCompleted = f.phase === 'completed';

            // Don't render markers for planning or completed flights
            if (isPlanning || isCompleted) return null;

            return (
              <Marker key={`ac-${i}`} coordinates={[lon, lat]}>
                {/* Callsign label (offset above the icon) */}
                <text
                  textAnchor="middle"
                  y={-iconSize / 2 - 2 / z}
                  style={{
                    fontFamily: 'ui-monospace, monospace',
                    fontSize: 3.2 / z,
                    fill: isSelected ? '#ffffff' : `${markerColor}b3`,
                    fontWeight: isSelected ? 700 : 500,
                  }}
                >
                  {f.callsign}
                </text>

                {/* Aircraft icon or phase circle */}
                <g
                  transform={isPlanning || isCompleted ? undefined : `rotate(${f.heading})`}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSelect(isSelected ? null : i);
                    if (mode === 'dispatch') {
                      onFlightClick?.(f, e as any);
                    }
                  }}
                  style={{ cursor: 'pointer' }}
                >
                  {isSelected && (
                    <circle
                      r={iconSize * 0.55}
                      fill="rgba(74,222,128,0.08)"
                      stroke="rgba(74,222,128,0.3)"
                      strokeWidth={0.5 / z}
                    />
                  )}
                  <image
                    href={buildUri(f.aircraftType, isSelected ? '#ffffff' : markerColor, isSelected ? '_sel' : '')}
                    width={iconSize}
                    height={iconSize}
                    x={-iconSize / 2}
                    y={-iconSize / 2}
                  />
                </g>
              </Marker>
            );
          })}
        </ZoomableGroup>
      </ComposableMap>

      {/* ── Flight detail panel (reference-style sidebar) ── */}
      {mode !== 'dispatch' && selectedFlight && (
        <div
          className="absolute flex flex-col gap-3 overflow-y-auto"
          style={{
            top: 0, right: 0, bottom: 0,
            width: 220,
            background: 'rgba(8,10,18,0.92)',
            borderLeft: '1px solid var(--border-primary)',
            padding: '12px 14px',
            zIndex: 10,
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between">
            <span className="font-mono text-[16px] font-bold text-[var(--accent-emerald)]">
              {selectedFlight.callsign}
            </span>
            <button
              onClick={() => handleSelect(null)}
              className="text-[var(--text-quaternary)] hover:text-[var(--text-secondary)] text-[16px] leading-none px-1"
            >
              ×
            </button>
          </div>

          {/* Route */}
          <div className="flex items-center gap-2 pb-2 border-b border-[var(--divider)]">
            <div className="text-center">
              <div className="font-mono text-[13px] font-bold text-[var(--accent-emerald)]">
                {selectedFlight.depIcao || '----'}
              </div>
              <div className="text-[8px] text-[var(--text-quaternary)]">DEP</div>
            </div>
            <div className="flex-1 flex items-center">
              <div className="flex-1 h-px bg-[var(--divider)]" />
              <span className="px-1.5 text-[9px] text-[var(--text-quaternary)]">→</span>
              <div className="flex-1 h-px bg-[var(--divider)]" />
            </div>
            <div className="text-center">
              <div className="font-mono text-[13px] font-bold text-[var(--accent-red)]">
                {selectedFlight.arrIcao || '----'}
              </div>
              <div className="text-[8px] text-[var(--text-quaternary)]">ARR</div>
            </div>
          </div>

          {/* Flight Details */}
          <div>
            <div className="text-[9px] font-semibold uppercase tracking-wider text-[var(--text-quaternary)] mb-1.5">
              Flight Details
            </div>
            <div className="grid gap-x-3 gap-y-1" style={{ gridTemplateColumns: 'auto 1fr' }}>
              <span className="text-[10px] text-[var(--text-quaternary)]">Callsign</span>
              <span className="font-mono text-[11px] text-[var(--text-primary)]">{selectedFlight.callsign}</span>

              <span className="text-[10px] text-[var(--text-quaternary)]">Aircraft</span>
              <span className="font-mono text-[11px] text-[var(--text-primary)]">{selectedFlight.aircraftType || '----'}</span>

              <span className="text-[10px] text-[var(--text-quaternary)]">Flight No.</span>
              <span className="font-mono text-[11px] text-[var(--text-primary)]">{selectedFlight.flightNumber || '----'}</span>
            </div>
          </div>

          {/* Telemetry */}
          <div>
            <div className="text-[9px] font-semibold uppercase tracking-wider text-[var(--text-quaternary)] mb-1.5">
              Live Telemetry
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <div className="text-[8px] text-[var(--text-quaternary)]">Altitude</div>
                <div className="font-mono text-[13px] font-semibold tabular-nums text-[var(--text-primary)]">
                  FL{String(Math.round(selectedFlight.altitude ?? 0) / 100 | 0).padStart(3, '0')}
                </div>
              </div>
              <div>
                <div className="text-[8px] text-[var(--text-quaternary)]">Ground Speed</div>
                <div className="font-mono text-[13px] font-semibold tabular-nums text-[var(--text-primary)]">
                  {Math.round(selectedFlight.groundSpeed ?? 0)}kt
                </div>
              </div>
              <div>
                <div className="text-[8px] text-[var(--text-quaternary)]">Heading</div>
                <div className="font-mono text-[13px] font-semibold tabular-nums text-[var(--text-primary)]">
                  {String(Math.round(selectedFlight.heading)).padStart(3, '0')}°
                </div>
              </div>
              <div>
                <div className="text-[8px] text-[var(--text-quaternary)]">Position</div>
                <div className="font-mono text-[11px] tabular-nums text-[var(--text-secondary)]">
                  {selectedFlight.latitude.toFixed(2)}°
                  <br />
                  {selectedFlight.longitude.toFixed(2)}°
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Historical route panel ─────────────────────── */}
      {mode !== 'dispatch' && historicalRoute && !selectedFlight && (
        <div
          className="absolute flex flex-col gap-2"
          style={{
            top: 0, right: 0,
            width: 200,
            background: 'rgba(8,10,18,0.92)',
            borderLeft: '1px solid var(--border-primary)',
            padding: '12px 14px',
            zIndex: 10,
          }}
        >
          <div className="flex items-center justify-between">
            <span className="font-mono text-[14px] font-bold text-[var(--text-primary)]">
              {historicalRoute.callsign}
            </span>
            <span className="text-[9px] font-medium uppercase tracking-wider text-[var(--accent-cyan)]">
              Completed
            </span>
          </div>
          <div className="text-[10px] text-[var(--text-quaternary)]">
            Historical flight trace
          </div>
        </div>
      )}
    </div>
  );
});
