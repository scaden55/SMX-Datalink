import { CollapsibleSection } from '../common/CollapsibleSection';
import { useFlightPlanStore } from '../../stores/flightPlanStore';
import { useDispatchEdit } from '../../contexts/DispatchEditContext';

export function RouteSection() {
  const flightPlan = useFlightPlanStore((s) => s.flightPlan);
  const { canEditRoute, editableFields, onFieldChange } = useDispatchEdit();

  const route = editableFields.route ?? flightPlan?.route ?? '';

  if (canEditRoute) {
    return (
      <CollapsibleSection
        title="Route"
        summary={route || 'No route loaded'}
        useCheckmark
        status={route ? 'green' : 'grey'}
        defaultOpen
      >
        <div>
          <label className="data-label block mb-1">Route</label>
          <textarea
            value={route}
            onChange={(e) => onFieldChange('route', e.target.value)}
            className="w-full h-16 rounded bg-acars-bg border border-acars-border text-acars-text text-[11px] px-2 py-1.5 font-mono resize-none focus:outline-none focus:border-sky-400"
            placeholder="Enter ICAO route..."
          />
        </div>
      </CollapsibleSection>
    );
  }

  return (
    <CollapsibleSection
      title="Route"
      summary={route || 'No route loaded'}
      useCheckmark
      status={route ? 'green' : 'grey'}
      defaultOpen
    >
      <div className="font-mono text-[11px] text-acars-text leading-relaxed break-all">
        {route || (
          <span className="text-acars-muted italic">No flight plan loaded. Import a .PLN file or enter an ICAO route.</span>
        )}
      </div>
    </CollapsibleSection>
  );
}
