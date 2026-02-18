import { AirportCard } from './AirportCard';
import { useFlightPlanStore } from '../../stores/flightPlanStore';

export function SidebarPanel() {
  const flightPlan = useFlightPlanStore((s) => s.flightPlan);

  return (
    <div className="bg-acars-bg p-2 space-y-2">
      <AirportCard
        label="Origin"
        icao={flightPlan?.origin ?? '----'}
        active
      />
      <AirportCard
        label="Destination"
        icao={flightPlan?.destination ?? '----'}
      />
      {flightPlan?.alternates.map((alt) => (
        <AirportCard key={alt} label="Dest Alt" icao={alt} />
      ))}
      {(!flightPlan || flightPlan.alternates.length === 0) && (
        <>
          <AirportCard label="Dest Alt 1" icao="----" />
          <AirportCard label="Dest Alt 2" icao="----" />
        </>
      )}
    </div>
  );
}
