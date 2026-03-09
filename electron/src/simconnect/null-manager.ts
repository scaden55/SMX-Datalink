import { EventEmitter } from 'events';
import type { ISimConnectManager } from './types';

/**
 * No-op SimConnect manager for when the native module is unavailable.
 */
export class NullSimConnectManager extends EventEmitter implements ISimConnectManager {
  get connected(): boolean {
    return false;
  }

  getConnectionStatus() {
    return {
      connected: false as const,
      simulator: 'unknown' as const,
      simConnectVersion: 'N/A',
      applicationName: 'N/A',
      lastUpdate: new Date().toISOString(),
    };
  }

  async connect(): Promise<void> {
    console.log('[SimConnect] Disabled — running without simulator');
  }

  disconnect(): void {}
  setHighRateMode(): void {}
}
