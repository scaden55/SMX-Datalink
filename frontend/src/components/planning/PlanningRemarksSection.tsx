import { MessageSquare } from 'lucide-react';
import { CollapsibleSection } from '../common/CollapsibleSection';
import { useFlightPlanStore } from '../../stores/flightPlanStore';

export function PlanningRemarksSection() {
  const { form, setFormField } = useFlightPlanStore();

  return (
    <CollapsibleSection title="Remarks" icon={<MessageSquare className="w-3.5 h-3.5" />} defaultOpen>
      <div className="space-y-2">
        <div>
          <label className="text-[9px] uppercase tracking-wider text-acars-muted font-medium mb-1 block">Dispatcher</label>
          <textarea
            value={form.dispatcherRemarks}
            onChange={(e) => setFormField('dispatcherRemarks', e.target.value)}
            placeholder="Dispatcher remarks..."
            rows={2}
            className="w-full rounded bg-acars-bg border border-acars-border text-acars-text text-[11px] px-2 py-1.5 font-mono outline-none focus:border-acars-blue transition-colors resize-none placeholder:text-acars-muted/50"
          />
        </div>
        <div>
          <label className="text-[9px] uppercase tracking-wider text-acars-muted font-medium mb-1 block">Auto / Fuel</label>
          <textarea
            value={form.autoRemarks}
            onChange={(e) => setFormField('autoRemarks', e.target.value)}
            placeholder="Auto-generated remarks..."
            rows={2}
            className="w-full rounded bg-acars-bg border border-acars-border text-acars-text text-[11px] px-2 py-1.5 font-mono outline-none focus:border-acars-blue transition-colors resize-none placeholder:text-acars-muted/50"
          />
        </div>
      </div>
    </CollapsibleSection>
  );
}
