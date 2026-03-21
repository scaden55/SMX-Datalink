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
}

interface HistoricalRoute {
  callsign: string;
  depLat: number;
  depLon: number;
  arrLat: number;
  arrLon: number;
  trackPoints: TrackPt[];
}

interface WorldMapProps {
  hubs?: { lat: number; lon: number }[];
  flights?: FlightData[];
  selectedCallsign?: string | null;
  onSelectCallsign?: (callsign: string | null) => void;
  historicalRoute?: HistoricalRoute | null;
}

const CENTER: [number, number] = [0, 30];

// ── Icon URI cache ───────────────────────────────────────────

const dataUriCache = new Map<string, string>();

function buildUri(typeCode: string | undefined, color: string, suffix = ''): string {
  const key = (typeCode?.toUpperCase().split('/')[0].trim() || 'generic') + suffix;
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

// ── Component ────────────────────────────────────────────────

export const WorldMap = memo(function WorldMap({
  hubs = [], flights = [],
  selectedCallsign, onSelectCallsign,
  historicalRoute,
}: WorldMapProps) {
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
    () => flights.filter(f => f.depLat != null && f.depLon != null && f.arrLat != null && f.arrLon != null),
    [flights],
  );

  const selectedFlight = selectedIdx !== null ? flights[selectedIdx] : null;
  const z = position.zoom;

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', background: '#050608' }}>
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
          translateExtent={[[-100, -50], [1060, 550]]}
        >
          {/* ── Geography (very dark, subtle borders) ────── */}
          <Geographies geography={GEO_URL}>
            {({ geographies }) =>
              geographies.map((geo) => (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  fill="#0c0e14"
                  stroke="#1a1d28"
                  strokeWidth={0.4}
                  style={{
                    default: { outline: 'none' },
                    hover: { fill: '#0e1018', outline: 'none' },
                    pressed: { outline: 'none' },
                  }}
                />
              ))
            }
          </Geographies>

          {/* ── Hub airport badges ────────────────────────── */}
          {hubs.map((hub, i) => (
            <Marker key={`hub-${i}`} coordinates={[hub.lon, hub.lat]}>
              <circle r={2.5 / z} fill="var(--accent-blue)" opacity={0.2} />
              <circle r={1.2 / z} fill="var(--accent-blue)" opacity={0.8} />
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
          {selectedFlight && selectedFlight.depLat != null && (
            <g>
              {/* Planned route — bright magenta/pink like reference */}
              <Line
                from={[selectedFlight.depLon!, selectedFlight.depLat!]}
                to={[selectedFlight.arrLon!, selectedFlight.arrLat!]}
                stroke="#e05080"
                strokeWidth={1.2 / z}
                strokeLinecap="round"
                strokeDasharray={`${4 / z} ${3 / z}`}
              />

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
          )}

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
            return (
              <Marker key={`ac-${i}`} coordinates={[f.longitude, f.latitude]}>
                {/* Callsign label (offset above the icon) */}
                <text
                  textAnchor="middle"
                  y={-iconSize / 2 - 2 / z}
                  style={{
                    fontFamily: 'ui-monospace, monospace',
                    fontSize: 3.2 / z,
                    fill: isSelected ? '#ffffff' : 'rgba(74,222,128,0.7)',
                    fontWeight: isSelected ? 700 : 500,
                  }}
                >
                  {f.callsign}
                </text>

                {/* Aircraft icon */}
                <g
                  transform={`rotate(${f.heading})`}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSelect(isSelected ? null : i);
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
                    href={buildUri(f.aircraftType, isSelected ? '#ffffff' : '#4ade80', isSelected ? '_sel' : '')}
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
      {selectedFlight && (
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
      {historicalRoute && !selectedFlight && (
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
