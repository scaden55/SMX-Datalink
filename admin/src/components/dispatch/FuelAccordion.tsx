import type { DispatchFlight } from '@acars/shared';
import AccordionSection from './AccordionSection';
import { useDispatchEdit } from './DispatchEditContext';

const labelClass = 'text-[10px] text-[var(--text-secondary)]';
const valueClass = 'font-mono text-[11px] tabular-nums text-[var(--text-primary)] text-right';
const inputClass =
  'bg-[var(--surface-2)] border border-[var(--surface-3)] rounded px-1.5 py-0.5 font-mono text-[11px] tabular-nums text-[var(--text-primary)] w-full text-right';

function FuelRow({
  label,
  fieldKey,
  value,
  editable,
  bold,
  onFieldChange,
  isReleased,
}: {
  label: string;
  fieldKey?: string;
  value: string;
  editable: boolean;
  bold?: boolean;
  onFieldChange?: (key: string, value: string) => void;
  isReleased?: boolean;
}) {
  const releasedClass = isReleased ? 'border-l-2 border-l-amber-400 bg-amber-400/5 pl-1' : '';
  return (
    <div className={`flex items-center justify-between py-0.5 ${releasedClass} ${bold ? 'font-semibold' : ''}`}>
      <span className={labelClass}>{label}</span>
      {editable && fieldKey && onFieldChange ? (
        <input
          type="text"
          value={value}
          onChange={(e) => onFieldChange(fieldKey, e.target.value)}
          className={`${inputClass} max-w-[90px]`}
        />
      ) : (
        <span className={valueClass}>{value || '—'}</span>
      )}
    </div>
  );
}

export default function FuelAccordion({ flight }: { flight: DispatchFlight }) {
  const { editableFields, onFieldChange, canEditFuel, releasedFields } = useDispatchEdit();

  const get = (key: string) =>
    (editableFields as Record<string, string>)[key] ??
    (flight.flightPlanData as Record<string, string> | null)?.[key] ??
    '';

  const fuelBurn = get('fuelBurn');
  const fuelContingency = get('fuelContingency');
  const fuelReserve = get('fuelReserve');
  const fuelAlternate = get('fuelAlternate');
  const fuelExtra = get('fuelExtra');
  const fuelTaxi = get('fuelTaxi');
  const fuelTotal = get('fuelTotal');

  const totalNum = parseFloat(fuelTotal) || 0;
  const taxiNum = parseFloat(fuelTaxi) || 0;
  const planTO = totalNum > 0 && taxiNum >= 0 ? String(totalNum - taxiNum) : '';

  const isReleased = (key: string) => releasedFields?.includes(key) ?? false;
  const hasFuel = totalNum > 0;

  const summary = hasFuel
    ? `${fuelTotal} lbs total · ${fuelBurn} burn`
    : 'No fuel data';

  return (
    <AccordionSection
      title="Fuel"
      summary={summary}
      status={hasFuel ? 'green' : 'neutral'}
    >
      <div className="space-y-0.5">
        <FuelRow
          label="Trip / Burn"
          fieldKey="fuelBurn"
          value={fuelBurn}
          editable={canEditFuel}
          onFieldChange={onFieldChange as any}
          isReleased={isReleased('fuelBurn')}
        />
        <FuelRow
          label="Contingency"
          fieldKey="fuelContingency"
          value={fuelContingency}
          editable={canEditFuel}
          onFieldChange={onFieldChange as any}
          isReleased={isReleased('fuelContingency')}
        />
        <FuelRow
          label="Reserve"
          fieldKey="fuelReserve"
          value={fuelReserve}
          editable={canEditFuel}
          onFieldChange={onFieldChange as any}
          isReleased={isReleased('fuelReserve')}
        />
        <FuelRow
          label="Alternate"
          fieldKey="fuelAlternate"
          value={fuelAlternate}
          editable={canEditFuel}
          onFieldChange={onFieldChange as any}
          isReleased={isReleased('fuelAlternate')}
        />
        <FuelRow
          label="Extra"
          fieldKey="fuelExtra"
          value={fuelExtra}
          editable={canEditFuel}
          onFieldChange={onFieldChange as any}
          isReleased={isReleased('fuelExtra')}
        />
        <div className="border-t border-[var(--surface-3)] my-1" />
        <FuelRow label="Plan T/O" value={planTO} editable={false} bold />
        <FuelRow
          label="Taxi"
          fieldKey="fuelTaxi"
          value={fuelTaxi}
          editable={canEditFuel}
          onFieldChange={onFieldChange as any}
          isReleased={isReleased('fuelTaxi')}
        />
        <div className="border-t border-[var(--surface-3)] my-1" />
        <FuelRow
          label="Plan Gate"
          fieldKey="fuelTotal"
          value={fuelTotal}
          editable={canEditFuel}
          bold
          onFieldChange={onFieldChange as any}
          isReleased={isReleased('fuelTotal')}
        />
      </div>
    </AccordionSection>
  );
}
