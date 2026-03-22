import type { DispatchFlight } from '@acars/shared';

interface OfpTabProps {
  flight: DispatchFlight;
}

export default function OfpTab({ flight }: OfpTabProps) {
  const ofp = flight.ofpJson;

  if (!ofp) {
    return (
      <div className="space-y-3">
        <h3 className="text-xs font-semibold text-[var(--text-primary)]">Operational Flight Plan</h3>
        <div className="text-[12px] text-[var(--text-muted)] italic">
          No OFP data available — SimBrief flight plan not loaded.
        </div>
      </div>
    );
  }

  const fuel = ofp.fuel;
  const wgt = ofp.weights;
  const enrouteH = Math.floor((ofp.times?.estEnroute ?? 0) / 60);
  const enrouteM = (ofp.times?.estEnroute ?? 0) % 60;

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-[var(--text-primary)]">Operational Flight Plan</h3>
        <span className="text-[11px] text-[var(--text-muted)] font-mono tabular-nums">
          {ofp.airline ?? ''}{ofp.flightNumber} | {ofp.aircraftType ?? '---'}
        </span>
      </div>

      {/* Summary panel */}
      <div className="bg-[var(--surface-1)] border border-[var(--surface-3)] rounded-md p-3 space-y-2">
        <div className="grid grid-cols-4 gap-3 text-[12px]">
          <div>
            <span className="text-[11px] text-[var(--text-muted)]">Origin</span>
            <div className="font-mono tabular-nums text-[var(--text-primary)]">{ofp.origin}</div>
          </div>
          <div>
            <span className="text-[11px] text-[var(--text-muted)]">Destination</span>
            <div className="font-mono tabular-nums text-[var(--text-primary)]">{ofp.destination}</div>
          </div>
          <div>
            <span className="text-[11px] text-[var(--text-muted)]">Cruise FL</span>
            <div className="font-mono tabular-nums text-[var(--text-primary)]">
              {ofp.cruiseAltitude
                ? `FL${String(Math.round(ofp.cruiseAltitude / 100)).padStart(3, '0')}`
                : '---'}
            </div>
          </div>
          <div>
            <span className="text-[11px] text-[var(--text-muted)]">Est Enroute</span>
            <div className="font-mono tabular-nums text-[var(--text-primary)]">
              {ofp.times?.estEnroute ? `${enrouteH}h${String(enrouteM).padStart(2, '0')}m` : '---'}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-3 text-[12px] mt-2">
          <div>
            <span className="text-[11px] text-[var(--text-muted)]">Fuel Total</span>
            <div className="font-mono tabular-nums text-[var(--text-primary)]">
              {fuel?.totalLbs?.toLocaleString() ?? '--'} lbs
            </div>
          </div>
          <div>
            <span className="text-[11px] text-[var(--text-muted)]">Burn</span>
            <div className="font-mono tabular-nums text-[var(--text-primary)]">
              {fuel?.burnLbs?.toLocaleString() ?? '--'} lbs
            </div>
          </div>
          <div>
            <span className="text-[11px] text-[var(--text-muted)]">ZFW</span>
            <div className="font-mono tabular-nums text-[var(--text-primary)]">
              {wgt?.estZfw?.toLocaleString() ?? '--'} lbs
            </div>
          </div>
          <div>
            <span className="text-[11px] text-[var(--text-muted)]">TOW</span>
            <div className="font-mono tabular-nums text-[var(--text-primary)]">
              {wgt?.estTow?.toLocaleString() ?? '--'} lbs
            </div>
          </div>
        </div>
      </div>

      {/* Route */}
      <div className="bg-[var(--surface-1)] border border-[var(--surface-3)] rounded-md p-3 space-y-2">
        <h3 className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">Route</h3>
        <div className="font-mono text-[12px] text-[var(--text-primary)] tabular-nums break-all leading-relaxed">
          {ofp.route || '---'}
        </div>
      </div>

      {/* Alternates */}
      {ofp.alternates && ofp.alternates.length > 0 && (
        <div className="bg-[var(--surface-1)] border border-[var(--surface-3)] rounded-md p-3 space-y-2">
          <h3 className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
            Alternates
          </h3>
          <div className="space-y-1">
            {ofp.alternates.map((alt) => (
              <div key={alt.icao} className="font-mono text-[12px] text-[var(--text-primary)] tabular-nums">
                {alt.icao} ({alt.name}) — {alt.distanceNm} nm, fuel {alt.fuelLbs?.toLocaleString() ?? '--'} lbs
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Raw OFP text */}
      {ofp.rawText && (
        <div className="bg-[var(--surface-1)] border border-[var(--surface-3)] rounded-md p-3 space-y-2">
          <h3 className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
            Raw OFP
          </h3>
          <pre className="font-mono text-[11px] text-[var(--text-secondary)] tabular-nums whitespace-pre-wrap leading-relaxed max-h-[300px] overflow-y-auto">
            {ofp.rawText}
          </pre>
        </div>
      )}
    </div>
  );
}
