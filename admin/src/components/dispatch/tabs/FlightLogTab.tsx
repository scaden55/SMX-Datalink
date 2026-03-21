import { Clock } from 'lucide-react';
import type { DispatchFlight } from '@acars/shared';

interface FlightLogTabProps {
  flight: DispatchFlight;
  track: any[];
}

const PHASE_LABELS: Record<string, string> = {
  PREFLIGHT: 'Preflight',
  TAXI_OUT: 'Taxi Out',
  TAKEOFF: 'Takeoff',
  CLIMB: 'Climb',
  CRUISE: 'Cruise',
  DESCENT: 'Descent',
  APPROACH: 'Approach',
  LANDING: 'Landing',
  TAXI_IN: 'Taxi In',
  PARKED: 'Parked',
};

export default function FlightLogTab({ flight, track }: FlightLogTabProps) {
  const phase = flight.phase;
  const isPreFlight = phase === 'planning';

  if (isPreFlight && (!track || track.length === 0)) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-xs text-[var(--text-muted)] gap-2">
        <Clock size={20} />
        Flight has not departed yet
      </div>
    );
  }

  // Extract phase transitions from track data
  const phaseEvents: { phase: string; timestamp: string }[] = [];
  let lastPhase: string | null = null;
  for (const point of track) {
    const pointPhase = point.phase ?? point.flightPhase;
    if (pointPhase && pointPhase !== lastPhase) {
      phaseEvents.push({
        phase: pointPhase,
        timestamp: point.timestamp ?? point.time ?? '',
      });
      lastPhase = pointPhase;
    }
  }

  // Extract OOOI times
  const outTime = phaseEvents.find((e) => e.phase === 'TAXI_OUT')?.timestamp;
  const offTime = phaseEvents.find((e) => e.phase === 'TAKEOFF')?.timestamp;
  const onTime = phaseEvents.find((e) => e.phase === 'LANDING')?.timestamp;
  const inTime = phaseEvents.find((e) => e.phase === 'PARKED' || e.phase === 'TAXI_IN')?.timestamp;

  // Landing rate from last track point with vs_fpm
  const landingPoint = [...track].reverse().find((p) => p.phase === 'LANDING' || p.flightPhase === 'LANDING');
  const landingRate = landingPoint?.vs_fpm ?? landingPoint?.verticalSpeed ?? null;

  return (
    <div className="space-y-3">
      {/* OOOI Summary */}
      {(outTime || offTime || onTime || inTime) && (
        <div className="rounded bg-[var(--surface-1)] p-3">
          <div className="text-[10px] uppercase tracking-wider font-semibold text-[var(--text-muted)] mb-2">OOOI Times</div>
          <div className="grid grid-cols-4 gap-2">
            <OooiCell label="OUT" time={outTime} />
            <OooiCell label="OFF" time={offTime} />
            <OooiCell label="ON" time={onTime} />
            <OooiCell label="IN" time={inTime} />
          </div>
        </div>
      )}

      {/* Landing rate */}
      {landingRate != null && (
        <div className="rounded bg-[var(--surface-1)] px-3 py-2">
          <span className="text-[10px] text-[var(--text-muted)] mr-2">Landing Rate:</span>
          <span className={`font-mono text-[11px] tabular-nums font-bold ${
            Math.abs(landingRate) <= 200 ? 'text-emerald-400' :
            Math.abs(landingRate) <= 400 ? 'text-amber-400' : 'text-red-400'
          }`}>
            {Math.round(landingRate)} fpm
          </span>
        </div>
      )}

      {/* Phase timeline */}
      {phaseEvents.length > 0 && (
        <div className="rounded bg-[var(--surface-1)] p-3">
          <div className="text-[10px] uppercase tracking-wider font-semibold text-[var(--text-muted)] mb-3">Phase Timeline</div>
          <div className="relative pl-4">
            {/* Vertical line */}
            <div className="absolute left-[5px] top-1 bottom-1 w-px bg-[var(--surface-3)]" />

            {phaseEvents.map((evt, i) => (
              <div key={i} className="relative flex items-start gap-3 mb-3 last:mb-0">
                {/* Dot */}
                <div className="absolute left-[-12px] top-[3px] w-[10px] h-[10px] rounded-full border-2 border-[var(--accent)] bg-[var(--surface-0)]" />

                {/* Content */}
                <div className="flex items-center gap-2 ml-2">
                  <span className="font-mono text-[10px] font-semibold text-[var(--text-primary)] uppercase">
                    {PHASE_LABELS[evt.phase] ?? evt.phase.replace('_', ' ')}
                  </span>
                  {evt.timestamp && (
                    <span className="font-mono text-[9px] tabular-nums text-[var(--text-muted)]">
                      {formatTime(evt.timestamp)}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Fallback if no phase events but we have track data */}
      {phaseEvents.length === 0 && track.length > 0 && (
        <div className="rounded bg-[var(--surface-1)] p-3">
          <div className="text-[10px] text-[var(--text-muted)]">
            {track.length} track points recorded. Phase data not available in track.
          </div>
        </div>
      )}
    </div>
  );
}

function OooiCell({ label, time }: { label: string; time?: string }) {
  return (
    <div className="text-center">
      <div className="text-[9px] uppercase tracking-wider text-[var(--text-muted)] font-semibold">{label}</div>
      <div className="font-mono text-[11px] tabular-nums text-[var(--text-primary)]">
        {time ? formatTime(time) : '--:--'}
      </div>
    </div>
  );
}

function formatTime(timestamp: string): string {
  try {
    return new Date(timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  } catch {
    return timestamp;
  }
}
