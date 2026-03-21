import type { DispatchFlight } from '@acars/shared';
import { useDispatchEdit } from './DispatchEditContext';

const labelClass = 'text-[8px] text-[var(--text-muted)] uppercase tracking-wider';
const valueClass = 'font-mono text-[11px] tabular-nums text-[var(--text-primary)]';
const inputClass =
  'bg-[var(--surface-2)] border border-[var(--surface-3)] rounded px-1.5 py-0.5 font-mono text-[11px] tabular-nums text-[var(--text-primary)] w-full';

function EditableCell({
  label,
  fieldKey,
  value,
  canEdit,
  onFieldChange,
  isReleased,
}: {
  label: string;
  fieldKey: string;
  value: string;
  canEdit: boolean;
  onFieldChange: (key: string, value: string | number) => void;
  isReleased: boolean;
}) {
  const releasedClass = isReleased ? 'border-l-2 border-l-amber-400 bg-amber-400/5 pl-1' : '';
  return (
    <div className={releasedClass}>
      <div className={labelClass}>{label}</div>
      {canEdit ? (
        <input
          type="text"
          value={value}
          onChange={(e) => onFieldChange(fieldKey, e.target.value)}
          className={inputClass}
        />
      ) : (
        <div className={valueClass}>{value || '—'}</div>
      )}
    </div>
  );
}

export default function AircraftSection({ flight }: { flight: DispatchFlight }) {
  const { editableFields, onFieldChange, canEdit, releasedFields } = useDispatchEdit();

  const isReleased = (key: string) => releasedFields?.includes(key) ?? false;

  const cruiseFL = (editableFields.cruiseFL as string) ?? flight.flightPlanData?.cruiseFL ?? '';
  const costIndex = (editableFields.costIndex as string) ?? flight.flightPlanData?.costIndex ?? '';
  const depRunway = (editableFields.depRunway as string) ?? flight.flightPlanData?.depRunway ?? '';
  const arrRunway = (editableFields.arrRunway as string) ?? flight.flightPlanData?.arrRunway ?? '';
  const paxCount = (editableFields.paxCount as string) ?? flight.flightPlanData?.paxCount ?? '';

  return (
    <div className="bg-[var(--surface-1)] border border-[var(--surface-3)] rounded-md px-3 py-2.5">
      <div className="grid grid-cols-3 gap-x-3 gap-y-2">
        {/* Aircraft Type — always read-only */}
        <div>
          <div className={labelClass}>Aircraft Type</div>
          <div className={valueClass}>{flight.bid.aircraftType || '—'}</div>
        </div>

        <EditableCell
          label="Cruise FL"
          fieldKey="cruiseFL"
          value={cruiseFL}
          canEdit={canEdit}
          onFieldChange={onFieldChange}
          isReleased={isReleased('cruiseFL')}
        />
        <EditableCell
          label="Cost Index"
          fieldKey="costIndex"
          value={String(costIndex)}
          canEdit={canEdit}
          onFieldChange={(k, v) => onFieldChange(k, Number(v) || 0)}
          isReleased={isReleased('costIndex')}
        />
        <EditableCell
          label="Dep Runway"
          fieldKey="depRunway"
          value={depRunway}
          canEdit={canEdit}
          onFieldChange={onFieldChange}
          isReleased={isReleased('depRunway')}
        />
        <EditableCell
          label="Arr Runway"
          fieldKey="arrRunway"
          value={arrRunway}
          canEdit={canEdit}
          onFieldChange={onFieldChange}
          isReleased={isReleased('arrRunway')}
        />
        <EditableCell
          label="PAX Count"
          fieldKey="paxCount"
          value={String(paxCount)}
          canEdit={canEdit}
          onFieldChange={(k, v) => onFieldChange(k, Number(v) || 0)}
          isReleased={isReleased('paxCount')}
        />
      </div>
    </div>
  );
}
