import { memo, useState } from 'react';
import type { ActiveFlightHeartbeat } from '@acars/shared';

// ── Phase badge ──────────────────────────────────────────────

const PHASE_COLORS: Record<string, string> = {
  PREFLIGHT: 'var(--text-quaternary)',
  TAXI_OUT: 'var(--accent-amber)',
  TAKEOFF: 'var(--accent-emerald)',
  CLIMB: 'var(--accent-emerald)',
  CRUISE: 'var(--accent-blue)',
  DESCENT: 'var(--accent-cyan)',
  APPROACH: 'var(--accent-amber)',
  LANDING: 'var(--accent-amber)',
  TAXI_IN: 'var(--accent-amber)',
  PARKED: 'var(--text-quaternary)',
};

function PhaseBadge({ phase }: { phase: string }) {
  const color = PHASE_COLORS[phase] ?? 'var(--text-quaternary)';
  const label = phase.replace(/_/g, ' ');
  return (
    <span
      className="inline-block rounded px-1 py-[1px] font-mono text-[9px] font-medium uppercase"
      style={{ color, border: `1px solid ${color}`, opacity: 0.8 }}
    >
      {label}
    </span>
  );
}

// ── Delta badge (timing) ─────────────────────────────────────

function DeltaBadge({ minutes }: { minutes: number }) {
  const color = minutes <= 0
    ? 'var(--accent-emerald)'
    : minutes <= 10
      ? 'var(--accent-amber)'
      : 'var(--accent-red)';
  const label = minutes <= 0 ? 'On time' : `+${minutes}m`;
  return (
    <span className="font-mono text-[10px] tabular-nums" style={{ color }}>
      {label}
    </span>
  );
}

// ── Live flight display shape ─────────────────────────────────

interface LiveDisplayRow {
  flightNumber: string; callsign: string; tail: string; type: string;
  dep: string; arr: string; phase: string;
  alt: number; gs: number; hdg: number; vs: number;
  loadPct: number; delta: number;
}

// ── Main component ───────────────────────────────────────────

interface FlightsCardProps {
  liveFlights: ActiveFlightHeartbeat[];
  selectedCallsign?: string | null;
  onSelectFlight?: (callsign: string | null) => void;
}

export const FlightsCard = memo(function FlightsCard({ liveFlights, selectedCallsign, onSelectFlight }: FlightsCardProps) {
  const [tab, setTab] = useState<'live' | 'recent'>('live');

  // Map real heartbeat data to display shape
  const live: LiveDisplayRow[] = liveFlights.map((f) => ({
    flightNumber: f.flightNumber ?? f.callsign,
    callsign: f.callsign,
    tail: '',
    type: f.aircraftType || '',
    dep: f.depIcao || '',
    arr: f.arrIcao || '',
    phase: f.phase || 'UNKNOWN',
    alt: f.altitude,
    gs: Math.round(f.groundSpeed),
    hdg: Math.round(f.heading),
    vs: 0,
    loadPct: 0,
    delta: 0,
  }));

  // Use external selection state
  const selectedRow = selectedCallsign ?? null;

  const handleRowClick = (callsign: string) => {
    const next = selectedRow === callsign ? null : callsign;
    onSelectFlight?.(next);
  };

  return (
    <div className="rounded-lg border border-[var(--border-primary)] p-3 flex flex-col gap-2 h-full min-h-0">
      {/* ── Header with tabs ───────────────────────────────── */}
      <div className="flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setTab('live')}
            className={`px-2 py-0.5 rounded text-[11px] font-semibold uppercase tracking-wider transition-colors ${
              tab === 'live'
                ? 'bg-[var(--accent-emerald-bg)] text-[var(--accent-emerald)]'
                : 'text-[var(--text-quaternary)] hover:text-[var(--text-tertiary)]'
            }`}
          >
            Live ({live.length})
          </button>
          <button
            onClick={() => setTab('recent')}
            className={`px-2 py-0.5 rounded text-[11px] font-semibold uppercase tracking-wider transition-colors ${
              tab === 'recent'
                ? 'bg-[var(--accent-blue-bg)] text-[var(--accent-blue)]'
                : 'text-[var(--text-quaternary)] hover:text-[var(--text-tertiary)]'
            }`}
          >
            Recent
          </button>
        </div>
      </div>

      {/* ── Table ──────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto min-h-0" style={{ scrollbarWidth: 'thin' }}>
        {tab === 'live' ? (
          live.length === 0 ? (
            <div className="flex items-center justify-center h-full text-[var(--text-quaternary)] text-[12px]">
              No active flights
            </div>
          ) : (
          <table className="w-full">
            <thead>
              <tr className="text-[9px] uppercase tracking-wider text-[var(--text-quaternary)] border-b border-[var(--divider)]">
                <th className="text-left font-medium py-1 pr-2">Flight</th>
                <th className="text-left font-medium py-1 pr-2">Route</th>
                <th className="text-left font-medium py-1 pr-2">Phase</th>
                <th className="text-right font-medium py-1 pr-2">Alt</th>
                <th className="text-right font-medium py-1 pr-2">GS</th>
                <th className="text-right font-medium py-1 pr-2">HDG</th>
                <th className="text-right font-medium py-1 pr-2">Load</th>
                <th className="text-right font-medium py-1">Status</th>
              </tr>
            </thead>
            <tbody>
              {live.map((f) => {
                const isSelected = selectedRow === f.callsign;
                return (
                  <tr
                    key={f.callsign}
                    onClick={() => handleRowClick(f.callsign)}
                    className={`cursor-pointer transition-colors ${isSelected ? 'bg-[var(--accent-blue-bg)]' : 'hover:bg-[var(--tint-hover)]'}`}
                  >
                    <td className="py-1 pr-2">
                      <div className="font-mono text-[11px] font-semibold text-[var(--text-primary)]">{f.flightNumber}</div>
                      <div className="font-mono text-[9px] text-[var(--text-quaternary)]">{f.tail} · {f.type}</div>
                    </td>
                    <td className="py-1 pr-2">
                      <span className="font-mono text-[11px] text-[var(--text-secondary)]">
                        {f.dep} → {f.arr}
                      </span>
                    </td>
                    <td className="py-1 pr-2">
                      <PhaseBadge phase={f.phase} />
                    </td>
                    <td className="py-1 pr-2 text-right">
                      <span className="font-mono text-[10px] tabular-nums text-[var(--text-secondary)]">
                        FL{String(Math.round(f.alt / 100)).padStart(3, '0')}
                      </span>
                    </td>
                    <td className="py-1 pr-2 text-right">
                      <span className="font-mono text-[10px] tabular-nums text-[var(--text-secondary)]">
                        {f.gs}kt
                      </span>
                    </td>
                    <td className="py-1 pr-2 text-right">
                      <span className="font-mono text-[10px] tabular-nums text-[var(--text-secondary)]">
                        {String(f.hdg).padStart(3, '0')}°
                      </span>
                    </td>
                    <td className="py-1 pr-2 text-right">
                      <span className={`font-mono text-[10px] tabular-nums ${f.loadPct >= 80 ? 'text-[var(--accent-emerald)]' : f.loadPct >= 50 ? 'text-[var(--text-secondary)]' : 'text-[var(--accent-red)]'}`}>
                        {f.loadPct}%
                      </span>
                    </td>
                    <td className="py-1 text-right">
                      <DeltaBadge minutes={f.delta} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          )
        ) : (
          <div className="flex items-center justify-center h-full text-[var(--text-quaternary)] text-[12px]">
            Recent flights will appear here from PIREPs
          </div>
        )}
      </div>
    </div>
  );
});
