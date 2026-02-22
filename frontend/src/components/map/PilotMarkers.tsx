import { useMemo, useState, useCallback } from 'react';
import { Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import type { VatsimPilot } from '@acars/shared';

// ── Constants ────────────────────────────────────────────────

const PILOT_SIZE = 20;
const PILOT_COLOR = '#4a9eff';
const LOW_ZOOM_THRESHOLD = 5;

/** Small rotated plane SVG for VATSIM pilots */
function pilotIcon(heading: number): L.DivIcon {
  const svg = `<svg viewBox="0 0 64 64" width="${PILOT_SIZE}" height="${PILOT_SIZE}" style="transform:rotate(${heading}deg);filter:drop-shadow(0 1px 2px rgba(0,0,0,0.5));">
    <path d="M32 2 C33 2 34 3 34 5 L34 20 L54 30 C56 31 56 33 55 34 L34 32 L34 48 L42 54 C43 55 43 56 42 57 L34 55 L33 58 C32.5 59 31.5 59 31 58 L30 55 L22 57 C21 56 21 55 22 54 L30 48 L30 32 L9 34 C8 33 8 31 10 30 L30 20 L30 5 C30 3 31 2 32 2 Z" fill="${PILOT_COLOR}" stroke="rgba(0,0,0,0.3)" stroke-width="0.5"/>
  </svg>`;

  return L.divIcon({
    html: svg,
    className: '',
    iconSize: [PILOT_SIZE, PILOT_SIZE],
    iconAnchor: [PILOT_SIZE / 2, PILOT_SIZE / 2],
  });
}

// Cache icons by heading (rounded to nearest 5 degrees)
const iconCache = new Map<number, L.DivIcon>();
function getCachedIcon(heading: number): L.DivIcon {
  const rounded = Math.round(heading / 5) * 5;
  let icon = iconCache.get(rounded);
  if (!icon) {
    icon = pilotIcon(rounded);
    iconCache.set(rounded, icon);
  }
  return icon;
}

// ── Component ────────────────────────────────────────────────

interface Props {
  pilots: VatsimPilot[];
  onSelectPilot: (pilot: VatsimPilot) => void;
}

export function PilotMarkers({ pilots, onSelectPilot }: Props) {
  const [bounds, setBounds] = useState<L.LatLngBounds | null>(null);
  const [zoom, setZoom] = useState(4);

  const updateView = useCallback((map: L.Map) => {
    setBounds(map.getBounds());
    setZoom(map.getZoom());
  }, []);

  const map = useMapEvents({
    moveend: () => updateView(map),
    zoomend: () => updateView(map),
    load: () => updateView(map),
  });

  // Initialize bounds on first render
  if (!bounds) {
    // Schedule for next tick so map is ready
    setTimeout(() => updateView(map), 0);
  }

  // Filter pilots to visible viewport + zoom-based density control
  const visiblePilots = useMemo(() => {
    if (!bounds) return [];

    const filtered = pilots.filter((p) => {
      // Must be within viewport
      if (!bounds.contains([p.latitude, p.longitude])) return false;
      // At low zoom, only show pilots with flight plans (reduces clutter)
      if (zoom < LOW_ZOOM_THRESHOLD && !p.flight_plan) return false;
      return true;
    });

    return filtered;
  }, [pilots, bounds, zoom]);

  return (
    <>
      {visiblePilots.map((pilot) => (
        <Marker
          key={pilot.cid}
          position={[pilot.latitude, pilot.longitude]}
          icon={getCachedIcon(pilot.heading)}
          eventHandlers={{
            click: () => onSelectPilot(pilot),
          }}
        />
      ))}
    </>
  );
}
