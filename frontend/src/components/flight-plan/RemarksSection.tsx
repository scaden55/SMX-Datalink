import { useDispatchEdit } from '../../contexts/DispatchEditContext';

interface RemarksSectionProps {
  dispatcherRemarks?: string;
  autoRemarks?: string;
}

export function RemarksSection({ dispatcherRemarks: initialDispatcher = '', autoRemarks: initialAuto = '' }: RemarksSectionProps) {
  const { canEditRemarks, editableFields, onFieldChange } = useDispatchEdit();

  const dispatcherRemarks = editableFields.dispatcherRemarks ?? initialDispatcher;
  const fuelAutoRemarks = editableFields.autoRemarks ?? initialAuto;

  return (
    <div className="border-t border-acars-border px-3 py-2.5">
      <div className="grid grid-cols-2 gap-3">
        {/* Left: Remarks */}
        <div className="space-y-3">
          <div>
            <label className="data-label block mb-1">Dispatcher Remarks</label>
            {canEditRemarks ? (
              <textarea
                value={dispatcherRemarks}
                onChange={(e) => onFieldChange('dispatcherRemarks', e.target.value)}
                className="w-full h-16 rounded bg-acars-bg border border-acars-border text-acars-text text-[11px] px-2 py-1.5 font-mono resize-none focus:outline-none focus:border-sky-400"
                placeholder="No dispatcher remarks"
              />
            ) : (
              <div className="w-full h-16 rounded bg-acars-bg border border-acars-border text-acars-text text-[11px] px-2 py-1.5 font-mono overflow-y-auto">
                {dispatcherRemarks || <span className="text-acars-muted italic">No dispatcher remarks</span>}
              </div>
            )}
          </div>
          <div>
            <label className="data-label block mb-1">Fuel/Auto Remarks</label>
            {canEditRemarks ? (
              <textarea
                value={fuelAutoRemarks}
                onChange={(e) => onFieldChange('autoRemarks', e.target.value)}
                className="w-full h-16 rounded bg-acars-bg border border-acars-border text-acars-text text-[11px] px-2 py-1.5 font-mono resize-none focus:outline-none focus:border-sky-400"
                placeholder="No auto remarks"
              />
            ) : (
              <div className="w-full h-16 rounded bg-acars-bg border border-acars-border text-acars-text text-[11px] px-2 py-1.5 font-mono overflow-y-auto">
                {fuelAutoRemarks || <span className="text-acars-muted italic">No auto remarks</span>}
              </div>
            )}
          </div>
        </div>

        {/* Right: System Info */}
        <div>
          <label className="data-label block mb-1">System Info</label>
          <div className="h-[140px] rounded bg-acars-bg border border-acars-border text-[10px] font-mono px-2 py-1.5 overflow-y-auto leading-relaxed">
            {(initialDispatcher || initialAuto) ? (
              <>
                {initialDispatcher && <div className="text-acars-text">{initialDispatcher}</div>}
                {initialAuto && <div className="text-acars-muted mt-1">{initialAuto}</div>}
              </>
            ) : (
              <div className="text-acars-muted italic">No system info available</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
