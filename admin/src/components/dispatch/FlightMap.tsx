import { useEffect, useRef, memo } from 'react';
import { MapContainer, TileLayer, Marker, Tooltip, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import type { ActiveFlightHeartbeat, TrackPoint } from '@acars/shared';
import { getAircraftIcon, getIconSize } from '@/lib/aircraft-icons';
import 'leaflet/dist/leaflet.css';

/* ── Aircraft icon factory (type-specific SVG shapes) ──────── */

const iconCache = new Map<string, L.DivIcon>();

function getFlightIcon(heading: number, selected: boolean, aircraftType?: string): L.DivIcon {
  const rounded = Math.round(heading / 5) * 5;
  const codeKey = aircraftType?.toUpperCase().split('/')[0].trim() || 'generic';
  const key = `${codeKey}-${rounded}-${selected}`;

  let icon = iconCache.get(key);
  if (!icon) {
    const color = selected ? '#facc15' : '#4F6CCD';
    const info = getAircraftIcon(aircraftType);
    const baseSize = selected ? 32 : 24;
    const size = Math.max(getIconSize(info.sizeCoef), baseSize);
    const colored = info.svgRaw
      .replace(/currentColor/g, color)
      .replace(/fill="currentColor"/g, `fill="${color}"`);

    icon = L.divIcon({
      html: `<div style="transform:rotate(${rounded}deg);filter:drop-shadow(0 1px 3px rgba(0,0,0,0.6)) drop-shadow(0 0 6px ${color}60);width:${size}px;height:${size}px;line-height:0;color:${color};">
        <div style="width:${size}px;height:${size}px;">${colored}</div>
      </div>`,
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
      pathOptions={{ color: '#4F6CCD', weight: 2, opacity: 0.5, dashArray: '4 3' }}
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
    <div className="h-full w-full" style={{ background: 'var(--surface-0)' }}>
      <MapContainer
        center={[30, -20]}
        zoom={3}
        className="h-full w-full"
        zoomControl={false}
        attributionControl={false}
        style={{ background: 'var(--surface-0)' }}
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
                icon={getFlightIcon(flight.heading, isSelected, flight.aircraftType)}
                eventHandlers={{ click: () => onSelectFlight(flight) }}
              >
                <Tooltip direction="top" offset={[0, -12]} opacity={0.95}>
                  <div style={{ fontFamily: 'ui-monospace, Cascadia Mono, Consolas, monospace', fontSize: 11, lineHeight: 1.5, fontVariantNumeric: 'tabular-nums' }}>
                    <div style={{ fontWeight: 700, color: isSelected ? '#facc15' : '#4F6CCD', letterSpacing: '0.04em' }}>
                      {flight.callsign}
                    </div>
                    <div style={{ color: 'var(--text-secondary)', fontSize: 10 }}>
                      {flight.aircraftType} · FL{Math.round(flight.altitude / 100).toString().padStart(3, '0')} · {Math.round(flight.groundSpeed).toString().padStart(3, '0')}kt
                    </div>
                    {flight.phase && (
                      <div style={{ color: 'var(--text-tertiary)', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
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
