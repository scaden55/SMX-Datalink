import { Marker, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import { useFlightPlanStore } from '../../stores/flightPlanStore';

const waypointIcon = L.divIcon({
  html: '<div style="width:6px;height:6px;background:#d2a8ff;border-radius:50%;border:1px solid #0d1117;"></div>',
  className: '',
  iconSize: [6, 6],
  iconAnchor: [3, 3],
});

export function WaypointLabels() {
  const flightPlan = useFlightPlanStore((s) => s.flightPlan);

  if (!flightPlan) return null;

  return (
    <>
      {flightPlan.waypoints.map((wp) => (
        <Marker
          key={wp.ident}
          position={[wp.latitude, wp.longitude]}
          icon={waypointIcon}
        >
          <Tooltip
            permanent
            direction="top"
            offset={[0, -6]}
            className="!bg-transparent !border-none !shadow-none !text-[10px] !text-acars-magenta !font-mono !p-0"
          >
            {wp.ident}
          </Tooltip>
        </Marker>
      ))}
    </>
  );
}
