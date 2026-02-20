import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { MapContainer, TileLayer, Polyline, CircleMarker, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import {
  ChevronLeft, ChevronRight, Plus, Minus, Crosshair,
  Plane, Navigation, Gauge, ArrowUpDown, Radio,
} from 'lucide-react';
import { api } from '../lib/api';
import { useTelemetry } from '../hooks/useTelemetry';
import type { Airport, ActiveBidEntry, AllBidsResponse } from '@acars/shared';

// ─── Types ───────────────────────────────────────────────────

interface RouteInfo {
  bid: ActiveBidEntry;
  depAirport: Airport;
  arrAirport: Airport;
}

// ─── Constants ───────────────────────────────────────────────

const TRAIL_INTERVAL_MS = 3000;
const MAX_TRAIL_POINTS = 200;
const REFETCH_INTERVAL_MS = 60_000;

const PLANE_SVG = (heading: number, size: number, color: string, glow: boolean) => `
  <svg viewBox="0 0 64 64" width="${size}" height="${size}" style="transform: rotate(${heading}deg); filter: drop-shadow(0 1px 3px rgba(0,0,0,0.6))${glow ? ` drop-shadow(0 0 8px ${color}80)` : ''};">
    <path d="
      M32 2
      C33 2 34 3 34 5
      L34 20
      L54 30 C56 31 56 33 55 34 L34 32
      L34 48
      L42 54 C43 55 43 56 42 57 L34 55
      L33 58 C32.5 59 31.5 59 31 58
      L30 55
      L22 57 C21 56 21 55 22 54 L30 48
      L30 32
      L9 34 C8 33 8 31 10 30 L30 20
      L30 5
      C30 3 31 2 32 2 Z"
      fill="${color}" stroke="rgba(0,0,0,0.3)" stroke-width="0.5"/>
  </svg>`;

// ─── Sidebar Component ──────────────────────────────────────

function FlightsSidebar({
  collapsed,
  onToggle,
  routes,
  selectedBidId,
  onSelectBid,
  connected,
  aircraft,
  flight,
}: {
  collapsed: boolean;
  onToggle: () => void;
  routes: RouteInfo[];
  selectedBidId: number | null;
  onSelectBid: (id: number | null) => void;
  connected: boolean;
  aircraft: ReturnType<typeof useTelemetry>['aircraft'];
  flight: ReturnType<typeof useTelemetry>['flight'];
}) {
  return (
    <div
      className={`absolute top-3 left-3 bottom-3 z-[1000] transition-all duration-300 flex ${
        collapsed ? 'w-10' : 'w-72'
      }`}
    >
      <div className="flex-1 bg-acars-panel/90 backdrop-blur-sm rounded-lg border border-acars-border overflow-hidden flex flex-col">
        {/* Toggle button */}
        <button
          onClick={onToggle}
          className="flex items-center justify-center h-9 border-b border-acars-border hover:bg-acars-border/30 transition-colors shrink-0"
        >
          {collapsed ? (
            <ChevronRight className="w-4 h-4 text-acars-muted" />
          ) : (
            <div className="flex items-center justify-between w-full px-3">
              <span className="text-xs font-semibold text-acars-text tracking-wide uppercase">Flights</span>
              <ChevronLeft className="w-4 h-4 text-acars-muted" />
            </div>
          )}
        </button>

        {!collapsed && (
          <div className="flex-1 overflow-y-auto">
            {/* Your Flight card */}
            {connected && aircraft && (
              <div className="mx-2 mt-2 mb-1 p-2.5 rounded-md bg-acars-cyan/10 border border-acars-cyan/20">
                <div className="flex items-center gap-1.5 mb-2">
                  <Radio className="w-3 h-3 text-acars-cyan" />
                  <span className="text-[10px] font-bold text-acars-cyan tracking-wider uppercase">Your Flight</span>
                  <span className="ml-auto w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                </div>
                <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px]">
                  <div className="flex items-center gap-1.5">
                    <ArrowUpDown className="w-3 h-3 text-acars-muted shrink-0" />
                    <span className="text-acars-muted">ALT</span>
                    <span className="ml-auto text-acars-text font-mono tabular-nums">
                      {Math.round(aircraft.position.altitude).toLocaleString()}ft
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Gauge className="w-3 h-3 text-acars-muted shrink-0" />
                    <span className="text-acars-muted">GS</span>
                    <span className="ml-auto text-acars-text font-mono tabular-nums">
                      {Math.round(aircraft.position.groundSpeed)}kt
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Navigation className="w-3 h-3 text-acars-muted shrink-0" />
                    <span className="text-acars-muted">HDG</span>
                    <span className="ml-auto text-acars-text font-mono tabular-nums">
                      {Math.round(aircraft.position.heading).toString().padStart(3, '0')}&deg;
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Plane className="w-3 h-3 text-acars-muted shrink-0" />
                    <span className="text-acars-muted">PHS</span>
                    <span className="ml-auto text-acars-text font-mono tabular-nums text-acars-cyan">
                      {flight?.phase?.replace('_', ' ') ?? '—'}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Active flights list */}
            <div className="px-2 py-1.5">
              <span className="text-[10px] font-semibold text-acars-muted tracking-wider uppercase px-1">
                Active Flights ({routes.length})
              </span>
            </div>
            {routes.length === 0 && (
              <div className="px-3 py-6 text-center text-xs text-acars-muted">No active flights</div>
            )}
            {routes.map(({ bid }) => {
              const isSelected = selectedBidId === bid.id;
              return (
                <button
                  key={bid.id}
                  onClick={() => onSelectBid(isSelected ? null : bid.id)}
                  className={`w-full text-left px-3 py-2 transition-colors hover:bg-acars-border/20 ${
                    isSelected ? 'bg-acars-cyan/10 border-l-2 border-acars-cyan' : 'border-l-2 border-transparent'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-acars-text font-mono">{bid.flightNumber}</span>
                    <span className="text-[10px] text-acars-muted font-mono">{bid.aircraftType}</span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-[11px] font-mono text-acars-text">{bid.depIcao}</span>
                    <span className="text-[10px] text-acars-muted">→</span>
                    <span className="text-[11px] font-mono text-acars-text">{bid.arrIcao}</span>
                    <span className="ml-auto text-[10px] text-acars-muted truncate max-w-[90px]">
                      {bid.pilotCallsign}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Map Control Buttons ────────────────────────────────────

function MapControlButtons({ connected }: { connected: boolean }) {
  const map = useMap();

  return (
    <div className="absolute top-3 right-3 z-[1000] flex flex-col gap-1">
      <div className="bg-acars-panel/90 backdrop-blur-sm rounded-lg border border-acars-border overflow-hidden">
        <button
          onClick={() => map.zoomIn()}
          className="flex items-center justify-center w-9 h-9 hover:bg-acars-border/30 transition-colors border-b border-acars-border"
          title="Zoom in"
        >
          <Plus className="w-4 h-4 text-acars-muted" />
        </button>
        <button
          onClick={() => map.zoomOut()}
          className="flex items-center justify-center w-9 h-9 hover:bg-acars-border/30 transition-colors"
          title="Zoom out"
        >
          <Minus className="w-4 h-4 text-acars-muted" />
        </button>
      </div>
      {connected && (
        <div className="bg-acars-panel/90 backdrop-blur-sm rounded-lg border border-acars-border overflow-hidden mt-1">
          <button
            onClick={() => {
              // dispatch custom event so MapEventHandler can pick it up
              map.getContainer().dispatchEvent(new CustomEvent('center-aircraft'));
            }}
            className="flex items-center justify-center w-9 h-9 hover:bg-acars-border/30 transition-colors"
            title="Center on aircraft"
          >
            <Crosshair className="w-4 h-4 text-acars-cyan" />
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Route Layer ─────────────────────────────────────────────

function RouteLayer({
  routes,
  selectedBidId,
}: {
  routes: RouteInfo[];
  selectedBidId: number | null;
}) {
  // Collect unique airports to show as markers
  const uniqueAirports = useMemo(() => {
    const map = new Map<string, Airport>();
    for (const r of routes) {
      map.set(r.depAirport.icao, r.depAirport);
      map.set(r.arrAirport.icao, r.arrAirport);
    }
    return Array.from(map.values());
  }, [routes]);

  return (
    <>
      {/* Route polylines */}
      {routes.map(({ bid, depAirport, arrAirport }) => {
        const isSelected = selectedBidId === bid.id;
        return (
          <Polyline
            key={bid.id}
            positions={[
              [depAirport.lat, depAirport.lon],
              [arrAirport.lat, arrAirport.lon],
            ]}
            pathOptions={{
              color: isSelected ? '#79c0ff' : '#30363d',
              weight: isSelected ? 2.5 : 1.5,
              opacity: isSelected ? 0.8 : 0.5,
              dashArray: isSelected ? undefined : '6 4',
            }}
          />
        );
      })}

      {/* Airport markers */}
      {uniqueAirports.map((apt) => (
        <CircleMarker
          key={apt.icao}
          center={[apt.lat, apt.lon]}
          radius={4}
          pathOptions={{
            color: '#58a6ff',
            fillColor: '#58a6ff',
            fillOpacity: 0.7,
            weight: 1,
          }}
        >
          <Tooltip direction="top" offset={[0, -6]} className="hub-tooltip" permanent={false}>
            <span style={{ fontFamily: 'JetBrains Mono, Consolas, monospace', fontSize: '10px' }}>
              {apt.icao} — {apt.city}
            </span>
          </Tooltip>
        </CircleMarker>
      ))}
    </>
  );
}

// ─── Live Aircraft Marker ────────────────────────────────────

function LiveAircraftMarker({
  aircraft,
  flight,
}: {
  aircraft: NonNullable<ReturnType<typeof useTelemetry>['aircraft']>;
  flight: ReturnType<typeof useTelemetry>['flight'];
}) {
  const map = useMap();

  useEffect(() => {
    const { latitude, longitude, heading } = aircraft.position;
    if (latitude === 0 && longitude === 0) return;

    const icon = L.divIcon({
      html: PLANE_SVG(heading, 42, '#79c0ff', true),
      className: '',
      iconSize: [42, 42],
      iconAnchor: [21, 21],
    });

    // Escape HTML to prevent XSS from telemetry data
    const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const safeAtcId = esc(aircraft.atcId || 'Unknown');
    const safePhase = flight ? esc(flight.phase.replace('_', ' ')) : '';

    const popupContent = `
      <div style="font-family: 'JetBrains Mono', Consolas, monospace; font-size: 11px; color: #e6edf3; background: #161b22; padding: 8px 10px; border-radius: 6px; line-height: 1.6; min-width: 140px;">
        <div style="font-weight: 600; color: #79c0ff; margin-bottom: 4px;">${safeAtcId}</div>
        <div>ALT: <span style="color: #e6edf3;">${Math.round(aircraft.position.altitude).toLocaleString()} ft</span></div>
        <div>GS: <span style="color: #e6edf3;">${Math.round(aircraft.position.groundSpeed)} kt</span></div>
        <div>HDG: <span style="color: #e6edf3;">${Math.round(heading).toString().padStart(3, '0')}&deg;</span></div>
        <div>VS: <span style="color: #e6edf3;">${Math.round(aircraft.position.verticalSpeed)} fpm</span></div>
        ${flight ? `<div>Phase: <span style="color: #79c0ff;">${safePhase}</span></div>` : ''}
      </div>
    `;

    const marker = L.marker([latitude, longitude], { icon })
      .addTo(map)
      .bindPopup(popupContent, {
        className: 'aircraft-popup',
        closeButton: false,
        offset: [0, -10],
      });

    return () => {
      marker.remove();
    };
  }, [aircraft, flight, map]);

  return null;
}

// ─── Aircraft Trail ──────────────────────────────────────────

function AircraftTrail({
  aircraft,
}: {
  aircraft: NonNullable<ReturnType<typeof useTelemetry>['aircraft']>;
}) {
  const trailRef = useRef<[number, number][]>([]);
  const lastPushRef = useRef(0);
  const [trail, setTrail] = useState<[number, number][]>([]);

  useEffect(() => {
    const now = Date.now();
    if (now - lastPushRef.current < TRAIL_INTERVAL_MS) return;

    const { latitude, longitude } = aircraft.position;
    if (latitude === 0 && longitude === 0) return;

    lastPushRef.current = now;
    const pts = trailRef.current;
    pts.push([latitude, longitude]);
    if (pts.length > MAX_TRAIL_POINTS) pts.shift();
    setTrail([...pts]);
  }, [aircraft]);

  if (trail.length < 2) return null;

  return (
    <Polyline
      positions={trail}
      pathOptions={{
        color: '#79c0ff',
        weight: 2,
        opacity: 0.4,
        dashArray: '4 6',
      }}
    />
  );
}

// ─── Map Event Handler ───────────────────────────────────────

function MapEventHandler({
  routes,
  selectedBidId,
  aircraftLat,
  aircraftLon,
}: {
  routes: RouteInfo[];
  selectedBidId: number | null;
  aircraftLat: number | null;
  aircraftLon: number | null;
}) {
  const map = useMap();

  // Fit to selected route
  useEffect(() => {
    if (!selectedBidId) return;
    const route = routes.find((r) => r.bid.id === selectedBidId);
    if (!route) return;

    const bounds = L.latLngBounds(
      [route.depAirport.lat, route.depAirport.lon],
      [route.arrAirport.lat, route.arrAirport.lon],
    );
    map.fitBounds(bounds, { padding: [80, 80], maxZoom: 8 });
  }, [selectedBidId, routes, map]);

  // Center on aircraft via custom event
  useEffect(() => {
    const container = map.getContainer();
    const handler = () => {
      if (aircraftLat != null && aircraftLon != null && !(aircraftLat === 0 && aircraftLon === 0)) {
        map.flyTo([aircraftLat, aircraftLon], Math.max(map.getZoom(), 7), { duration: 1 });
      }
    };
    container.addEventListener('center-aircraft', handler);
    return () => container.removeEventListener('center-aircraft', handler);
  }, [map, aircraftLat, aircraftLon]);

  return null;
}

// ─── Main Page ───────────────────────────────────────────────

export function LiveMapPage() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [selectedBidId, setSelectedBidId] = useState<number | null>(null);
  const [routes, setRoutes] = useState<RouteInfo[]>([]);

  const { aircraft, flight, connected } = useTelemetry();

  // Fetch airports + bids on mount, refetch bids every 60s
  const fetchData = useCallback(async () => {
    try {
      const [airports, bidsRes] = await Promise.all([
        api.get<Airport[]>('/api/airports'),
        api.get<AllBidsResponse>('/api/bids/all'),
      ]);

      const aMap = new Map(airports.map((a) => [a.icao, a]));

      const resolved: RouteInfo[] = [];
      for (const bid of bidsRes.bids) {
        const dep = aMap.get(bid.depIcao);
        const arr = aMap.get(bid.arrIcao);
        if (dep && arr) {
          resolved.push({ bid, depAirport: dep, arrAirport: arr });
        }
      }
      setRoutes(resolved);
    } catch {
      // silent — map still usable without routes
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, REFETCH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Derive aircraft position for sub-components
  const aircraftLat = connected && aircraft ? aircraft.position.latitude : null;
  const aircraftLon = connected && aircraft ? aircraft.position.longitude : null;

  return (
    <div className="h-full w-full relative">
      <MapContainer
        center={[37.5, -96.0]}
        zoom={4}
        zoomSnap={0.5}
        className="h-full w-full"
        zoomControl={false}
        attributionControl={false}
        style={{ background: '#0d1117' }}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          maxZoom={19}
        />

        {/* Route lines + airport markers */}
        <RouteLayer routes={routes} selectedBidId={selectedBidId} />

        {/* Live aircraft */}
        {connected && aircraft && (
          <>
            <LiveAircraftMarker aircraft={aircraft} flight={flight} />
            <AircraftTrail aircraft={aircraft} />
          </>
        )}

        {/* Map controls (inside MapContainer so useMap works) */}
        <MapControlButtons connected={connected} />

        {/* Event handler for selection + center */}
        <MapEventHandler
          routes={routes}
          selectedBidId={selectedBidId}
          aircraftLat={aircraftLat}
          aircraftLon={aircraftLon}
        />
      </MapContainer>

      {/* Sidebar overlay */}
      <FlightsSidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        routes={routes}
        selectedBidId={selectedBidId}
        onSelectBid={setSelectedBidId}
        connected={connected}
        aircraft={aircraft}
        flight={flight}
      />
    </div>
  );
}
