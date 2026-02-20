import type { Server as HttpServer } from 'http';
import { Server as SocketServer, type Socket } from 'socket.io';
import type { ServerToClientEvents, ClientToServerEvents, AuthPayload } from '@acars/shared';
import type { TelemetryService } from '../services/telemetry.js';
import type { ISimConnectManager } from '../simconnect/types.js';
import { generateMockSnapshot } from '../services/mock-data.js';
import { AuthService } from '../services/auth.js';
import { MessageService } from '../services/messages.js';
import { getDb } from '../db/index.js';
import { config } from '../config.js';

type AcarsSocket = Socket<ClientToServerEvents, ServerToClientEvents> & {
  user?: AuthPayload;
};

/**
 * Sets up Socket.io WebSocket server for real-time telemetry broadcast.
 * Clients subscribe/unsubscribe to control data flow.
 *
 * Key design decisions:
 * - Per-socket subscription tracking (Set) instead of global counter to prevent count drift
 * - Dispatch room auth checks bid ownership before allowing join
 * - Phase change detection only runs when subscribers exist
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
  let phaseCheckInterval: ReturnType<typeof setInterval> | null = null;
  const telemetrySubscribers = new Set<string>();

  function startBroadcast(): void {
    if (broadcastInterval) return;
    console.log('[WebSocket] Starting telemetry broadcast');
    broadcastInterval = setInterval(() => {
      if (simConnect.connected) {
        io.emit('telemetry:update', telemetry.getSnapshot());
      } else {
        io.emit('telemetry:update', generateMockSnapshot());
      }
    }, config.simconnect.pollInterval);

    // Start phase detection alongside telemetry
    if (!phaseCheckInterval) {
      phaseCheckInterval = setInterval(checkPhaseChange, 1000);
    }
  }

  function stopBroadcast(): void {
    if (telemetrySubscribers.size > 0) return;

    if (broadcastInterval) {
      console.log('[WebSocket] Stopping telemetry broadcast (no subscribers)');
      clearInterval(broadcastInterval);
      broadcastInterval = null;
    }
    if (phaseCheckInterval) {
      clearInterval(phaseCheckInterval);
      phaseCheckInterval = null;
    }
  }

  // Emit connection status changes
  simConnect.on('connected', (status) => {
    io.emit('connection:status', status);
  });

  simConnect.on('disconnected', () => {
    io.emit('connection:status', simConnect.getConnectionStatus());
  });

  // Flight phase change detection (only active when subscribers exist)
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

  // JWT auth middleware for Socket.io
  const authService = new AuthService();
  const messageService = new MessageService();

  // Pre-prepare the bid ownership query once (not per-event)
  const bidOwnerStmt = () => getDb().prepare('SELECT user_id FROM active_bids WHERE id = ?');

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
    if (token) {
      try {
        const payload = authService.verifyAccessToken(token);
        (socket as AcarsSocket).user = payload;
      } catch {
        // Token invalid — allow connection but no dispatch features
      }
    }
    next();
  });

  io.on('connection', (rawSocket) => {
    const socket = rawSocket as AcarsSocket;
    console.log(`[WebSocket] Client connected: ${socket.id}`);

    // Send current connection status immediately
    const status = simConnect.connected
      ? simConnect.getConnectionStatus()
      : {
          connected: false,
          simulator: 'unknown' as const,
          simConnectVersion: 'unknown',
          applicationName: 'Not connected',
          lastUpdate: new Date().toISOString(),
        };
    socket.emit('connection:status', status);

    socket.on('telemetry:subscribe', () => {
      telemetrySubscribers.add(socket.id);
      startBroadcast();
    });

    socket.on('telemetry:unsubscribe', () => {
      telemetrySubscribers.delete(socket.id);
      stopBroadcast();
    });

    // Dispatch room management — verify bid ownership
    socket.on('dispatch:subscribe', (bidId: number) => {
      const user = socket.user;
      if (!user) return;

      // Verify user owns this bid or is admin
      if (user.role !== 'admin') {
        const bid = bidOwnerStmt().get(bidId) as { user_id: number } | undefined;
        if (!bid || bid.user_id !== user.userId) return;
      }

      socket.join(`bid:${bidId}`);
      console.log(`[WebSocket] ${socket.id} joined bid:${bidId}`);
    });

    socket.on('dispatch:unsubscribe', (bidId: number) => {
      socket.leave(`bid:${bidId}`);
    });

    // Real-time message sending via WebSocket — verify bid ownership
    socket.on('acars:sendMessage', (data: { bidId: number; content: string }) => {
      const user = socket.user;
      if (!user || !data.content?.trim()) return;

      // Verify sender owns this bid or is admin
      if (user.role !== 'admin') {
        const bid = bidOwnerStmt().get(data.bidId) as { user_id: number } | undefined;
        if (!bid || bid.user_id !== user.userId) return;
      }

      const content = data.content.trim().slice(0, 2000); // enforce max length
      const type = user.role === 'admin' ? 'DISPATCHER' : 'PILOT';
      const message = messageService.createMessage(data.bidId, user.userId, type, content);
      io.to(`bid:${data.bidId}`).emit('acars:message', message);
    });

    socket.on('disconnect', () => {
      console.log(`[WebSocket] Client disconnected: ${socket.id}`);
      telemetrySubscribers.delete(socket.id);
      stopBroadcast();
    });
  });

  return io;
}
