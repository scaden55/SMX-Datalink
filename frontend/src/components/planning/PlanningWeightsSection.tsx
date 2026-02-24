import { Scales } from '@phosphor-icons/react';
import { CollapsibleSection } from '../common/CollapsibleSection';
import { useFlightPlanStore } from '../../stores/flightPlanStore';
import type { FlightPlanFormData } from '@acars/shared';

type WeightField = 'estZfw' | 'estTow' | 'estLdw' | 'payload' | 'paxCount' | 'cargoLbs';

export function PlanningWeightsSection() {
  const { form, setFormField } = useFlightPlanStore();

  const fields: { key: WeightField; label: string }[] = [
    { key: 'estZfw', label: 'ZFW' },
    { key: 'estTow', label: 'TOW' },
    { key: 'estLdw', label: 'LDW' },
    { key: 'payload', label: 'Payload' },
    { key: 'paxCount', label: 'PAX' },
    { key: 'cargoLbs', label: 'Cargo' },
  ];

  const towSummary = form.estTow ? `TOW ${Number(form.estTow).toLocaleString()} lbs` : undefined;

  return (
    <CollapsibleSection
      title="Weights"
      summary={towSummary}
      icon={<Scales className="w-3.5 h-3.5" />}
      status={form.estTow ? 'green' : 'grey'}
      defaultOpen
    >
      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
        {fields.map(({ key, label }) => (
          <div key={key}>
            <label className="planning-label">{label}</label>
            <input
              type="text"
              value={form[key]}
              onChange={(e) => setFormField(key, e.target.value)}
              placeholder="0"
              className="planning-input"
            />
          </div>
        ))}
      </div>
    </CollapsibleSection>
  );
}
