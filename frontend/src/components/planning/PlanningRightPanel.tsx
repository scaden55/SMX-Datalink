import { Plane, ArrowRight, Clock } from 'lucide-react';
import { useFlightPlanStore } from '../../stores/flightPlanStore';
import type { BidWithDetails } from '@acars/shared';

function formatDuration(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}h ${String(m).padStart(2, '0')}m`;
}

function PhaseBadge({ phase }: { phase: string }) {
  const colors: Record<string, string> = {
    planning: 'text-acars-blue bg-acars-blue/10 border-acars-blue/20',
    active: 'text-acars-green bg-acars-green/10 border-acars-green/20',
    completed: 'text-acars-muted bg-acars-muted/10 border-acars-muted/20',
  };
  return (
    <span className={`inline-flex px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide border ${colors[phase] ?? colors.planning}`}>
      {phase}
    </span>
  );
}

interface Props {
  bids: BidWithDetails[];
  onSelectBid: (bidId: number) => void;
}

export function PlanningRightPanel({ bids, onSelectBid }: Props) {
  const { phase, activeBidId } = useFlightPlanStore();

  return (
    <div className="w-[240px] shrink-0 border-l border-acars-border flex flex-col bg-acars-panel overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-acars-border">
        <span className="text-[10px] uppercase tracking-wider text-acars-muted font-medium">My Bids</span>
        <span className="inline-flex items-center justify-center min-w-[18px] h-4 rounded-full bg-acars-blue/10 border border-acars-blue/20 text-[9px] font-semibold text-acars-blue tabular-nums px-1">
          {bids.length}
        </span>
      </div>
      <div className="flex-1 overflow-auto">
        {bids.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <Plane className="w-6 h-6 text-acars-muted/30 mb-2" />
            <p className="text-[11px] text-acars-muted">No active bids</p>
            <p className="text-[9px] text-acars-muted/60 mt-0.5">Place a bid from the schedule</p>
          </div>
        ) : (
          <div className="p-2 space-y-1.5">
            {bids.map(bid => {
              const isActive = bid.id === activeBidId;
              return (
                <button
                  key={bid.id}
                  onClick={() => onSelectBid(bid.id)}
                  className={`w-full text-left rounded-md border p-2.5 transition-all ${
                    isActive
                      ? 'border-acars-blue/40 bg-acars-blue/5 ring-1 ring-acars-blue/20'
                      : 'border-acars-border bg-acars-bg hover:border-acars-muted/40 hover:bg-acars-bg/80'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono font-semibold text-[11px] text-acars-text">{bid.flightNumber}</span>
                    {isActive && (
                      <span className="text-[8px] font-bold uppercase tracking-wide text-acars-blue bg-acars-blue/10 border border-acars-blue/20 px-1.5 py-0.5 rounded">
                        Active
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px] text-acars-muted mb-1">
                    <span className="font-mono text-acars-text">{bid.depIcao}</span>
                    <ArrowRight className="w-2.5 h-2.5 text-acars-muted/40" />
                    <span className="font-mono text-acars-text">{bid.arrIcao}</span>
                  </div>
                  <div className="flex items-center gap-2.5 text-[10px] text-acars-muted">
                    <span>{bid.aircraftType}</span>
                    <span className="flex items-center gap-0.5 tabular-nums">
                      <Clock className="w-2.5 h-2.5" />
                      {bid.depTime}Z
                    </span>
                    <span className="tabular-nums">{formatDuration(bid.flightTimeMin)}</span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
      <div className="px-3 py-2.5 border-t border-acars-border flex items-center justify-center">
        <PhaseBadge phase={phase} />
      </div>
    </div>
  );
}
