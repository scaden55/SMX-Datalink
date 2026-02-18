import { CollapsibleSection } from '../common/CollapsibleSection';
import { DataField } from '../common/DataField';
import { useFlightPlanStore } from '../../stores/flightPlanStore';

interface FuelSectionProps {
  totalWeight: number | null;
  fuelPct: number | null;
}

export function FuelSection({ totalWeight, fuelPct }: FuelSectionProps) {
  const progress = useFlightPlanStore((s) => s.progress);

  return (
    <CollapsibleSection
      title="Fuel"
      summary={
        totalWeight !== null
          ? `CF:20 | Extra :15 | ALTN KFAT | REMT 2:10`
          : undefined
      }
    >
      <div className="grid grid-cols-7 gap-2">
        <DataField label="ZFW" value="175,000" unit="lbs" />
        <div>
          <div className="data-label">Plan Gate <span className="text-acars-amber">T/O</span></div>
          <div className="data-value">{totalWeight !== null ? Math.round(totalWeight).toLocaleString() : '---'}</div>
          <div className="text-[9px] text-acars-muted">Max 46,100 lbs</div>
        </div>
        <DataField label="Taxi Out" value="00:10" />
        <DataField label="CF" value="00:20" />
        <DataField label="Extra" value="00:15" />
        <div>
          <div className="data-label">ACF</div>
          <div className="data-value">90% | 00:07</div>
        </div>
        <div>
          <div className="data-label">REMF</div>
          <div className="data-value font-bold">{progress?.fuelAtDestination ? Math.round(progress.fuelAtDestination).toLocaleString() : '---'}</div>
          <div className="text-[9px] text-acars-muted">lbs</div>
        </div>
      </div>
    </CollapsibleSection>
  );
}
