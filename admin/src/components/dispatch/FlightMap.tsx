import { useEffect, useRef, memo } from 'react';
import { MapContainer, TileLayer, Marker, Tooltip, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import type { ActiveFlightHeartbeat, TrackPoint } from '@acars/shared';
import 'leaflet/dist/leaflet.css';

/* ── Aircraft icon factory ─────────────────────────────────── */

const PLANE_SVG = (heading: number, size: number, color: string) => `
  <svg viewBox="0 0 64 64" width="${size}" height="${size}" style="transform: rotate(${heading}deg); filter: drop-shadow(0 1px 3px rgba(0,0,0,0.6)) drop-shadow(0 0 6px ${color}60);">
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

const iconCache = new Map<string, L.DivIcon>();

function getFlightIcon(heading: number, selected: boolean): L.DivIcon {
  const rounded = Math.round(heading / 5) * 5;
  const key = `${rounded}-${selected}`;
  let icon = iconCache.get(key);
  if (!icon) {
    const color = selected ? '#facc15' : '#3b82f6';
    const size = selected ? 32 : 24;
    icon = L.divIcon({
      html: PLANE_SVG(rounded, size, color),
      className: '',
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
    });
    iconCache.set(key, icon);
  }
  return icon;
}

/* ── Auto-fit bounds to flights ────────────────────────────── */

function FitFlights({ flights }: { flights: ActiveFlightHeartbeat[] }) {
  const map = useMap();
  const fittedRef = useRef(false);

  useEffect(() => {
    if (fittedRef.current || flights.length === 0) return;
    const valid = flights.filter((f) => f.latitude !== 0 || f.longitude !== 0);
    if (valid.length === 0) return;

    fittedRef.current = true;
    if (valid.length === 1) {
      map.setView([valid[0].latitude, valid[0].longitude], 6, { animate: true });
    } else {
      const bounds = L.latLngBounds(valid.map((f) => [f.latitude, f.longitude] as [number, number]));
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 8 });
    }
  }, [map, flights]);

  return null;
}

/* ── Trail polyline ────────────────────────────────────────── */

const TrailLine = memo(function TrailLine({ trail }: { trail: TrackPoint[] }) {
  if (trail.length < 2) return null;
  const positions = trail.map((p) => [p.lat, p.lon] as [number, number]);
  return (
    <Polyline
      positions={positions}
      pathOptions={{ color: '#3b82f6', weight: 2, opacity: 0.5, dashArray: '4 3' }}
    />
  );
});

/* ── Main FlightMap component ──────────────────────────────── */

interface FlightMapProps {
  flights: ActiveFlightHeartbeat[];
  selectedCallsign: string | null;
  onSelectFlight: (flight: ActiveFlightHeartbeat) => void;
  trail: TrackPoint[];
}

export const FlightMap = memo(function FlightMap({
  flights,
  selectedCallsign,
  onSelectFlight,
  trail,
}: FlightMapProps) {
  return (
    <div className="h-full w-full" style={{ background: '#000000' }}>
      <MapContainer
        center={[30, -20]}
        zoom={3}
        className="h-full w-full"
        zoomControl={false}
        attributionControl={false}
        style={{ background: '#000000' }}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          maxZoom={19}
        />

        <FitFlights flights={flights} />

        {/* Trail for selected flight */}
        <TrailLine trail={trail} />

        {/* Airline flight markers */}
        {flights
          .filter((f) => f.latitude !== 0 || f.longitude !== 0)
          .map((flight) => {
            const isSelected = flight.callsign === selectedCallsign;
            return (
              <Marker
                key={flight.callsign}
                position={[flight.latitude, flight.longitude]}
                icon={getFlightIcon(flight.heading, isSelected)}
                eventHandlers={{ click: () => onSelectFlight(flight) }}
              >
                <Tooltip direction="top" offset={[0, -12]} opacity={0.95}>
                  <div style={{ fontFamily: 'Inter, system-ui, sans-serif', fontSize: 11, lineHeight: 1.5 }}>
                    <div style={{ fontWeight: 600, color: isSelected ? '#facc15' : '#3b82f6' }}>
                      {flight.callsign}
                    </div>
                    <div style={{ color: '#9ca3af' }}>
                      {flight.aircraftType} · FL{Math.round(flight.altitude / 100)} · {Math.round(flight.groundSpeed)}kt
                    </div>
                    {flight.phase && (
                      <div style={{ color: '#6b7280', fontSize: 10 }}>
                        {flight.phase.replace('_', ' ')}
                      </div>
                    )}
                  </div>
                </Tooltip>
              </Marker>
            );
          })}
      </MapContainer>
    </div>
  );
});
