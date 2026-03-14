import { Polyline } from 'react-leaflet';
import { useFlightPlanStore } from '../../stores/flightPlanStore';
import { findTocTod } from '../../lib/flight-phases';

const CLR_CLIMB = '#d2a8ff';
const CLR_CRUISE = '#58a6ff';
const CLR_DESCENT = '#3fb950';

export function RoutePolyline() {
  const flightPlan = useFlightPlanStore((s) => s.flightPlan);

  if (!flightPlan || flightPlan.waypoints.length < 2) return null;

  const wps = flightPlan.waypoints;
  const { tocIndex, todIndex } = findTocTod(wps);

  const toPos = (w: typeof wps[number]): [number, number] => [w.latitude, w.longitude];

  // Build segments with overlap at TOC/TOD so they connect
  const climbPositions = wps.slice(0, tocIndex + 1).map(toPos);
  const cruisePositions = wps.slice(tocIndex, todIndex + 1).map(toPos);
  const descentPositions = wps.slice(todIndex).map(toPos);

  const baseOpts = { weight: 3, opacity: 0.8 };

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
