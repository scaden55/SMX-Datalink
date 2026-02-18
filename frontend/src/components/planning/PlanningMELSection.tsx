import { AlertTriangle } from 'lucide-react';
import { CollapsibleSection } from '../common/CollapsibleSection';
import { useFlightPlanStore } from '../../stores/flightPlanStore';

export function PlanningMELSection() {
  const { form, setFormField } = useFlightPlanStore();

  return (
    <CollapsibleSection title="MEL & Restrictions" icon={<AlertTriangle className="w-3.5 h-3.5" />} defaultOpen>
      <textarea
        value={form.melRestrictions}
        onChange={(e) => setFormField('melRestrictions', e.target.value)}
        placeholder="No MEL items..."
        rows={2}
        className="w-full rounded bg-acars-bg border border-acars-border text-acars-text text-[11px] px-2 py-1.5 font-mono outline-none focus:border-acars-blue transition-colors resize-none placeholder:text-acars-muted/50"
      />
    </CollapsibleSection>
  );
}
