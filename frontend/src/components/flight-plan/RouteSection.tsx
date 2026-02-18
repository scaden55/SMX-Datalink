import { CollapsibleSection } from '../common/CollapsibleSection';
import { useFlightPlanStore } from '../../stores/flightPlanStore';

export function RouteSection() {
  const flightPlan = useFlightPlanStore((s) => s.flightPlan);

  return (
    <CollapsibleSection
      title="Route"
      summary={flightPlan?.route ?? 'No route loaded'}
    >
      <div className="font-mono text-[11px] text-acars-text leading-relaxed break-all">
        {flightPlan?.route ?? (
          <span className="text-acars-muted italic">No flight plan loaded. Import a .PLN file or enter an ICAO route.</span>
        )}
      </div>
    </CollapsibleSection>
  );
}
