import { SpinnerGap, Lightning, PlayCircle, CaretDown, ArrowsClockwise } from '@phosphor-icons/react';
import { useFlightPlanStore } from '../../stores/flightPlanStore';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '../ui/dropdown-menu';

interface Props {
  onGenerate: () => void;
  onFetch: () => void;
  onStartFlight: () => void;
}

export function PlanningGenerateBar({ onGenerate, onFetch, onStartFlight }: Props) {
  const { ofp, simbriefLoading, activeBidId } = useFlightPlanStore();

  const hasOFP = ofp !== null;

  return (
    <div className="px-3 py-3 border-t border-white/[0.06] space-y-2">
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
        {hasOFP ? (
          /* Split button: Fetch OFP (primary) + dropdown chevron for Generate New */
          <div className="flex flex-1 min-w-0">
            <button
              onClick={onFetch}
              disabled={simbriefLoading}
              className="flex-1 btn-primary btn-md rounded-r-none"
              title="Fetch latest OFP from SimBrief"
            >
              {simbriefLoading
                ? <SpinnerGap className="w-3.5 h-3.5 animate-spin" />
                : <ArrowsClockwise className="w-3.5 h-3.5" />}
              {simbriefLoading
                ? (window.electronAPI?.isElectron ? 'Waiting for SimBrief...' : 'Loading OFP...')
                : 'Fetch OFP'}
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  disabled={simbriefLoading}
                  className="btn-primary btn-md rounded-l-none border-l border-white/15 px-2"
                  title="More OFP options"
                >
                  <CaretDown className="w-3.5 h-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" side="top" sideOffset={6}>
                <DropdownMenuItem onClick={onGenerate} className="gap-2">
                  <Lightning className="w-3.5 h-3.5" />
                  Generate New OFP
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ) : (
          /* Split button: Generate OFP (primary) + dropdown for Fetch Existing */
          <div className="flex flex-1 min-w-0">
            <button
              onClick={onGenerate}
              disabled={simbriefLoading}
              className="flex-1 btn-primary btn-md rounded-r-none"
              title="Generate OFP via SimBrief"
            >
              {simbriefLoading
                ? <SpinnerGap className="w-3.5 h-3.5 animate-spin" />
                : <Lightning className="w-3.5 h-3.5" />}
              {simbriefLoading
                ? (window.electronAPI?.isElectron ? 'Waiting for SimBrief...' : 'Loading OFP...')
                : 'Generate OFP'}
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  disabled={simbriefLoading}
                  className="btn-primary btn-md rounded-l-none border-l border-white/15 px-2"
                  title="More OFP options"
                >
                  <CaretDown className="w-3.5 h-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" side="top" sideOffset={6}>
                <DropdownMenuItem onClick={onFetch} className="gap-2">
                  <ArrowsClockwise className="w-3.5 h-3.5" />
                  Fetch Existing OFP
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
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
