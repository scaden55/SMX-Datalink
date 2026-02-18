import { ChevronDown, Plane } from 'lucide-react';
import { useFlightPlanStore } from '../../stores/flightPlanStore';
import type { BidWithDetails } from '@acars/shared';

interface Props {
  bids: BidWithDetails[];
  onSelect: (bidId: number) => void;
}

export function PlanningBidSelector({ bids, onSelect }: Props) {
  const { activeBidId } = useFlightPlanStore();
  const active = bids.find((b) => b.id === activeBidId);

  return (
    <div className="px-3 py-2 border-b border-acars-border bg-acars-bg/50">
      <label className="text-[9px] uppercase tracking-wider text-acars-muted font-medium mb-1 block">Active Bid</label>
      <div className="relative">
        <select
          value={activeBidId ?? ''}
          onChange={(e) => {
            const id = parseInt(e.target.value, 10);
            if (!isNaN(id)) onSelect(id);
          }}
          className="w-full appearance-none rounded bg-acars-bg border border-acars-border text-acars-text text-[11px] pl-7 pr-7 py-1.5 font-mono outline-none focus:border-acars-blue transition-colors cursor-pointer"
        >
          {!activeBidId && <option value="">Select a bid to plan...</option>}
          {bids.map((b) => (
            <option key={b.id} value={b.id}>
              {b.flightNumber} — {b.depIcao} → {b.arrIcao} ({b.aircraftType}) {b.depTime}Z
            </option>
          ))}
        </select>
        <Plane className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-acars-blue pointer-events-none" />
        <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-acars-muted pointer-events-none" />
      </div>
      {active && (
        <div className="flex gap-3 mt-1.5 text-[10px] text-acars-muted">
          <span>{active.depName}</span>
          <span>→</span>
          <span>{active.arrName}</span>
          <span className="ml-auto">{Math.floor(active.flightTimeMin / 60)}h {active.flightTimeMin % 60}m</span>
        </div>
      )}
    </div>
  );
}
