import { Loader2, Save, Zap, Download } from 'lucide-react';
import { useFlightPlanStore } from '../../stores/flightPlanStore';

interface Props {
  onGenerate: () => void;
  onFetchLatest: () => void;
  onSave: () => void;
}

export function PlanningGenerateBar({ onGenerate, onFetchLatest, onSave }: Props) {
  const { ofp, simbriefLoading, savingFlightPlan, activeBidId } = useFlightPlanStore();

  const hasOFP = ofp !== null;

  return (
    <div className="px-3 py-3 border-t border-acars-border space-y-2">
      {hasOFP && ofp.times && (
        <div className="grid grid-cols-4 gap-1 text-[9px] text-center">
          <div>
            <span className="text-acars-muted block">ETE</span>
            <span className="text-acars-text font-mono">{ofp.times.estEnroute}m</span>
          </div>
          <div>
            <span className="text-acars-muted block">ETD</span>
            <span className="text-acars-text font-mono">{formatUtc(ofp.times.schedDep)}</span>
          </div>
          <div>
            <span className="text-acars-muted block">ETA</span>
            <span className="text-acars-text font-mono">{formatUtc(ofp.times.schedArr)}</span>
          </div>
          <div>
            <span className="text-acars-muted block">Block</span>
            <span className="text-acars-text font-mono">{ofp.times.estBlock}m</span>
          </div>
        </div>
      )}
      <div className="flex gap-2">
        <button
          onClick={onGenerate}
          disabled={simbriefLoading}
          className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded text-[11px] font-semibold bg-acars-blue/10 text-acars-blue border border-acars-blue/20 hover:bg-acars-blue/20 transition-colors disabled:opacity-50"
          title="Generate OFP via SimBrief (opens popup, auto-fetches result)"
        >
          {simbriefLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
          {simbriefLoading ? 'Generating...' : 'Generate OFP'}
        </button>
        <button
          onClick={onFetchLatest}
          disabled={simbriefLoading}
          className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded text-[11px] font-semibold bg-acars-cyan/10 text-acars-cyan border border-acars-cyan/20 hover:bg-acars-cyan/20 transition-colors disabled:opacity-50"
          title="Fetch your latest SimBrief OFP"
        >
          <Download className="w-3.5 h-3.5" />
          Fetch
        </button>
        {activeBidId && (
          <button
            onClick={onSave}
            disabled={savingFlightPlan}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded text-[11px] font-semibold bg-acars-green/10 text-acars-green border border-acars-green/20 hover:bg-acars-green/20 transition-colors disabled:opacity-50"
          >
            {savingFlightPlan ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Save
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
