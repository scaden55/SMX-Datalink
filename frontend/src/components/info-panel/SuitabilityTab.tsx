import { useFlightPlanStore } from '../../stores/flightPlanStore';
import type { FaaAirportEvent, MetarData } from '@acars/shared';
import type { DispatchData } from '../../hooks/useDispatchData';

function getFaaEvent(faaEvents: FaaAirportEvent[], icao?: string): FaaAirportEvent | null {
  if (!icao || icao.length < 4) return null;
  const iata = icao.slice(1);
  return faaEvents.find((e) => e.airportId === iata) ?? null;
}

type SuitLevel = 'green' | 'amber' | 'red';

interface Check {
  label: string;
  level: SuitLevel;
  detail: string;
}

function getFlightCategoryLevel(cat: string | null): SuitLevel {
  if (!cat) return 'amber';
  if (cat === 'VFR' || cat === 'MVFR') return 'green';
  if (cat === 'IFR') return 'amber';
  return 'red'; // LIFR
}

function buildChecks(icao: string, metar: MetarData | undefined, faaEvent: FaaAirportEvent | null): Check[] {
  const checks: Check[] = [];

  // Weather category
  if (metar) {
    const cat = metar.flightCategory;
    checks.push({
      label: 'Flight Category',
      level: getFlightCategoryLevel(cat),
      detail: cat || 'Unknown',
    });

    // Wind check
    if (metar.windSpeed != null) {
      const gustInfo = metar.windGust != null ? ` G${metar.windGust}kt` : '';
      if ((metar.windGust ?? metar.windSpeed) >= 35) {
        checks.push({ label: 'Surface Wind', level: 'red', detail: `${metar.windSpeed}kt${gustInfo} — HIGH` });
      } else if ((metar.windGust ?? metar.windSpeed) >= 25) {
        checks.push({ label: 'Surface Wind', level: 'amber', detail: `${metar.windSpeed}kt${gustInfo} — Moderate` });
      } else {
        checks.push({ label: 'Surface Wind', level: 'green', detail: `${metar.windSpeed}kt${gustInfo}` });
      }
    }

    // Visibility check
    if (metar.visibility != null) {
      if (metar.visibility < 1) {
        checks.push({ label: 'Visibility', level: 'red', detail: `${metar.visibility} sm — Below minimums` });
      } else if (metar.visibility < 3) {
        checks.push({ label: 'Visibility', level: 'amber', detail: `${metar.visibility} sm — Low` });
      } else {
        checks.push({ label: 'Visibility', level: 'green', detail: `${metar.visibility} sm` });
      }
    }
  } else {
    checks.push({ label: 'Weather', level: 'amber', detail: 'No METAR data available' });
  }

  // FAA status checks
  if (faaEvent) {
    if (faaEvent.airportClosure) {
      checks.push({ label: 'Airport Status', level: 'red', detail: `CLOSED — ${faaEvent.airportClosure.reason}` });
    } else if (faaEvent.groundStop) {
      checks.push({ label: 'Ground Stop', level: 'red', detail: faaEvent.groundStop.impactingCondition });
    } else if (faaEvent.groundDelay) {
      checks.push({
        label: 'Ground Delay',
        level: 'amber',
        detail: `Avg ${faaEvent.groundDelay.avgDelay}min / Max ${faaEvent.groundDelay.maxDelay}min`,
      });
    }

    if (faaEvent.arrivalDelay) {
      checks.push({
        label: 'Arrival Delay',
        level: 'amber',
        detail: `${faaEvent.arrivalDelay.arrivalDeparture.min}–${faaEvent.arrivalDelay.arrivalDeparture.max}`,
      });
    }

    if (faaEvent.departureDelay) {
      checks.push({
        label: 'Departure Delay',
        level: 'amber',
        detail: `${faaEvent.departureDelay.arrivalDeparture.min}–${faaEvent.departureDelay.arrivalDeparture.max}`,
      });
    }

    if (faaEvent.deicing) {
      checks.push({ label: 'Deicing', level: 'amber', detail: 'Active deicing in effect' });
    }

    // If no FAA issues
    if (!faaEvent.airportClosure && !faaEvent.groundStop && !faaEvent.groundDelay &&
        !faaEvent.arrivalDelay && !faaEvent.departureDelay) {
      checks.push({ label: 'FAA Status', level: 'green', detail: 'Normal operations' });
    }
  } else {
    checks.push({ label: 'FAA Status', level: 'green', detail: 'No active events' });
  }

  return checks;
}

function SuitIndicator({ level }: { level: SuitLevel }) {
  const cls = {
    green: 'bg-emerald-500',
    amber: 'bg-amber-500',
    red: 'bg-red-500',
  };
  return <div className={`w-2 h-2 rounded-full ${cls[level]} shrink-0`} />;
}

function overallLevel(checks: Check[]): SuitLevel {
  if (checks.some((c) => c.level === 'red')) return 'red';
  if (checks.some((c) => c.level === 'amber')) return 'amber';
  return 'green';
}

function OverallBadge({ level }: { level: SuitLevel }) {
  const styles = {
    green: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    amber: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    red: 'bg-red-500/15 text-red-400 border-red-500/30',
  };
  const labels = { green: 'SUITABLE', amber: 'CAUTION', red: 'NOT RECOMMENDED' };
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold border ${styles[level]}`}>
      {labels[level]}
    </span>
  );
}

function AirportSuitability({ icao, label, checks }: { icao: string; label: string; checks: Check[] }) {
  const level = overallLevel(checks);

  return (
    <div className="panel p-3 space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-xs font-bold text-acars-cyan">{icao}</span>
        <span className="text-[10px] text-acars-muted">({label})</span>
        <OverallBadge level={level} />
      </div>
      <div className="space-y-1">
        {checks.map((c, i) => (
          <div key={i} className="flex items-center gap-2 text-[11px]">
            <SuitIndicator level={c.level} />
            <span className="text-acars-muted w-28 shrink-0">{c.label}</span>
            <span className="text-acars-text">{c.detail}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function SuitabilityTab({ dispatchData }: { dispatchData: DispatchData }) {
  const flightPlan = useFlightPlanStore((s) => s.flightPlan);

  if (!flightPlan) {
    return (
      <div className="space-y-3">
        <h3 className="text-xs font-semibold text-acars-text">Airport Suitability</h3>
        <div className="text-[11px] text-acars-muted italic">
          No flight plan loaded. Suitability checks will appear once a flight is selected.
        </div>
      </div>
    );
  }

  const originIcao = flightPlan.origin;
  const destIcao = flightPlan.destination;

  const originChecks = buildChecks(
    originIcao,
    dispatchData.metars[originIcao],
    getFaaEvent(dispatchData.faaEvents, originIcao),
  );
  const destChecks = buildChecks(
    destIcao,
    dispatchData.metars[destIcao],
    getFaaEvent(dispatchData.faaEvents, destIcao),
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <h3 className="text-xs font-semibold text-acars-text">Airport Suitability</h3>
        {dispatchData.loading && (
          <span className="text-[10px] text-acars-cyan animate-pulse">Fetching...</span>
        )}
      </div>

      <AirportSuitability icao={originIcao} label="Origin" checks={originChecks} />
      <AirportSuitability icao={destIcao} label="Destination" checks={destChecks} />
    </div>
  );
}
