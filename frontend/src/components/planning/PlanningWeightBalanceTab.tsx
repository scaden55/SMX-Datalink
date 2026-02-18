import { useFlightPlanStore } from '../../stores/flightPlanStore';
import { Scale } from 'lucide-react';

function WeightRow({ label, value, max }: { label: string; value: number; max?: number }) {
  const over = max !== undefined && value > max;
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-acars-border/30 last:border-0">
      <span className="text-[11px] text-acars-muted">{label}</span>
      <div className="flex items-center gap-2">
        <span className={`text-[11px] font-mono font-semibold ${over ? 'text-acars-red' : 'text-acars-text'}`}>
          {value ? value.toLocaleString() : '—'}
        </span>
        {max !== undefined && (
          <span className="text-[9px] text-acars-muted">
            / {max.toLocaleString()}
          </span>
        )}
        {over && (
          <span className="text-[8px] font-bold text-acars-red uppercase">OVER</span>
        )}
      </div>
    </div>
  );
}

export function PlanningWeightBalanceTab() {
  const { ofp } = useFlightPlanStore();

  if (!ofp) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center gap-2 p-4">
        <Scale className="w-6 h-6 text-acars-muted/30" />
        <p className="text-[11px] text-acars-muted">Generate OFP to see weight & balance</p>
      </div>
    );
  }

  const { weights, fuel } = ofp;

  return (
    <div className="p-3 space-y-3 overflow-auto">
      <div>
        <span className="text-[10px] uppercase tracking-wider text-acars-muted font-medium mb-1 block">Weights</span>
        <div className="rounded border border-acars-border bg-acars-bg">
          <div className="px-3">
            <WeightRow label="Zero Fuel Weight" value={weights.estZfw} max={weights.maxZfw} />
            <WeightRow label="Takeoff Weight" value={weights.estTow} max={weights.maxTow} />
            <WeightRow label="Landing Weight" value={weights.estLdw} max={weights.maxLdw} />
            <WeightRow label="Payload" value={weights.payload} />
            <WeightRow label="Passengers" value={weights.paxCount} />
            <WeightRow label="Cargo" value={weights.cargoLbs} />
          </div>
        </div>
      </div>

      <div>
        <span className="text-[10px] uppercase tracking-wider text-acars-muted font-medium mb-1 block">Fuel</span>
        <div className="rounded border border-acars-border bg-acars-bg">
          <div className="px-3">
            <WeightRow label="Enroute Burn" value={fuel.burnLbs} />
            <WeightRow label="Reserve" value={fuel.reserveLbs} />
            <WeightRow label="Alternate" value={fuel.alternateLbs} />
            <WeightRow label="Taxi" value={fuel.taxiLbs} />
            <WeightRow label="Contingency" value={fuel.contingencyLbs} />
            <WeightRow label="Extra" value={fuel.extraLbs} />
            <WeightRow label="Total Ramp" value={fuel.totalLbs} />
          </div>
        </div>
      </div>
    </div>
  );
}
