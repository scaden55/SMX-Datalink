import { io, type Socket } from 'socket.io-client';
import type { ISimConnectManager } from './simconnect/types';

interface RelayConfig {
  vpsUrl: string;
  heartbeatIntervalMs: number;
  token: string;
  userId: number;
  callsign: string;
}

export class VpsRelay {
  private socket: Socket | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private relaying = false;
  private latestPosition: { latitude: number; longitude: number; altitude: number; heading: number; groundSpeed: number } | null = null;
  private latestAircraftType = '';
  private latestPhase = 'unknown';
  private config: RelayConfig;
  private simConnect: ISimConnectManager;

  constructor(simConnect: ISimConnectManager, config: RelayConfig) {
    this.simConnect = simConnect;
    this.config = config;
  }

  start(): void {
    this.socket = io(this.config.vpsUrl, {
      transports: ['websocket'],
      auth: { token: this.config.token },
      reconnection: true,
      reconnectionDelay: 5000,
    });

    this.socket.on('connect', () => {
      console.log('[Relay] Connected to VPS');
      this.startHeartbeat();
    });

    this.socket.on('relay:start', () => {
      console.log('[Relay] Observer watching — starting full telemetry relay');
      this.relaying = true;
    });

    this.socket.on('relay:stop', () => {
      console.log('[Relay] No observers — stopping full telemetry relay');
      this.relaying = false;
    });

    this.socket.on('disconnect', () => {
      console.log('[Relay] Disconnected from VPS');
      this.stopHeartbeat();
      this.relaying = false;
    });

    // Listen to SimConnect updates for heartbeat data
    this.simConnect.on('positionUpdate', (data: any) => {
      this.latestPosition = data;
    });
    this.simConnect.on('aircraftInfoUpdate', (data: any) => {
      this.latestAircraftType = data.atcType || data.title || '';
    });
  }

  sendTelemetry(snapshot: unknown): void {
    if (this.relaying && this.socket?.connected) {
      this.socket.emit('flight:telemetry', snapshot as any);
    }
  }

  updateAuth(token: string): void {
    this.config.token = token;
    if (this.socket) {
      (this.socket as any).auth = { token };
    }
  }

  stop(): void {
    if (this.socket?.connected) {
      this.socket.emit('flight:ended');
    }
    this.stopHeartbeat();
    this.socket?.disconnect();
    this.socket = null;
    this.relaying = false;
  }

  private startHeartbeat(): void {
    if (this.heartbeatTimer) return;
    this.heartbeatTimer = setInterval(() => {
      if (!this.simConnect.connected || !this.socket?.connected || !this.latestPosition) return;
      this.socket.emit('flight:heartbeat', {
        userId: this.config.userId,
        callsign: this.config.callsign,
        aircraftType: this.latestAircraftType,
        latitude: this.latestPosition.latitude,
        longitude: this.latestPosition.longitude,
        altitude: this.latestPosition.altitude,
        heading: this.latestPosition.heading,
        groundSpeed: this.latestPosition.groundSpeed,
        phase: this.latestPhase,
        timestamp: new Date().toISOString(),
      });
    }, this.config.heartbeatIntervalMs);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }
}
