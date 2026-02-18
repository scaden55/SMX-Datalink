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
    <CollapsibleSection title="Aircraft" summary={summary} icon={<Plane className="w-3.5 h-3.5" />} defaultOpen>
      <select
        value={form.aircraftId ?? ''}
        onChange={handleSelect}
        className="w-full rounded bg-acars-bg border border-acars-border text-acars-text text-[11px] px-2 py-1.5 outline-none focus:border-acars-blue transition-colors"
      >
        <option value="">Select aircraft</option>
        {fleet.map((a) => (
          <option key={a.id} value={a.id}>
            {a.registration} — {a.name} ({a.icaoType})
          </option>
        ))}
      </select>
      {selected && (
        <div className="grid grid-cols-3 gap-2 mt-2 text-[10px]">
          <div>
            <span className="text-acars-muted block">Range</span>
            <span className="text-acars-text font-mono">{selected.rangeNm.toLocaleString()} nm</span>
          </div>
          <div>
            <span className="text-acars-muted block">Cruise</span>
            <span className="text-acars-text font-mono">{selected.cruiseSpeed} kts</span>
          </div>
          <div>
            <span className="text-acars-muted block">PAX</span>
            <span className="text-acars-text font-mono">{selected.paxCapacity}</span>
          </div>
        </div>
      )}
    </CollapsibleSection>
  );
}
