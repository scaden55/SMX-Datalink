import { useTelemetry } from '../../hooks/useTelemetry';

export function StatusBar() {
  const { flight, connectionStatus, isStale } = useTelemetry();

  return (
    <div className="flex items-center justify-between border-t border-acars-border bg-acars-panel px-4 py-1 text-[11px]">
      <div className="flex items-center gap-4">
        <span className="flex items-center gap-1.5">
          <span
            className={`inline-block h-2 w-2 rounded-full ${
              connectionStatus.connected
                ? isStale ? 'bg-acars-amber' : 'bg-acars-green'
                : 'bg-acars-red'
            }`}
          />
          <span className="text-acars-muted">
            {connectionStatus.connected
              ? `${connectionStatus.applicationName} v${connectionStatus.simConnectVersion}`
              : 'Simulator Disconnected'}
          </span>
        </span>
        {flight && (
          <span className="text-acars-muted">
            SIM RATE: {flight.simRate}x
          </span>
        )}
      </div>
      <div className="flex items-center gap-4 text-acars-muted">
        {flight && (
          <>
            <span>ZULU {flight.zuluTime}</span>
            <span>LOCAL {flight.localTime}</span>
          </>
        )}
        {flight?.isPaused && (
          <span className="text-acars-amber font-medium">PAUSED</span>
        )}
      </div>
    </div>
  );
}
