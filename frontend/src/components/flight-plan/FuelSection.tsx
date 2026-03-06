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

export function FuelSection({ totalWeight, fuelPct, ofpFuel }: FuelSectionProps) {
  const progress = useFlightPlanStore((s) => s.progress);
  const { editableFields } = useDispatchEdit();

  const summaryParts: string[] = [];
  if (ofpFuel) {
    summaryParts.push(`Planned: ${fmt(ofpFuel.totalLbs)} lbs`);
    summaryParts.push(`Burn: ${fmt(ofpFuel.burnLbs)} lbs`);
  }
  if (totalWeight !== null) {
    summaryParts.push(`Live: ${fmt(totalWeight)} lbs`);
  }

  const boxCls = "bg-acars-input border border-acars-border text-[11px] tabular-nums rounded-md px-1.5 py-0.5 w-full truncate";

  return (
    <CollapsibleSection
      title="Fuel"
      summary={summaryParts.length > 0 ? summaryParts.join(' | ') : undefined}
      useCheckmark
      status={ofpFuel ? 'green' : 'grey'}
      defaultOpen
    >
      <div className="flex items-start gap-1.5">
        <div className="flex flex-col min-w-0 flex-1">
          <span className="text-[9px] font-medium uppercase tracking-[0.06em] text-[#5e646e]">Planned</span>
          <div className={boxCls} style={{ color: '#dde1e8' }}>
            {fmt(editableFields.fuelTotal ?? ofpFuel?.totalLbs)} lbs
          </div>
        </div>
        <div className="flex flex-col min-w-0 flex-1">
          <span className="text-[9px] font-medium uppercase tracking-[0.06em] text-[#5e646e]">Burn</span>
          <div className={boxCls} style={{ color: '#dde1e8' }}>
            {fmt(editableFields.fuelBurn ?? ofpFuel?.burnLbs)} lbs
          </div>
        </div>
        <div className="flex flex-col min-w-0 flex-1">
          <span className="text-[9px] font-medium uppercase tracking-[0.06em] text-[#5e646e]">Live Fuel</span>
          <div
            className={boxCls}
            style={{ color: fuelPct !== null && fuelPct < 15 ? '#f59e0b' : '#dde1e8' }}
          >
            {totalWeight !== null ? `${fmt(totalWeight)} lbs` : '---'}
          </div>
          {fuelPct !== null && (
            <span className="text-[9px] text-[#454a52]">{Math.round(fuelPct)}%</span>
          )}
        </div>
        <div className="flex flex-col min-w-0 flex-1">
          <span className="text-[9px] font-medium uppercase tracking-[0.06em] text-[#5e646e]">At Dest</span>
          <div className={boxCls} style={{ color: '#dde1e8' }}>
            {progress?.fuelAtDestination ? `${fmt(progress.fuelAtDestination)} lbs` : '---'}
          </div>
        </div>
      </div>
    </CollapsibleSection>
  );
}
