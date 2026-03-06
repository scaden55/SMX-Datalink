import { useFlightPlanStore } from '../../stores/flightPlanStore';
import type { FaaAirportEvent } from '@acars/shared';
import type { DispatchData } from '../../hooks/useDispatchData';

function getFaaEvent(faaEvents: FaaAirportEvent[], icao?: string): FaaAirportEvent | null {
  if (!icao || icao.length < 4) return null;
  const iata = icao.slice(1);
  return faaEvents.find((e) => e.airportId === iata) ?? null;
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'UTC' }) + 'Z';
  } catch {
    return iso;
  }
}

function AirportAdvisories({ icao, label, faaEvent }: { icao: string; label: string; faaEvent: FaaAirportEvent | null }) {
  const hasFreeForm = faaEvent?.freeForm;

  return (
    <div className="panel p-3 space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-xs font-bold text-sky-400">{icao}</span>
        <span className="text-[10px] text-acars-muted">({label})</span>
      </div>

      {hasFreeForm ? (
        <div className="space-y-2">
          <div className="text-[11px] text-acars-text bg-acars-bg/50 p-2 rounded border border-acars-border tabular-nums leading-relaxed whitespace-pre-wrap">
            {faaEvent!.freeForm!.simpleText}
          </div>
          <div className="text-[10px] text-acars-muted">
            Valid: {formatTime(faaEvent!.freeForm!.startTime)} – {formatTime(faaEvent!.freeForm!.endTime)}
            {faaEvent!.freeForm!.notamNumber > 0 && ` | NOTAM #${faaEvent!.freeForm!.notamNumber}`}
          </div>
        </div>
      ) : (
        <div className="text-[11px] text-acars-muted italic">No active advisories.</div>
      )}

      {/* Show ground stop / closure as critical NOTAMs */}
      {faaEvent?.airportClosure && (
        <div className="text-[11px] bg-red-500/10 border border-red-500/20 rounded p-2 space-y-0.5">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold border bg-red-500/15 text-red-400 border-red-500/30">
              CLOSURE
            </span>
            <span className="text-red-400 font-semibold">{faaEvent.airportClosure.reason}</span>
          </div>
          <div className="text-acars-muted">
            {formatTime(faaEvent.airportClosure.startTime)} – {formatTime(faaEvent.airportClosure.endTime)}
          </div>
        </div>
      )}

      {faaEvent?.groundStop && (
        <div className="text-[11px] bg-red-500/10 border border-red-500/20 rounded p-2 space-y-0.5">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold border bg-red-500/15 text-red-400 border-red-500/30">
              GROUND STOP
            </span>
            <span className="text-acars-text">{faaEvent.groundStop.impactingCondition}</span>
          </div>
          <div className="text-acars-muted">
            {formatTime(faaEvent.groundStop.startTime)} – {formatTime(faaEvent.groundStop.endTime)}
          </div>
        </div>
      )}
    </div>
  );
}

export function NOTAMTab({ dispatchData }: { dispatchData: DispatchData }) {
  const flightPlan = useFlightPlanStore((s) => s.flightPlan);

  if (!flightPlan) {
    return (
      <div className="space-y-3">
        <h3 className="text-xs font-semibold text-acars-text">NOTAMs</h3>
        <div className="text-[11px] text-acars-muted italic">
          No flight plan loaded. NOTAMs will appear once a flight is selected.
        </div>
      </div>
    );
  }

  const originEvent = getFaaEvent(dispatchData.faaEvents, flightPlan.origin);
  const destEvent = getFaaEvent(dispatchData.faaEvents, flightPlan.destination);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <h3 className="text-xs font-semibold text-acars-text">NOTAMs & Advisories</h3>
        {dispatchData.loading && (
          <span className="text-[10px] text-sky-400 animate-pulse">Fetching...</span>
        )}
      </div>

      <AirportAdvisories icao={flightPlan.origin} label="Origin" faaEvent={originEvent} />
      <AirportAdvisories icao={flightPlan.destination} label="Destination" faaEvent={destEvent} />
    </div>
  );
}
