import { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';

const ACCENT = '#4a9eff';

interface AircraftMarkerProps {
  lat: number;
  lon: number;
  heading: number;
}

export function AircraftMarker({ lat, lon, heading }: AircraftMarkerProps) {
  const map = useMap();

  useEffect(() => {
    if (lat === 0 && lon === 0) return;

    const icon = L.divIcon({
      html: `<div style="transform: rotate(${heading}deg); filter: drop-shadow(0 1px 3px rgba(0,0,0,0.6)); width: 36px; height: 36px; line-height: 0;">
        <svg viewBox="0 0 64 64" width="36" height="36">
          <path d="M32 2C33.2 2 34 3.5 34 5.5L34 22L52 31C53.5 31.8 53.5 33.5 52 34L34 32.5V48L41 53.5C42 54.3 41.8 55.5 41 56L34 54L32.5 58C32.2 59 31.8 59 31.5 58L30 54L23 56C22.2 55.5 22 54.3 23 53.5L30 48V32.5L12 34C10.5 33.5 10.5 31.8 12 31L30 22V5.5C30 3.5 30.8 2 32 2Z" fill="${ACCENT}"/>
        </svg>
      </div>`,
      className: '',
      iconSize: [36, 36],
      iconAnchor: [18, 18],
    });

    const marker = L.marker([lat, lon], { icon }).addTo(map);

    return () => {
      marker.remove();
    };
  }, [lat, lon, heading, map]);

  return null;
}
