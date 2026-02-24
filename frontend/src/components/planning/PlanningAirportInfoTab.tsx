import { useFlightPlanStore } from '../../stores/flightPlanStore';
import { MapPin } from '@phosphor-icons/react';

export function PlanningAirportInfoTab() {
  const { selectedAirportIcao, airports, weatherCache } = useFlightPlanStore();

  const airport = airports.find((a) => a.icao === selectedAirportIcao);

  if (!airport) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center gap-2 p-4">
        <MapPin className="w-6 h-6 text-acars-muted/20" />
        <p className="text-[11px] text-acars-muted font-sans">Click an airport card to view details</p>
      </div>
    );
  }

  const wx = weatherCache[airport.icao];

  return (
    <div className="p-3 space-y-3 overflow-auto">
      <div>
        <div className="flex items-center gap-2 mb-2">
          <span className="font-mono text-base font-bold text-acars-mono">{airport.icao}</span>
          <span className="text-[12px] text-acars-muted font-sans">{airport.name}</span>
        </div>
        <div className="grid grid-cols-2 gap-y-2 gap-x-4">
          <div>
            <span className="planning-label">City</span>
            <span className="text-[12px] text-acars-text font-sans">{airport.city}, {airport.state}</span>
          </div>
          <div>
            <span className="planning-label">Country</span>
            <span className="text-[12px] text-acars-text font-sans">{airport.country}</span>
          </div>
          <div>
            <span className="planning-label">Elevation</span>
            <span className="data-value">{airport.elevation.toLocaleString()} ft</span>
          </div>
          <div>
            <span className="planning-label">Timezone</span>
            <span className="text-[12px] text-acars-text font-sans">{airport.timezone}</span>
          </div>
          <div>
            <span className="planning-label">Lat / Lon</span>
            <span className="data-value text-[11px]">{airport.lat.toFixed(4)} / {airport.lon.toFixed(4)}</span>
          </div>
        </div>
      </div>

      {wx?.metar && (
        <div>
          <span className="planning-label mb-1">Current METAR</span>
          <pre className="text-[11px] font-mono text-acars-mono bg-acars-input rounded-md px-2 py-1 whitespace-pre-wrap break-words border border-acars-border">
            {wx.metar.rawOb}
          </pre>
        </div>
      )}
    </div>
  );
}
