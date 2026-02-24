import { useFlightPlanStore } from '../../stores/flightPlanStore';
import { useDispatchEdit } from '../../contexts/DispatchEditContext';
import type { SimBriefWeights, SimBriefFuel } from '@acars/shared';

interface WeightsSectionProps {
  ofpWeights?: SimBriefWeights | null;
  ofpFuel?: SimBriefFuel | null;
  liveFuelLbs?: number | null;
}

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
  onFieldChange?: (key: string, val: string) => void;
}

function Field({ label, value, sub, warn, editable, fieldKey, onFieldChange }: FieldProps) {
  const boxStyle = { color: warn ? '#f59e0b' : '#dde1e8' };
  const boxCls = "bg-acars-input border border-acars-border text-[11px] font-mono rounded-md px-1.5 py-0.5 w-full truncate outline-none focus:border-blue-400";

  return (
    <div className="flex flex-col items-start min-w-0 flex-1">
      <span className="text-[9px] font-medium uppercase tracking-[0.06em] text-[#5e646e]">{label}</span>
      {editable && fieldKey && onFieldChange ? (
        <input
          type="text"
          value={value}
          onChange={(e) => onFieldChange(fieldKey, e.target.value)}
          className={boxCls}
          style={boxStyle}
        />
      ) : (
        <div className={boxCls} style={boxStyle}>
          {value}
        </div>
      )}
      {sub && <span className="text-[9px] font-sans text-[#454a52]">{sub}</span>}
    </div>
  );
}

export function WeightsSection({ ofpWeights, ofpFuel, liveFuelLbs }: WeightsSectionProps) {
  const w = ofpWeights;
  const f = ofpFuel;
  const progress = useFlightPlanStore((s) => s.progress);
  const { canEditFuel, editableFields, onFieldChange } = useDispatchEdit();

  // Contingency fuel: default 5% of planned burn
  const contingencyRaw = editableFields.fuelContingency ?? f?.contingencyLbs;
  const contingencyPct = f?.burnLbs ? Math.round(((Number(contingencyRaw) || 0) / f.burnLbs) * 100) : null;

  return (
    <div className="border-b border-acars-border px-3 py-1.5 space-y-1.5">
      {/* Row 1: Weights */}
      <div className="flex items-start gap-1.5">
        <Field
          label="ZFW"
          value={`${fmt(w?.estZfw)} lbs`}
          sub={w?.maxZfw ? `Max ${fmt(w.maxZfw)} lbs` : undefined}
        />
        <Field
          label="Plan Gate"
          value={`${fmt(w?.estTow)} lbs`}
          sub={w?.maxTow ? `Max ${fmt(w.maxTow)} lbs` : undefined}
        />
        <Field
          label="Taxi Out"
          value={String(editableFields.fuelTaxi ?? f?.taxiLbs ?? '---')}
          sub={f?.taxiLbs ? `${fmt(f.taxiLbs)} lbs` : undefined}
          editable={canEditFuel}
          fieldKey="fuelTaxi"
          onFieldChange={onFieldChange}
        />
        <Field
          label="CF"
          value={String(editableFields.fuelContingency ?? f?.contingencyLbs ?? '---')}
          sub={contingencyPct !== null ? `${contingencyPct}% of burn` : undefined}
          editable={canEditFuel}
          fieldKey="fuelContingency"
          onFieldChange={onFieldChange}
        />
        <Field
          label="Extra"
          value={String(editableFields.fuelExtra ?? f?.extraLbs ?? '---')}
          sub="pilot disc."
          editable={canEditFuel}
          fieldKey="fuelExtra"
          onFieldChange={onFieldChange}
        />
        <Field
          label="ACF"
          value={`${fmt(editableFields.fuelAlternate ?? f?.alternateLbs)} lbs`}
          sub={w?.estLdw ? `LDW ${fmt(w.estLdw)} lbs` : undefined}
        />
        <Field
          label="REMF"
          value={progress?.fuelAtDestination ? `${fmt(progress.fuelAtDestination)} lbs` : `${fmt(editableFields.fuelReserve ?? f?.reserveLbs)} lbs`}
          sub={f?.reserveLbs ? `Rsv ${fmt(f.reserveLbs)} lbs` : undefined}
        />
      </div>
    </div>
  );
}
