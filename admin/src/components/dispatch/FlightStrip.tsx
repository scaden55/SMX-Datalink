import type { DispatchMapFlight } from '@/components/layout/SharedMapContext';

interface FlightStripProps {
  flights: DispatchMapFlight[];
  selectedBidId: number | null;
  onSelectFlight: (bidId: number) => void;
}

const phaseOrder: Record<DispatchMapFlight['phase'], number> = { flying: 0, planning: 1, completed: 2 };

const phaseDot: Record<DispatchMapFlight['phase'], string> = {
  flying: 'bg-emerald-400',
  planning: 'bg-amber-400',
  completed: 'bg-gray-500',
};

export function FlightStrip({ flights, selectedBidId, onSelectFlight }: FlightStripProps) {
  const sorted = [...flights].sort((a, b) => phaseOrder[a.phase] - phaseOrder[b.phase]);

  if (sorted.length === 0) return null;

  return (
    <div className="absolute bottom-0 left-0 right-0 z-[1000] border-t border-[var(--surface-3)] bg-[var(--surface-1)]/95">
      <div className="flex items-center gap-1.5 overflow-x-auto px-3 py-2 scrollbar-thin">
        {sorted.map((f) => {
          const isSelected = f.bidId === selectedBidId;
          return (
            <button
              key={f.bidId}
              type="button"
              onClick={() => onSelectFlight(f.bidId)}
              className={`flex shrink-0 items-center gap-2 rounded-md border px-3 py-1.5 text-xs transition-colors ${
                isSelected
                  ? 'border-[var(--accent)] bg-[var(--surface-3)]'
                  : 'border-[var(--surface-3)] bg-[var(--surface-2)] hover:bg-[var(--surface-3)]'
              }`}
            >
              {/* Phase dot */}
              <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${phaseDot[f.phase]}`} />

              {/* Callsign */}
              <span className="font-mono tabular-nums font-semibold text-[var(--text-primary)]">
                {f.callsign}
              </span>

              {/* Route */}
              <span className="font-mono tabular-nums text-[var(--text-muted)]">
                {f.depIcao}&rarr;{f.arrIcao}
              </span>

              {/* Status */}
              <span className="text-[var(--text-muted)]">
                {f.phase === 'flying' && f.altitude != null
                  ? `FL${String(Math.round(f.altitude / 100)).padStart(3, '0')}`
                  : f.phase === 'planning'
                    ? 'Planning'
                    : 'Completed'}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
