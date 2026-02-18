import { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, CircleMarker, Polyline, Tooltip, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { useFlightPlanStore } from '../../stores/flightPlanStore';

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
            <Polyline
              key={`route-${routeKey}`}
              positions={routePositions}
              pathOptions={{ color: '#58a6ff', weight: 2, opacity: 0.8, dashArray: '6 4' }}
            />
          </>
        )}

        {/* Waypoint markers (small dots for intermediate) */}
        {planningWaypoints.slice(1, -1).map((w, i) => (
          <CircleMarker
            key={`wp-${i}-${w.ident}`}
            center={[w.latitude, w.longitude]}
            radius={2.5}
            pathOptions={{ color: '#58a6ff', fillColor: '#58a6ff', fillOpacity: 0.6, weight: 1 }}
          >
            <Tooltip direction="top" offset={[0, -6]} className="hub-tooltip">
              <span style={{ fontFamily: 'JetBrains Mono, Consolas, monospace', fontSize: '9px' }}>
                {w.ident}
              </span>
            </Tooltip>
          </CircleMarker>
        ))}

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
