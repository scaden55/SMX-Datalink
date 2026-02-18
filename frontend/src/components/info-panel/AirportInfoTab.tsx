import { Badge } from '../common/Badge';

export function AirportInfoTab() {
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2 text-xs">
        <span className="font-bold text-acars-cyan">KDEN</span>
        <span className="text-acars-muted">(Destination)</span>
        <span className="text-acars-muted">|</span>
        <span className="text-acars-muted">RWY 18R</span>
        <span className="ml-auto text-[10px] text-acars-muted">
          ETD 05 - 07:54z | EOF 05 - 08:15z | Takeoff Mins: 500' - 2 sm | Forecast Winds: HW 3 kts, XW 5 kts
        </span>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {/* General info */}
        <div className="panel p-3">
          <h3 className="text-xs font-semibold text-acars-text mb-2">General</h3>
          <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-[11px]">
            <span className="text-acars-muted">Name</span>
            <span className="text-acars-text">Denver International</span>
            <span className="text-acars-muted">Location</span>
            <span className="text-acars-text">Denver, Colorado, United States</span>
            <span className="text-acars-muted">FIR/UIR</span>
            <span className="text-acars-text">KZJX (JACKSONVILLE)</span>
            <span className="text-acars-muted">Local Time</span>
            <span className="text-acars-text">02:08 (-1:00) Mountain Standard Time</span>
            <span className="text-acars-muted">Morning Twilight</span>
            <span className="text-acars-text">06:02 (10:02z)</span>
            <span className="text-acars-muted">Sunrise</span>
            <span className="text-acars-text">06:02 (10:02z)</span>
            <span className="text-acars-muted">Evening Twilight</span>
            <span className="text-acars-text">20:18 (00:18z)</span>
            <span className="text-acars-muted">Sunset</span>
            <span className="text-acars-text">20:18 (00:18z)</span>
            <span className="text-acars-muted">Tower Hours</span>
            <span className="text-acars-text">Mon - Sun (Open 24 hours)</span>
            <span className="text-acars-muted">Curfew Hours</span>
            <span className="text-acars-text">Mon - Sun (Open 24 hours)</span>
            <span className="text-acars-muted">Latitude</span>
            <span className="text-acars-text font-mono">N 39° 51'42"</span>
            <span className="text-acars-muted">Longitude</span>
            <span className="text-acars-text font-mono">W 104° 40' 23"</span>
            <span className="text-acars-muted">Elevation</span>
            <span className="text-acars-text">5,430'</span>
            <span className="text-acars-muted">Magnetic Variance</span>
            <span className="text-acars-text">E 8.0°</span>
            <span className="text-acars-muted">Usage Type</span>
            <span className="text-acars-text">Airport/Heliport is open to the public</span>
            <span className="text-acars-muted">Time Zone Conversion</span>
            <span className="text-acars-text">+6:00 = UTC</span>
          </div>
        </div>

        {/* Runways */}
        <div className="panel p-3">
          <h3 className="text-xs font-semibold text-acars-text mb-2">Runways</h3>
          <table className="w-full text-[11px]">
            <thead>
              <tr className="text-acars-muted border-b border-acars-border">
                <th className="text-left py-1 font-medium">RWY</th>
                <th className="text-right py-1 font-medium">Dimensions</th>
              </tr>
            </thead>
            <tbody className="text-acars-text">
              <tr className="border-b border-acars-border/50">
                <td className="py-1">RWY 10</td>
                <td className="py-1 text-right font-mono">7,000 ft x 150 ft</td>
              </tr>
              <tr className="border-b border-acars-border/50">
                <td className="py-1">RWY 28</td>
                <td className="py-1 text-right font-mono">7,000 ft x 150 ft</td>
              </tr>
              <tr className="border-b border-acars-border/50">
                <td className="py-1">RWY 01L</td>
                <td className="py-1 text-right font-mono">8,300 ft x 150 ft</td>
              </tr>
              <tr>
                <td className="py-1">RWY 01R</td>
                <td className="py-1 text-right font-mono">11,000 ft x 150 ft</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* ATC */}
        <div className="panel p-3">
          <h3 className="text-xs font-semibold text-acars-text mb-2">ATC</h3>
          <div className="space-y-3">
            <div>
              <span className="data-label">Active Events</span>
              <div className="mt-1">
                <Badge variant="red">Ground Stop</Badge>
                <span className="ml-2 text-[11px] text-acars-text">16/1439z - 16/1600z</span>
              </div>
              <div className="mt-1 text-[11px] text-acars-text">
                Departures to Denver International are grounded due to thunderstorms. Probability of extension is medium (30-60%).
              </div>
            </div>

            <div className="space-y-1.5 text-[11px]">
              <h4 className="data-label mt-2">ATC Constraints</h4>
              <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[11px]">
                <span className="text-acars-muted">Airport Closure</span>
                <span className="text-acars-text">No</span>
                <span className="text-acars-muted">Deicing</span>
                <span className="text-acars-text">No</span>
                <span className="text-acars-muted">Delay Info</span>
                <span className="text-acars-text">No</span>
                <span className="text-acars-muted">Ground Delay Program</span>
                <span className="text-acars-text">No</span>
                <span className="text-acars-muted">Ground Stop</span>
                <span className="text-acars-text">No</span>
                <span className="text-acars-muted">Published Reroutes</span>
                <span className="text-acars-text">None</span>
                <span className="text-acars-muted">VIP Movement</span>
                <span className="text-acars-text">No</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
