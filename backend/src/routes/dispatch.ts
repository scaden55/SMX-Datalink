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

  // GET /api/dispatch/flights — active flights with saved flight plans
  // Admin: all flights; Pilot: only own flights
  router.get('/dispatch/flights', authMiddleware, (req, res) => {
    try {
      const isAdmin = req.user!.role === 'admin';
      const flights = isAdmin
        ? dispatchService.findActiveFlights()
        : dispatchService.findActiveFlights(req.user!.userId);

      const response: DispatchFlightsResponse = { flights };
      res.json(response);
    } catch (err) {
      console.error('[Dispatch] Get flights error:', err);
      res.status(500).json({ error: 'Failed to get dispatch flights' });
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
      console.error('[Dispatch] Patch flight error:', err);
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
      console.error('[Dispatch] Get messages error:', err);
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
      console.error('[Dispatch] Send message error:', err);
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

      const { remarks } = req.body as { remarks?: string };

      // Read current fuel from telemetry
      const currentFuelLbs = telemetry
        ? telemetry.getFuelData().totalQuantityWeight
        : 0;

      // Read flight events (landing rate, takeoff fuel/time)
      const flightEvents = flightEventTracker
        ? flightEventTracker.getEvents()
        : { landingRateFpm: null, takeoffFuelLbs: null, takeoffTime: null };

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
      console.error('[Dispatch] Complete flight error:', err);
      const status = err.message?.includes('not found') || err.message?.includes('Not your')
        ? 404
        : err.message?.includes('not active')
          ? 409
          : 500;
      res.status(status).json({ error: err.message || 'Failed to complete flight' });
    }
  });

  return router;
}
