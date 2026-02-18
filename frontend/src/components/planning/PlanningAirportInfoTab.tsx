import { useFlightPlanStore } from '../../stores/flightPlanStore';
import { MapPin } from 'lucide-react';

export function PlanningAirportInfoTab() {
  const { selectedAirportIcao, airports, weatherCache } = useFlightPlanStore();

  const airport = airports.find((a) => a.icao === selectedAirportIcao);

  if (!airport) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center gap-2 p-4">
        <MapPin className="w-6 h-6 text-acars-muted/30" />
        <p className="text-[11px] text-acars-muted">Click an airport card to view details</p>
      </div>
    );
  }

  const wx = weatherCache[airport.icao];

  return (
    <div className="p-3 space-y-3 overflow-auto">
      <div>
        <div className="flex items-center gap-2 mb-2">
          <span className="font-mono text-lg font-bold text-acars-text">{airport.icao}</span>
          <span className="text-xs text-acars-muted">{airport.name}</span>
        </div>
        <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-[11px]">
          <div>
            <span className="text-acars-muted block text-[9px] uppercase tracking-wider font-medium">City</span>
            <span className="text-acars-text">{airport.city}, {airport.state}</span>
          </div>
          <div>
            <span className="text-acars-muted block text-[9px] uppercase tracking-wider font-medium">Country</span>
            <span className="text-acars-text">{airport.country}</span>
          </div>
          <div>
            <span className="text-acars-muted block text-[9px] uppercase tracking-wider font-medium">Elevation</span>
            <span className="text-acars-text font-mono">{airport.elevation.toLocaleString()} ft</span>
          </div>
          <div>
            <span className="text-acars-muted block text-[9px] uppercase tracking-wider font-medium">Timezone</span>
            <span className="text-acars-text">{airport.timezone}</span>
          </div>
          <div>
            <span className="text-acars-muted block text-[9px] uppercase tracking-wider font-medium">Lat / Lon</span>
            <span className="text-acars-text font-mono text-[10px]">{airport.lat.toFixed(4)} / {airport.lon.toFixed(4)}</span>
          </div>
        </div>
      </div>

      {wx?.metar && (
        <div>
          <span className="text-[10px] uppercase tracking-wider text-acars-muted font-medium mb-1 block">Current METAR</span>
          <pre className="text-[10px] font-mono text-acars-text bg-acars-bg rounded px-2 py-1.5 whitespace-pre-wrap break-words border border-acars-border/50">
            {wx.metar.rawOb}
          </pre>
        </div>
      )}
    </div>
  );
}
