import { useFlightPlanStore } from '../../stores/flightPlanStore';
import type { MetarData, TafData } from '@acars/shared';
import type { DispatchData } from '../../hooks/useDispatchData';

function FlightCategoryBadge({ category }: { category: string | null }) {
  if (!category) return null;
  const styles: Record<string, string> = {
    VFR: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    MVFR: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
    IFR: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    LIFR: 'bg-red-500/15 text-red-400 border-red-500/30',
  };
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold border ${styles[category] ?? 'bg-acars-cyan/15 text-acars-cyan border-acars-cyan/30'}`}>
      {category}
    </span>
  );
}

function MetarBlock({ icao, label, metar }: { icao: string; label: string; metar?: MetarData }) {
  return (
    <div className="panel p-3 space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-xs font-bold text-acars-cyan">{icao}</span>
        <span className="text-[10px] text-acars-muted">({label})</span>
        {metar?.flightCategory && <FlightCategoryBadge category={metar.flightCategory} />}
      </div>

      {metar ? (
        <>
          <div>
            <span className="data-label">METAR</span>
            <div className="font-mono text-[10px] text-acars-text mt-1 leading-relaxed break-all">
              {metar.rawOb}
            </div>
          </div>

          <div className="grid grid-cols-5 gap-2 text-[11px]">
            <div>
              <span className="text-acars-muted">Wind</span>
              <div className="text-acars-text font-mono">
                {metar.windDir != null ? `${String(metar.windDir).padStart(3, '0')}°` : '---'}
                /{metar.windSpeed ?? '--'}kt
                {metar.windGust != null && `G${metar.windGust}`}
              </div>
            </div>
            <div>
              <span className="text-acars-muted">Vis</span>
              <div className="text-acars-text font-mono">{metar.visibility ?? '--'} sm</div>
            </div>
            <div>
              <span className="text-acars-muted">Temp</span>
              <div className="text-acars-text font-mono">{metar.temp ?? '--'}°C</div>
            </div>
            <div>
              <span className="text-acars-muted">Dewpoint</span>
              <div className="text-acars-text font-mono">{metar.dewpoint ?? '--'}°C</div>
            </div>
            <div>
              <span className="text-acars-muted">Altimeter</span>
              <div className="text-acars-text font-mono">{metar.altimeter?.toFixed(2) ?? '----'}</div>
            </div>
          </div>
        </>
      ) : (
        <div className="text-[11px] text-acars-muted italic">METAR not available.</div>
      )}
    </div>
  );
}

function TafBlock({ icao, label, taf }: { icao: string; label: string; taf?: TafData }) {
  return (
    <div className="panel p-3 space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-xs font-bold text-acars-cyan">{icao}</span>
        <span className="text-[10px] text-acars-muted">({label} TAF)</span>
      </div>

      {taf ? (
        <div>
          <div className="font-mono text-[10px] text-acars-text leading-relaxed break-all whitespace-pre-wrap">
            {taf.rawTaf}
          </div>
          <div className="text-[10px] text-acars-muted mt-1">
            Valid: {taf.validTimeFrom} – {taf.validTimeTo}
          </div>
        </div>
      ) : (
        <div className="text-[11px] text-acars-muted italic">TAF not available.</div>
      )}
    </div>
  );
}

export function WeatherTab({ dispatchData }: { dispatchData: DispatchData }) {
  const flightPlan = useFlightPlanStore((s) => s.flightPlan);
  const origin = flightPlan?.origin;
  const destination = flightPlan?.destination;

  if (!flightPlan) {
    return (
      <div className="space-y-3">
        <h3 className="text-xs font-semibold text-acars-text">Weather</h3>
        <div className="text-[11px] text-acars-muted italic">
          No flight plan loaded. Weather data will appear once a flight is selected.
        </div>
      </div>
    );
  }

  const originMetar = origin ? dispatchData.metars[origin] : undefined;
  const destMetar = destination ? dispatchData.metars[destination] : undefined;
  const originTaf = origin ? dispatchData.tafs[origin] : undefined;
  const destTaf = destination ? dispatchData.tafs[destination] : undefined;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <h3 className="text-xs font-semibold text-acars-text">Weather</h3>
        {dispatchData.loading && (
          <span className="text-[10px] text-acars-cyan animate-pulse">Fetching...</span>
        )}
      </div>

      {/* Origin METAR + TAF */}
      {origin && (
        <>
          <MetarBlock icao={origin} label="Origin" metar={originMetar} />
          <TafBlock icao={origin} label="Origin" taf={originTaf} />
        </>
      )}

      {/* Destination METAR + TAF */}
      {destination && (
        <>
          <MetarBlock icao={destination} label="Destination" metar={destMetar} />
          <TafBlock icao={destination} label="Destination" taf={destTaf} />
        </>
      )}
    </div>
  );
}
