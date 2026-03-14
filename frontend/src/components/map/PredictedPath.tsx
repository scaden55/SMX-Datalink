import { useMemo } from 'react';
import { Polyline, Marker, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import type { SimBriefStep, TrackPoint } from '@acars/shared';

// ── Helpers ──────────────────────────────────────────────────

function haversineNm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3440.065; // Earth radius in nautical miles
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Waypoint diamond icon ────────────────────────────────────

const WP_COLOR = '#e8602c';

const waypointIcon = L.divIcon({
  html: `<svg viewBox="0 0 14 14" width="14" height="14"><polygon points="7,1 13,7 7,13 1,7" fill="${WP_COLOR}" stroke="#000" stroke-width="1.5"/></svg>`,
  className: '',
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

// ── Component ───────────────────────────────────────────────

interface Props {
  /** The aircraft's current position (last track point, or live telemetry) */
  currentPos: { lat: number; lon: number } | null;
  /** OFP route waypoints from SimBrief (null = no OFP available) */
  ofpSteps: SimBriefStep[] | null;
  /** Arrival airport coords for great-circle fallback */
  arrivalCoords: [number, number] | null;
}

/**
 * Renders the predicted future path as a dashed line.
 *
 * If OFP waypoints are available:
 *   - Finds the closest waypoint to the aircraft's current position
 *   - Renders remaining waypoints as a dashed amber line
 *   - Shows small dots at each waypoint with ICAO tooltip
 *
 * If no OFP:
 *   - Renders a simple dashed line from current position to arrival
 */
export function PredictedPath({ currentPos, ofpSteps, arrivalCoords }: Props) {
  // Compute remaining waypoints from OFP
  const remainingPath = useMemo(() => {
    if (!currentPos || !ofpSteps || ofpSteps.length < 2) return null;

    // Find closest OFP waypoint to current position
    let closestIdx = 0;
    let closestDist = Infinity;
    for (let i = 0; i < ofpSteps.length; i++) {
      const d = haversineNm(currentPos.lat, currentPos.lon, ofpSteps[i].lat, ofpSteps[i].lon);
      if (d < closestDist) {
        closestDist = d;
        closestIdx = i;
      }
    }

    // Take waypoints from the closest forward
    const remaining = ofpSteps.slice(closestIdx);
    if (remaining.length < 1) return null;

    // Build positions: aircraft → remaining waypoints
    const positions: [number, number][] = [
      [currentPos.lat, currentPos.lon],
      ...remaining.map((s) => [s.lat, s.lon] as [number, number]),
    ];

    // Filter to named waypoints for labels (skip lat/lon-only fixes)
    const namedWaypoints = remaining.filter(
      (s) => s.ident && s.fixType !== 'ltlg' && s.fixType !== 'toc' && s.fixType !== 'tod',
    );

    return { positions, namedWaypoints };
  }, [currentPos, ofpSteps]);

  // Great-circle fallback (no OFP)
  const fallbackPath = useMemo(() => {
    if (remainingPath || !currentPos || !arrivalCoords) return null;
    return [
      [currentPos.lat, currentPos.lon] as [number, number],
      arrivalCoords,
    ];
  }, [remainingPath, currentPos, arrivalCoords]);

  if (!remainingPath && !fallbackPath) return null;

  return (
    <>
      {/* OFP-based predicted path */}
      {remainingPath && (
        <>
          <Polyline
            positions={remainingPath.positions}
            pathOptions={{
              color: WP_COLOR,
              weight: 2,
              opacity: 0.6,
              dashArray: '8 6',
            }}
          />
          {/* Waypoint diamonds with permanent labels */}
          {remainingPath.namedWaypoints.map((wp) => (
            <Marker
              key={`wp-${wp.ident}-${wp.lat}`}
              position={[wp.lat, wp.lon]}
              icon={waypointIcon}
            >
              <Tooltip
                direction="right"
                offset={[6, 0]}
                permanent
                className="!bg-transparent !border-none !shadow-none !p-0"
              >
                <span style={{ fontSize: '10px', color: WP_COLOR, fontFamily: 'Lufga, system-ui, sans-serif', fontWeight: 500 }}>
                  {wp.ident}
                </span>
              </Tooltip>
            </Marker>
          ))}
        </>
      )}

      {/* Great-circle fallback */}
      {fallbackPath && (
        <Polyline
          positions={fallbackPath}
          pathOptions={{
            color: '#79c0ff',
            weight: 2,
            opacity: 0.4,
            dashArray: '6 4',
          }}
        />
      )}
    </>
  );
}
