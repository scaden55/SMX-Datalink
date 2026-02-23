import { useMemo, useState, useCallback } from 'react';
import { Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import type { VatsimPilot } from '@acars/shared';
import { getAircraftIcon, getIconSize, type AircraftCategory } from '../../lib/aircraft-icons';

// ── Constants ────────────────────────────────────────────────

const PILOT_COLOR = '#4a9eff';
const LOW_ZOOM_THRESHOLD = 5;

// ── Icon factory ─────────────────────────────────────────────

/**
 * Build a Leaflet DivIcon that renders the aircraft SVG as an <img>,
 * tinted via CSS filter, rotated to the pilot's heading.
 *
 * We use an <img> tag with the Vite-resolved SVG URL and apply
 * a CSS brightness/sepia/hue-rotate filter chain to tint it blue.
 * This keeps the SVG crisp at any size while allowing color control.
 */
function buildIcon(svgUrl: string, size: number, heading: number): L.DivIcon {
  // CSS filter to tint "currentColor" (black) SVGs to our pilot blue (#4a9eff)
  // brightness(0) → black, then saturate + invert + sepia + hue-rotate → blue
  const html = `<img
    src="${svgUrl}"
    width="${size}" height="${size}"
    style="
      transform: rotate(${heading}deg);
      filter: drop-shadow(0 1px 2px rgba(0,0,0,0.5))
              brightness(0) saturate(100%) invert(55%) sepia(70%) saturate(500%) hue-rotate(190deg) brightness(105%);
      display: block;
    "
    draggable="false"
    alt=""
  />`;

  return L.divIcon({
    html,
    className: 'pilot-marker-icon',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

// ── Icon cache ───────────────────────────────────────────────
// Key: `${category}-${headingRounded5}-${size}`

const iconCache = new Map<string, L.DivIcon>();

function getCachedIcon(pilot: VatsimPilot): L.DivIcon {
  const typeCode = pilot.flight_plan?.aircraft_short ?? null;
  const info = getAircraftIcon(typeCode);
  const size = getIconSize(info);
  const headingRound = Math.round(pilot.heading / 5) * 5;
  const key = `${info.category}-${headingRound}-${size}`;

  let icon = iconCache.get(key);
  if (!icon) {
    icon = buildIcon(info.svgUrl, size, headingRound);
    iconCache.set(key, icon);
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
    setTimeout(() => updateView(map), 0);
  }

  // Filter pilots to visible viewport + zoom-based density control
  const visiblePilots = useMemo(() => {
    if (!bounds) return [];

    return pilots.filter((p) => {
      if (!bounds.contains([p.latitude, p.longitude])) return false;
      if (zoom < LOW_ZOOM_THRESHOLD && !p.flight_plan) return false;
      return true;
    });
  }, [pilots, bounds, zoom]);

  return (
    <>
      {visiblePilots.map((pilot) => (
        <Marker
          key={pilot.cid}
          position={[pilot.latitude, pilot.longitude]}
          icon={getCachedIcon(pilot)}
          eventHandlers={{
            click: () => onSelectPilot(pilot),
          }}
        />
      ))}
    </>
  );
}
