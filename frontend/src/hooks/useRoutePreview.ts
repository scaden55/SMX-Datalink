import { useEffect, useRef } from 'react';
import { api } from '../lib/api';
import { useFlightPlanStore } from '../stores/flightPlanStore';
import type { RouteFixResult, Waypoint } from '@acars/shared';

/**
 * Watches `form.route` and resolves it to planning waypoints for map preview.
 * Only active when no SimBrief OFP exists (OFP waypoints take priority).
 */
export function useRoutePreview() {
  const form = useFlightPlanStore((s) => s.form);
  const ofp = useFlightPlanStore((s) => s.ofp);
  const setPlanningWaypoints = useFlightPlanStore((s) => s.setPlanningWaypoints);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    // SimBrief OFP waypoints take priority
    if (ofp) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);

    const tokens = form.route.trim().split(/\s+/).filter(Boolean);
    if (tokens.length < 1) {
      setPlanningWaypoints([]);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      try {
        const fixes = await api.get<RouteFixResult[]>(
          `/api/navdata/route?fixes=${encodeURIComponent(tokens.join(','))}`
        );

        if (fixes.length === 0) {
          setPlanningWaypoints([]);
          return;
        }

        // Map RouteFixResult → Waypoint (the shape PlanningMap renders)
        const waypoints: Waypoint[] = fixes.map((fix, i) => ({
          ident: fix.ident,
          type: mapFixType(fix.type),
          latitude: fix.lat,
          longitude: fix.lon,
          altitude: null,
          isActive: false,
          distanceFromPrevious: 0,
          ete: null,
          eta: null,
          passed: false,
        }));

        setPlanningWaypoints(waypoints);
      } catch {
        // Silent — route preview is supplementary
      }
    }, 800);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [form.route, ofp, setPlanningWaypoints]);
}

/** Map backend fix type to Waypoint type union */
function mapFixType(type: RouteFixResult['type']): Waypoint['type'] {
  switch (type) {
    case 'vor': return 'vor';
    case 'ndb': return 'ndb';
    case 'airport': return 'airport';
    case 'fix': return 'intersection';
    case 'airway-fix': return 'intersection';
    default: return 'gps';
  }
}
