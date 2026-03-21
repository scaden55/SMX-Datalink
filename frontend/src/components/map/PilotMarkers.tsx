import { useMemo, useState, useCallback } from 'react';
import { Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import type { VatsimPilot } from '@acars/shared';
import { getAircraftIcon, getIconSize } from '../../lib/aircraft-icons';

// ── Constants ────────────────────────────────────────────────

const PILOT_COLOR = '#4a9eff';
const LOW_ZOOM_THRESHOLD = 5;

// ── Icon factory ─────────────────────────────────────────────

/**
 * Build a Leaflet DivIcon that renders the aircraft SVG inline.
 * Handles both the old 64×64 viewBox category SVGs and the new
 * RexKramer type-specific SVGs (80×80mm viewBox with varying offsets).
 */
function buildIcon(svgRaw: string, size: number, heading: number): L.DivIcon {
  const colored = svgRaw
    .replace(/currentColor/g, PILOT_COLOR)
    .replace(/fill="currentColor"/g, `fill="${PILOT_COLOR}"`);

  const html = `<div style="
    transform: rotate(${heading}deg);
    filter: drop-shadow(0 1px 3px rgba(0,0,0,0.6));
    width: ${size}px;
    height: ${size}px;
    line-height: 0;
    color: ${PILOT_COLOR};
  "><div style="width:${size}px;height:${size}px;">${colored}</div></div>`;

  return L.divIcon({
    html,
    className: '',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

// ── Icon cache ───────────────────────────────────────────────
// Key: `${typeCode}-${headingRounded5}-${size}`

const iconCache = new Map<string, L.DivIcon>();

function getCachedIcon(pilot: VatsimPilot): L.DivIcon {
  const typeCode = pilot.flight_plan?.aircraft_short ?? null;
  const info = getAircraftIcon(typeCode);
  const size = getIconSize(info);
  const headingRound = Math.round(pilot.heading / 5) * 5;
  // Use the actual type code in the key so each aircraft type gets its own cached icon
  const codeKey = typeCode?.toUpperCase().split('/')[0].trim() || 'generic';
  const key = `${codeKey}-${headingRound}-${size}`;

  let icon = iconCache.get(key);
  if (!icon) {
    icon = buildIcon(info.svgRaw, size, headingRound);
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
