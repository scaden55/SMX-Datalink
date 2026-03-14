import { useFlightPlanStore } from '../../stores/flightPlanStore';

export function OFPTab() {
  const ofp = useFlightPlanStore((s) => s.ofp);
  const flightPlan = useFlightPlanStore((s) => s.flightPlan);

  if (!ofp) {
    return (
      <div className="space-y-3">
        <h3 className="text-xs font-semibold text-acars-text">Operational Flight Plan</h3>
        <div className="text-[12px] text-acars-muted italic">
          No OFP available. Generate an OFP via SimBrief on the Planning page.
        </div>
      </div>
    );
  }

  const enrouteH = Math.floor((ofp.times.estEnroute ?? 0) / 60);
  const enrouteM = (ofp.times.estEnroute ?? 0) % 60;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-acars-text">Operational Flight Plan</h3>
        <span className="text-[11px] text-acars-muted tabular-nums">
          {ofp.airline}{ofp.flightNumber} | {ofp.aircraftType}
        </span>
      </div>

      {/* Summary */}
      <div className="panel p-3 space-y-2">
        <div className="grid grid-cols-4 gap-3 text-[12px]">
          <div>
            <span className="data-label">Origin</span>
            <div className="text-acars-text tabular-nums">{ofp.origin}</div>
          </div>
          <div>
            <span className="data-label">Destination</span>
            <div className="text-acars-text tabular-nums">{ofp.destination}</div>
          </div>
          <div>
            <span className="data-label">Cruise</span>
            <div className="text-acars-text tabular-nums">FL{Math.round(ofp.cruiseAltitude / 100)}</div>
          </div>
          <div>
            <span className="data-label">Est Enroute</span>
            <div className="text-acars-text tabular-nums">{enrouteH}h{String(enrouteM).padStart(2, '0')}m</div>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-3 text-[12px] mt-2">
          <div>
            <span className="data-label">Fuel Plan</span>
            <div className="text-acars-text tabular-nums">{ofp.fuel.totalLbs.toLocaleString()} lbs</div>
          </div>
          <div>
            <span className="data-label">Burn</span>
            <div className="text-acars-text tabular-nums">{ofp.fuel.burnLbs.toLocaleString()} lbs</div>
          </div>
          <div>
            <span className="data-label">ZFW</span>
            <div className="text-acars-text tabular-nums">{ofp.weights.estZfw.toLocaleString()} lbs</div>
          </div>
          <div>
            <span className="data-label">TOW</span>
            <div className="text-acars-text tabular-nums">{ofp.weights.estTow.toLocaleString()} lbs</div>
          </div>
        </div>
      </div>

      {/* Route */}
      <div className="panel p-3">
        <span className="data-label">Route</span>
        <div className="text-[12px] text-acars-text tabular-nums mt-1 break-all leading-relaxed">
          {ofp.route || flightPlan?.route || '---'}
        </div>
      </div>

      {/* Alternates */}
      {ofp.alternates.length > 0 && (
        <div className="panel p-3">
          <span className="data-label">Alternates</span>
          <div className="mt-1 space-y-1">
            {ofp.alternates.map((alt) => (
              <div key={alt.icao} className="text-[12px] text-acars-text tabular-nums">
                {alt.icao} ({alt.name}) — {alt.distanceNm} nm, fuel {alt.fuelLbs.toLocaleString()} lbs
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Raw OFP text */}
      {ofp.rawText && (
        <div className="panel p-3">
          <span className="data-label">Raw OFP</span>
          <pre className="text-[11px] text-acars-text tabular-nums mt-1 whitespace-pre-wrap leading-relaxed max-h-[300px] overflow-y-auto">
            {ofp.rawText}
          </pre>
        </div>
      )}
    </div>
  );
}
