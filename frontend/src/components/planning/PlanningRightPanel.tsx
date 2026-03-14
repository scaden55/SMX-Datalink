import { AirplaneTilt, ArrowRight, Clock, Broadcast } from '@phosphor-icons/react';
import { useFlightPlanStore } from '../../stores/flightPlanStore';
import type { BidWithDetails } from '@acars/shared';

function formatDuration(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}h ${String(m).padStart(2, '0')}m`;
}

interface Props {
  bids: BidWithDetails[];
  onSelectBid: (bidId: number) => void;
  onFileVatsim: () => void;
}

export function PlanningRightPanel({ bids, onSelectBid, onFileVatsim }: Props) {
  const { activeBidId, ofp } = useFlightPlanStore();

  return (
    <div className="w-[260px] shrink-0 border-l border-white/[0.06] flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/[0.06]">
        <span className="text-[12px] uppercase tracking-[0.08em] text-acars-muted font-medium">My Bids</span>
        <span className="inline-flex items-center justify-center min-w-[18px] h-4 rounded-[2px] bg-acars-badge-bg text-[11px] font-semibold font-mono text-acars-badge-text tabular-nums px-1">
          {bids.length}
        </span>
      </div>
      <div className="flex-1 overflow-auto">
        {bids.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <img src="./logos/chevron-light.png" alt="SMX" className="h-7 w-auto opacity-10 mb-2" />
            <p className="text-[12px] text-acars-muted">No active bids</p>
            <p className="text-[11px] text-acars-muted/50 mt-0.5">Place a bid from the cargo schedule</p>
          </div>
        ) : (
          <div className="p-2 space-y-1">
            {bids.map(bid => {
              const isActive = bid.id === activeBidId;
              return (
                <button
                  key={bid.id}
                  onClick={() => onSelectBid(bid.id)}
                  className={`w-full text-left rounded-md border p-2 transition-all duration-150 ${
                    isActive
                      ? 'border-[#4F6CCD]/40 bg-[#4F6CCD]/5'
                      : 'border-white/[0.06] bg-white/[0.02] hover:border-white/[0.10]'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono tabular-nums font-semibold text-[12px] text-acars-text">{bid.flightNumber}</span>
                    {isActive && (
                      <span className="text-[9px] font-bold uppercase tracking-[0.08em] text-acars-badge-text bg-acars-badge-bg px-[3px] rounded-[2px]">
                        Active
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 text-[12px] mb-1">
                    <span className="font-mono tabular-nums text-acars-text">{bid.depIcao}</span>
                    <ArrowRight className="w-2.5 h-2.5 text-[#7B94E0]/40" />
                    <span className="font-mono tabular-nums text-acars-text">{bid.arrIcao}</span>
                  </div>
                  <div className="flex items-center gap-2 text-[12px] text-acars-muted">
                    <span className="font-mono">{bid.aircraftType}</span>
                    <span className="flex items-center gap-0.5 font-mono tabular-nums text-acars-muted">
                      <Clock className="w-2.5 h-2.5" />
                      {bid.depTime}Z
                    </span>
                    <span className="font-mono tabular-nums text-acars-muted">{formatDuration(bid.flightTimeMin)}</span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
      <div className="px-3 py-2 border-t border-white/[0.06] flex items-center justify-center">
        <button
          onClick={onFileVatsim}
          disabled={!ofp}
          className="flex items-center gap-1.5 px-3 py-1 rounded-md text-[12px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-400/20 hover:bg-emerald-500/20 transition-colors duration-150 disabled:opacity-30 disabled:cursor-not-allowed"
          title={ofp ? 'Pre-file your flight plan on VATSIM' : 'Generate an OFP first'}
        >
          <Broadcast className="w-3.5 h-3.5" />
          File on VATSIM
        </button>
      </div>
    </div>
  );
}
