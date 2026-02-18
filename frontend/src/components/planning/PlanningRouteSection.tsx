import { Route } from 'lucide-react';
import { CollapsibleSection } from '../common/CollapsibleSection';
import { useFlightPlanStore } from '../../stores/flightPlanStore';

export function PlanningRouteSection() {
  const { form, setFormField } = useFlightPlanStore();

  return (
    <CollapsibleSection title="Route" summary={form.route ? form.route.slice(0, 40) + '...' : undefined} icon={<Route className="w-3.5 h-3.5" />} defaultOpen>
      <textarea
        value={form.route}
        onChange={(e) => setFormField('route', e.target.value.toUpperCase())}
        placeholder="DCT WAVEY J6 LGA... (leave blank for auto-route)"
        rows={3}
        className="w-full rounded bg-acars-bg border border-acars-border text-acars-text text-[11px] px-2 py-1.5 font-mono outline-none focus:border-acars-blue transition-colors resize-none placeholder:text-acars-muted/50"
      />
    </CollapsibleSection>
  );
}
