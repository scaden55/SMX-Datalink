import { create } from 'zustand';
import type { TelemetrySnapshot, ConnectionStatus } from '@acars/shared';

interface TelemetryState {
  snapshot: TelemetrySnapshot | null;
  connectionStatus: ConnectionStatus;
  lastUpdate: number;
  remoteSnapshot: TelemetrySnapshot | null;
  remoteLastUpdate: number;
  setSnapshot: (data: TelemetrySnapshot) => void;
  setConnectionStatus: (status: ConnectionStatus) => void;
  setRemoteSnapshot: (data: TelemetrySnapshot) => void;
  clearRemoteSnapshot: () => void;
}

export const useTelemetryStore = create<TelemetryState>((set) => ({
  snapshot: null,
  connectionStatus: {
    connected: false,
    simulator: 'unknown',
    simConnectVersion: 'unknown',
    applicationName: 'unknown',
    lastUpdate: new Date().toISOString(),
  },
  lastUpdate: 0,
  remoteSnapshot: null,
  remoteLastUpdate: 0,
  setSnapshot: (data) => set({ snapshot: data, lastUpdate: Date.now() }),
  setConnectionStatus: (status) => set({ connectionStatus: status }),
  setRemoteSnapshot: (data) => set({ remoteSnapshot: data, remoteLastUpdate: Date.now() }),
  clearRemoteSnapshot: () => set({ remoteSnapshot: null, remoteLastUpdate: 0 }),
}));
