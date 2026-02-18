import { useFlightPlanStore } from '../../stores/flightPlanStore';
import { Cloud } from 'lucide-react';

function FlightCatBadge({ cat }: { cat: string | null }) {
  if (!cat) return null;
  const colors: Record<string, string> = {
    VFR: 'text-acars-green bg-acars-green/10 border-acars-green/20',
    MVFR: 'text-acars-blue bg-acars-blue/10 border-acars-blue/20',
    IFR: 'text-acars-red bg-acars-red/10 border-acars-red/20',
    LIFR: 'text-acars-magenta bg-acars-magenta/10 border-acars-magenta/20',
  };
  return (
    <span className={`inline-flex px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wide border ${colors[cat] ?? 'text-acars-muted bg-acars-bg border-acars-border'}`}>
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
        <span className="text-[10px] uppercase tracking-wider text-acars-muted font-medium">{label}</span>
        <span className="font-mono text-xs text-acars-text font-semibold">{icao}</span>
        {wx?.metar?.flightCategory && <FlightCatBadge cat={wx.metar.flightCategory} />}
      </div>
      {wx?.metar ? (
        <pre className="text-[10px] font-mono text-acars-text bg-acars-bg rounded px-2 py-1.5 whitespace-pre-wrap break-words border border-acars-border/50">
          {wx.metar.rawOb}
        </pre>
      ) : (
        <p className="text-[10px] text-acars-muted">No METAR available</p>
      )}
      {wx?.taf ? (
        <pre className="text-[10px] font-mono text-acars-muted bg-acars-bg rounded px-2 py-1.5 whitespace-pre-wrap break-words border border-acars-border/50">
          {wx.taf.rawTaf}
        </pre>
      ) : (
        <p className="text-[10px] text-acars-muted">No TAF available</p>
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
        <Cloud className="w-6 h-6 text-acars-muted/30" />
        <p className="text-[11px] text-acars-muted">Enter origin/destination to fetch weather</p>
      </div>
    );
  }

  return (
    <div className="p-3 space-y-3 overflow-auto">
      {weatherLoading && <p className="text-[10px] text-acars-cyan animate-pulse">Fetching weather...</p>}
      {icaos.map((e) => (
        <WeatherBlock key={e.icao} icao={e.icao} label={e.label} />
      ))}
    </div>
  );
}
