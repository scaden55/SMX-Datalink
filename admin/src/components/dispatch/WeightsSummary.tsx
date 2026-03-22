import type { DispatchFlight } from '@acars/shared';
import { useDispatchEdit } from './DispatchEditContext';

function fmt(val: number | string | undefined | null): string {
  if (val === null || val === undefined || val === '') return '---';
  const n = typeof val === 'string' ? Number(val) : val;
  if (isNaN(n)) return '---';
  return Math.round(n).toLocaleString();
}

interface FieldProps {
  label: string;
  value: string;
  sub?: string;
  warn?: boolean;
  editable?: boolean;
  fieldKey?: string;
  onFieldChange?: (key: string, val: string | number) => void;
  highlighted?: boolean;
}

function Field({ label, value, sub, warn, editable, fieldKey, onFieldChange, highlighted }: FieldProps) {
  const boxCls = `bg-[var(--surface-2)] border border-[var(--surface-3)] text-[12px] tabular-nums rounded-md px-1.5 py-0.5 w-full truncate outline-none focus:border-blue-400 ${warn ? 'text-amber-400' : 'text-[var(--text-primary)]'}`;

  return (
    <div className={`flex flex-col items-start min-w-0 flex-1 ${highlighted ? 'border-l-2 border-amber-400 bg-amber-400/5 pl-1' : ''}`}>
      <span className="text-[9px] font-medium uppercase tracking-[0.06em] text-[var(--text-muted)]/70">{label}</span>
      {editable && fieldKey && onFieldChange ? (
        <input
          type="text"
          value={value}
          onChange={(e) => onFieldChange(fieldKey, e.target.value)}
          className={boxCls}
        />
      ) : (
        <div className={boxCls}>
          {value}
        </div>
      )}
      {sub && <span className="text-[9px] text-[var(--text-muted)]/50">{sub}</span>}
    </div>
  );
}

export default function WeightsSummary({ flight }: { flight: DispatchFlight }) {
  const w = flight.ofpJson?.weights;
  const f = flight.ofpJson?.fuel;
  const { canEditFuel, editableFields, onFieldChange, releasedFields } = useDispatchEdit();
  const hl = (key: string) => releasedFields?.includes(key) ?? false;

  // Contingency fuel: default 5% of planned burn
  const contingencyRaw = editableFields.fuelContingency ?? f?.contingencyLbs;
  const contingencyPct = f?.burnLbs ? Math.round(((Number(contingencyRaw) || 0) / f.burnLbs) * 100) : null;

  return (
    <div className="border-b border-[var(--surface-3)] px-3 py-1.5 space-y-1.5">
      {/* Row 1: Weights */}
      <div className="flex items-start gap-1.5">
        <Field
          label="ZFW"
          value={`${fmt(w?.estZfw)} lbs`}
          sub={w?.maxZfw ? `Max ${fmt(w.maxZfw)} lbs` : undefined}
        />
        <Field
          label="Plan Gate"
          value={String(editableFields.fuelTotal ?? f?.totalLbs ?? '---')}
          sub={w?.maxTow ? `Max ${fmt(w.maxTow)} lbs` : undefined}
          editable={canEditFuel}
          fieldKey="fuelTotal"
          onFieldChange={onFieldChange}
          highlighted={hl('fuelTotal')}
        />
        <Field
          label="Taxi Out"
          value={String(editableFields.fuelTaxi ?? f?.taxiLbs ?? '---')}
          sub={f?.taxiLbs ? `${fmt(f.taxiLbs)} lbs` : undefined}
          editable={canEditFuel}
          fieldKey="fuelTaxi"
          onFieldChange={onFieldChange}
          highlighted={hl('fuelTaxi')}
        />
        <Field
          label="CF"
          value={String(editableFields.fuelContingency ?? f?.contingencyLbs ?? '---')}
          sub={contingencyPct !== null ? `${contingencyPct}% of burn` : undefined}
          editable={canEditFuel}
          fieldKey="fuelContingency"
          onFieldChange={onFieldChange}
          highlighted={hl('fuelContingency')}
        />
        <Field
          label="Extra"
          value={String(editableFields.fuelExtra ?? f?.extraLbs ?? '---')}
          sub="pilot disc."
          editable={canEditFuel}
          fieldKey="fuelExtra"
          onFieldChange={onFieldChange}
          highlighted={hl('fuelExtra')}
        />
        <Field
          label="ACF"
          value={`${fmt(editableFields.fuelAlternate ?? f?.alternateLbs)} lbs`}
          sub={w?.estLdw ? `LDW ${fmt(w.estLdw)} lbs` : undefined}
        />
        <Field
          label="REMF"
          value={String(editableFields.fuelReserve ?? f?.reserveLbs ?? '---')}
          sub="FAA reserve"
          editable={canEditFuel}
          fieldKey="fuelReserve"
          onFieldChange={onFieldChange}
          highlighted={hl('fuelReserve')}
        />
      </div>
    </div>
  );
}
