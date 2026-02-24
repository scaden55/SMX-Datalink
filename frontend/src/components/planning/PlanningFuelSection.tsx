import { Fuel } from 'lucide-react';
import { CollapsibleSection } from '../common/CollapsibleSection';
import { useFlightPlanStore } from '../../stores/flightPlanStore';
import type { FlightPlanFormData } from '@acars/shared';

type FuelField = 'fuelBurn' | 'fuelPlanned' | 'fuelExtra' | 'fuelAlternate' | 'fuelReserve' | 'fuelTaxi' | 'fuelContingency' | 'fuelTotal';

export function PlanningFuelSection() {
  const { form, setFormField } = useFlightPlanStore();

  const fields: { key: FuelField; label: string }[] = [
    { key: 'fuelBurn', label: 'Burn' },
    { key: 'fuelPlanned', label: 'Planned' },
    { key: 'fuelExtra', label: 'Extra' },
    { key: 'fuelAlternate', label: 'Alternate' },
    { key: 'fuelReserve', label: 'Reserve' },
    { key: 'fuelTaxi', label: 'Taxi' },
    { key: 'fuelContingency', label: 'Cont.' },
    { key: 'fuelTotal', label: 'Total' },
  ];

  const totalSummary = form.fuelTotal ? `${Number(form.fuelTotal).toLocaleString()} lbs` : undefined;

  return (
    <CollapsibleSection
      title="Fuel"
      summary={totalSummary}
      icon={<Fuel className="w-3.5 h-3.5" />}
      status={form.fuelTotal ? 'green' : 'grey'}
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
