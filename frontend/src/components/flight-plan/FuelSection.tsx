import { CollapsibleSection } from '../common/CollapsibleSection';
import { DataField } from '../common/DataField';
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

interface EditableFuelFieldProps {
  label: string;
  fieldKey: string;
  value: string;
  onFieldChange: (key: string, val: string) => void;
}

function EditableFuelField({ label, fieldKey, value, onFieldChange }: EditableFuelFieldProps) {
  return (
    <div>
      <div className="data-label">{label}</div>
      <input
        type="text"
        value={value}
        onChange={(e) => onFieldChange(fieldKey, e.target.value)}
        className="w-full rounded bg-acars-bg border border-acars-border text-acars-text text-[11px] px-1.5 py-0.5 font-mono focus:outline-none focus:border-acars-cyan"
      />
      <div className="text-[9px] text-acars-muted">lbs</div>
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
      defaultOpen
    >
      <div className="grid grid-cols-7 gap-2">
        {/* Planned (fuelTotal) — always read-only (OFP-derived) */}
        <DataField label="Planned" value={fmt(editableFields.fuelTotal ?? ofpFuel?.totalLbs)} unit="lbs" />

        {/* Live Fuel — always read-only (telemetry) */}
        <div>
          <div className="data-label">Live <span className="text-acars-amber">Fuel</span></div>
          <div className="data-value">{totalWeight !== null ? Math.round(totalWeight).toLocaleString() : '---'}</div>
          {fuelPct !== null && <div className="text-[9px] text-acars-muted">{Math.round(fuelPct)}%</div>}
        </div>

        {/* Burn — always read-only (OFP-derived) */}
        <DataField label="Burn" value={fmt(editableFields.fuelBurn ?? ofpFuel?.burnLbs)} unit="lbs" />

        {/* Editable fuel fields when admin + planning phase */}
        {canEditFuel ? (
          <>
            <EditableFuelField label="Taxi" fieldKey="fuelTaxi" value={editableFields.fuelTaxi ?? String(ofpFuel?.taxiLbs ?? '')} onFieldChange={onFieldChange} />
            <EditableFuelField label="Reserve" fieldKey="fuelReserve" value={editableFields.fuelReserve ?? String(ofpFuel?.reserveLbs ?? '')} onFieldChange={onFieldChange} />
            <EditableFuelField label="Contingency" fieldKey="fuelContingency" value={editableFields.fuelContingency ?? String(ofpFuel?.contingencyLbs ?? '')} onFieldChange={onFieldChange} />
          </>
        ) : (
          <>
            <DataField label="Taxi" value={fmt(editableFields.fuelTaxi ?? ofpFuel?.taxiLbs)} unit="lbs" />
            <DataField label="Reserve" value={fmt(editableFields.fuelReserve ?? ofpFuel?.reserveLbs)} unit="lbs" />
            <DataField label="Contingency" value={fmt(editableFields.fuelContingency ?? ofpFuel?.contingencyLbs)} unit="lbs" />
          </>
        )}

        {/* REMF — always read-only */}
        <div>
          <div className="data-label">REMF</div>
          <div className="data-value font-bold">{progress?.fuelAtDestination ? Math.round(progress.fuelAtDestination).toLocaleString() : '---'}</div>
          <div className="text-[9px] text-acars-muted">lbs</div>
        </div>
      </div>
    </CollapsibleSection>
  );
}
