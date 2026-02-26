import { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import { useTelemetry } from '../../hooks/useTelemetry';
import { useDispatchEdit } from '../../contexts/DispatchEditContext';
import { useFlightPlanStore } from '../../stores/flightPlanStore';
import { AircraftMarker } from './AircraftMarker';
import { RoutePolyline } from './RoutePolyline';
import { WaypointLabels } from './WaypointLabels';
import { VerticalProfile } from './VerticalProfile';
import { GroundChartOverlay } from './GroundChartOverlay';
import 'leaflet/dist/leaflet.css';

/** Fit map bounds to flight plan route when waypoints change. */
function FitRoute() {
  const map = useMap();
  const flightPlan = useFlightPlanStore((s) => s.flightPlan);
  const fittedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!flightPlan || flightPlan.waypoints.length < 2) return;

    // Only auto-fit once per flight plan (keyed by id) so user can still pan/zoom freely
    if (fittedRef.current === flightPlan.id) return;
    fittedRef.current = flightPlan.id;

    const bounds = L.latLngBounds(
      flightPlan.waypoints.map((wp) => [wp.latitude, wp.longitude] as [number, number]),
    );
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 8 });
  }, [map, flightPlan]);

  return null;
}

export function FlightMap() {
  const telemetry = useTelemetry();
  const { isOwnFlight } = useDispatchEdit();
  const aircraft = isOwnFlight ? telemetry.aircraft : null;
  const connected = isOwnFlight ? telemetry.connected : false;

  return (
    <div className="relative h-full w-full">
      <MapContainer
        center={[39.8283, -98.5795]}
        zoom={5}
        className="h-full w-full"
        zoomControl={false}
        attributionControl={false}
        style={{ background: 'var(--bg-app)' }}
      >
        {/* Dark aviation-style tiles */}
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          maxZoom={19}
        />

        {/* Aircraft position marker */}
        {connected && aircraft && (
          <AircraftMarker
            lat={aircraft.position.latitude}
            lon={aircraft.position.longitude}
            heading={aircraft.position.heading}
          />
        )}

        {/* Auto-fit route bounds */}
        <FitRoute />

        {/* Route polyline */}
        <RoutePolyline />

        {/* Waypoint labels */}
        <WaypointLabels />

        {/* Ground chart overlay (appears at high zoom) */}
        <GroundChartOverlay />
      </MapContainer>

      {/* Sim-disconnected badge — small indicator, doesn't hide the route */}
      {!connected && (
        <div className="absolute top-2 right-2 z-[1001] bg-acars-panel/90 border border-acars-border rounded-md px-2.5 py-1.5 flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
          <span className="text-[10px] text-acars-muted font-sans">Sim Offline</span>
        </div>
      )}

      {/* Vertical profile strip at bottom — 18% of map height, min 80px */}
      <div className="absolute bottom-0 left-0 right-0 z-[1000] h-[18%] min-h-[80px]">
        <VerticalProfile />
      </div>
    </div>
  );
}
