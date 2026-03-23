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
  private latestPosition: { latitude: number; longitude: number; altitude: number; heading: number; groundSpeed: number } | null = null;
  private latestAircraftType = '';
  private latestPhase = 'unknown';
  private config: RelayConfig;
  private simConnect: ISimConnectManager;
  private onPositionUpdate: ((data: any) => void) | null = null;
  private onAircraftInfoUpdate: ((data: any) => void) | null = null;

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

    this.socket.on('disconnect', () => {
      console.log('[Relay] Disconnected from VPS');
      this.stopHeartbeat();
    });

    // Listen to SimConnect updates for heartbeat data
    this.onPositionUpdate = (data: any) => {
      this.latestPosition = data;
    };
    this.onAircraftInfoUpdate = (data: any) => {
      this.latestAircraftType = data.atcType || data.title || '';
    };
    this.simConnect.on('positionUpdate', this.onPositionUpdate);
    this.simConnect.on('aircraftInfoUpdate', this.onAircraftInfoUpdate);
  }

  updatePhase(phase: string): void {
    this.latestPhase = phase;
  }

  emitExceedance(event: unknown): void {
    if (this.socket?.connected) {
      this.socket.emit('flight:exceedance', event as any);
    }
  }

  updateAuth(token: string): void {
    this.config.token = token;
    if (this.socket) {
      (this.socket as any).auth = { token };
      // Force reconnect so the new token is used for authentication
      if (this.socket.connected) {
        this.socket.disconnect();
        this.socket.connect();
      }
    }
  }

  stop(): void {
    if (this.socket?.connected) {
      this.socket.emit('flight:ended');
    }
    this.stopHeartbeat();
    this.socket?.disconnect();
    this.socket = null;
    // Remove SimConnect listeners to prevent accumulation across restarts
    if (this.onPositionUpdate) {
      this.simConnect.removeListener('positionUpdate', this.onPositionUpdate);
      this.onPositionUpdate = null;
    }
    if (this.onAircraftInfoUpdate) {
      this.simConnect.removeListener('aircraftInfoUpdate', this.onAircraftInfoUpdate);
      this.onAircraftInfoUpdate = null;
    }
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
