import { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, CircleMarker, Marker, Polyline, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Waypoint } from '@acars/shared';
import { useFlightPlanStore } from '../../stores/flightPlanStore';

const CLR_CLIMB = '#d2a8ff';
const CLR_CRUISE = '#58a6ff';
const CLR_DESCENT = '#3fb950';

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

const SZ = 10;
const FILL = '#161b22';
const SW = 1.5;

function shapeIcon(wpType: Waypoint['type'], color: string): L.DivIcon {
  let svg: string;
  const half = SZ / 2;

  switch (wpType) {
    case 'airport':
      svg = `<rect x="1" y="1" width="${SZ - 2}" height="${SZ - 2}" fill="${FILL}" stroke="${color}" stroke-width="${SW}"/>`;
      break;
    case 'vor': {
      const pts = Array.from({ length: 6 }, (_, i) => {
        const a = (Math.PI / 3) * i - Math.PI / 2;
        return `${half + (half - 1) * Math.cos(a)},${half + (half - 1) * Math.sin(a)}`;
      }).join(' ');
      svg = `<polygon points="${pts}" fill="${FILL}" stroke="${color}" stroke-width="${SW}"/>`;
      break;
    }
    case 'ndb':
      svg = `<circle cx="${half}" cy="${half}" r="${half - 1}" fill="${FILL}" stroke="${color}" stroke-width="${SW}"/>`;
      break;
    case 'gps':
      svg = `<polygon points="${half},1 ${SZ - 1},${half} ${half},${SZ - 1} 1,${half}" fill="${FILL}" stroke="${color}" stroke-width="${SW}"/>`;
      break;
    default:
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

export function PlanningMap() {
  const planningWaypoints = useFlightPlanStore((s) => s.planningWaypoints);
  const form = useFlightPlanStore((s) => s.form);
  const airports = useFlightPlanStore((s) => s.airports);

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

    const maxAlt = Math.max(...planningWaypoints.map((w) => w.altitude ?? 0));
    const threshold = maxAlt * 0.90;

    let toc = 0;
    let tod = planningWaypoints.length - 1;
    for (let i = 0; i < planningWaypoints.length; i++) {
      if ((planningWaypoints[i].altitude ?? 0) >= threshold) { toc = i; break; }
    }
    for (let i = planningWaypoints.length - 1; i >= 0; i--) {
      if ((planningWaypoints[i].altitude ?? 0) >= threshold) { tod = i; break; }
    }

    const toPos = (w: typeof planningWaypoints[number]): [number, number] => [w.latitude, w.longitude];
    return {
      climbPositions: planningWaypoints.slice(0, toc + 1).map(toPos),
      cruisePositions: planningWaypoints.slice(toc, tod + 1).map(toPos),
      descentPositions: planningWaypoints.slice(tod).map(toPos),
      tocIndex: toc,
      todIndex: tod,
    };
  }, [planningWaypoints]);

  return (
    <div className="h-full w-full relative">
      <MapContainer
        center={[39.8283, -98.5795]}
        zoom={4}
        className="h-full w-full"
        zoomControl={false}
        attributionControl={false}
        style={{ background: '#0d1117' }}
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
              <Polyline key={`climb-${routeKey}`} positions={climbPositions} pathOptions={{ color: CLR_CLIMB, weight: 2, opacity: 0.8, dashArray: '6 4' }} />
            )}
            {cruisePositions.length >= 2 && (
              <Polyline key={`cruise-${routeKey}`} positions={cruisePositions} pathOptions={{ color: CLR_CRUISE, weight: 2, opacity: 0.8, dashArray: '6 4' }} />
            )}
            {descentPositions.length >= 2 && (
              <Polyline key={`descent-${routeKey}`} positions={descentPositions} pathOptions={{ color: CLR_DESCENT, weight: 2, opacity: 0.8, dashArray: '6 4' }} />
            )}
          </>
        )}

        {/* Waypoint markers — shape by type, colored by phase */}
        {planningWaypoints.slice(1, -1).map((w, i) => {
          const absIdx = i + 1;
          const clr = absIdx < tocIndex ? CLR_CLIMB : absIdx > todIndex ? CLR_DESCENT : CLR_CRUISE;
          return (
            <Marker
              key={`wp-${i}-${w.ident}`}
              position={[w.latitude, w.longitude]}
              icon={shapeIcon(w.type, clr)}
            >
              <Tooltip direction="top" offset={[0, -6]} className="hub-tooltip">
                <span style={{ fontFamily: 'JetBrains Mono, Consolas, monospace', fontSize: '9px' }}>
                  {w.ident}
                </span>
              </Tooltip>
            </Marker>
          );
        })}

        {/* Departure */}
        {depAirport && (
          <CircleMarker
            center={[depAirport.lat, depAirport.lon]}
            radius={6}
            pathOptions={{ color: '#3fb950', fillColor: '#3fb950', fillOpacity: 0.9, weight: 1.5 }}
          >
            <Tooltip direction="top" offset={[0, -8]} permanent className="hub-tooltip">
              <span style={{ fontFamily: 'JetBrains Mono, Consolas, monospace', fontSize: '10px' }}>
                {depAirport.icao}
              </span>
            </Tooltip>
          </CircleMarker>
        )}

        {/* Arrival */}
        {arrAirport && (
          <CircleMarker
            center={[arrAirport.lat, arrAirport.lon]}
            radius={6}
            pathOptions={{ color: '#f85149', fillColor: '#f85149', fillOpacity: 0.9, weight: 1.5 }}
          >
            <Tooltip direction="top" offset={[0, -8]} permanent className="hub-tooltip">
              <span style={{ fontFamily: 'JetBrains Mono, Consolas, monospace', fontSize: '10px' }}>
                {arrAirport.icao}
              </span>
            </Tooltip>
          </CircleMarker>
        )}

        {/* Alternate 1 */}
        {alt1Airport && (
          <CircleMarker
            center={[alt1Airport.lat, alt1Airport.lon]}
            radius={5}
            pathOptions={{ color: '#d29922', fillColor: '#d29922', fillOpacity: 0.8, weight: 1.5 }}
          >
            <Tooltip direction="top" offset={[0, -8]} className="hub-tooltip">
              <span style={{ fontFamily: 'JetBrains Mono, Consolas, monospace', fontSize: '10px' }}>
                {alt1Airport.icao} (ALT)
              </span>
            </Tooltip>
          </CircleMarker>
        )}

        {/* Alternate 2 */}
        {alt2Airport && (
          <CircleMarker
            center={[alt2Airport.lat, alt2Airport.lon]}
            radius={5}
            pathOptions={{ color: '#d29922', fillColor: '#d29922', fillOpacity: 0.8, weight: 1.5 }}
          >
            <Tooltip direction="top" offset={[0, -8]} className="hub-tooltip">
              <span style={{ fontFamily: 'JetBrains Mono, Consolas, monospace', fontSize: '10px' }}>
                {alt2Airport.icao} (ALT)
              </span>
            </Tooltip>
          </CircleMarker>
        )}
      </MapContainer>
    </div>
  );
}
