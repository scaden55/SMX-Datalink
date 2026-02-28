import { AirplaneTilt } from '@phosphor-icons/react';
import type { ActiveFlightHeartbeat } from '@acars/shared';

const PHASE_COLORS: Record<string, string> = {
  PREFLIGHT: 'bg-zinc-600 text-zinc-200',
  TAXI: 'bg-amber-700 text-amber-100',
  TAKEOFF: 'bg-red-700 text-red-100',
  CLIMB: 'bg-blue-700 text-blue-100',
  CRUISE: 'bg-emerald-700 text-emerald-100',
  DESCENT: 'bg-amber-700 text-amber-100',
  APPROACH: 'bg-red-700 text-red-100',
  LANDING: 'bg-red-700 text-red-100',
  ARRIVED: 'bg-emerald-700 text-emerald-100',
};

function PhaseBadge({ phase }: { phase: string }) {
  const upper = phase.toUpperCase();
  const colors = PHASE_COLORS[upper] ?? 'bg-zinc-600 text-zinc-200';
  return (
    <span className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${colors}`}>
      {phase}
    </span>
  );
}

interface FlightListPanelProps {
  flights: ActiveFlightHeartbeat[];
  selectedCallsign: string | null;
  onSelectFlight: (flight: ActiveFlightHeartbeat) => void;
}

export function FlightListPanel({ flights, selectedCallsign, onSelectFlight }: FlightListPanelProps) {
  const sorted = [...flights].sort((a, b) => a.callsign.localeCompare(b.callsign));

  return (
    <div className="flex h-full flex-col border-r border-border">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <AirplaneTilt size={18} weight="bold" className="text-primary" />
        <h2 className="text-sm font-semibold">Active Flights</h2>
        <span className="ml-auto rounded bg-primary/20 px-1.5 py-0.5 text-xs font-mono text-primary">
          {flights.length}
        </span>
      </div>

      {/* Flight list */}
      <div className="flex-1 overflow-y-auto">
        {sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-muted-foreground">
            <AirplaneTilt size={32} />
            <p className="text-sm">No active flights</p>
          </div>
        ) : (
          sorted.map((flight) => {
            const isSelected = flight.callsign === selectedCallsign;
            return (
              <button
                key={flight.callsign}
                onClick={() => onSelectFlight(flight)}
                className={`w-full border-b border-border px-4 py-3 text-left transition-colors hover:bg-accent/50 ${
                  isSelected ? 'bg-primary/10 border-l-2 border-l-primary' : ''
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-sm font-semibold">{flight.callsign}</span>
                  <PhaseBadge phase={flight.phase || 'unknown'} />
                </div>
                <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="font-mono">{flight.aircraftType || 'N/A'}</span>
                  <span className="font-mono">{Math.round(flight.altitude).toLocaleString()} ft</span>
                  <span className="font-mono">{Math.round(flight.groundSpeed)} kts</span>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
