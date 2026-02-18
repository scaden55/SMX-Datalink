import { MapPinPlus } from 'lucide-react';
import { CollapsibleSection } from '../common/CollapsibleSection';
import { useFlightPlanStore } from '../../stores/flightPlanStore';

export function PlanningAlternatesSection() {
  const { form, setFormField } = useFlightPlanStore();

  const summary = [form.alternate1, form.alternate2].filter(Boolean).join(', ') || undefined;

  return (
    <CollapsibleSection title="Alternates" summary={summary} icon={<MapPinPlus className="w-3.5 h-3.5" />} defaultOpen>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[9px] uppercase tracking-wider text-acars-muted font-medium mb-1 block">Alternate 1</label>
          <input
            type="text"
            value={form.alternate1}
            onChange={(e) => setFormField('alternate1', e.target.value.toUpperCase())}
            placeholder="ICAO"
            maxLength={4}
            className="w-full rounded bg-acars-bg border border-acars-border text-acars-text text-[11px] px-2 py-1.5 font-mono outline-none focus:border-acars-blue transition-colors placeholder:text-acars-muted/50"
          />
        </div>
        <div>
          <label className="text-[9px] uppercase tracking-wider text-acars-muted font-medium mb-1 block">Alternate 2</label>
          <input
            type="text"
            value={form.alternate2}
            onChange={(e) => setFormField('alternate2', e.target.value.toUpperCase())}
            placeholder="ICAO"
            maxLength={4}
            className="w-full rounded bg-acars-bg border border-acars-border text-acars-text text-[11px] px-2 py-1.5 font-mono outline-none focus:border-acars-blue transition-colors placeholder:text-acars-muted/50"
          />
        </div>
      </div>
    </CollapsibleSection>
  );
}
