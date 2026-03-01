import { useEffect, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import { useNavigate } from 'react-router-dom';
import L from 'leaflet';
import type { ActiveFlightHeartbeat } from '@acars/shared';
import 'leaflet/dist/leaflet.css';

const ACCENT = '#3b82f6';

function makeAircraftSvg(color: string) {
  return `<svg viewBox="0 0 64 64" width="28" height="28" xmlns="http://www.w3.org/2000/svg">
    <path d="M32 2C33.2 2 34 3.5 34 5.5L34 22L52 31C53.5 31.8 53.5 33.5 52 34L34 32.5V48L41 53.5C42 54.3 41.8 55.5 41 56L34 54L32.5 58C32.2 59 31.8 59 31.5 58L30 54L23 56C22.2 55.5 22 54.3 23 53.5L30 48V32.5L12 34C10.5 33.5 10.5 31.8 12 31L30 22V5.5C30 3.5 30.8 2 32 2Z" fill="${color}"/>
  </svg>`;
}

function makeIcon(heading: number) {
  return L.divIcon({
    html: `<div style="transform: rotate(${heading}deg); filter: drop-shadow(0 1px 4px rgba(0,0,0,0.7)); width: 28px; height: 28px; line-height: 0;">
      ${makeAircraftSvg(ACCENT)}
    </div>`,
    className: '',
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

interface MarkersProps {
  flights: ActiveFlightHeartbeat[];
}

function AircraftMarkers({ flights }: MarkersProps) {
  const map = useMap();
  const navigate = useNavigate();
  const markersRef = useRef<Map<string, L.Marker>>(new Map());

  const handleClick = useCallback(() => {
    navigate('/dispatch');
  }, [navigate]);

  useEffect(() => {
    const existing = markersRef.current;
    const currentCallsigns = new Set(flights.map((f) => f.callsign));

    for (const [cs, marker] of existing) {
      if (!currentCallsigns.has(cs)) {
        marker.remove();
        existing.delete(cs);
      }
    }

    for (const flight of flights) {
      if (flight.latitude === 0 && flight.longitude === 0) continue;
      const icon = makeIcon(flight.heading);

      const existingMarker = existing.get(flight.callsign);
      if (existingMarker) {
        existingMarker.setLatLng([flight.latitude, flight.longitude]);
        existingMarker.setIcon(icon);
      } else {
        const marker = L.marker([flight.latitude, flight.longitude], { icon })
          .addTo(map)
          .bindTooltip(flight.callsign, {
            permanent: false,
            direction: 'top',
            offset: [0, -14],
            className: 'aircraft-tooltip',
          });
        marker.on('click', handleClick);
        existing.set(flight.callsign, marker);
      }
    }
  }, [flights, map, handleClick]);

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

interface DashboardMapProps {
  flights: ActiveFlightHeartbeat[];
}

export function DashboardMap({ flights }: DashboardMapProps) {
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
      <AircraftMarkers flights={flights} />
    </MapContainer>
  );
}
