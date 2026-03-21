import type { DispatchFlight } from '@acars/shared';
import AccordionSection from './AccordionSection';
import { useDispatchEdit } from './DispatchEditContext';

const inputClass =
  'bg-[var(--surface-2)] border border-[var(--surface-3)] rounded px-1.5 py-1 font-mono text-[11px] tabular-nums text-[var(--text-primary)] w-full resize-y min-h-[48px]';

export default function MelAccordion({ flight }: { flight: DispatchFlight }) {
  const { editableFields, onFieldChange, canEditMEL, releasedFields } = useDispatchEdit();

  const melRestrictions =
    (editableFields.melRestrictions as string) ??
    flight.flightPlanData?.melRestrictions ??
    '';

  const hasRestrictions = melRestrictions.trim().length > 0;
  const isReleased = releasedFields?.includes('melRestrictions') ?? false;
  const releasedClass = isReleased ? 'border-l-2 border-l-amber-400 bg-amber-400/5 pl-1' : '';

  const summary = hasRestrictions
    ? `${melRestrictions.trim().split('\n').length} restriction${melRestrictions.trim().split('\n').length > 1 ? 's' : ''}`
    : 'None';

  return (
    <AccordionSection
      title="MEL"
      summary={summary}
      status={hasRestrictions ? 'amber' : 'green'}
    >
      <div className={releasedClass}>
        {canEditMEL ? (
          <textarea
            value={melRestrictions}
            onChange={(e) => onFieldChange('melRestrictions', e.target.value)}
            rows={3}
            className={inputClass}
            placeholder="Enter MEL restrictions..."
          />
        ) : (
          <div className="font-mono text-[11px] tabular-nums text-[var(--text-primary)] whitespace-pre-wrap">
            {melRestrictions || 'No restrictions'}
          </div>
        )}
      </div>
    </AccordionSection>
  );
}
