import { Router } from 'express';
import type { Server as SocketServer } from 'socket.io';
import type { ServerToClientEvents, ClientToServerEvents } from '@acars/shared';
import { authMiddleware, adminMiddleware } from '../middleware/auth.js';
import { DispatchService } from '../services/dispatch.js';
import { FlightPlanService } from '../services/flight-plan.js';
import { MessageService } from '../services/messages.js';
import { PirepService } from '../services/pirep.js';
import type { TelemetryService } from '../services/telemetry.js';
import type { FlightEventTracker } from '../services/flight-event-tracker.js';
import type { DispatchFlightsResponse, DispatchEditPayload } from '@acars/shared';
import { logger } from '../lib/logger.js';
import { NotificationService } from '../services/notification.js';
import { CargoService } from '../services/cargo.js';
import type { ExceedanceRow } from '../types/db-rows.js';
import { getDb } from '../db/index.js';

interface TrackPointRow {
  id: number;
  pilot_id: number;
  bid_id: number;
  lat: number;
  lon: number;
  altitude_ft: number;
  heading: number | null;
  speed_kts: number | null;
  vs_fpm: number | null;
  recorded_at: number;
}

export function dispatchRouter(
  io?: SocketServer<ClientToServerEvents, ServerToClientEvents>,
  telemetry?: TelemetryService,
  flightEventTracker?: FlightEventTracker,
): Router {
  const router = Router();
  const dispatchService = new DispatchService();
  const flightPlanService = new FlightPlanService();
  const messageService = new MessageService();
  const pirepService = new PirepService();
  const notificationService = new NotificationService();
  const cargoService = new CargoService();

  // GET /api/dispatch/flights — active flights with saved flight plans
  // Admin: all flights; Pilot: only own flights
  // Optional query param: ?phase=planning|active|all
  router.get('/dispatch/flights', authMiddleware, (req, res) => {
    try {
      const isAdmin = req.user!.role === 'admin';
      const phase = req.query.phase as string | undefined;
      const flights = isAdmin
        ? dispatchService.findActiveFlights(undefined, phase)
        : dispatchService.findActiveFlights(req.user!.userId, phase);

      const response: DispatchFlightsResponse = { flights };
      res.json(response);
    } catch (err) {
      logger.error('Dispatch', 'Get flights error', err);
      res.status(500).json({ error: 'Failed to get dispatch flights' });
    }
  });

  // GET /api/dispatch/flights/:bidId — single-flight detail (admin or owner)
  router.get('/dispatch/flights/:bidId', authMiddleware, (req, res) => {
    try {
      const bidId = Number(req.params.bidId);
      if (isNaN(bidId)) {
        res.status(400).json({ error: 'Invalid bid ID' });
        return;
      }

      // Verify ownership — pilot must own the bid; admins can see all
      if (req.user!.role !== 'admin') {
        const bid = dispatchService.findBidOwner(bidId);
        if (!bid || bid.userId !== req.user!.userId) {
          res.status(404).json({ error: 'Flight not found' });
          return;
        }
      }

      const flight = dispatchService.findFlightById(bidId);
      if (!flight) {
        res.status(404).json({ error: 'Flight not found' });
        return;
      }

      const cargo = cargoService.getByFlightId(bidId);
      const messages = messageService.getMessages(bidId);

      const exceedances = getDb().prepare(
        'SELECT * FROM flight_exceedances WHERE bid_id = ? ORDER BY detected_at DESC'
      ).all(bidId) as ExceedanceRow[];

      const track = getDb().prepare(
        'SELECT * FROM telemetry_track WHERE bid_id = ? ORDER BY recorded_at ASC'
      ).all(bidId) as TrackPointRow[];

      res.json({ flight, cargo, messages, exceedances, track });
    } catch (err) {
      logger.error('Dispatch', 'Get flight detail error', err);
      res.status(500).json({ error: 'Failed to get flight detail' });
    }
  });

  // PATCH /api/dispatch/flights/:bidId — edit flight plan fields (admin only)
  router.patch('/dispatch/flights/:bidId', authMiddleware, adminMiddleware, (req, res) => {
    try {
      const bidId = Number(req.params.bidId);
      if (isNaN(bidId)) {
        res.status(400).json({ error: 'Invalid bid ID' });
        return;
      }

      const fields = req.body as DispatchEditPayload;
      if (!fields || Object.keys(fields).length === 0) {
        res.status(400).json({ error: 'No fields to update' });
        return;
      }

      const result = flightPlanService.patchFlightPlanData(bidId, fields);
      if (!result.ok) {
        res.status(400).json({ error: result.error });
        return;
      }

      // Broadcast update to subscribers of this flight
      if (io) {
        io.to(`bid:${bidId}`).emit('dispatch:updated', { bidId, fields });
      }

      res.json({ ok: true });
    } catch (err) {
      logger.error('Dispatch', 'Patch flight error', err);
      res.status(500).json({ error: 'Failed to update flight plan' });
    }
  });

  // GET /api/dispatch/flights/:bidId/messages — message history
  // Pilots can only see messages for their own bids; admins can see all
  router.get('/dispatch/flights/:bidId/messages', authMiddleware, (req, res) => {
    try {
      const bidId = Number(req.params.bidId);
      if (isNaN(bidId)) {
        res.status(400).json({ error: 'Invalid bid ID' });
        return;
      }

      // Verify ownership — pilot must own the bid
      if (req.user!.role !== 'admin') {
        const bid = dispatchService.findBidOwner(bidId);
        if (!bid || bid.userId !== req.user!.userId) {
          res.status(404).json({ error: 'Bid not found' });
          return;
        }
      }

      const messages = messageService.getMessages(bidId);
      res.json({ messages });
    } catch (err) {
      logger.error('Dispatch', 'Get messages error', err);
      res.status(500).json({ error: 'Failed to get messages' });
    }
  });

  // POST /api/dispatch/flights/:bidId/messages — send a message
  // Pilots can only send messages for their own bids; admins can send to any
  router.post('/dispatch/flights/:bidId/messages', authMiddleware, (req, res) => {
    try {
      const bidId = Number(req.params.bidId);
      if (isNaN(bidId)) {
        res.status(400).json({ error: 'Invalid bid ID' });
        return;
      }

      // Verify ownership — pilot must own the bid
      if (req.user!.role !== 'admin') {
        const bid = dispatchService.findBidOwner(bidId);
        if (!bid || bid.userId !== req.user!.userId) {
          res.status(404).json({ error: 'Bid not found' });
          return;
        }
      }

      const { content } = req.body as { content?: string };
      if (!content?.trim()) {
        res.status(400).json({ error: 'Message content is required' });
        return;
      }

      const trimmed = content.trim();
      if (trimmed.length > 2000) {
        res.status(400).json({ error: 'Message content must be 2000 characters or less' });
        return;
      }

      const isAdmin = req.user!.role === 'admin';
      const type = isAdmin ? 'DISPATCHER' : 'PILOT';
      const message = messageService.createMessage(bidId, req.user!.userId, type, trimmed);

      // Broadcast to subscribers of this flight
      if (io) {
        io.to(`bid:${bidId}`).emit('acars:message', message);
      }

      res.status(201).json(message);
    } catch (err) {
      logger.error('Dispatch', 'Send message error', err);
      res.status(500).json({ error: 'Failed to send message' });
    }
  });

  // POST /api/dispatch/flights/:bidId/complete — end flight and file PIREP
  router.post('/dispatch/flights/:bidId/complete', authMiddleware, (req, res) => {
    try {
      const bidId = Number(req.params.bidId);
      if (isNaN(bidId)) {
        res.status(400).json({ error: 'Invalid bid ID' });
        return;
      }

      // Verify ownership — pilot must own the bid (or admin)
      if (req.user!.role !== 'admin') {
        const bid = dispatchService.findBidOwner(bidId);
        if (!bid || bid.userId !== req.user!.userId) {
          res.status(404).json({ error: 'Bid not found' });
          return;
        }
      }

      const { remarks, clientFlightEvents, clientFuelLbs } = req.body as {
        remarks?: string;
        clientFlightEvents?: {
          landingRateFpm: number | null;
          landingGForce: number | null;
          takeoffFuelLbs: number | null;
          takeoffTime: string | null;
          oooiOut: string | null;
          oooiOff: string | null;
          oooiOn: string | null;
          oooiIn: string | null;
        };
        clientFuelLbs?: number;
      };

      // Read server-side flight events (available when SimConnect is local)
      const serverEvents = flightEventTracker?.getEvents();
      const hasServerData = serverEvents != null && (
        serverEvents.landingRateFpm != null
        || serverEvents.takeoffTime != null
        || serverEvents.oooiOut != null
      );

      // Prefer server-side data; fall back to client-provided events (VPS path)
      const nullEvents = { landingRateFpm: null, landingGForce: null, takeoffFuelLbs: null, takeoffTime: null,
        oooiOut: null, oooiOff: null, oooiOn: null, oooiIn: null };
      const flightEvents = hasServerData
        ? serverEvents!
        : (clientFlightEvents ?? nullEvents);

      if (!hasServerData && clientFlightEvents) {
        logger.info('Dispatch', 'Using client-provided flight events (no server SimConnect data)');
      }

      // Read current fuel: server telemetry > client snapshot > 0
      const serverFuel = telemetry?.getFuelData().totalQuantityWeight ?? 0;
      const currentFuelLbs = serverFuel > 0 ? serverFuel : (clientFuelLbs ?? 0);

      const result = pirepService.submit(
        bidId,
        req.user!.userId,
        currentFuelLbs,
        flightEvents,
        remarks?.trim()?.slice(0, 2000),
      );

      // Reset tracker for next flight
      if (flightEventTracker) {
        flightEventTracker.reset();
      }

      // Broadcast flight completion to dispatch room subscribers
      if (io) {
        io.to(`bid:${bidId}`).emit('flight:completed', {
          bidId,
          logbookId: result.logbookId,
        });
      }

      res.status(201).json(result);
    } catch (err: any) {
      logger.error('Dispatch', 'Complete flight error', err);
      const status = err.message?.includes('not found') || err.message?.includes('Not your')
        ? 404
        : err.message?.includes('not active')
          ? 409
          : 500;
      res.status(status).json({ error: err.message || 'Failed to complete flight' });
    }
  });

  // POST /api/dispatch/flights/:bidId/release — release dispatch edits to pilot
  router.post('/dispatch/flights/:bidId/release', authMiddleware, adminMiddleware, (req, res) => {
    try {
      const bidId = Number(req.params.bidId);
      if (isNaN(bidId)) {
        res.status(400).json({ error: 'Invalid bid ID' });
        return;
      }

      const { changedFields } = req.body as { changedFields?: string[] };
      if (!Array.isArray(changedFields) || changedFields.length === 0) {
        res.status(400).json({ error: 'changedFields array is required' });
        return;
      }

      // Look up who owns this bid (the pilot)
      const bid = dispatchService.findBidOwner(bidId);
      if (!bid) {
        res.status(404).json({ error: 'Bid not found' });
        return;
      }

      // Persist released fields so the pilot sees highlighted changes
      dispatchService.setReleasedFields(bidId, changedFields);

      // Build a human-readable summary of changed fields
      const fieldSummary = changedFields.join(', ');
      const messageContent = `Dispatch update: ${fieldSummary} modified`;

      // Create SYSTEM ACARS message in the flight's message thread
      const message = messageService.createMessage(bidId, req.user!.userId, 'SYSTEM', messageContent);

      // Send notification bell entry to the pilot
      notificationService.send({
        userId: bid.userId,
        message: `Dispatcher updated your flight plan (${fieldSummary})`,
        type: 'info',
        link: '/dispatch',
      });

      // Broadcast via WebSocket
      if (io) {
        io.to(`bid:${bidId}`).emit('dispatch:released', { bidId, changedFields });
        io.to(`bid:${bidId}`).emit('acars:message', message);
      }

      res.json({ ok: true });
    } catch (err) {
      logger.error('Dispatch', 'Release dispatch error', err);
      res.status(500).json({ error: 'Failed to release dispatch' });
    }
  });

  // POST /api/dispatch/flights/:bidId/acknowledge — pilot acknowledges released changes
  router.post('/dispatch/flights/:bidId/acknowledge', authMiddleware, (req, res) => {
    try {
      const bidId = Number(req.params.bidId);
      if (isNaN(bidId)) {
        res.status(400).json({ error: 'Invalid bid ID' });
        return;
      }

      // Verify ownership — pilot must own the bid (or admin)
      if (req.user!.role !== 'admin') {
        const bid = dispatchService.findBidOwner(bidId);
        if (!bid || bid.userId !== req.user!.userId) {
          res.status(404).json({ error: 'Bid not found' });
          return;
        }
      }

      dispatchService.acknowledgeRelease(bidId);
      res.json({ ok: true });
    } catch (err) {
      logger.error('Dispatch', 'Acknowledge release error', err);
      res.status(500).json({ error: 'Failed to acknowledge release' });
    }
  });

  return router;
}
