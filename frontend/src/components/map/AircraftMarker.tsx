import { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';

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
      html: `<svg viewBox="0 0 64 64" width="36" height="36" style="transform: rotate(${heading}deg); filter: drop-shadow(0 1px 3px rgba(0,0,0,0.6));">
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
          fill="white" stroke="rgba(0,0,0,0.3)" stroke-width="0.5"/>
      </svg>`,
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
