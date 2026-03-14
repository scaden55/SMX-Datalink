import { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Waypoint } from '@acars/shared';
import { useFlightPlanStore } from '../../stores/flightPlanStore';
import { findTocTod, isTocTod } from '../../lib/flight-phases';

/** Resolve a CSS custom property from :root to its computed value (e.g. '#00cece'). */
function getCssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function FitToRoute({ positions }: { positions: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (positions.length < 2) return;
    map.fitBounds(positions, { padding: [40, 40], maxZoom: 7 });
  }, [map, positions]);
  return null;
}

/** Force Leaflet to invalidate size when container dimensions change */
function MapInvalidator() {
  const map = useMap();
  useEffect(() => {
    const timer = setTimeout(() => map.invalidateSize(), 100);
    return () => clearTimeout(timer);
  }, [map]);
  return null;
}

/** ForeFlight-style SVG shape per waypoint type, colored by flight phase */
function shapeIcon(wpType: Waypoint['type'], color: string, _fill: string): L.DivIcon {
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

export function PlanningMap() {
  const planningWaypoints = useFlightPlanStore((s) => s.planningWaypoints);
  const form = useFlightPlanStore((s) => s.form);
  const airports = useFlightPlanStore((s) => s.airports);

  // Resolve CSS custom properties once for canvas/SVG rendering
  const clr = useMemo(() => ({
    climb:   getCssVar('--phase-climb'),
    cruise:  getCssVar('--phase-cruise'),
    descent: getCssVar('--phase-descent'),
    fill:    getCssVar('--bg-panel'),
    depArr:  getCssVar('--status-green'),
    arrival: getCssVar('--status-red'),
    alt:     getCssVar('--status-amber'),
    mapBg:   getCssVar('--bg-map'),
  }), []);

  const depAirport = airports.find((a) => a.icao === form.origin);
  const arrAirport = airports.find((a) => a.icao === form.destination);
  const alt1Airport = airports.find((a) => a.icao === form.alternate1);
  const alt2Airport = airports.find((a) => a.icao === form.alternate2);

  // Build route positions from waypoints, or fallback to dep/arr
  const routePositions = useMemo<[number, number][]>(() => {
    if (planningWaypoints.length > 1) {
      return planningWaypoints
        .filter((w) => w.latitude !== 0 || w.longitude !== 0)
        .map((w) => [w.latitude, w.longitude] as [number, number]);
    }
    const pts: [number, number][] = [];
    if (depAirport) pts.push([depAirport.lat, depAirport.lon]);
    if (arrAirport) pts.push([arrAirport.lat, arrAirport.lon]);
    return pts;
  }, [planningWaypoints, depAirport, arrAirport]);

  // Use waypoints count as key to force Polyline re-mount when route changes
  const routeKey = planningWaypoints.length;

  // Compute phase indices and colored route segments
  const { climbPositions, cruisePositions, descentPositions, tocIndex, todIndex } = useMemo(() => {
    if (planningWaypoints.length < 2) return { climbPositions: [] as [number, number][], cruisePositions: [] as [number, number][], descentPositions: [] as [number, number][], tocIndex: 0, todIndex: 0 };

    const { tocIndex: toc, todIndex: tod } = findTocTod(planningWaypoints);

    const toPos = (w: typeof planningWaypoints[number]): [number, number] => [w.latitude, w.longitude];
    return {
      climbPositions: planningWaypoints.slice(0, toc + 1).map(toPos),
      cruisePositions: planningWaypoints.slice(toc, tod + 1).map(toPos),
      descentPositions: planningWaypoints.slice(tod).map(toPos),
      tocIndex: toc,
      todIndex: tod,
    };
  }, [planningWaypoints]);

  const tocTodDiamond = (color: string) => L.divIcon({
    html: `<svg viewBox="0 0 14 14" width="14" height="14"><polygon points="7,1 13,7 7,13 1,7" fill="${color}" stroke="#000" stroke-width="1.5"/></svg>`,
    className: '',
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });

  return (
    <div className="h-full w-full relative">
      <MapContainer
        center={[39.8283, -98.5795]}
        zoom={4}
        className="h-full w-full"
        zoomControl={false}
        attributionControl={false}
        style={{ background: 'var(--bg-map)' }}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          maxZoom={19}
        />
        <MapInvalidator />

        {routePositions.length >= 2 && (
          <>
            <FitToRoute positions={routePositions} />
            {climbPositions.length >= 2 && (
              <Polyline key={`climb-${routeKey}`} positions={climbPositions} pathOptions={{ color: clr.climb, weight: 3, opacity: 0.8 }} />
            )}
            {cruisePositions.length >= 2 && (
              <Polyline key={`cruise-${routeKey}`} positions={cruisePositions} pathOptions={{ color: clr.cruise, weight: 3, opacity: 0.8 }} />
            )}
            {descentPositions.length >= 2 && (
              <Polyline key={`descent-${routeKey}`} positions={descentPositions} pathOptions={{ color: clr.descent, weight: 3, opacity: 0.8 }} />
            )}
          </>
        )}

        {/* Waypoint markers — TOC/TOD as diamonds, others as navaid shapes */}
        {planningWaypoints.slice(1, -1).map((w, i) => {
          const absIdx = i + 1;

          // TOC/TOD → diamond marker with label
          if (isTocTod(w.ident)) {
            const isToc = /c$/i.test(w.ident);
            const color = isToc ? clr.climb : clr.descent;
            const label = isToc ? 'TOC' : 'TOD';
            return (
              <Marker key={`wp-${i}-${w.ident}`} position={[w.latitude, w.longitude]} icon={tocTodDiamond(color)}>
                <Tooltip direction="right" offset={[8, 0]} permanent className="!bg-transparent !border-none !shadow-none !p-0">
                  <span style={{ fontSize: '10px', color, fontWeight: 600 }}>{label}</span>
                </Tooltip>
              </Marker>
            );
          }

          // Regular waypoint — navaid shape colored by phase
          const phaseClr = absIdx < tocIndex ? clr.climb : absIdx > todIndex ? clr.descent : clr.cruise;
          return (
            <Marker
              key={`wp-${i}-${w.ident}`}
              position={[w.latitude, w.longitude]}
              icon={shapeIcon(w.type, phaseClr, clr.fill)}
            >
              <Tooltip direction="top" offset={[0, -6]} className="hub-tooltip">
                <span style={{ fontSize: '11px', fontFeatureSettings: '"tnum"' }}>
                  {w.ident}
                </span>
              </Tooltip>
            </Marker>
          );
        })}

        {/* Departure */}
        {depAirport && (
          <Marker
            position={[depAirport.lat, depAirport.lon]}
            icon={shapeIcon('airport', clr.depArr, clr.fill)}
          >
            <Tooltip direction="top" offset={[0, -8]} permanent className="hub-tooltip">
              <span style={{ fontSize: '11px', fontFeatureSettings: '"tnum"' }}>
                {depAirport.icao}
              </span>
            </Tooltip>
          </Marker>
        )}

        {/* Arrival */}
        {arrAirport && (
          <Marker
            position={[arrAirport.lat, arrAirport.lon]}
            icon={shapeIcon('airport', clr.arrival, clr.fill)}
          >
            <Tooltip direction="top" offset={[0, -8]} permanent className="hub-tooltip">
              <span style={{ fontSize: '11px', fontFeatureSettings: '"tnum"' }}>
                {arrAirport.icao}
              </span>
            </Tooltip>
          </Marker>
        )}

        {/* Alternate 1 */}
        {alt1Airport && (
          <Marker
            position={[alt1Airport.lat, alt1Airport.lon]}
            icon={shapeIcon('airport', clr.alt, clr.fill)}
          >
            <Tooltip direction="top" offset={[0, -8]} className="hub-tooltip">
              <span style={{ fontSize: '11px', fontFeatureSettings: '"tnum"' }}>
                {alt1Airport.icao} (ALT)
              </span>
            </Tooltip>
          </Marker>
        )}

        {/* Alternate 2 */}
        {alt2Airport && (
          <Marker
            position={[alt2Airport.lat, alt2Airport.lon]}
            icon={shapeIcon('airport', clr.alt, clr.fill)}
          >
            <Tooltip direction="top" offset={[0, -8]} className="hub-tooltip">
              <span style={{ fontSize: '11px', fontFeatureSettings: '"tnum"' }}>
                {alt2Airport.icao} (ALT)
              </span>
            </Tooltip>
          </Marker>
        )}
      </MapContainer>
    </div>
  );
}
