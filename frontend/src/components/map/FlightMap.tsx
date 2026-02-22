import { MapContainer, TileLayer } from 'react-leaflet';
import { useTelemetry } from '../../hooks/useTelemetry';
import { AircraftMarker } from './AircraftMarker';
import { RoutePolyline } from './RoutePolyline';
import { WaypointLabels } from './WaypointLabels';
import { VerticalProfile } from './VerticalProfile';
import 'leaflet/dist/leaflet.css';

export function FlightMap() {
  const { aircraft, connected } = useTelemetry();

  const center: [number, number] = aircraft
    ? [aircraft.position.latitude, aircraft.position.longitude]
    : [39.8283, -98.5795]; // Center of US

  return (
    <div className="relative h-full w-full">
      <MapContainer
        center={center}
        zoom={6}
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

        {/* Route polyline */}
        <RoutePolyline />

        {/* Waypoint labels */}
        <WaypointLabels />
      </MapContainer>

      {/* Disconnected overlay */}
      {!connected && (
        <div className="absolute inset-0 flex items-center justify-center bg-acars-bg/80 z-[1000] pb-24">
          <div className="text-center flex flex-col items-center">
            <img src="/logos/chevron-light.png" alt="SMA" className="h-10 w-auto opacity-15 mb-3" />
            <div className="text-acars-muted text-sm">Simulator Disconnected</div>
            <div className="text-acars-muted/50 text-xs mt-1">Waiting for MSFS connection...</div>
          </div>
        </div>
      )}

      {/* Vertical profile strip at bottom */}
      <div className="absolute bottom-0 left-0 right-0 z-[1000]">
        <VerticalProfile />
      </div>
    </div>
  );
}
