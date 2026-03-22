import type { DispatchFlight } from '@acars/shared';
import { useDispatchEdit } from './DispatchEditContext';

export default function RemarksSection({ flight }: { flight: DispatchFlight }) {
  const { canEditRemarks, editableFields, onFieldChange, releasedFields } = useDispatchEdit();

  const initialDispatcher = flight.flightPlanData?.dispatcherRemarks ?? '';
  const initialAuto = flight.flightPlanData?.autoRemarks ?? '';

  const dispatcherRemarks = (editableFields.dispatcherRemarks as string) ?? initialDispatcher;
  const fuelAutoRemarks = (editableFields.autoRemarks as string) ?? initialAuto;
  const hlDispatcher = releasedFields?.includes('dispatcherRemarks') ?? false;
  const hlAuto = releasedFields?.includes('autoRemarks') ?? false;

  return (
    <div className="border-t border-[var(--surface-3)] px-3 py-2.5">
      <div className="grid grid-cols-2 gap-3">
        {/* Left: Remarks */}
        <div className="space-y-3">
          <div className={hlDispatcher ? 'border-l-2 border-amber-400 bg-amber-400/5 pl-1.5' : ''}>
            <label className="text-[9px] font-medium uppercase tracking-[0.06em] text-[var(--text-muted)]/70 block mb-1">Dispatcher Remarks</label>
            {canEditRemarks ? (
              <textarea
                value={dispatcherRemarks}
                onChange={(e) => onFieldChange('dispatcherRemarks', e.target.value)}
                className="w-full h-16 rounded bg-[var(--surface-0)] border border-[var(--surface-3)] text-[var(--text-primary)] text-[12px] px-2 py-1.5 tabular-nums resize-none focus:outline-none focus:border-sky-400"
                placeholder="No dispatcher remarks"
              />
            ) : (
              <div className="w-full h-16 rounded bg-[var(--surface-0)] border border-[var(--surface-3)] text-[var(--text-primary)] text-[12px] px-2 py-1.5 tabular-nums overflow-y-auto">
                {dispatcherRemarks || <span className="text-[var(--text-muted)] italic">No dispatcher remarks</span>}
              </div>
            )}
          </div>
          <div className={hlAuto ? 'border-l-2 border-amber-400 bg-amber-400/5 pl-1.5' : ''}>
            <label className="text-[9px] font-medium uppercase tracking-[0.06em] text-[var(--text-muted)]/70 block mb-1">Fuel/Auto Remarks</label>
            {canEditRemarks ? (
              <textarea
                value={fuelAutoRemarks}
                onChange={(e) => onFieldChange('autoRemarks', e.target.value)}
                className="w-full h-16 rounded bg-[var(--surface-0)] border border-[var(--surface-3)] text-[var(--text-primary)] text-[12px] px-2 py-1.5 tabular-nums resize-none focus:outline-none focus:border-sky-400"
                placeholder="No auto remarks"
              />
            ) : (
              <div className="w-full h-16 rounded bg-[var(--surface-0)] border border-[var(--surface-3)] text-[var(--text-primary)] text-[12px] px-2 py-1.5 tabular-nums overflow-y-auto">
                {fuelAutoRemarks || <span className="text-[var(--text-muted)] italic">No auto remarks</span>}
              </div>
            )}
          </div>
        </div>

        {/* Right: System Info */}
        <div>
          <label className="text-[9px] font-medium uppercase tracking-[0.06em] text-[var(--text-muted)]/70 block mb-1">System Info</label>
          <div className="h-[140px] rounded bg-[var(--surface-0)] border border-[var(--surface-3)] text-[11px] tabular-nums px-2 py-1.5 overflow-y-auto leading-relaxed">
            {(initialDispatcher || initialAuto) ? (
              <>
                {initialDispatcher && <div className="text-[var(--text-primary)]">{initialDispatcher}</div>}
                {initialAuto && <div className="text-[var(--text-muted)] mt-1">{initialAuto}</div>}
              </>
            ) : (
              <div className="text-[var(--text-muted)] italic">No system info available</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
