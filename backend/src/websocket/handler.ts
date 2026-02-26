import type { Server as HttpServer } from 'http';
import { Server as SocketServer, type Socket } from 'socket.io';
import type { ServerToClientEvents, ClientToServerEvents, AuthPayload, VatsimDataSnapshot, VatsimFlightStatus, ActiveFlightHeartbeat, TelemetrySnapshot } from '@acars/shared';
import type { TelemetryService } from '../services/telemetry.js';
import type { ISimConnectManager } from '../simconnect/types.js';
import type { VatsimService } from '../services/vatsim.js';
import type { FlightEventTracker } from '../services/flight-event-tracker.js';
import { AuthService } from '../services/auth.js';
import { MessageService } from '../services/messages.js';
import { TrackService } from '../services/track.js';
import { VatsimTrackService } from '../services/vatsim-track.js';
import { getDb } from '../db/index.js';
import { config } from '../config.js';
import { logger } from '../lib/logger.js';

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
  vatsimService?: VatsimService,
  flightEventTracker?: FlightEventTracker,
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
  const vatsimSubscribers = new Set<string>();
  const livemapSubscribers = new Set<string>();
  const activeFlights = new Map<number, ActiveFlightHeartbeat>();
  const flightObservers = new Map<number, Set<string>>();
  const pilotSockets = new Map<number, string>();
  const trackService = new TrackService();
  const vatsimTrackService = new VatsimTrackService();

  // Cache the active bid query for track recording
  const findActiveBid = () =>
    getDb().prepare(
      `SELECT ab.id AS bid_id, ab.user_id AS pilot_id
       FROM active_bids ab
       WHERE ab.flight_plan_phase = 'active'
       LIMIT 1`,
    );

  // Wire up VATSIM broadcast callbacks
  if (vatsimService) {
    vatsimService.setOnUpdate((snapshot: VatsimDataSnapshot) => {
      // Record ALL moving pilot positions (runs even without WebSocket subscribers)
      try { vatsimTrackService.recordSnapshot(snapshot.pilots); } catch { /* non-critical */ }

      if (vatsimSubscribers.size > 0) {
        const event = {
          pilots: snapshot.pilots,
          controllers: snapshot.controllers,
          atis: snapshot.atis,
          updatedAt: snapshot.updatedAt,
        };
        for (const sid of vatsimSubscribers) {
          io.to(sid).emit('vatsim:update', event);
        }
      }
    });

    vatsimService.setOnFlightStatus((status: VatsimFlightStatus) => {
      io.emit('dispatch:vatsimStatus', status);
    });
  }

  function startBroadcast(): void {
    if (broadcastInterval) return;
    logger.info('WebSocket', 'Starting telemetry broadcast');
    broadcastInterval = setInterval(() => {
      if (simConnect.connected) {
        const snapshot = telemetry.getSnapshot();
        io.emit('telemetry:update', snapshot);

        // Track airborne VS for landing rate capture
        if (flightEventTracker) {
          flightEventTracker.updateAirborneVs(
            snapshot.aircraft.position.verticalSpeed,
            snapshot.flight.simOnGround,
          );
        }

        // Record track point for active flight (throttled inside TrackService)
        try {
          const bid = findActiveBid().get() as { bid_id: number; pilot_id: number } | undefined;
          if (bid) {
            const pos = snapshot.aircraft.position;
            const recorded = trackService.record(
              bid.pilot_id, bid.bid_id,
              pos.latitude, pos.longitude, pos.altitude,
              pos.heading, pos.groundSpeed, pos.verticalSpeed,
            );
            // Emit real-time track point to dispatch room subscribers
            if (recorded) {
              io.to(`bid:${bid.bid_id}`).emit('track:point', {
                bidId: bid.bid_id,
                point: {
                  lat: pos.latitude,
                  lon: pos.longitude,
                  altitudeFt: Math.round(pos.altitude),
                  heading: Math.round(pos.heading),
                  speedKts: Math.round(pos.groundSpeed),
                  vsFpm: Math.round(pos.verticalSpeed),
                  recordedAt: Date.now(),
                },
              });
            }
          }
        } catch {
          // Track recording is non-critical — don't break broadcast
        }
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
      logger.info('WebSocket', 'Stopping telemetry broadcast (no subscribers)');
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

        // Capture flight events on phase transitions
        if (flightEventTracker) {
          const fuelLbs = telemetry.getFuelData().totalQuantityWeight;
          flightEventTracker.onPhaseChange(previous, flightData.phase, fuelLbs);
        }
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
    logger.info('WebSocket', `Client connected: ${socket.id}`);

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
      // If this subscriber is NOT a pilot with an active flight,
      // they're an observer — signal all active pilots to start relaying
      const isActivePilot = socket.user && activeFlights.has(socket.user.userId);
      if (!isActivePilot) {
        for (const [pilotUserId, pilotSocketId] of pilotSockets) {
          let observers = flightObservers.get(pilotUserId);
          if (!observers) {
            observers = new Set();
            flightObservers.set(pilotUserId, observers);
          }
          const wasEmpty = observers.size === 0;
          observers.add(socket.id);
          if (wasEmpty) {
            io.to(pilotSocketId).emit('relay:start');
          }
        }
      }
    });

    socket.on('telemetry:unsubscribe', () => {
      telemetrySubscribers.delete(socket.id);
      // Remove from all observer sets and signal relay:stop if needed
      for (const [pilotUserId, observers] of flightObservers) {
        observers.delete(socket.id);
        if (observers.size === 0) {
          const pilotSocketId = pilotSockets.get(pilotUserId);
          if (pilotSocketId) {
            io.to(pilotSocketId).emit('relay:stop');
          }
        }
      }
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
      logger.info('WebSocket', `${socket.id} joined bid:${bidId}`);
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

    // VATSIM live data subscription
    socket.on('vatsim:subscribe', () => {
      vatsimSubscribers.add(socket.id);
    });

    socket.on('vatsim:unsubscribe', () => {
      vatsimSubscribers.delete(socket.id);
    });

    // ── Active flight relay ──────────────────────────────────────

    socket.on('flight:heartbeat', (data: ActiveFlightHeartbeat) => {
      if (!socket.user) return;
      activeFlights.set(socket.user.userId, data);
      pilotSockets.set(socket.user.userId, socket.id);
      const flights = Array.from(activeFlights.values());
      for (const sid of livemapSubscribers) {
        io.to(sid).emit('flights:active', flights);
      }
    });

    socket.on('flight:telemetry', (snapshot: TelemetrySnapshot) => {
      if (!socket.user) return;
      const observers = flightObservers.get(socket.user.userId);
      if (observers) {
        for (const sid of observers) {
          io.to(sid).emit('telemetry:update', snapshot);
        }
      }
    });

    socket.on('flight:ended', () => {
      if (!socket.user) return;
      activeFlights.delete(socket.user.userId);
      pilotSockets.delete(socket.user.userId);
      flightObservers.delete(socket.user.userId);
      const flights = Array.from(activeFlights.values());
      for (const sid of livemapSubscribers) {
        io.to(sid).emit('flights:active', flights);
      }
    });

    socket.on('livemap:subscribe', () => {
      livemapSubscribers.add(socket.id);
      socket.emit('flights:active', Array.from(activeFlights.values()));
    });

    socket.on('livemap:unsubscribe', () => {
      livemapSubscribers.delete(socket.id);
    });

    socket.on('disconnect', () => {
      logger.info('WebSocket', `Client disconnected: ${socket.id}`);
      // Clean up active flight if pilot disconnects
      if (socket.user && activeFlights.has(socket.user.userId)) {
        activeFlights.delete(socket.user.userId);
        pilotSockets.delete(socket.user.userId);
        flightObservers.delete(socket.user.userId);
      }
      // Remove from all observer sets and signal relay:stop if needed
      for (const [pilotUserId, observers] of flightObservers) {
        observers.delete(socket.id);
        if (observers.size === 0) {
          const pilotSocketId = pilotSockets.get(pilotUserId);
          if (pilotSocketId) {
            io.to(pilotSocketId).emit('relay:stop');
          }
        }
      }
      livemapSubscribers.delete(socket.id);
      telemetrySubscribers.delete(socket.id);
      vatsimSubscribers.delete(socket.id);
      stopBroadcast();
    });
  });

  return io;
}
