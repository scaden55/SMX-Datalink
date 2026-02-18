export function WeatherTab() {
  return (
    <div className="space-y-3">
      <h3 className="text-xs font-semibold text-acars-text">Weather</h3>
      <div className="text-[11px] text-acars-muted">
        <div className="panel p-3 space-y-2">
          <div>
            <span className="data-label">METAR</span>
            <div className="font-mono text-acars-text mt-1">
              Awaiting simulator connection...
            </div>
          </div>
          <div>
            <span className="data-label">TAF</span>
            <div className="font-mono text-acars-text mt-1">
              Awaiting simulator connection...
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
