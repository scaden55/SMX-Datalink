import { useFlightPlanStore } from '../../stores/flightPlanStore';

export function PlanningHeader() {
  const { form, setFormField } = useFlightPlanStore();

  return (
    <div className="px-3 py-3 border-b border-acars-border space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[10px] uppercase tracking-wider text-acars-muted font-medium mb-1 block">Origin</label>
          <input
            type="text"
            value={form.origin}
            onChange={(e) => setFormField('origin', e.target.value.toUpperCase())}
            placeholder="ICAO"
            maxLength={4}
            className="w-full rounded bg-acars-bg border border-acars-border text-acars-text text-[11px] px-2 py-1.5 font-mono outline-none focus:border-acars-blue transition-colors placeholder:text-acars-muted/50"
          />
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-wider text-acars-muted font-medium mb-1 block">Destination</label>
          <input
            type="text"
            value={form.destination}
            onChange={(e) => setFormField('destination', e.target.value.toUpperCase())}
            placeholder="ICAO"
            maxLength={4}
            className="w-full rounded bg-acars-bg border border-acars-border text-acars-text text-[11px] px-2 py-1.5 font-mono outline-none focus:border-acars-blue transition-colors placeholder:text-acars-muted/50"
          />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="text-[10px] uppercase tracking-wider text-acars-muted font-medium mb-1 block">Flight #</label>
          <input
            type="text"
            value={form.flightNumber}
            onChange={(e) => setFormField('flightNumber', e.target.value)}
            placeholder="SMX001"
            className="w-full rounded bg-acars-bg border border-acars-border text-acars-text text-[11px] px-2 py-1.5 font-mono outline-none focus:border-acars-blue transition-colors placeholder:text-acars-muted/50"
          />
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-wider text-acars-muted font-medium mb-1 block">Dep Date</label>
          <input
            type="date"
            value={form.depDate}
            onChange={(e) => setFormField('depDate', e.target.value)}
            className="w-full rounded bg-acars-bg border border-acars-border text-acars-text text-[11px] px-2 py-1.5 font-mono outline-none focus:border-acars-blue transition-colors"
          />
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-wider text-acars-muted font-medium mb-1 block">ETD (Z)</label>
          <input
            type="time"
            value={form.etd}
            onChange={(e) => setFormField('etd', e.target.value)}
            className="w-full rounded bg-acars-bg border border-acars-border text-acars-text text-[11px] px-2 py-1.5 font-mono outline-none focus:border-acars-blue transition-colors"
          />
        </div>
      </div>
    </div>
  );
}
