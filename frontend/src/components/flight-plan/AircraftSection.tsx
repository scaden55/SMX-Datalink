import { useDispatchEdit } from '../../contexts/DispatchEditContext';
import type { FlightPlanFormData } from '@acars/shared';

interface AircraftSectionProps {
  title: string;
  tailNumber: string;
  type: string;
  formData?: FlightPlanFormData | null;
}

export function AircraftSection({ title, tailNumber, type, formData }: AircraftSectionProps) {
  const { canEdit, editableFields, onFieldChange } = useDispatchEdit();

  const cruiseFL = editableFields.cruiseFL ?? formData?.cruiseFL ?? '';
  const costIdx = editableFields.costIndex ?? formData?.costIndex ?? '';
  const aobFL = editableFields.aobFL ?? formData?.aobFL ?? '';
  const pic = editableFields.pic ?? formData?.pic ?? '';

  const inputCls = "bg-acars-input border border-acars-border text-[11px] font-mono text-[#cdd1d8] rounded-md px-1.5 py-0.5 outline-none focus:border-blue-400 truncate w-full";

  return (
    <div className="border-b border-acars-border px-3 py-2 space-y-2">
      {/* Row 1: Aircraft / Cruise / CI / AOB */}
      <div className="flex items-end gap-1.5">
        {/* Aircraft — read-only (from SimConnect telemetry) */}
        <div className="flex flex-col min-w-0 flex-[2]">
          <span className="text-[9px] font-sans text-[#656b75] mb-0.5">Aircraft</span>
          <input type="text" value={`${tailNumber} (${type})`} readOnly className={inputCls} />
        </div>
        {/* Cruise — editable */}
        <div className="flex flex-col min-w-0 flex-1">
          <span className="text-[9px] font-sans text-[#656b75] mb-0.5">Cruise</span>
          <input
            type="text"
            value={cruiseFL}
            onChange={(e) => onFieldChange('cruiseFL', e.target.value.toUpperCase())}
            readOnly={!canEdit}
            placeholder="FL350"
            className={inputCls}
          />
        </div>
        {/* CI Value — editable */}
        <div className="flex flex-col min-w-0 flex-1">
          <span className="text-[9px] font-sans text-[#656b75] mb-0.5">CI Value</span>
          <input
            type="text"
            value={costIdx}
            onChange={(e) => onFieldChange('costIndex', e.target.value)}
            readOnly={!canEdit}
            placeholder="0"
            className={inputCls}
          />
        </div>
        {/* AOB FL — editable */}
        <div className="flex flex-col min-w-0 flex-1">
          <span className="text-[9px] font-sans text-[#656b75] mb-0.5">AOB FL</span>
          <input
            type="text"
            value={aobFL}
            onChange={(e) => onFieldChange('aobFL', e.target.value.toUpperCase())}
            readOnly={!canEdit}
            placeholder="FL350"
            className={inputCls}
          />
        </div>
      </div>
      {/* Row 2: Pilot in Command — editable, auto-filled from SimBrief */}
      <div className="flex items-end gap-1.5">
        <div className="flex flex-col flex-1 min-w-0">
          <span className="text-[9px] font-sans text-[#656b75] mb-0.5">Pilot in Command</span>
          <input
            type="text"
            value={pic || (title !== '---' ? `${title} | PIC | Left Seat` : '---')}
            onChange={(e) => onFieldChange('pic', e.target.value)}
            readOnly={!canEdit}
            className={inputCls}
          />
        </div>
      </div>
    </div>
  );
}
