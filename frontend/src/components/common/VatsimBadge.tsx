import { useState } from 'react';
import { Broadcast } from '@phosphor-icons/react';

interface Props {
  connected: boolean;
  callsign?: string | null;
  /** 'compact' for table rows, 'full' for detail pages */
  mode?: 'compact' | 'full';
}

/**
 * Green "VATSIM" pill badge indicating a flight was/is connected to VATSIM.
 * Shows the matched callsign on hover in a tooltip.
 */
export function VatsimBadge({ connected, callsign, mode = 'compact' }: Props) {
  const [showTooltip, setShowTooltip] = useState(false);

  if (!connected) return null;

  if (mode === 'compact') {
    return (
      <span
        className="relative inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide bg-emerald-500/15 text-emerald-400 border border-emerald-400/20 cursor-default"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        <Broadcast className="w-2.5 h-2.5" />
        VATSIM
        {showTooltip && callsign && (
          <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 rounded bg-acars-input border border-acars-border text-[10px] text-acars-text font-mono whitespace-nowrap z-50 shadow-lg">
            {callsign}
          </span>
        )}
      </span>
    );
  }

  // Full mode for detail pages
  return (
    <div
      className="relative inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-500/10 border border-emerald-400/20 cursor-default"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <Broadcast className="w-3.5 h-3.5 text-emerald-400" />
      <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wide">VATSIM</span>
      {callsign && (
        <span className="text-[10px] text-emerald-400/70 font-mono ml-1">{callsign}</span>
      )}
      {showTooltip && (
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 rounded bg-acars-input border border-acars-border text-[10px] text-acars-text whitespace-nowrap z-50 shadow-lg">
          Flight tracked on VATSIM network
        </span>
      )}
    </div>
  );
}
