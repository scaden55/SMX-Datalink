import { useFlightPlanStore } from '../../stores/flightPlanStore';
import { useTelemetry } from '../../hooks/useTelemetry';
import { Badge } from '../common/Badge';

export function FlightHeader() {
  const flightPlan = useFlightPlanStore((s) => s.flightPlan);
  const progress = useFlightPlanStore((s) => s.progress);
  const { aircraft } = useTelemetry();

  const origin = flightPlan?.origin ?? 'XXXX';
  const destination = flightPlan?.destination ?? 'XXXX';
  const flightId = flightPlan?.id ?? '---';

  const formatEte = (seconds: number | null | undefined): string => {
    if (!seconds) return '---';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${h}h ${String(m).padStart(2, '0')}m`;
  };

  return (
    <div className="border-b border-acars-border px-3 py-3">
      {/* Origin / Destination header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs text-acars-muted">George Bush Intcntl, Houston, TX, US</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-acars-muted">Denver Intl, Denver, CO, US</span>
        </div>
      </div>

      <div className="flex items-baseline justify-between mt-1">
        <div className="flex items-baseline gap-1">
          <span className="text-xl font-bold text-acars-cyan">{origin}</span>
          <span className="text-acars-muted">/</span>
          <span className="text-[11px] text-acars-muted">IAH</span>
        </div>

        <div className="flex flex-col items-center">
          <span className="text-lg font-bold text-acars-text">{flightId}</span>
          <div className="flex items-center gap-1 text-[10px] text-acars-muted">
            <span>3253</span>
            <span>|</span>
            <span>38WE</span>
          </div>
          <div className="flex items-center gap-1 mt-0.5">
            <span className="text-acars-muted">· · · · · · · · · · · · · ·</span>
            {aircraft && (
              <span className="text-[10px] text-acars-cyan">
                ▸ {Math.round(progress?.distanceFlown ?? 0)} nm
              </span>
            )}
            <span className="text-acars-muted">· · · · · · · · · · ·</span>
          </div>
        </div>

        <div className="flex items-baseline gap-1">
          <span className="text-xl font-bold text-acars-cyan">{destination}</span>
          <span className="text-acars-muted">/</span>
          <span className="text-[11px] text-acars-muted">DEN</span>
        </div>
      </div>

      {/* Times row */}
      <div className="mt-2 flex items-center justify-between text-[11px]">
        <div className="text-acars-muted">
          STD 05 - 07:50z | ETD 05 - 07:50z
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="green">On Time</Badge>
          <span className="text-acars-muted font-mono">
            UAL8079
          </span>
        </div>
        <div className="text-acars-muted">
          STA 05 - 11:16z | ETA 05 - 11:21z
        </div>
      </div>

      <div className="mt-1 flex items-center justify-center text-[11px] text-acars-cyan">
        ETE {formatEte(progress?.eteDestination)}
        <span className="mx-2 text-acars-muted">|</span>
        <span className="text-acars-muted">
          REM {Math.round(progress?.distanceRemaining ?? 0)} nm
        </span>
        <span className="mx-2 text-acars-muted">|</span>
        <span className="text-acars-muted">
          Fuel@Dest {Math.round(progress?.fuelAtDestination ?? 0).toLocaleString()} lbs
        </span>
      </div>
    </div>
  );
}
