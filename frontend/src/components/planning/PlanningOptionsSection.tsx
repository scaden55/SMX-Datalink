import { Settings2 } from 'lucide-react';
import { CollapsibleSection } from '../common/CollapsibleSection';
import { useFlightPlanStore } from '../../stores/flightPlanStore';

export function PlanningOptionsSection() {
  const { form, setFormField } = useFlightPlanStore();

  const summary = [form.cruiseFL, form.flightRules, form.costIndex ? `CI ${form.costIndex}` : ''].filter(Boolean).join(' / ') || undefined;

  return (
    <CollapsibleSection title="Options" summary={summary} icon={<Settings2 className="w-3.5 h-3.5" />} defaultOpen>
      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="text-[9px] uppercase tracking-wider text-acars-muted font-medium mb-1 block">Cruise FL</label>
          <input
            type="text"
            value={form.cruiseFL}
            onChange={(e) => setFormField('cruiseFL', e.target.value.toUpperCase())}
            placeholder="FL350"
            className="w-full rounded bg-acars-bg border border-acars-border text-acars-text text-[11px] px-2 py-1.5 font-mono outline-none focus:border-acars-blue transition-colors placeholder:text-acars-muted/50"
          />
        </div>
        <div>
          <label className="text-[9px] uppercase tracking-wider text-acars-muted font-medium mb-1 block">Rules</label>
          <select
            value={form.flightRules}
            onChange={(e) => setFormField('flightRules', e.target.value as 'IFR' | 'VFR')}
            className="w-full rounded bg-acars-bg border border-acars-border text-acars-text text-[11px] px-2 py-1.5 outline-none focus:border-acars-blue transition-colors"
          >
            <option value="IFR">IFR</option>
            <option value="VFR">VFR</option>
          </select>
        </div>
        <div>
          <label className="text-[9px] uppercase tracking-wider text-acars-muted font-medium mb-1 block">Cost Idx</label>
          <input
            type="text"
            value={form.costIndex}
            onChange={(e) => setFormField('costIndex', e.target.value)}
            placeholder="0"
            className="w-full rounded bg-acars-bg border border-acars-border text-acars-text text-[11px] px-2 py-1.5 font-mono outline-none focus:border-acars-blue transition-colors placeholder:text-acars-muted/50"
          />
        </div>
      </div>
    </CollapsibleSection>
  );
}
