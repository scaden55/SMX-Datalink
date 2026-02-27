import { useEffect } from 'react';
import { useTelemetryStore } from '../stores/telemetryStore';
import type { TelemetrySnapshot, ConnectionStatus } from '@acars/shared';

interface DiagEvent {
  ts: string;
  level: 'info' | 'warn' | 'error';
  msg: string;
}

const DIAG_STYLES: Record<string, string> = {
  info: 'color: #60a5fa',     // blue
  warn: 'color: #fbbf24',     // amber
  error: 'color: #f87171',    // red
};

/**
 * When running in Electron, listens for SimConnect telemetry and status
 * from the main process via IPC. Feeds into the same telemetryStore
 * that the WebSocket path uses — components don't need to know the source.
 *
 * Also pipes SimConnect diagnostic events to the DevTools console.
 * Call `window.simDiag()` from DevTools to dump the full diagnostic log.
 */
export function useLocalSimConnect(): void {
  const setSnapshot = useTelemetryStore((s) => s.setSnapshot);
  const setConnectionStatus = useTelemetryStore((s) => s.setConnectionStatus);

  useEffect(() => {
    const api = (window as any).electronAPI;
    if (!api?.isElectron) return; // Not in Electron — no-op

    // Pull current status immediately (covers race where main connected before we mounted)
    api.requestSimStatus?.().then((status: ConnectionStatus) => {
      if (status) {
        setConnectionStatus(status);
        // Log status to DevTools for debugging
        const style = status.connected ? 'color: #34d399' : 'color: #f87171';
        console.log(`%c[SimConnect] Status: connected=${status.connected}, sim=${status.simulator}, app=${status.applicationName}${status.lastError ? `, error="${status.lastError}"` : ''}`, style);
      }
    }).catch(() => {});

    // Pull boot diagnostic log (catches messages from before renderer mounted)
    api.getSimDiagnosticLog?.().then((log: DiagEvent[]) => {
      if (log?.length) {
        console.group(`%c[SimConnect] Boot log (${log.length} events)`, 'color: #60a5fa; font-weight: bold');
        for (const e of log) {
          console.log(`%c${e.ts} [${e.level}] ${e.msg}`, DIAG_STYLES[e.level] || '');
        }
        console.groupEnd();
      }
    }).catch(() => {});

    const unsubTelemetry = api.on('sim:telemetry', (data: unknown) => {
      setSnapshot(data as TelemetrySnapshot);
    });

    const unsubStatus = api.on('sim:status', (data: unknown) => {
      setConnectionStatus(data as ConnectionStatus);
    });

    // Live diagnostic stream — print each event to DevTools console
    const unsubDiag = api.on('sim:diagnostic', (event: DiagEvent) => {
      const style = DIAG_STYLES[event.level] || '';
      console.log(`%c[SimConnect] ${event.msg}`, style);
    });

    // Global helper: call window.simDiag() from DevTools to dump full log
    (window as any).simDiag = async () => {
      try {
        const log: DiagEvent[] = await api.getSimDiagnosticLog();
        console.group(`%c[SimConnect Diagnostic Log] ${log.length} events`, 'color: #60a5fa; font-weight: bold');
        for (const e of log) {
          const style = DIAG_STYLES[e.level] || '';
          console.log(`%c${e.ts} [${e.level}] ${e.msg}`, style);
        }
        console.groupEnd();
        return log;
      } catch (err) {
        console.error('[SimConnect] Failed to fetch diagnostic log:', err);
        return [];
      }
    };

    return () => {
      unsubTelemetry?.();
      unsubStatus?.();
      unsubDiag?.();
      delete (window as any).simDiag;
    };
  }, [setSnapshot, setConnectionStatus]);
}
