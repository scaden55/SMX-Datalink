import { useState, useEffect, useMemo, useRef } from 'react';
import { Polyline, CircleMarker, Tooltip } from 'react-leaflet';
import type { RouteFixResult } from '@acars/shared';
import { api } from '../../lib/api';

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
          color: '#79c0ff',
          weight: 2,
          opacity: 0.5,
          dashArray: '8 6',
        }}
      />

      {/* Waypoint dots with labels */}
      {remainingFixes.map((fix) => (
        <CircleMarker
          key={`${fix.ident}-${fix.lat}-${fix.lon}`}
          center={[fix.lat, fix.lon]}
          radius={3}
          pathOptions={{
            color: fixColor(fix.type),
            fillColor: fixColor(fix.type),
            fillOpacity: 0.9,
            weight: 1,
          }}
        >
          <Tooltip
            direction="top"
            offset={[0, -6]}
            permanent={false}
            className="planned-route-tooltip"
          >
            <span className="font-mono text-[10px]">
              {fix.ident}
              {fix.airway ? ` (${fix.airway})` : ''}
            </span>
          </Tooltip>
        </CircleMarker>
      ))}
    </>
  );
}

// ── Helpers ──────────────────────────────────────────────────

function fixColor(type: RouteFixResult['type']): string {
  switch (type) {
    case 'vor': return '#22d3ee';     // cyan
    case 'ndb': return '#a78bfa';     // purple
    case 'airport': return '#f59e0b'; // amber
    case 'airway-fix': return '#6b7280'; // gray
    default: return '#9ca3af';        // light gray
  }
}
