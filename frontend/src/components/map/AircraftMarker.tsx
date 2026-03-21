import { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import { getAircraftIcon, getIconSize } from '../../lib/aircraft-icons';

const ACCENT = '#4a9eff';

interface AircraftMarkerProps {
  lat: number;
  lon: number;
  heading: number;
  typeCode?: string | null;
}

const iconCache = new Map<string, L.DivIcon>();

function getIcon(heading: number, typeCode?: string | null): L.DivIcon {
  const info = getAircraftIcon(typeCode);
  const size = Math.max(getIconSize(info), 28); // own aircraft at least 28px
  const headingRound = Math.round(heading / 5) * 5;
  const codeKey = typeCode?.toUpperCase().split('/')[0].trim() || 'generic';
  const key = `own-${codeKey}-${headingRound}`;

  let icon = iconCache.get(key);
  if (!icon) {
    const colored = info.svgRaw
      .replace(/currentColor/g, ACCENT)
      .replace(/fill="currentColor"/g, `fill="${ACCENT}"`);

    icon = L.divIcon({
      html: `<div style="transform: rotate(${headingRound}deg); filter: drop-shadow(0 1px 3px rgba(0,0,0,0.6)); width: ${size}px; height: ${size}px; line-height: 0; color: ${ACCENT};">
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

export function AircraftMarker({ lat, lon, heading, typeCode }: AircraftMarkerProps) {
  const map = useMap();

  useEffect(() => {
    if (lat === 0 && lon === 0) return;

    const icon = getIcon(heading, typeCode);
    const marker = L.marker([lat, lon], { icon }).addTo(map);

    return () => {
      marker.remove();
    };
  }, [lat, lon, heading, typeCode, map]);

  return null;
}
