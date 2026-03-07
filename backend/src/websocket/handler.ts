import type { Server as HttpServer } from 'http';
import { Server as SocketServer, type Socket } from 'socket.io';
import type { ServerToClientEvents, ClientToServerEvents, AuthPayload, VatsimDataSnapshot, VatsimFlightStatus, ActiveFlightHeartbeat, TelemetrySnapshot, ExceedanceEvent } from '@acars/shared';
import type { TelemetryService } from '../services/telemetry.js';
import type { ISimConnectManager } from '../simconnect/types.js';
import type { VatsimService } from '../services/vatsim.js';
import type { FlightEventTracker } from '../services/flight-event-tracker.js';
import { AuthService } from '../services/auth.js';
import { MessageService } from '../services/messages.js';
import { TrackService } from '../services/track.js';
import { VatsimTrackService } from '../services/vatsim-track.js';
import { ExceedanceService } from '../services/exceedance.js';
import { MaintenanceService } from '../services/maintenance.js';
import { getDb } from '../db/index.js';
import { config } from '../config.js';
import { logger } from '../lib/logger.js';

type AcarsSocket = Socket<ClientToServerEvents, ServerToClientEvents> & {
  user?: AuthPayload;
};

// Socket.io room names for broadcast groups
const ROOM_TELEMETRY = 'sub:telemetry';
const ROOM_VATSIM = 'sub:vatsim';
const ROOM_LIVEMAP = 'sub:livemap';

/**
 * Sets up Socket.io WebSocket server for real-time telemetry broadcast.
 *
 * Performance design:
 * - Socket.io rooms for broadcast groups (no per-socket loops)
 * - Cached flights array invalidated on mutation
 * - Prepared statements cached at setup (not per-event)
 * - Numeric timestamps internally to avoid Date parsing
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

  // Subscriber tracking (Sets kept for count-based logic: cap checks, stopBroadcast)
  const telemetrySubscribers = new Set<string>();
  const vatsimSubscribers = new Set<string>();
  const livemapSubscribers = new Set<string>();

  const activeFlights = new Map<number, ActiveFlightHeartbeat>();
  const flightObservers = new Map<number, Set<string>>();
  const pilotSockets = new Map<number, string>();

  const trackService = new TrackService();
  const vatsimTrackService = new VatsimTrackService();
  const exceedanceService = new ExceedanceService();
  const maintenanceService = new MaintenanceService();

  // Memory leak guard: cap subscriber/flight Sets to prevent unbounded growth
  const MAX_SUBSCRIBERS = 500;
  const MAX_ACTIVE_FLIGHTS = 200;

  // ── Cached flights array — invalidated on any activeFlights mutation ──
  let cachedFlightsArray: ActiveFlightHeartbeat[] | null = null;
  function getFlightsArray(): ActiveFlightHeartbeat[] {
    if (!cachedFlightsArray) {
      cachedFlightsArray = Array.from(activeFlights.values());
    }
    return cachedFlightsArray;
  }
  function invalidateFlightsCache(): void {
    cachedFlightsArray = null;
  }

  // ── Prepared statements — cached once after DB init ──
  const stmts = {
    findActiveBid: () => getDb().prepare(
      `SELECT ab.id AS bid_id, ab.user_id AS pilot_id
       FROM active_bids ab
       WHERE ab.flight_plan_phase IN ('active', 'airborne')
       LIMIT 1`,
    ),
    findActiveBidByUser: () => getDb().prepare(
      `SELECT id FROM active_bids WHERE user_id = ? AND flight_plan_phase IN ('active', 'airborne') LIMIT 1`,
    ),
    bidOwner: () => getDb().prepare('SELECT user_id FROM active_bids WHERE id = ?'),
    bidAircraft: () => getDb().prepare(
      `SELECT ab.aircraft_id, f.registration FROM active_bids ab
       JOIN fleet f ON f.id = ab.aircraft_id
       WHERE ab.id = ? AND ab.aircraft_id IS NOT NULL`,
    ),
  };

  // Broadcast flights to livemap room
  function broadcastFlights(): void {
    if (livemapSubscribers.size > 0) {
      io.to(ROOM_LIVEMAP).emit('flights:active', getFlightsArray());
    }
  }

  // Wire up VATSIM broadcast callbacks
  if (vatsimService) {
    vatsimService.setOnUpdate((snapshot: VatsimDataSnapshot) => {
      // Record ALL moving pilot positions (runs even without WebSocket subscribers)
      try { vatsimTrackService.recordSnapshot(snapshot.pilots); } catch { /* non-critical */ }

      if (vatsimSubscribers.size > 0) {
        io.to(ROOM_VATSIM).emit('vatsim:update', {
          pilots: snapshot.pilots,
          controllers: snapshot.controllers,
          atis: snapshot.atis,
          updatedAt: snapshot.updatedAt,
        });
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

        // Emit only to telemetry subscribers via room
        if (telemetrySubscribers.size > 0) {
          io.to(ROOM_TELEMETRY).emit('telemetry:update', snapshot);
        }

        // Track airborne VS for landing rate capture
        if (flightEventTracker) {
          flightEventTracker.updateAirborneVs(
            snapshot.aircraft.position.verticalSpeed,
            snapshot.flight.simOnGround,
          );
        }

        // Record track point for active flight (throttled inside TrackService)
        try {
          const bid = stmts.findActiveBid().get() as { bid_id: number; pilot_id: number } | undefined;
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
      if (!socket.user) return;
      if (telemetrySubscribers.size >= MAX_SUBSCRIBERS) return;
      telemetrySubscribers.add(socket.id);
      socket.join(ROOM_TELEMETRY);
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
      socket.leave(ROOM_TELEMETRY);
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

      // Verify user owns this bid, or is admin/dispatcher
      if (user.role !== 'admin' && user.role !== 'dispatcher') {
        const bid = stmts.bidOwner().get(bidId) as { user_id: number } | undefined;
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

      // Verify sender owns this bid, or is admin/dispatcher
      if (user.role !== 'admin' && user.role !== 'dispatcher') {
        const bid = stmts.bidOwner().get(data.bidId) as { user_id: number } | undefined;
        if (!bid || bid.user_id !== user.userId) return;
      }

      const content = data.content.trim().slice(0, 2000); // enforce max length
      const type = (user.role === 'admin' || user.role === 'dispatcher') ? 'DISPATCHER' : 'PILOT';
      const message = messageService.createMessage(data.bidId, user.userId, type, content);
      io.to(`bid:${data.bidId}`).emit('acars:message', message);
    });

    // VATSIM live data subscription
    socket.on('vatsim:subscribe', () => {
      if (!socket.user) return;
      if (vatsimSubscribers.size >= MAX_SUBSCRIBERS) return;
      vatsimSubscribers.add(socket.id);
      socket.join(ROOM_VATSIM);
    });

    socket.on('vatsim:unsubscribe', () => {
      vatsimSubscribers.delete(socket.id);
      socket.leave(ROOM_VATSIM);
    });

    // ── Active flight relay ──────────────────────────────────────

    socket.on('flight:heartbeat', (data: ActiveFlightHeartbeat) => {
      if (!socket.user) return;

      // Look up the pilot's active bid ID so admin dispatch board can subscribe to the correct room
      let bidId: number | undefined;
      try {
        const bid = stmts.findActiveBidByUser().get(socket.user.userId) as { id: number } | undefined;
        bidId = bid?.id;
      } catch { /* non-critical */ }

      const sanitized: ActiveFlightHeartbeat = {
        userId: socket.user.userId,
        bidId,
        callsign: socket.user.callsign,
        aircraftType: String(data.aircraftType || '').slice(0, 64),
        latitude: Number.isFinite(data.latitude) ? data.latitude : 0,
        longitude: Number.isFinite(data.longitude) ? data.longitude : 0,
        altitude: Number.isFinite(data.altitude) ? data.altitude : 0,
        heading: Number.isFinite(data.heading) ? data.heading : 0,
        groundSpeed: Number.isFinite(data.groundSpeed) ? data.groundSpeed : 0,
        phase: String(data.phase || 'unknown').slice(0, 32),
        timestamp: new Date().toISOString(),
      };
      // Guard against unbounded growth — only allow updates for existing entries or if under cap
      if (activeFlights.has(socket.user.userId) || activeFlights.size < MAX_ACTIVE_FLIGHTS) {
        activeFlights.set(socket.user.userId, sanitized);
        invalidateFlightsCache();
      }
      pilotSockets.set(socket.user.userId, socket.id);
      broadcastFlights();
    });

    socket.on('flight:telemetry', (snapshot: TelemetrySnapshot) => {
      if (!socket.user) return;
      const observers = flightObservers.get(socket.user.userId);
      if (observers) {
        for (const sid of observers) {
          io.to(sid).emit('telemetry:update', snapshot);
        }
      }

      // Relay telemetry to dispatch room subscribers watching this pilot's flight
      try {
        const bid = stmts.findActiveBidByUser().get(socket.user.userId) as { id: number } | undefined;
        if (bid) {
          io.to(`bid:${bid.id}`).emit('dispatch:telemetry', snapshot);
        }
      } catch {
        // Non-critical — don't break relay
      }
    });

    socket.on('flight:ended', () => {
      if (!socket.user) return;
      activeFlights.delete(socket.user.userId);
      pilotSockets.delete(socket.user.userId);
      flightObservers.delete(socket.user.userId);
      invalidateFlightsCache();
      broadcastFlights();
    });

    socket.on('flight:exceedance', (data: ExceedanceEvent) => {
      if (!socket.user) return;

      // Validate incoming exceedance data
      const validTypes = ['HARD_LANDING', 'OVERSPEED', 'OVERWEIGHT_LANDING', 'UNSTABLE_APPROACH', 'TAILSTRIKE'];
      if (!validTypes.includes(data.type)) return;
      if (data.severity !== 'warning' && data.severity !== 'critical') return;
      if (!Number.isFinite(data.value) || !Number.isFinite(data.threshold)) return;
      if (typeof data.unit !== 'string' || typeof data.phase !== 'string' || typeof data.message !== 'string') return;

      try {
        const bid = stmts.findActiveBidByUser().get(socket.user.userId) as { id: number } | undefined;
        if (!bid) return;
        const exceedance = exceedanceService.insert(bid.id, socket.user.userId, data);

        // Auto-create maintenance inspection for hard landings
        if (data.type === 'HARD_LANDING') {
          try {
            const bidRow = stmts.bidAircraft().get(bid.id) as { aircraft_id: number; registration: string } | undefined;

            if (bidRow) {
              maintenanceService.createLog({
                aircraftId: bidRow.aircraft_id,
                checkType: 'UNSCHEDULED',
                title: `Hard landing inspection – ${bidRow.registration}`,
                description: `Hard landing inspection required\nLanding rate: ${data.value} fpm (limit: ${data.threshold} fpm)\nFlight by ${socket.user.callsign} at ${data.detectedAt}`,
              }, socket.user.userId);
              logger.info('Exceedance', `Auto-created maintenance inspection for hard landing on ${bidRow.registration}`);
            }
          } catch (err) {
            logger.error('Exceedance', 'Failed to create maintenance entry', err);
          }
        }

        // Broadcast to dispatch observers
        io.to(`bid:${bid.id}`).emit('dispatch:exceedance', exceedance);
      } catch (err) {
        logger.error('Exceedance', 'Failed to handle exceedance event', err);
      }
    });

    socket.on('livemap:subscribe', () => {
      if (!socket.user) return;
      if (livemapSubscribers.size >= MAX_SUBSCRIBERS) return;
      livemapSubscribers.add(socket.id);
      socket.join(ROOM_LIVEMAP);
      socket.emit('flights:active', getFlightsArray());
    });

    socket.on('livemap:unsubscribe', () => {
      livemapSubscribers.delete(socket.id);
      socket.leave(ROOM_LIVEMAP);
    });

    socket.on('disconnect', () => {
      logger.info('WebSocket', `Client disconnected: ${socket.id}`);
      // Clean up active flight if pilot disconnects
      if (socket.user && activeFlights.has(socket.user.userId)) {
        activeFlights.delete(socket.user.userId);
        pilotSockets.delete(socket.user.userId);
        flightObservers.delete(socket.user.userId);
        invalidateFlightsCache();
        broadcastFlights();
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
      // Socket.io automatically removes from rooms on disconnect,
      // but we still track our own Sets for cap logic
      livemapSubscribers.delete(socket.id);
      telemetrySubscribers.delete(socket.id);
      vatsimSubscribers.delete(socket.id);
      stopBroadcast();
    });
  });

  // Stale flight cleanup — remove heartbeats older than 2 minutes (runs every 60s)
  const STALE_FLIGHT_MS = 2 * 60 * 1000;
  const staleCleanupInterval = setInterval(() => {
    const now = Date.now();
    let cleaned = false;
    for (const [userId, flight] of activeFlights) {
      const age = now - new Date(flight.timestamp).getTime();
      if (age > STALE_FLIGHT_MS) {
        activeFlights.delete(userId);
        pilotSockets.delete(userId);
        flightObservers.delete(userId);
        cleaned = true;
        logger.info('WebSocket', `Cleaned stale flight for user ${userId} (${Math.round(age / 1000)}s old)`);
      }
    }
    if (cleaned) {
      invalidateFlightsCache();
      broadcastFlights();
    }
  }, 60_000);
  staleCleanupInterval.unref();

  // Expose metrics for health endpoint
  (io as any).__getMetrics = () => ({
    connectedSockets: io.sockets.sockets.size,
    telemetrySubscribers: telemetrySubscribers.size,
    vatsimSubscribers: vatsimSubscribers.size,
    livemapSubscribers: livemapSubscribers.size,
    activeFlights: activeFlights.size,
    flightObservers: flightObservers.size,
    pilotSockets: pilotSockets.size,
  });

  return io;
}
