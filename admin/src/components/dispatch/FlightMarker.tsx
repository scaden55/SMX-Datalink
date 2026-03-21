import { useMemo } from 'react';
import L from 'leaflet';
import { Marker } from 'react-leaflet';
import type { DispatchMapFlight } from '@/pages/DispatchMapPage';
import { getAircraftIcon, getIconSize } from '@/lib/aircraft-icons';

interface FlightMarkerProps {
  flight: DispatchMapFlight;
  isSelected: boolean;
  onClick: () => void;
}

/* ── Phase dot colors ──────────────────────────────────────────── */

const PHASE_COLORS = {
  flying: '#22c55e',
  planning: '#f59e0b',
  completed: '#6b7280',
} as const;

const PHASE_COLORS_BRIGHT = {
  flying: '#4ade80',
  planning: '#fbbf24',
  completed: '#9ca3af',
} as const;

/* ── Position helpers ──────────────────────────────────────────── */

function getFlightPosition(f: DispatchMapFlight): [number, number] | null {
  if (f.phase === 'flying') {
    if (f.latitude != null && f.longitude != null) return [f.latitude, f.longitude];
    return null;
  }
  if (f.phase === 'planning') {
    if (f.depLat != null && f.depLon != null) return [f.depLat, f.depLon];
    return null;
  }
  // completed
  if (f.arrLat != null && f.arrLon != null) return [f.arrLat, f.arrLon];
  return null;
}

/* ── Icon builders ─────────────────────────────────────────────── */

function buildFlyingIcon(flight: DispatchMapFlight, isSelected: boolean): L.DivIcon {
  const { svgRaw, sizeCoef } = getAircraftIcon(flight.aircraftType);
  const baseSize = getIconSize(sizeCoef);
  const size = isSelected ? baseSize + 8 : baseSize;
  const heading = flight.heading ?? 0;

  // Colorize SVG: replace fill/stroke with green tint
  const color = isSelected ? PHASE_COLORS_BRIGHT.flying : PHASE_COLORS.flying;
  const coloredSvg = svgRaw
    .replace(/fill="[^"]*"/g, `fill="${color}"`)
    .replace(/currentColor/g, color);

  const glow = isSelected
    ? `filter: drop-shadow(0 0 6px rgba(99, 132, 230, 0.8)) drop-shadow(0 0 12px rgba(99, 132, 230, 0.4));`
    : '';

  const html = `<div style="
    width: ${size}px;
    height: ${size}px;
    transform: rotate(${heading}deg);
    ${glow}
    transition: transform 0.3s ease;
  ">${coloredSvg}</div>`;

  return L.divIcon({
    className: '',
    html,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

function buildDotIcon(
  phase: 'planning' | 'completed',
  isSelected: boolean,
): L.DivIcon {
  const isPlanning = phase === 'planning';
  const baseSize = isPlanning ? 12 : 10;
  const size = isSelected ? baseSize + 4 : baseSize;
  const color = isSelected
    ? PHASE_COLORS_BRIGHT[phase]
    : PHASE_COLORS[phase];
  const opacity = phase === 'completed' && !isSelected ? 0.6 : 1;
  const border = isSelected ? `2px solid ${color}` : 'none';
  const shadow = isSelected ? `0 0 6px ${color}` : 'none';

  const html = `<div style="
    width: ${size}px;
    height: ${size}px;
    border-radius: 50%;
    background: ${color};
    opacity: ${opacity};
    border: ${border};
    box-shadow: ${shadow};
  "></div>`;

  return L.divIcon({
    className: '',
    html,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

/* ── Component ─────────────────────────────────────────────────── */

export function FlightMarker({ flight, isSelected, onClick }: FlightMarkerProps) {
  const position = getFlightPosition(flight);
  if (!position) return null;

  const icon = useMemo(() => {
    if (flight.phase === 'flying') {
      return buildFlyingIcon(flight, isSelected);
    }
    return buildDotIcon(flight.phase, isSelected);
    // Re-create icon when these change
  }, [flight.phase, flight.heading, flight.aircraftType, isSelected]);

  return (
    <Marker
      position={position}
      icon={icon}
      zIndexOffset={isSelected ? 1000 : flight.phase === 'flying' ? 100 : 0}
      eventHandlers={{ click: onClick }}
    />
  );
}
