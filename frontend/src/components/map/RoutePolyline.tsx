import { Polyline } from 'react-leaflet';
import { useFlightPlanStore } from '../../stores/flightPlanStore';

export function RoutePolyline() {
  const flightPlan = useFlightPlanStore((s) => s.flightPlan);

  if (!flightPlan || flightPlan.waypoints.length < 2) return null;

  const positions = flightPlan.waypoints.map(
    (wp) => [wp.latitude, wp.longitude] as [number, number],
  );

  return (
    <Polyline
      positions={positions}
      pathOptions={{
        color: '#79c0ff',
        weight: 2,
        opacity: 0.8,
        dashArray: '8 4',
      }}
    />
  );
}
