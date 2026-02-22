import { Plane } from 'lucide-react';
import { CollapsibleSection } from '../common/CollapsibleSection';
import { useFlightPlanStore } from '../../stores/flightPlanStore';

export function PlanningAircraftSection() {
  const { form, setFormField, fleet } = useFlightPlanStore();

  const selected = fleet.find((a) => a.id === form.aircraftId);
  const summary = selected ? `${selected.registration} (${selected.icaoType})` : undefined;

  const handleSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = parseInt(e.target.value, 10);
    const aircraft = fleet.find((a) => a.id === id);
    if (aircraft) {
      setFormField('aircraftId', aircraft.id);
      setFormField('aircraftType', aircraft.icaoType);
    } else {
      setFormField('aircraftId', null);
      setFormField('aircraftType', '');
    }
  };

  return (
    <CollapsibleSection
      title="Aircraft"
      summary={summary}
      icon={<Plane className="w-3.5 h-3.5" />}
      status={selected ? 'green' : 'grey'}
      defaultOpen
    >
      <select
        value={form.aircraftId ?? ''}
        onChange={handleSelect}
        className="planning-select"
      >
        <option value="">Select aircraft</option>
        {fleet.map((a) => (
          <option key={a.id} value={a.id}>
            {a.registration} — {a.name} ({a.icaoType})
          </option>
        ))}
      </select>
      {selected && (
        <div className="grid grid-cols-3 gap-2.5 mt-2">
          <div>
            <span className="planning-label">Range</span>
            <span className="data-value">{selected.rangeNm.toLocaleString()} nm</span>
          </div>
          <div>
            <span className="planning-label">Cruise</span>
            <span className="data-value">{selected.cruiseSpeed} kts</span>
          </div>
          <div>
            <span className="planning-label">PAX</span>
            <span className="data-value">{selected.paxCapacity}</span>
          </div>
        </div>
      )}
    </CollapsibleSection>
  );
}
