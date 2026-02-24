import { ChatText } from '@phosphor-icons/react';
import { CollapsibleSection } from '../common/CollapsibleSection';
import { useFlightPlanStore } from '../../stores/flightPlanStore';

export function PlanningRemarksSection() {
  const { form, setFormField } = useFlightPlanStore();

  return (
    <CollapsibleSection
      title="Remarks"
      icon={<ChatText className="w-3.5 h-3.5" />}
      status={form.dispatcherRemarks ? 'green' : 'grey'}
      defaultOpen
    >
      <div className="space-y-2">
        <div>
          <label className="planning-label mb-1">Dispatcher</label>
          <textarea
            value={form.dispatcherRemarks}
            onChange={(e) => setFormField('dispatcherRemarks', e.target.value)}
            placeholder="Dispatcher remarks..."
            rows={2}
            className="planning-textarea"
          />
        </div>
        <div>
          <label className="planning-label mb-1">Auto / GasPump</label>
          <textarea
            value={form.autoRemarks}
            onChange={(e) => setFormField('autoRemarks', e.target.value)}
            placeholder="Auto-generated remarks..."
            rows={2}
            className="planning-textarea"
          />
        </div>
      </div>
    </CollapsibleSection>
  );
}
