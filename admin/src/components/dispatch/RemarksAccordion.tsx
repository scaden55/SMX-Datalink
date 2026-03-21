import type { DispatchFlight } from '@acars/shared';
import AccordionSection from './AccordionSection';
import { useDispatchEdit } from './DispatchEditContext';

const labelClass = 'text-[8px] text-[var(--text-muted)] uppercase tracking-wider mb-0.5';
const inputClass =
  'bg-[var(--surface-2)] border border-[var(--surface-3)] rounded px-1.5 py-1 font-mono text-[11px] tabular-nums text-[var(--text-primary)] w-full resize-y min-h-[40px]';

export default function RemarksAccordion({ flight }: { flight: DispatchFlight }) {
  const { editableFields, onFieldChange, canEditRemarks, releasedFields } = useDispatchEdit();

  const dispatcherRemarks =
    (editableFields.dispatcherRemarks as string) ??
    flight.flightPlanData?.dispatcherRemarks ??
    '';

  const autoRemarks =
    (editableFields.autoRemarks as string) ??
    flight.flightPlanData?.autoRemarks ??
    '';

  const isReleased = (key: string) => releasedFields?.includes(key) ?? false;
  const releasedClass = (key: string) =>
    isReleased(key) ? 'border-l-2 border-l-amber-400 bg-amber-400/5 pl-1' : '';

  const hasRemarks = dispatcherRemarks.trim().length > 0 || autoRemarks.trim().length > 0;

  return (
    <AccordionSection
      title="Remarks"
      summary={hasRemarks ? 'Has remarks' : 'None'}
      status="neutral"
    >
      <div className="space-y-2">
        <div className={releasedClass('dispatcherRemarks')}>
          <div className={labelClass}>Dispatcher Remarks</div>
          {canEditRemarks ? (
            <textarea
              value={dispatcherRemarks}
              onChange={(e) => onFieldChange('dispatcherRemarks', e.target.value)}
              rows={2}
              className={inputClass}
              placeholder="Enter dispatcher remarks..."
            />
          ) : (
            <div className="font-mono text-[11px] tabular-nums text-[var(--text-primary)] whitespace-pre-wrap">
              {dispatcherRemarks || '—'}
            </div>
          )}
        </div>

        <div className={releasedClass('autoRemarks')}>
          <div className={labelClass}>Auto / Fuel Remarks</div>
          {canEditRemarks ? (
            <textarea
              value={autoRemarks}
              onChange={(e) => onFieldChange('autoRemarks', e.target.value)}
              rows={2}
              className={inputClass}
              placeholder="Auto-generated remarks..."
            />
          ) : (
            <div className="font-mono text-[11px] tabular-nums text-[var(--text-primary)] whitespace-pre-wrap">
              {autoRemarks || '—'}
            </div>
          )}
        </div>
      </div>
    </AccordionSection>
  );
}
