import { useDispatchTelemetry } from '../../hooks/useDispatchTelemetry';
import { formatAltitude, formatHeading, formatFrequency, formatSquawk } from '../../utils/format';

export function FlightLogTab() {
  const { aircraft, engine, fuel, flight, connected } = useDispatchTelemetry();

  if (!aircraft) {
    return (
      <div className="text-[11px] text-acars-muted italic">
        {connected ? 'Awaiting telemetry data...' : 'Awaiting pilot telemetry...'}
      </div>
    );
  }

  const pos = aircraft.position;
  const ap = aircraft.autopilot;

  return (
    <div className="grid grid-cols-2 gap-4">
      {/* Position & Flight */}
      <div className="panel p-3">
        <h4 className="data-label mb-2">Position & Flight</h4>
        <table className="w-full text-[11px]">
          <tbody className="tabular-nums">
            <Row label="Phase" value={flight?.phase ?? '---'} highlight />
            <Row label="Altitude" value={formatAltitude(pos.altitude)} />
            <Row label="IAS" value={`${Math.round(pos.airspeedIndicated)} kts`} />
            <Row label="TAS" value={`${Math.round(pos.airspeedTrue)} kts`} />
            <Row label="GS" value={`${Math.round(pos.groundSpeed)} kts`} />
            <Row label="Heading" value={formatHeading(pos.heading)} />
            <Row label="VS" value={`${Math.round(pos.verticalSpeed)} fpm`} />
            <Row label="Pitch" value={`${pos.pitch.toFixed(1)}°`} />
            <Row label="Bank" value={`${pos.bank.toFixed(1)}°`} />
            <Row label="On Ground" value={flight?.simOnGround ? 'Yes' : 'No'} />
            <Row label="Gear" value={flight?.gearHandlePosition ? 'DOWN' : 'UP'} />
            <Row label="Flaps" value={`${flight?.flapsHandleIndex ?? 0}`} />
            <Row label="Spoilers" value={`${flight?.spoilersPosition?.toFixed(0) ?? 0}%`} />
          </tbody>
        </table>
      </div>

      {/* Engine & Fuel */}
      <div className="space-y-4">
        <div className="panel p-3">
          <h4 className="data-label mb-2">Engines</h4>
          <table className="w-full text-[11px]">
            <thead>
              <tr className="text-acars-muted border-b border-acars-border">
                <th className="text-left py-1 font-medium">Param</th>
                <th className="text-right py-1 font-medium">ENG 1</th>
                {(engine?.numberOfEngines ?? 0) >= 2 && (
                  <th className="text-right py-1 font-medium">ENG 2</th>
                )}
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {engine?.engines && (
                <>
                  <EngRow label="N1" values={engine.engines.map((e) => `${e.n1.toFixed(1)}%`)} />
                  <EngRow label="N2" values={engine.engines.map((e) => `${e.n2.toFixed(1)}%`)} />
                  <EngRow label="FF" values={engine.engines.map((e) => `${Math.round(e.fuelFlow)} gph`)} />
                  <EngRow label="EGT" values={engine.engines.map((e) => `${Math.round(e.egt)}°`)} />
                  <EngRow label="Oil T" values={engine.engines.map((e) => `${Math.round(e.oilTemperature)}°`)} />
                  <EngRow label="Oil P" values={engine.engines.map((e) => `${e.oilPressure.toFixed(1)} psi`)} />
                </>
              )}
            </tbody>
          </table>
        </div>

        <div className="panel p-3">
          <h4 className="data-label mb-2">Fuel</h4>
          <table className="w-full text-[11px]">
            <tbody className="tabular-nums">
              <Row label="Total" value={`${Math.round(fuel?.totalQuantityWeight ?? 0).toLocaleString()} lbs`} />
              <Row label="Quantity" value={`${Math.round(fuel?.totalQuantityGallons ?? 0).toLocaleString()} gal`} />
              <Row label="Capacity" value={`${Math.round(fuel?.totalCapacityGallons ?? 0).toLocaleString()} gal`} />
              <Row label="Remaining" value={`${(fuel?.fuelPercentage ?? 0).toFixed(1)}%`} />
            </tbody>
          </table>
          {fuel?.tanks && fuel.tanks.length > 0 && (
            <div className="mt-2 pt-2 border-t border-acars-border">
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="text-acars-muted">
                    <th className="text-left font-medium">Tank</th>
                    <th className="text-right font-medium">Qty (gal)</th>
                    <th className="text-right font-medium">Cap (gal)</th>
                  </tr>
                </thead>
                <tbody className="tabular-nums">
                  {fuel.tanks.map((t) => (
                    <tr key={t.name} className="border-t border-acars-border">
                      <td className="py-0.5 text-acars-muted">{t.name}</td>
                      <td className="py-0.5 text-right">{Math.round(t.quantityGallons).toLocaleString()}</td>
                      <td className="py-0.5 text-right text-acars-muted">{Math.round(t.capacityGallons).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="panel p-3">
          <h4 className="data-label mb-2">Autopilot & Radios</h4>
          <table className="w-full text-[11px]">
            <tbody className="tabular-nums">
              <Row label="AP Master" value={ap.master ? 'ON' : 'OFF'} highlight={ap.master} />
              <Row label="ALT" value={`${ap.altitudeTarget.toLocaleString()} ft`} />
              <Row label="HDG" value={formatHeading(ap.headingTarget)} />
              <Row label="SPD" value={`${Math.round(ap.speedTarget)} kts`} />
              <Row label="VS" value={`${Math.round(ap.verticalSpeedTarget)} fpm`} />
              <Row label="XPDR" value={formatSquawk(aircraft.transponder.code)} />
              <Row label="COM1" value={formatFrequency(aircraft.com1.activeFrequency)} />
              <Row label="NAV1" value={formatFrequency(aircraft.nav1.activeFrequency)} />
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <tr className="border-b border-acars-border">
      <td className="py-0.5 text-acars-muted">{label}</td>
      <td className={`py-0.5 text-right ${highlight ? 'text-sky-400 font-semibold' : ''}`}>{value}</td>
    </tr>
  );
}

function EngRow({ label, values }: { label: string; values: string[] }) {
  return (
    <tr className="border-b border-acars-border">
      <td className="py-0.5 text-acars-muted">{label}</td>
      {values.map((v, i) => (
        <td key={i} className="py-0.5 text-right">{v}</td>
      ))}
    </tr>
  );
}
