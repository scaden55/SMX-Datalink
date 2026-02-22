import { Route } from 'lucide-react';
import { CollapsibleSection } from '../common/CollapsibleSection';
import { useFlightPlanStore } from '../../stores/flightPlanStore';
import { RouteAutocomplete } from './RouteAutocomplete';

export function PlanningRouteSection() {
  const { form, setFormField } = useFlightPlanStore();

  return (
    <CollapsibleSection
      title="Route"
      summary={form.route ? form.route.slice(0, 40) + '...' : undefined}
      icon={<Route className="w-3.5 h-3.5" />}
      status={form.route ? 'green' : 'grey'}
      defaultOpen
    >
      <RouteAutocomplete
        value={form.route}
        onChange={(val) => setFormField('route', val.toUpperCase())}
        placeholder="DCT WAVEY J6 LGA... (leave blank for auto-route)"
      />
    </CollapsibleSection>
  );
}
