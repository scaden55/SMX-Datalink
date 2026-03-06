import { Plane } from 'lucide-react';
import type { ActiveFlightHeartbeat } from '@acars/shared';
import { StatusBadge } from '@/components/primitives';

interface FlightListPanelProps {
  flights: ActiveFlightHeartbeat[];
  selectedCallsign: string | null;
  onSelectFlight: (flight: ActiveFlightHeartbeat) => void;
  connected?: boolean;
  connecting?: boolean;
}

export function FlightListPanel({ flights, selectedCallsign, onSelectFlight, connected = false, connecting = false }: FlightListPanelProps) {
  const sorted = [...flights].sort((a, b) => a.callsign.localeCompare(b.callsign));

  return (
    <div className="flex h-full flex-col bg-[var(--surface-0)] border-r border-[var(--border-primary)]">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-[var(--border-primary)] px-4 py-3">
        <Plane size={18} className="text-[var(--accent-blue)]" />
        <h2 className="text-sm font-semibold">Active Flights</h2>
        <div className="ml-auto flex items-center gap-2">
          <div className="flex items-center gap-1.5" title={connected ? 'Connected' : connecting ? 'Connecting' : 'Disconnected'}>
            <span className={`inline-block h-1.5 w-1.5 rounded-full ${
              connected
                ? 'bg-[var(--accent-emerald)]'
                : connecting
                  ? 'bg-[var(--accent-amber)] animate-pulse'
                  : 'bg-[var(--accent-red)]'
            }`} />
          </div>
          <span className="rounded bg-[var(--accent-blue-bg)] px-1.5 py-0.5 text-xs font-mono text-[var(--accent-blue)]">
            {flights.length}
          </span>
        </div>
      </div>

      {/* Flight list */}
      <div className="flex-1 overflow-y-auto">
        {sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-[var(--text-quaternary)]">
            <Plane size={32} />
            <p className="text-sm">No active flights</p>
          </div>
        ) : (
          sorted.map((flight) => {
            const isSelected = flight.callsign === selectedCallsign;
            return (
              <button
                key={flight.callsign}
                onClick={() => onSelectFlight(flight)}
                className={`w-full border-b border-[var(--border-primary)] px-4 py-3 text-left transition-colors hover:bg-[var(--surface-3)] ${
                  isSelected ? 'bg-[var(--accent-blue-bg)] border-l-2 border-l-[var(--accent-blue)]' : ''
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-sm font-semibold text-[var(--text-primary)]">{flight.callsign}</span>
                  <StatusBadge status={flight.phase?.toLowerCase() || 'unknown'} />
                </div>
                <div className="mt-1 flex items-center gap-3 text-xs text-[var(--text-tertiary)]">
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
