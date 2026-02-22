import { Loader2, Zap, PlayCircle } from 'lucide-react';
import { useFlightPlanStore } from '../../stores/flightPlanStore';

interface Props {
  onGenerate: () => void;
  onStartFlight: () => void;
}

export function PlanningGenerateBar({ onGenerate, onStartFlight }: Props) {
  const { ofp, simbriefLoading, activeBidId } = useFlightPlanStore();

  const hasOFP = ofp !== null;

  return (
    <div className="px-3 py-3 border-t border-acars-border space-y-2">
      {hasOFP && ofp.times && (
        <div className="grid grid-cols-4 gap-1 text-center">
          <div>
            <span className="planning-label">ETE</span>
            <span className="data-value block">{ofp.times.estEnroute}m</span>
          </div>
          <div>
            <span className="planning-label">ETD</span>
            <span className="data-value block">{formatUtc(ofp.times.schedDep)}</span>
          </div>
          <div>
            <span className="planning-label">ETA</span>
            <span className="data-value block">{formatUtc(ofp.times.schedArr)}</span>
          </div>
          <div>
            <span className="planning-label">Block</span>
            <span className="data-value block">{ofp.times.estBlock}m</span>
          </div>
        </div>
      )}
      <div className="flex gap-2">
        <button
          onClick={onGenerate}
          disabled={simbriefLoading}
          className="flex-1 btn-primary btn-md"
          title="Generate or fetch OFP via SimBrief"
        >
          {simbriefLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
          {simbriefLoading
            ? (window.electronAPI?.isElectron ? 'Waiting for SimBrief...' : 'Loading OFP...')
            : 'Generate OFP'}
        </button>
        {activeBidId && hasOFP && (
          <button
            onClick={onStartFlight}
            className="btn-green btn-md"
          >
            <PlayCircle className="w-3.5 h-3.5" />
            Start Flight
          </button>
        )}
      </div>
    </div>
  );
}

function formatUtc(timestamp: string): string {
  if (!timestamp) return '\u2014';
  try {
    const ms = Number(timestamp) > 1e9 ? Number(timestamp) * 1000 : Date.parse(timestamp);
    if (isNaN(ms)) return '\u2014';
    return new Date(ms).toISOString().slice(11, 16) + 'Z';
  } catch {
    return '\u2014';
  }
}
