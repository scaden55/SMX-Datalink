import { CollapsibleSection } from '../common/CollapsibleSection';
import { useFlightPlanStore } from '../../stores/flightPlanStore';
import { useDispatchEdit } from '../../contexts/DispatchEditContext';
import type { SimBriefFuel } from '@acars/shared';

interface FuelSectionProps {
  totalWeight: number | null;
  fuelPct: number | null;
  ofpFuel?: SimBriefFuel | null;
}

function fmt(val: number | string | undefined | null): string {
  if (val === null || val === undefined || val === '') return '---';
  const n = typeof val === 'string' ? Number(val) : val;
  if (isNaN(n)) return '---';
  return Math.round(n).toLocaleString();
}

interface FuelFieldProps {
  label: string;
  value: string;
  sub?: string;
  warn?: boolean;
  editable?: boolean;
  fieldKey?: string;
  onFieldChange?: (key: string, val: string) => void;
}

function FuelField({ label, value, sub, warn, editable, fieldKey, onFieldChange }: FuelFieldProps) {
  return (
    <div className="flex flex-col min-w-0 flex-1">
      <span className="text-[9px] font-medium uppercase tracking-[0.06em] text-[#5e646e]">{label}</span>
      {editable && fieldKey && onFieldChange ? (
        <input
          type="text"
          value={value}
          onChange={(e) => onFieldChange(fieldKey, e.target.value)}
          className="bg-acars-input border border-acars-border text-[12px] font-mono rounded-md px-1 py-0 outline-none focus:border-blue-400 w-full"
          style={{ color: warn ? '#f59e0b' : '#dde1e8' }}
        />
      ) : (
        <span
          className="text-[12px] font-mono leading-tight"
          style={{ color: warn ? '#f59e0b' : '#dde1e8' }}
        >
          {value}
        </span>
      )}
      {sub && <span className="text-[9px] font-sans text-[#454a52]">{sub}</span>}
    </div>
  );
}

export function FuelSection({ totalWeight, fuelPct, ofpFuel }: FuelSectionProps) {
  const progress = useFlightPlanStore((s) => s.progress);
  const { canEditFuel, editableFields, onFieldChange } = useDispatchEdit();

  const summaryParts: string[] = [];
  if (ofpFuel) {
    summaryParts.push(`Planned: ${fmt(ofpFuel.totalLbs)} lbs`);
    summaryParts.push(`Burn: ${fmt(ofpFuel.burnLbs)} lbs`);
  }
  if (totalWeight !== null) {
    summaryParts.push(`Live: ${fmt(totalWeight)} lbs`);
  }

  return (
    <CollapsibleSection
      title="Fuel"
      summary={summaryParts.length > 0 ? summaryParts.join(' | ') : undefined}
      useCheckmark
      status={ofpFuel ? 'green' : 'grey'}
      defaultOpen
    >
      <div className="flex items-start gap-2">
        <FuelField label="Planned" value={fmt(editableFields.fuelTotal ?? ofpFuel?.totalLbs)} sub="lbs" />
        <FuelField
          label="Live Fuel"
          value={totalWeight !== null ? Math.round(totalWeight).toLocaleString() : '---'}
          sub={fuelPct !== null ? `${Math.round(fuelPct)}%` : undefined}
          warn={fuelPct !== null && fuelPct < 15}
        />
        <FuelField label="Burn" value={fmt(editableFields.fuelBurn ?? ofpFuel?.burnLbs)} sub="lbs" />
        <FuelField
          label="Taxi"
          value={String(editableFields.fuelTaxi ?? ofpFuel?.taxiLbs ?? '---')}
          sub="lbs"
          editable={canEditFuel}
          fieldKey="fuelTaxi"
          onFieldChange={onFieldChange}
        />
        <FuelField
          label="Reserve"
          value={String(editableFields.fuelReserve ?? ofpFuel?.reserveLbs ?? '---')}
          sub="lbs"
          editable={canEditFuel}
          fieldKey="fuelReserve"
          onFieldChange={onFieldChange}
        />
        <FuelField
          label="Cont."
          value={String(editableFields.fuelContingency ?? ofpFuel?.contingencyLbs ?? '---')}
          sub="lbs"
          editable={canEditFuel}
          fieldKey="fuelContingency"
          onFieldChange={onFieldChange}
        />
        <FuelField
          label="REMF"
          value={progress?.fuelAtDestination ? Math.round(progress.fuelAtDestination).toLocaleString() : '---'}
          sub="lbs"
        />
      </div>
    </CollapsibleSection>
  );
}
