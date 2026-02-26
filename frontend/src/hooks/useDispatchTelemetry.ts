import { useTelemetry } from './useTelemetry';
import { useDispatchEdit } from '../contexts/DispatchEditContext';
import { useTelemetryStore } from '../stores/telemetryStore';

/**
 * Returns telemetry data appropriate for the dispatch page:
 * - Own flight → local SimConnect telemetry
 * - Observed flight → remote snapshot relayed from the pilot's client
 */
export function useDispatchTelemetry() {
  const local = useTelemetry();
  const { isOwnFlight } = useDispatchEdit();

  const remoteSnapshot = useTelemetryStore((s) => s.remoteSnapshot);
  const remoteLastUpdate = useTelemetryStore((s) => s.remoteLastUpdate);

  if (isOwnFlight) {
    return local;
  }

  return {
    aircraft: remoteSnapshot?.aircraft ?? null,
    engine: remoteSnapshot?.engine ?? null,
    fuel: remoteSnapshot?.fuel ?? null,
    flight: remoteSnapshot?.flight ?? null,
    connected: remoteSnapshot !== null,
    connectionStatus: local.connectionStatus,
    lastUpdate: remoteLastUpdate,
    isStale: remoteLastUpdate > 0 ? Date.now() - remoteLastUpdate > 5000 : true,
  };
}
