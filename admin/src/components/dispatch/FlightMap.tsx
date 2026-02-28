import { useEffect, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import type { ActiveFlightHeartbeat, TrackPoint } from '@acars/shared';
import 'leaflet/dist/leaflet.css';

const ACCENT = '#3b82f6';
const SELECTED_COLOR = '#facc15'; // yellow for selected

/* ── Aircraft SVG (simple plane silhouette) ──────────────────── */

function makeAircraftSvg(color: string) {
  return `<svg viewBox="0 0 64 64" width="28" height="28" xmlns="http://www.w3.org/2000/svg">
    <path d="M32 2C33.2 2 34 3.5 34 5.5L34 22L52 31C53.5 31.8 53.5 33.5 52 34L34 32.5V48L41 53.5C42 54.3 41.8 55.5 41 56L34 54L32.5 58C32.2 59 31.8 59 31.5 58L30 54L23 56C22.2 55.5 22 54.3 23 53.5L30 48V32.5L12 34C10.5 33.5 10.5 31.8 12 31L30 22V5.5C30 3.5 30.8 2 32 2Z" fill="${color}"/>
  </svg>`;
}

function makeIcon(heading: number, selected: boolean) {
  const color = selected ? SELECTED_COLOR : ACCENT;
  return L.divIcon({
    html: `<div style="transform: rotate(${heading}deg); filter: drop-shadow(0 1px 4px rgba(0,0,0,0.7)); width: 28px; height: 28px; line-height: 0;">
      ${makeAircraftSvg(color)}
    </div>`,
    className: '',
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

/* ── Markers layer ───────────────────────────────────────────── */

interface MarkersProps {
  flights: ActiveFlightHeartbeat[];
  selectedCallsign: string | null;
  onSelectFlight: (flight: ActiveFlightHeartbeat) => void;
}

function AircraftMarkers({ flights, selectedCallsign, onSelectFlight }: MarkersProps) {
  const map = useMap();
  const markersRef = useRef<Map<string, L.Marker>>(new Map());

  useEffect(() => {
    const existing = markersRef.current;
    const currentCallsigns = new Set(flights.map((f) => f.callsign));

    // Remove markers for flights that are no longer present
    for (const [cs, marker] of existing) {
      if (!currentCallsigns.has(cs)) {
        marker.remove();
        existing.delete(cs);
      }
    }

    // Add or update markers
    for (const flight of flights) {
      if (flight.latitude === 0 && flight.longitude === 0) continue;
      const isSelected = flight.callsign === selectedCallsign;
      const icon = makeIcon(flight.heading, isSelected);

      const existingMarker = existing.get(flight.callsign);
      if (existingMarker) {
        existingMarker.setLatLng([flight.latitude, flight.longitude]);
        existingMarker.setIcon(icon);
        existingMarker.setZIndexOffset(isSelected ? 1000 : 0);
      } else {
        const marker = L.marker([flight.latitude, flight.longitude], {
          icon,
          zIndexOffset: isSelected ? 1000 : 0,
        })
          .addTo(map)
          .bindTooltip(flight.callsign, {
            permanent: false,
            direction: 'top',
            offset: [0, -14],
            className: 'aircraft-tooltip',
          });

        marker.on('click', () => onSelectFlight(flight));
        existing.set(flight.callsign, marker);
      }
    }

    return () => {
      // cleanup all on unmount
    };
  }, [flights, selectedCallsign, map, onSelectFlight]);

  // Full cleanup on component unmount
  useEffect(() => {
    return () => {
      for (const marker of markersRef.current.values()) {
        marker.remove();
      }
      markersRef.current.clear();
    };
  }, []);

  return null;
}

/* ── Trail line ──────────────────────────────────────────────── */

interface TrailProps {
  trail: TrackPoint[];
}

function TrailLine({ trail }: TrailProps) {
  const positions = useMemo(
    () => trail.map((p) => [p.lat, p.lon] as [number, number]),
    [trail],
  );

  if (positions.length < 2) return null;

  return (
    <Polyline
      positions={positions}
      pathOptions={{ color: ACCENT, weight: 2, opacity: 0.7, dashArray: '6 4' }}
    />
  );
}

/* ── Main map component ──────────────────────────────────────── */

interface FlightMapProps {
  flights: ActiveFlightHeartbeat[];
  selectedCallsign: string | null;
  onSelectFlight: (flight: ActiveFlightHeartbeat) => void;
  trail: TrackPoint[];
}

export function FlightMap({ flights, selectedCallsign, onSelectFlight, trail }: FlightMapProps) {
  return (
    <MapContainer
      center={[30, -10]}
      zoom={3}
      className="h-full w-full"
      zoomControl={false}
      attributionControl={false}
    >
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        subdomains="abcd"
        maxZoom={19}
      />
      <AircraftMarkers
        flights={flights}
        selectedCallsign={selectedCallsign}
        onSelectFlight={onSelectFlight}
      />
      <TrailLine trail={trail} />
    </MapContainer>
  );
}
