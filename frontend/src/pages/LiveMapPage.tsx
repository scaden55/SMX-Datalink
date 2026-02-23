import { useState, useEffect, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import {
  ChevronLeft, ChevronRight, Plus, Minus, Crosshair,
  Plane, Navigation, Gauge, ArrowUpDown, Radio,
} from 'lucide-react';
import { api } from '../lib/api';
import { useTelemetry } from '../hooks/useTelemetry';
import { useVatsim } from '../hooks/useVatsim';
import { useVatsimStore } from '../stores/vatsimStore';
import { FirBoundaryLayer } from '../components/map/FirBoundaryLayer';
import { TraconBoundaryLayer } from '../components/map/TraconBoundaryLayer';
import { VatsimLayerToggle } from '../components/map/VatsimLayerToggle';
import { PilotMarkers } from '../components/map/PilotMarkers';
import { AirportLabels } from '../components/map/AirportLabels';
import { AirportDetailPanel } from '../components/map/AirportDetailPanel';
import { PilotDetailPanel } from '../components/map/PilotDetailPanel';
import { AirspaceDetailPanel } from '../components/map/AirspaceDetailPanel';
import { AirspaceHoverCard } from '../components/map/AirspaceHoverCard';
import { NavaidMarkers } from '../components/map/NavaidMarkers';
import { PilotTrailLine } from '../components/map/PilotTrailLine';
import { PilotPlannedRoute } from '../components/map/PilotPlannedRoute';
import { FlightTrackLine } from '../components/map/FlightTrackLine';
import { PredictedPath } from '../components/map/PredictedPath';
import { TrackInfoCard } from '../components/map/TrackInfoCard';
import { GroundChartOverlay } from '../components/map/GroundChartOverlay';
import { useTrack } from '../hooks/useTrack';
import { useTrackStore } from '../stores/trackStore';
import type { Airport, ActiveBidEntry, AllBidsResponse, VatsimPilot } from '@acars/shared';

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
  if (collapsed) {
    return (
      <div className="absolute top-3 left-3 z-[1000]">
        <button
          onClick={onToggle}
          className="flex items-center justify-center w-9 h-9 bg-acars-panel rounded-md border border-acars-border hover:bg-acars-border transition-colors"
        >
          <ChevronRight className="w-4 h-4 text-acars-muted" />
        </button>
      </div>
    );
  }

  return (
    <div className="absolute top-3 left-3 bottom-3 z-[1000] w-72 transition-all duration-300 flex">
      <div className="flex-1 bg-acars-panel rounded-md border border-acars-border overflow-hidden flex flex-col">
        {/* Toggle button */}
        <button
          onClick={onToggle}
          className="flex items-center justify-center h-9 border-b border-acars-border hover:bg-acars-border transition-colors shrink-0"
        >
          <div className="flex items-center justify-between w-full px-3">
            <span className="text-[11px] font-bold text-acars-text tracking-wider uppercase">Flights</span>
            <ChevronLeft className="w-4 h-4 text-acars-muted" />
          </div>
        </button>

        <div className="flex-1 overflow-y-auto">
            {/* Your Flight card */}
            {connected && aircraft && (
              <div className="mx-2 mt-2 mb-1 p-2.5 rounded-md bg-sky-500/10 border border-sky-400/20">
                <div className="flex items-center gap-1.5 mb-2">
                  <Radio className="w-3 h-3 text-sky-400" />
                  <span className="text-[10px] font-bold text-sky-400 tracking-wider uppercase">Your Flight</span>
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
                    <span className="ml-auto text-acars-text font-mono tabular-nums text-sky-400">
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
              <div className="px-3 py-8 text-center">
                <Plane className="w-6 h-6 text-acars-muted/20 mx-auto mb-2" />
                <p className="text-xs text-acars-muted">No active flights</p>
              </div>
            )}
            {routes.map(({ bid }) => {
              const isSelected = selectedBidId === bid.id;
              return (
                <button
                  key={bid.id}
                  onClick={() => onSelectBid(isSelected ? null : bid.id)}
                  className={`w-full text-left px-3 py-2 transition-colors hover:bg-acars-border ${
                    isSelected ? 'bg-sky-500/10 border-l-2 border-sky-400' : 'border-l-2 border-transparent'
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
      </div>
    </div>
  );
}

// ─── Map Control Buttons ────────────────────────────────────

function MapControlButtons({ connected, panelOpen }: { connected: boolean; panelOpen: boolean }) {
  const map = useMap();

  return (
    <div className={`absolute top-3 z-[1000] flex flex-col items-end gap-1.5 transition-all duration-200 ${panelOpen ? 'right-[23.5rem]' : 'right-3'}`}>
      {/* VATSIM layer toggles (filters) first */}
      <VatsimLayerToggle />

      {/* Zoom + utility buttons below filters, tight sizing */}
      <div className="flex flex-col gap-1">
        <div className="bg-acars-panel rounded-md border border-acars-border overflow-hidden w-8">
          <button
            onClick={() => map.zoomIn()}
            className="flex items-center justify-center w-8 h-8 hover:bg-acars-border hover:text-acars-text transition-colors border-b border-acars-border"
            title="Zoom in"
          >
            <Plus className="w-3.5 h-3.5 text-acars-muted" />
          </button>
          <button
            onClick={() => map.zoomOut()}
            className="flex items-center justify-center w-8 h-8 hover:bg-acars-border hover:text-acars-text transition-colors"
            title="Zoom out"
          >
            <Minus className="w-3.5 h-3.5 text-acars-muted" />
          </button>
        </div>
        {connected && (
          <div className="bg-acars-panel rounded-md border border-acars-border overflow-hidden w-8">
            <button
              onClick={() => {
                map.getContainer().dispatchEvent(new CustomEvent('center-aircraft'));
              }}
              className="flex items-center justify-center w-8 h-8 hover:bg-acars-border hover:text-sky-400 transition-colors"
              title="Center on aircraft"
            >
              <Crosshair className="w-3.5 h-3.5 text-sky-400" />
            </button>
          </div>
        )}
      </div>
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
  return (
    <>
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
              color: isSelected ? '#79c0ff' : '#2e3138',
              weight: isSelected ? 2.5 : 1.5,
              opacity: isSelected ? 0.8 : 0.5,
              dashArray: isSelected ? undefined : '6 4',
            }}
          />
        );
      })}
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
      <div style="font-family: Inter, system-ui, sans-serif; font-feature-settings: 'tnum'; font-size: 11px; color: #e6e9ee; background: var(--bg-panel); padding: 8px 10px; border-radius: 6px; line-height: 1.6; min-width: 140px; border: 1px solid var(--border-panel);">
        <div style="font-weight: 600; color: #79c0ff; margin-bottom: 4px;">${safeAtcId}</div>
        <div>ALT: <span style="color: #e6e9ee;">${Math.round(aircraft.position.altitude).toLocaleString()} ft</span></div>
        <div>GS: <span style="color: #e6e9ee;">${Math.round(aircraft.position.groundSpeed)} kt</span></div>
        <div>HDG: <span style="color: #e6e9ee;">${Math.round(heading).toString().padStart(3, '0')}&deg;</span></div>
        <div>VS: <span style="color: #e6e9ee;">${Math.round(aircraft.position.verticalSpeed)} fpm</span></div>
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
  const [selectedAirport, setSelectedAirport] = useState<string | null>(null);
  const [selectedPilot, setSelectedPilot] = useState<VatsimPilot | null>(null);
  const [selectedAirspace, setSelectedAirspace] = useState<{
    type: 'fir' | 'tracon';
    boundaryId: string;
    feature: GeoJSON.Feature;
  } | null>(null);
  const [hoveredAirspace, setHoveredAirspace] = useState<{
    id: string;
    type: 'fir' | 'tracon';
    feature: GeoJSON.Feature;
    x: number;
    y: number;
  } | null>(null);

  const { aircraft, flight, connected } = useTelemetry();
  useVatsim();
  useTrack(selectedBidId);
  const vatsimSnapshot = useVatsimStore((s) => s.snapshot);
  const vatsimLayers = useVatsimStore((s) => s.layers);
  const pilotTracks = useVatsimStore((s) => s.pilotTracks);
  const bidTrack = useTrackStore((s) => s.selectedBidTrack);
  const ofpSteps = useTrackStore((s) => s.ofpSteps);

  const detailPanelOpen = selectedAirport != null || selectedPilot != null || selectedAirspace != null;

  // Close pilot panel when VATSIM pilots layer is toggled off
  useEffect(() => {
    if (!vatsimLayers.showPilots) setSelectedPilot(null);
  }, [vatsimLayers.showPilots]);

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

  const handleFirHover = useCallback((id: string | null, feature: GeoJSON.Feature | null, e: L.LeafletMouseEvent | null) => {
    if (id && feature && e) {
      setHoveredAirspace({ id, type: 'fir', feature, x: e.containerPoint.x, y: e.containerPoint.y });
    } else {
      setHoveredAirspace(null);
    }
  }, []);

  const handleTraconHover = useCallback((id: string | null, feature: GeoJSON.Feature | null, e: L.LeafletMouseEvent | null) => {
    if (id && feature && e) {
      setHoveredAirspace({ id, type: 'tracon', feature, x: e.containerPoint.x, y: e.containerPoint.y });
    } else {
      setHoveredAirspace(null);
    }
  }, []);

  const handleFirSelect = useCallback((id: string, feature: GeoJSON.Feature) => {
    setSelectedAirspace({ type: 'fir', boundaryId: id, feature });
    setSelectedAirport(null);
    setSelectedPilot(null);
    setHoveredAirspace(null);
  }, []);

  const handleTraconSelect = useCallback((id: string, feature: GeoJSON.Feature) => {
    setSelectedAirspace({ type: 'tracon', boundaryId: id, feature });
    setSelectedAirport(null);
    setSelectedPilot(null);
    setHoveredAirspace(null);
  }, []);

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
        style={{ background: 'var(--bg-map)' }}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          maxZoom={19}
        />

        {/* Ground chart overlay (appears at high zoom near airports) */}
        <GroundChartOverlay />

        {/* VATSIM boundary layers (render below SMA flights) */}
        {vatsimSnapshot && (
          <>
            <FirBoundaryLayer
              controllers={vatsimSnapshot.controllers}
              visible={vatsimLayers.showFirBoundaries}
              hoveredAirspaceId={hoveredAirspace?.type === 'fir' ? hoveredAirspace.id : null}
              onHoverAirspace={handleFirHover}
              onSelectAirspace={handleFirSelect}
            />
            <TraconBoundaryLayer
              controllers={vatsimSnapshot.controllers}
              visible={vatsimLayers.showTraconBoundaries}
              hoveredAirspaceId={hoveredAirspace?.type === 'tracon' ? hoveredAirspace.id : null}
              onHoverAirspace={handleTraconHover}
              onSelectAirspace={handleTraconSelect}
            />
          </>
        )}

        {/* Route polylines */}
        <RouteLayer routes={routes} selectedBidId={selectedBidId} />

        {/* Selected SMA bid: altitude-gradient flight track (already flown) */}
        {bidTrack && bidTrack.points.length > 0 && (
          <FlightTrackLine points={bidTrack.points} />
        )}

        {/* Selected SMA bid: predicted future path (OFP waypoints or great-circle) */}
        {selectedBidId && bidTrack && (() => {
          const route = routes.find((r) => r.bid.id === selectedBidId);
          const lastPt = bidTrack.points[bidTrack.points.length - 1];
          // Use live aircraft position if available, otherwise last track point
          const currentPos = connected && aircraft
            ? { lat: aircraft.position.latitude, lon: aircraft.position.longitude }
            : lastPt ? { lat: lastPt.lat, lon: lastPt.lon } : null;
          const arrCoords: [number, number] | null = route
            ? [route.arrAirport.lat, route.arrAirport.lon]
            : null;
          return (
            <PredictedPath
              currentPos={currentPos}
              ofpSteps={ofpSteps}
              arrivalCoords={arrCoords}
            />
          );
        })()}

        {/* Airport ICAO labels with ATC badges */}
        <AirportLabels
          controllers={vatsimSnapshot?.controllers ?? []}
          atis={vatsimSnapshot?.atis ?? []}
          visible={vatsimLayers.showAirportLabels}
          onSelectAirport={(icao) => { setSelectedAirport(icao); setSelectedPilot(null); setSelectedAirspace(null); }}
        />

        {/* Navaid markers (VOR/NDB/DME) */}
        {vatsimLayers.showNavaids && <NavaidMarkers />}

        {/* Selected VATSIM pilot: altitude-gradient trail (already flown) */}
        {selectedPilot && (
          <PilotTrailLine track={pilotTracks.get(selectedPilot.cid) ?? []} />
        )}

        {/* Selected VATSIM pilot: planned route through waypoints (remaining) */}
        {selectedPilot && selectedPilot.flight_plan?.route && (
          <PilotPlannedRoute
            pilotLat={selectedPilot.latitude}
            pilotLon={selectedPilot.longitude}
            routeString={selectedPilot.flight_plan.route}
            departure={selectedPilot.flight_plan.departure}
            arrival={selectedPilot.flight_plan.arrival}
          />
        )}

        {/* VATSIM pilots */}
        {vatsimSnapshot && vatsimLayers.showPilots && (
          <PilotMarkers
            pilots={vatsimSnapshot.pilots}
            onSelectPilot={(p) => { setSelectedPilot(p); setSelectedAirport(null); setSelectedAirspace(null); }}
          />
        )}

        {/* Live aircraft */}
        {connected && aircraft && (
          <>
            <LiveAircraftMarker aircraft={aircraft} flight={flight} />
            <AircraftTrail aircraft={aircraft} />
          </>
        )}

        {/* Map controls (inside MapContainer so useMap works) */}
        <MapControlButtons connected={connected} panelOpen={detailPanelOpen} />

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

      {/* Detail panels (right side, only one at a time) */}
      {selectedAirport && (
        <AirportDetailPanel
          icao={selectedAirport}
          controllers={vatsimSnapshot?.controllers ?? []}
          pilots={vatsimSnapshot?.pilots ?? []}
          atis={vatsimSnapshot?.atis ?? []}
          onClose={() => setSelectedAirport(null)}
        />
      )}
      {selectedPilot && (
        <PilotDetailPanel
          pilot={selectedPilot}
          onClose={() => setSelectedPilot(null)}
        />
      )}
      {selectedAirspace && (
        <AirspaceDetailPanel
          airspaceId={selectedAirspace.boundaryId}
          airspaceType={selectedAirspace.type}
          feature={selectedAirspace.feature}
          controllers={vatsimSnapshot?.controllers ?? []}
          pilots={vatsimSnapshot?.pilots ?? []}
          atis={vatsimSnapshot?.atis ?? []}
          onClose={() => setSelectedAirspace(null)}
        />
      )}
      {hoveredAirspace && !selectedAirspace && (
        <AirspaceHoverCard
          airspaceId={hoveredAirspace.id}
          airspaceType={hoveredAirspace.type}
          feature={hoveredAirspace.feature}
          controllers={vatsimSnapshot?.controllers ?? []}
          pilots={vatsimSnapshot?.pilots ?? []}
          x={hoveredAirspace.x}
          y={hoveredAirspace.y}
        />
      )}

      {/* Track info card (bottom center, shown when a bid with track data is selected) */}
      {selectedBidId && bidTrack && bidTrack.points.length > 0 && (() => {
        const route = routes.find((r) => r.bid.id === selectedBidId);
        if (!route) return null;
        return (
          <TrackInfoCard
            points={bidTrack.points}
            flightNumber={route.bid.flightNumber}
            depIcao={route.bid.depIcao}
            arrIcao={route.bid.arrIcao}
          />
        );
      })()}
    </div>
  );
}
