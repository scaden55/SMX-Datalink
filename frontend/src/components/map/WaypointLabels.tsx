import { Marker, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import type { Waypoint } from '@acars/shared';
import { useFlightPlanStore } from '../../stores/flightPlanStore';
import { findTocTod, isTocTod } from '../../lib/flight-phases';

const CLR_CLIMB = '#d2a8ff';
const CLR_CRUISE = '#58a6ff';
const CLR_DESCENT = '#3fb950';

/** TOC/TOD diamond icon — solid fill with black stroke */
function tocTodDiamond(color: string): L.DivIcon {
  return L.divIcon({
    html: `<svg viewBox="0 0 14 14" width="14" height="14"><polygon points="7,1 13,7 7,13 1,7" fill="${color}" stroke="#000" stroke-width="1.5"/></svg>`,
    className: '',
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });
}

/** ForeFlight-style SVG shape per waypoint type, colored by flight phase */
function shapeIcon(wpType: Waypoint['type'], color: string): L.DivIcon {
  let html: string;

  switch (wpType) {
    case 'airport': // Aerodrome: circle with 4 protruding ticks
      html = `<svg viewBox="0 0 24 24" width="20" height="20">
        <circle cx="12" cy="12" r="6" fill="none" stroke="#000" stroke-width="1.5"/>
        <circle cx="12" cy="12" r="6" fill="none" stroke="${color}" stroke-width="2.5"/>
        <rect x="10" y="0" width="4" height="5" fill="${color}" stroke="#000" stroke-width="0.5"/>
        <rect x="10" y="19" width="4" height="5" fill="${color}" stroke="#000" stroke-width="0.5"/>
        <rect x="0" y="10" width="5" height="4" fill="${color}" stroke="#000" stroke-width="0.5"/>
        <rect x="19" y="10" width="5" height="4" fill="${color}" stroke="#000" stroke-width="0.5"/>
      </svg>`;
      return L.divIcon({ html, className: '', iconSize: [20, 20], iconAnchor: [10, 10] });

    case 'vor': // Solid hexagon with black center dot
      html = `<svg viewBox="0 0 20 20" width="18" height="18">
        <polygon points="10,1 18,5.5 18,14.5 10,19 2,14.5 2,5.5" fill="${color}" stroke="#000" stroke-width="1.5"/>
        <circle cx="10" cy="10" r="2.5" fill="#000"/>
      </svg>`;
      return L.divIcon({ html, className: '', iconSize: [18, 18], iconAnchor: [9, 9] });

    case 'ndb': // Circle with black stroke
      html = `<svg viewBox="0 0 16 16" width="14" height="14">
        <circle cx="8" cy="8" r="5.5" fill="none" stroke="#000" stroke-width="1.5"/>
        <circle cx="8" cy="8" r="5.5" fill="none" stroke="${color}" stroke-width="2.5"/>
      </svg>`;
      return L.divIcon({ html, className: '', iconSize: [14, 14], iconAnchor: [7, 7] });

    case 'gps': // Diamond with black stroke
      html = `<svg viewBox="0 0 14 14" width="14" height="14">
        <polygon points="7,1 13,7 7,13 1,7" fill="none" stroke="#000" stroke-width="1.5"/>
        <polygon points="7,1 13,7 7,13 1,7" fill="none" stroke="${color}" stroke-width="2"/>
      </svg>`;
      return L.divIcon({ html, className: '', iconSize: [14, 14], iconAnchor: [7, 7] });

    default: // Fix/intersection: filled triangle with black stroke
      html = `<svg viewBox="0 0 14 14" width="14" height="14">
        <polygon points="7,1 13,12 1,12" fill="${color}" stroke="#000" stroke-width="1.5"/>
      </svg>`;
      return L.divIcon({ html, className: '', iconSize: [14, 14], iconAnchor: [7, 7] });
  }
}

export function WaypointLabels() {
  const flightPlan = useFlightPlanStore((s) => s.flightPlan);

  if (!flightPlan || flightPlan.waypoints.length < 2) return null;

  const wps = flightPlan.waypoints;
  const { tocIndex, todIndex } = findTocTod(wps);

  return (
    <>
      {wps.map((wp, i) => {
        // TOC/TOD → diamond marker with label
        if (isTocTod(wp.ident)) {
          const isToc = /c$/i.test(wp.ident);
          const color = isToc ? CLR_CLIMB : CLR_DESCENT;
          const label = isToc ? 'TOC' : 'TOD';
          return (
            <Marker key={`${wp.ident}-${i}`} position={[wp.latitude, wp.longitude]} icon={tocTodDiamond(color)}>
              <Tooltip direction="right" offset={[8, 0]} permanent className="!bg-transparent !border-none !shadow-none !p-0">
                <span style={{ fontSize: '10px', color, fontWeight: 600 }}>{label}</span>
              </Tooltip>
            </Marker>
          );
        }

        // Regular waypoint — navaid shape colored by phase
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
              className="!bg-transparent !border-none !shadow-none !text-[11px] !text-blue-400 !tabular-nums !p-0"
            >
              {wp.ident}
            </Tooltip>
          </Marker>
        );
      })}
    </>
  );
}
