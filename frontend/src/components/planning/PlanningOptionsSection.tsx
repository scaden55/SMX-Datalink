import { GearSix } from '@phosphor-icons/react';
import { CollapsibleSection } from '../common/CollapsibleSection';
import { useFlightPlanStore } from '../../stores/flightPlanStore';

export function PlanningOptionsSection() {
  const { form, setFormField } = useFlightPlanStore();

  const summary = [form.cruiseFL, form.flightRules, form.costIndex ? `CI ${form.costIndex}` : ''].filter(Boolean).join(' / ') || undefined;

  return (
    <CollapsibleSection
      title="Options"
      summary={summary}
      icon={<GearSix className="w-3.5 h-3.5" />}
      status={form.cruiseFL ? 'green' : 'grey'}
      defaultOpen
    >
      <div className="grid grid-cols-3 gap-2.5">
        <div>
          <label className="planning-label mb-1">Cruise FL</label>
          <input
            type="text"
            value={form.cruiseFL}
            onChange={(e) => setFormField('cruiseFL', e.target.value.toUpperCase())}
            placeholder="FL350"
            className="planning-input"
          />
        </div>
        <div>
          <label className="planning-label mb-1">Rules</label>
          <select
            value={form.flightRules}
            onChange={(e) => setFormField('flightRules', e.target.value as 'IFR' | 'VFR')}
            className="planning-select"
          >
            <option value="IFR">IFR</option>
            <option value="VFR">VFR</option>
          </select>
        </div>
        <div>
          <label className="planning-label mb-1">Cost Idx</label>
          <input
            type="text"
            value={form.costIndex}
            onChange={(e) => setFormField('costIndex', e.target.value)}
            placeholder="0"
            className="planning-input"
          />
        </div>
      </div>
    </CollapsibleSection>
  );
}
