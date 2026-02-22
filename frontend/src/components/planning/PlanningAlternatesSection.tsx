import { MapPinPlus } from 'lucide-react';
import { CollapsibleSection } from '../common/CollapsibleSection';
import { useFlightPlanStore } from '../../stores/flightPlanStore';

export function PlanningAlternatesSection() {
  const { form, setFormField } = useFlightPlanStore();

  const summary = [form.alternate1, form.alternate2].filter(Boolean).join(', ') || undefined;

  return (
    <CollapsibleSection
      title="Alternates"
      summary={summary}
      icon={<MapPinPlus className="w-3.5 h-3.5" />}
      status={form.alternate1 ? 'green' : 'grey'}
      defaultOpen
    >
      <div className="grid grid-cols-2 gap-2.5">
        <div>
          <label className="planning-label mb-1">Alternate 1</label>
          <input
            type="text"
            value={form.alternate1}
            onChange={(e) => setFormField('alternate1', e.target.value.toUpperCase())}
            placeholder="ICAO"
            maxLength={4}
            className="planning-input"
          />
        </div>
        <div>
          <label className="planning-label mb-1">Alternate 2</label>
          <input
            type="text"
            value={form.alternate2}
            onChange={(e) => setFormField('alternate2', e.target.value.toUpperCase())}
            placeholder="ICAO"
            maxLength={4}
            className="planning-input"
          />
        </div>
      </div>
    </CollapsibleSection>
  );
}
