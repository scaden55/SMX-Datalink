import { useEffect } from 'react';
import { useTelemetryStore } from '../stores/telemetryStore';
import type { TelemetrySnapshot, ConnectionStatus } from '@acars/shared';

/**
 * When running in Electron, listens for SimConnect telemetry and status
 * from the main process via IPC. Feeds into the same telemetryStore
 * that the WebSocket path uses — components don't need to know the source.
 */
export function useLocalSimConnect(): void {
  const setSnapshot = useTelemetryStore((s) => s.setSnapshot);
  const setConnectionStatus = useTelemetryStore((s) => s.setConnectionStatus);

  useEffect(() => {
    const api = (window as any).electronAPI;
    if (!api?.isElectron) return; // Not in Electron — no-op

    const unsubTelemetry = api.on('sim:telemetry', (data: unknown) => {
      setSnapshot(data as TelemetrySnapshot);
    });

    const unsubStatus = api.on('sim:status', (data: unknown) => {
      setConnectionStatus(data as ConnectionStatus);
    });

    return () => {
      unsubTelemetry?.();
      unsubStatus?.();
    };
  }, [setSnapshot, setConnectionStatus]);
}
