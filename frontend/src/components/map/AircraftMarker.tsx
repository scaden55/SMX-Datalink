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
      html: `<svg viewBox="0 0 24 24" width="28" height="28" style="transform: rotate(${heading}deg);">
        <path d="M12 2 L14 10 L20 12 L14 14 L12 22 L10 14 L4 12 L10 10 Z"
          fill="#79c0ff" stroke="#0d1117" stroke-width="0.5"/>
      </svg>`,
      className: '',
      iconSize: [28, 28],
      iconAnchor: [14, 14],
    });

    const marker = L.marker([lat, lon], { icon }).addTo(map);

    return () => {
      marker.remove();
    };
  }, [lat, lon, heading, map]);

  return null;
}
