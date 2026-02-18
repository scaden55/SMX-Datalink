import { EventEmitter } from 'events';
import type { ConnectionStatus } from '@acars/shared';
import type { ISimConnectManager } from './types.js';

/**
 * No-op SimConnect manager for Linux/server deployments.
 * Always reports disconnected; connect() and disconnect() are no-ops.
 */
export class NullSimConnectManager extends EventEmitter implements ISimConnectManager {
  get connected(): boolean {
    return false;
  }

  getConnectionStatus(): ConnectionStatus {
    return {
      connected: false,
      simulator: 'unknown',
      simConnectVersion: 'N/A',
      applicationName: 'N/A',
      lastUpdate: new Date().toISOString(),
    };
  }

  async connect(): Promise<void> {
    console.log('[SimConnect] Disabled — running in server-only mode');
  }

  disconnect(): void {
    // no-op
  }
}
