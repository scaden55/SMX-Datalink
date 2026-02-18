import { useTelemetryStore } from '../stores/telemetryStore';

export function useTelemetry() {
  const snapshot = useTelemetryStore((s) => s.snapshot);
  const connectionStatus = useTelemetryStore((s) => s.connectionStatus);
  const lastUpdate = useTelemetryStore((s) => s.lastUpdate);

  return {
    aircraft: snapshot?.aircraft ?? null,
    engine: snapshot?.engine ?? null,
    fuel: snapshot?.fuel ?? null,
    flight: snapshot?.flight ?? null,
    connected: connectionStatus.connected,
    connectionStatus,
    lastUpdate,
    isStale: Date.now() - lastUpdate > 5000,
  };
}
