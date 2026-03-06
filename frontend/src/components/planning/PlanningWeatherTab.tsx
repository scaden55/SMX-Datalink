import { useFlightPlanStore } from '../../stores/flightPlanStore';
import { Cloud } from '@phosphor-icons/react';

function FlightCatBadge({ cat }: { cat: string | null }) {
  if (!cat) return null;
  const colors: Record<string, string> = {
    VFR: 'text-emerald-400 bg-emerald-500/10',
    MVFR: 'text-blue-400 bg-blue-500/10',
    IFR: 'text-red-400 bg-red-500/10',
    LIFR: 'text-blue-400 bg-blue-500/10',
  };
  return (
    <span className={`inline-flex px-[3px] rounded-[2px] text-[11px] font-bold uppercase tracking-[0.08em] ${colors[cat] ?? 'text-acars-muted bg-acars-input'}`}>
      {cat}
    </span>
  );
}

function WeatherBlock({ icao, label }: { icao: string; label: string }) {
  const { weatherCache } = useFlightPlanStore();
  const wx = weatherCache[icao];

  if (!icao) return null;

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <span className="text-[11px] uppercase tracking-[0.08em] text-acars-muted font-medium">{label}</span>
        <span className="tabular-nums text-[12px] text-acars-text font-semibold">{icao}</span>
        {wx?.metar?.flightCategory && <FlightCatBadge cat={wx.metar.flightCategory} />}
      </div>
      {wx?.metar ? (
        <pre className="text-[11px] tabular-nums text-acars-text bg-acars-input rounded-md px-2 py-1 whitespace-pre-wrap break-words border border-acars-border">
          {wx.metar.rawOb}
        </pre>
      ) : (
        <p className="text-[11px] text-acars-muted">No METAR available</p>
      )}
      {wx?.taf ? (
        <pre className="text-[11px] tabular-nums text-acars-muted bg-acars-input rounded-md px-2 py-1 whitespace-pre-wrap break-words border border-acars-border">
          {wx.taf.rawTaf}
        </pre>
      ) : (
        <p className="text-[11px] text-acars-muted">No TAF available</p>
      )}
    </div>
  );
}

export function PlanningWeatherTab() {
  const { form, weatherLoading } = useFlightPlanStore();

  const icaos = [
    { icao: form.origin, label: 'Origin' },
    { icao: form.destination, label: 'Destination' },
    { icao: form.alternate1, label: 'Alternate 1' },
    { icao: form.alternate2, label: 'Alternate 2' },
  ].filter((e) => e.icao);

  if (icaos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center gap-2 p-4">
        <Cloud className="w-6 h-6 text-acars-muted/20" />
        <p className="text-[11px] text-acars-muted">Enter origin/destination to fetch weather</p>
      </div>
    );
  }

  return (
    <div className="p-3 space-y-3 overflow-auto">
      {weatherLoading && <p className="text-[11px] text-blue-400 animate-pulse">Fetching weather...</p>}
      {icaos.map((e) => (
        <WeatherBlock key={e.icao} icao={e.icao} label={e.label} />
      ))}
    </div>
  );
}
