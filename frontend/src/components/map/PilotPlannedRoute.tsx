import { useState, useEffect, useMemo, useRef } from 'react';
import { Polyline, Marker, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import type { RouteFixResult } from '@acars/shared';
import { api } from '../../lib/api';

// ── Waypoint diamond icon ────────────────────────────────────

const WP_COLOR = '#e8602c';

const waypointIcon = L.divIcon({
  html: `<svg viewBox="0 0 10 10" width="10" height="10"><polygon points="5,1 9,5 5,9 1,5" fill="${WP_COLOR}" stroke="${WP_COLOR}" stroke-width="0.5"/></svg>`,
  className: '',
  iconSize: [10, 10],
  iconAnchor: [5, 5],
});

// ── Types ───────────────────────────────────────────────────

interface Props {
  /** Current lat/lon of the pilot */
  pilotLat: number;
  pilotLon: number;
  /** Raw VATSIM flight plan route string (e.g. "DCT WAVEY J6 LGA") */
  routeString: string;
  /** Departure ICAO */
  departure: string;
  /** Arrival ICAO */
  arrival: string;
}

// ── Haversine (km) ──────────────────────────────────────────

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Component ───────────────────────────────────────────────

/**
 * Resolves a VATSIM pilot's filed route string into waypoints via
 * the navdata API, then renders the remaining planned route as a
 * dashed line from the pilot's current position through upcoming
 * waypoints to the destination.
 */
export function PilotPlannedRoute({ pilotLat, pilotLon, routeString, departure, arrival }: Props) {
  const [fixes, setFixes] = useState<RouteFixResult[]>([]);
  const fetchedRouteRef = useRef('');

  // Resolve route string → waypoints (only when route changes)
  useEffect(() => {
    const tokens = routeString.trim().split(/\s+/).filter(Boolean);
    if (tokens.length === 0) {
      setFixes([]);
      return;
    }

    // Prepend departure and append arrival so the full route is resolved
    const fullTokens = [departure, ...tokens, arrival].filter(Boolean);
    const key = fullTokens.join(',');

    // Don't re-fetch if we already resolved this exact route
    if (fetchedRouteRef.current === key) return;
    fetchedRouteRef.current = key;

    api
      .get<RouteFixResult[]>(`/api/navdata/route?fixes=${encodeURIComponent(key)}`)
      .then(setFixes)
      .catch(() => setFixes([]));
  }, [routeString, departure, arrival]);

  // Find the index of the nearest fix to the pilot's current position,
  // then return only the fixes ahead of (and including) that point.
  const remainingFixes = useMemo(() => {
    if (fixes.length < 2) return [];

    let nearestIdx = 0;
    let nearestDist = Infinity;

    for (let i = 0; i < fixes.length; i++) {
      const d = haversine(pilotLat, pilotLon, fixes[i].lat, fixes[i].lon);
      if (d < nearestDist) {
        nearestDist = d;
        nearestIdx = i;
      }
    }

    // Return from the nearest fix onward (the pilot has passed everything before)
    return fixes.slice(nearestIdx);
  }, [fixes, pilotLat, pilotLon]);

  if (remainingFixes.length === 0) return null;

  // Build the polyline: pilot position → remaining waypoints
  const positions: [number, number][] = [
    [pilotLat, pilotLon],
    ...remainingFixes.map((f) => [f.lat, f.lon] as [number, number]),
  ];

  return (
    <>
      {/* Dashed route line */}
      <Polyline
        positions={positions}
        pathOptions={{
          color: WP_COLOR,
          weight: 2,
          opacity: 0.6,
          dashArray: '8 6',
        }}
      />

      {/* Waypoint diamonds with permanent labels */}
      {remainingFixes.map((fix) => (
        <Marker
          key={`${fix.ident}-${fix.lat}-${fix.lon}`}
          position={[fix.lat, fix.lon]}
          icon={waypointIcon}
        >
          <Tooltip
            direction="right"
            offset={[6, 0]}
            permanent
            className="!bg-transparent !border-none !shadow-none !p-0"
          >
            <span style={{ fontSize: '10px', color: WP_COLOR, fontFamily: 'Lufga, system-ui, sans-serif', fontWeight: 500 }}>
              {fix.ident}
            </span>
          </Tooltip>
        </Marker>
      ))}
    </>
  );
}

