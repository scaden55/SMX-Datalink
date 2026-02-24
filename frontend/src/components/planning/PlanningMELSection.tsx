import { Warning } from '@phosphor-icons/react';
import { CollapsibleSection } from '../common/CollapsibleSection';
import { useFlightPlanStore } from '../../stores/flightPlanStore';

export function PlanningMELSection() {
  const { form, setFormField } = useFlightPlanStore();

  return (
    <CollapsibleSection
      title="MEL & Restrictions"
      icon={<Warning className="w-3.5 h-3.5" />}
      status={form.melRestrictions ? 'amber' : 'grey'}
      defaultOpen
    >
      <textarea
        value={form.melRestrictions}
        onChange={(e) => setFormField('melRestrictions', e.target.value)}
        placeholder="No MEL items..."
        rows={2}
        className="planning-textarea"
      />
    </CollapsibleSection>
  );
}
