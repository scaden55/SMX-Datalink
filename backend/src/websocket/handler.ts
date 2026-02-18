import type { Server as HttpServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import type { ServerToClientEvents, ClientToServerEvents } from '@acars/shared';
import type { TelemetryService } from '../services/telemetry.js';
import type { ISimConnectManager } from '../simconnect/types.js';
import { generateMockSnapshot } from '../services/mock-data.js';
import { config } from '../config.js';

/**
 * Sets up Socket.io WebSocket server for real-time telemetry broadcast.
 * Clients subscribe/unsubscribe to control data flow.
 */
export function setupWebSocket(
  httpServer: HttpServer,
  telemetry: TelemetryService,
  simConnect: ISimConnectManager,
): SocketServer<ClientToServerEvents, ServerToClientEvents> {
  const io = new SocketServer<ClientToServerEvents, ServerToClientEvents>(httpServer, {
    cors: {
      origin: config.corsOrigin,
      methods: ['GET', 'POST'],
    },
  });

  let broadcastInterval: ReturnType<typeof setInterval> | null = null;
  let subscriberCount = 0;

  function startBroadcast(): void {
    if (broadcastInterval) return;
    console.log('[WebSocket] Starting telemetry broadcast');
    broadcastInterval = setInterval(() => {
      if (simConnect.connected) {
        io.emit('telemetry:update', telemetry.getSnapshot());
      } else {
        // Broadcast mock data when SimConnect is disconnected
        io.emit('telemetry:update', generateMockSnapshot());
      }
    }, config.simconnect.pollInterval);
  }

  function stopBroadcast(): void {
    if (broadcastInterval && subscriberCount === 0) {
      console.log('[WebSocket] Stopping telemetry broadcast (no subscribers)');
      clearInterval(broadcastInterval);
      broadcastInterval = null;
    }
  }

  // Emit connection status changes
  simConnect.on('connected', (status) => {
    io.emit('connection:status', status);
  });

  simConnect.on('disconnected', () => {
    io.emit('connection:status', simConnect.getConnectionStatus());
  });

  // Emit flight phase changes
  let lastPhase = '';
  const originalGetFlightData = telemetry.getFlightData.bind(telemetry);
  const checkPhaseChange = (): void => {
    const flightData = originalGetFlightData();
    if (flightData.phase !== lastPhase) {
      const previous = lastPhase;
      lastPhase = flightData.phase;
      if (previous) {
        io.emit('flight:phaseChange', {
          previous,
          current: flightData.phase,
          timestamp: new Date().toISOString(),
        });
      }
    }
  };

  // Check phase changes every second
  setInterval(checkPhaseChange, 1000);

  io.on('connection', (socket) => {
    console.log(`[WebSocket] Client connected: ${socket.id}`);

    // Send current connection status immediately (report connected in mock mode)
    const status = simConnect.connected
      ? simConnect.getConnectionStatus()
      : {
          connected: true,
          simulator: 'msfs2024' as const,
          simConnectVersion: '0.24.2',
          applicationName: 'MSFS 2024 (Mock)',
          lastUpdate: new Date().toISOString(),
        };
    socket.emit('connection:status', status);

    socket.on('telemetry:subscribe', () => {
      subscriberCount++;
      startBroadcast();
    });

    socket.on('telemetry:unsubscribe', () => {
      subscriberCount = Math.max(0, subscriberCount - 1);
      stopBroadcast();
    });

    socket.on('disconnect', () => {
      console.log(`[WebSocket] Client disconnected: ${socket.id}`);
      subscriberCount = Math.max(0, subscriberCount - 1);
      stopBroadcast();
    });
  });

  return io;
}
