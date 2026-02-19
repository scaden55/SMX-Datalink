import { Polyline } from 'react-leaflet';
import { useFlightPlanStore } from '../../stores/flightPlanStore';

const CLR_CLIMB = '#d2a8ff';
const CLR_CRUISE = '#58a6ff';
const CLR_DESCENT = '#3fb950';

export function RoutePolyline() {
  const flightPlan = useFlightPlanStore((s) => s.flightPlan);

  if (!flightPlan || flightPlan.waypoints.length < 2) return null;

  const wps = flightPlan.waypoints;

  // Find TOC/TOD by altitude threshold
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

  const toPos = (w: typeof wps[number]): [number, number] => [w.latitude, w.longitude];

  // Build segments with overlap at TOC/TOD so they connect
  const climbPositions = wps.slice(0, tocIndex + 1).map(toPos);
  const cruisePositions = wps.slice(tocIndex, todIndex + 1).map(toPos);
  const descentPositions = wps.slice(todIndex).map(toPos);

  const baseOpts = { weight: 2, opacity: 0.8, dashArray: '8 4' };

  return (
    <>
      {climbPositions.length >= 2 && (
        <Polyline positions={climbPositions} pathOptions={{ ...baseOpts, color: CLR_CLIMB }} />
      )}
      {cruisePositions.length >= 2 && (
        <Polyline positions={cruisePositions} pathOptions={{ ...baseOpts, color: CLR_CRUISE }} />
      )}
      {descentPositions.length >= 2 && (
        <Polyline positions={descentPositions} pathOptions={{ ...baseOpts, color: CLR_DESCENT }} />
      )}
    </>
  );
}
