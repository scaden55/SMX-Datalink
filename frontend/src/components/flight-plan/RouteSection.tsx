import { CollapsibleSection } from '../common/CollapsibleSection';
import { useFlightPlanStore } from '../../stores/flightPlanStore';
import { useDispatchEdit } from '../../contexts/DispatchEditContext';

export function RouteSection() {
  const flightPlan = useFlightPlanStore((s) => s.flightPlan);
  const { canEditRoute, editableFields, onFieldChange } = useDispatchEdit();

  const route = editableFields.route ?? flightPlan?.route ?? '';
  const alt1 = editableFields.alternate1 ?? '';
  const alt2 = editableFields.alternate2 ?? '';

  if (canEditRoute) {
    return (
      <CollapsibleSection
        title="Route"
        summary={route || 'No route loaded'}
        useCheckmark
        status={route ? 'green' : 'grey'}
        defaultOpen
      >
        <div className="space-y-2">
          <div>
            <label className="data-label block mb-1">Route</label>
            <textarea
              value={route}
              onChange={(e) => onFieldChange('route', e.target.value)}
              className="w-full h-16 rounded bg-acars-bg border border-acars-border text-acars-text text-[11px] px-2 py-1.5 font-mono resize-none focus:outline-none focus:border-sky-400"
              placeholder="Enter ICAO route..."
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="data-label block mb-1">Alternate 1</label>
              <input
                type="text"
                value={alt1}
                onChange={(e) => onFieldChange('alternate1', e.target.value.toUpperCase())}
                className="w-full rounded bg-acars-bg border border-acars-border text-acars-text text-[11px] px-2 py-1 font-mono focus:outline-none focus:border-sky-400"
                placeholder="ICAO"
                maxLength={4}
              />
            </div>
            <div>
              <label className="data-label block mb-1">Alternate 2</label>
              <input
                type="text"
                value={alt2}
                onChange={(e) => onFieldChange('alternate2', e.target.value.toUpperCase())}
                className="w-full rounded bg-acars-bg border border-acars-border text-acars-text text-[11px] px-2 py-1 font-mono focus:outline-none focus:border-sky-400"
                placeholder="ICAO"
                maxLength={4}
              />
            </div>
          </div>
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
