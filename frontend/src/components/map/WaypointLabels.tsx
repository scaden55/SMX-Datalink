import { Marker, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import type { Waypoint } from '@acars/shared';
import { useFlightPlanStore } from '../../stores/flightPlanStore';

const CLR_CLIMB = '#d2a8ff';
const CLR_CRUISE = '#58a6ff';
const CLR_DESCENT = '#3fb950';

const SZ = 10;
const FILL = 'var(--bg-panel)';
const SW = 1.5;

/** SVG shape markup per waypoint type */
function shapeIcon(wpType: Waypoint['type'], color: string): L.DivIcon {
  let svg: string;
  const half = SZ / 2;

  switch (wpType) {
    case 'airport': // Square
      svg = `<rect x="1" y="1" width="${SZ - 2}" height="${SZ - 2}" fill="${FILL}" stroke="${color}" stroke-width="${SW}"/>`;
      break;
    case 'vor': { // Hexagon
      const pts = Array.from({ length: 6 }, (_, i) => {
        const a = (Math.PI / 3) * i - Math.PI / 2;
        return `${half + (half - 1) * Math.cos(a)},${half + (half - 1) * Math.sin(a)}`;
      }).join(' ');
      svg = `<polygon points="${pts}" fill="${FILL}" stroke="${color}" stroke-width="${SW}"/>`;
      break;
    }
    case 'ndb': // Circle
      svg = `<circle cx="${half}" cy="${half}" r="${half - 1}" fill="${FILL}" stroke="${color}" stroke-width="${SW}"/>`;
      break;
    case 'gps': // Diamond
      svg = `<polygon points="${half},1 ${SZ - 1},${half} ${half},${SZ - 1} 1,${half}" fill="${FILL}" stroke="${color}" stroke-width="${SW}"/>`;
      break;
    default: // Triangle — intersection/fix
      svg = `<polygon points="${half},1 ${SZ - 1},${SZ - 1} 1,${SZ - 1}" fill="${FILL}" stroke="${color}" stroke-width="${SW}"/>`;
      break;
  }

  return L.divIcon({
    html: `<svg width="${SZ}" height="${SZ}" viewBox="0 0 ${SZ} ${SZ}">${svg}</svg>`,
    className: '',
    iconSize: [SZ, SZ],
    iconAnchor: [half, half],
  });
}

export function WaypointLabels() {
  const flightPlan = useFlightPlanStore((s) => s.flightPlan);

  if (!flightPlan || flightPlan.waypoints.length < 2) return null;

  const wps = flightPlan.waypoints;

  // Phase detection for coloring
  const maxAlt = Math.max(...wps.map((w) => w.altitude ?? 0));
  const threshold = maxAlt * 0.90;
  let tocIndex = 0;
  let todIndex = wps.length - 1;
  for (let i = 0; i < wps.length; i++) {
    if ((wps[i].altitude ?? 0) >= threshold) { tocIndex = i; break; }
  }
  for (let i = wps.length - 1; i >= 0; i--) {
    if ((wps[i].altitude ?? 0) >= threshold) { todIndex = i; break; }
  }

  return (
    <>
      {wps.map((wp, i) => {
        const color = i < tocIndex ? CLR_CLIMB : i > todIndex ? CLR_DESCENT : CLR_CRUISE;
        return (
          <Marker
            key={`${wp.ident}-${i}`}
            position={[wp.latitude, wp.longitude]}
            icon={shapeIcon(wp.type, color)}
          >
            <Tooltip
              permanent
              direction="top"
              offset={[0, -6]}
              className="!bg-transparent !border-none !shadow-none !text-[10px] !text-blue-400 !tabular-nums !p-0"
            >
              {wp.ident}
            </Tooltip>
          </Marker>
        );
      })}
    </>
  );
}
