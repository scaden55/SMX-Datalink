import { useFlightPlanStore } from '../../stores/flightPlanStore';

export function PlanningHeader() {
  const { form, setFormField } = useFlightPlanStore();

  return (
    <div className="px-3 py-3 border-b border-white/[0.06] space-y-2">
      <div className="grid grid-cols-2 gap-2.5">
        <div>
          <label className="planning-label mb-1">Origin</label>
          <input
            type="text"
            value={form.origin}
            onChange={(e) => setFormField('origin', e.target.value.toUpperCase())}
            placeholder="ICAO"
            maxLength={4}
            className="planning-input"
          />
        </div>
        <div>
          <label className="planning-label mb-1">Destination</label>
          <input
            type="text"
            value={form.destination}
            onChange={(e) => setFormField('destination', e.target.value.toUpperCase())}
            placeholder="ICAO"
            maxLength={4}
            className="planning-input"
          />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2.5">
        <div>
          <label className="planning-label mb-1">Flight #</label>
          <input
            type="text"
            value={form.flightNumber}
            onChange={(e) => setFormField('flightNumber', e.target.value)}
            placeholder="SMX001"
            className="planning-input"
          />
        </div>
        <div>
          <label className="planning-label mb-1">Dep Date</label>
          <input
            type="date"
            value={form.depDate}
            onChange={(e) => setFormField('depDate', e.target.value)}
            className="planning-input"
          />
        </div>
        <div>
          <label className="planning-label mb-1">ETD (Z)</label>
          <input
            type="time"
            value={form.etd}
            onChange={(e) => setFormField('etd', e.target.value)}
            className="planning-input"
          />
        </div>
      </div>
    </div>
  );
}
