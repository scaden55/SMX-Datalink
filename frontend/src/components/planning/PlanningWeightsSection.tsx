import { Scale } from 'lucide-react';
import { CollapsibleSection } from '../common/CollapsibleSection';
import { useFlightPlanStore } from '../../stores/flightPlanStore';

export function PlanningWeightsSection() {
  const { form, setFormField } = useFlightPlanStore();

  const fields: { key: keyof typeof form; label: string }[] = [
    { key: 'estZfw', label: 'ZFW' },
    { key: 'estTow', label: 'TOW' },
    { key: 'estLdw', label: 'LDW' },
    { key: 'payload', label: 'Payload' },
    { key: 'paxCount', label: 'PAX' },
    { key: 'cargoLbs', label: 'Cargo' },
  ];

  const towSummary = form.estTow ? `TOW ${Number(form.estTow).toLocaleString()} lbs` : undefined;

  return (
    <CollapsibleSection title="Weights" summary={towSummary} icon={<Scale className="w-3.5 h-3.5" />} defaultOpen>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
        {fields.map(({ key, label }) => (
          <div key={key}>
            <label className="text-[9px] uppercase tracking-wider text-acars-muted font-medium">{label}</label>
            <input
              type="text"
              value={form[key] as string}
              onChange={(e) => setFormField(key as any, e.target.value)}
              placeholder="0"
              className="w-full rounded bg-acars-bg border border-acars-border text-acars-text text-[11px] px-2 py-1 font-mono outline-none focus:border-acars-blue transition-colors placeholder:text-acars-muted/30"
            />
          </div>
        ))}
      </div>
    </CollapsibleSection>
  );
}
