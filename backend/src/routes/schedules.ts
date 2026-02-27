import { Router } from 'express';
import { ScheduleService } from '../services/schedule.js';
import { authMiddleware, optionalAuthMiddleware, adminMiddleware } from '../middleware/auth.js';
import type { ScheduleFilters } from '../services/schedule.js';
import type { CreateCharterRequest, CharterType, ServerToClientEvents, ClientToServerEvents } from '@acars/shared';
import type { Server as SocketServer } from 'socket.io';
import { logger } from '../lib/logger.js';
import { randomFlightNumber } from '../services/charter-generator.js';
import { getDb } from '../db/index.js';

export function scheduleRouter(io?: SocketServer<ClientToServerEvents, ServerToClientEvents>): Router {
  const router = Router();
  const service = new ScheduleService();

  // GET /api/airports — public (needed for filter dropdowns)
  router.get('/airports', (_req, res) => {
    try {
      const airports = service.findAllAirports();
      res.json(airports);
    } catch (err) {
      logger.error('Schedule', 'Airports error', err);
      res.status(500).json({ error: 'Failed to fetch airports' });
    }
  });

  // GET /api/fleet — public
  router.get('/fleet', (_req, res) => {
    try {
      const fleet = service.findAllFleet();
      res.json(fleet);
    } catch (err) {
      logger.error('Schedule', 'Fleet error', err);
      res.status(500).json({ error: 'Failed to fetch fleet' });
    }
  });

  // GET /api/fleet/types — public
  router.get('/fleet/types', (_req, res) => {
    try {
      const types = service.findDistinctAircraftTypes();
      res.json(types);
    } catch (err) {
      logger.error('Schedule', 'Fleet types error', err);
      res.status(500).json({ error: 'Failed to fetch aircraft types' });
    }
  });

  // GET /api/fleet/for-bid — active fleet with location match info
  router.get('/fleet/for-bid', authMiddleware, (req, res) => {
    try {
      const depIcao = req.query.dep_icao as string;
      if (!depIcao) {
        res.status(400).json({ error: 'dep_icao query parameter is required' });
        return;
      }
      const fleet = service.findFleetForBid(depIcao, req.user!.userId);
      res.json({ fleet });
    } catch (err) {
      logger.error('Schedule', 'Fleet for bid error', err);
      res.status(500).json({ error: 'Failed to fetch fleet' });
    }
  });

  // GET /api/stats — public
  router.get('/stats', (_req, res) => {
    try {
      const stats = service.getDashboardStats();
      res.json(stats);
    } catch (err) {
      logger.error('Schedule', 'Stats error', err);
      res.status(500).json({ error: 'Failed to fetch stats' });
    }
  });

  // GET /api/schedules — auth optional (has_bid requires auth)
  router.get('/schedules', optionalAuthMiddleware, (req, res) => {
    try {
      const filters: ScheduleFilters = {
        depIcao: req.query.dep_icao as string | undefined,
        arrIcao: req.query.arr_icao as string | undefined,
        aircraftType: req.query.aircraft_type as string | undefined,
        search: req.query.search as string | undefined,
        charterType: req.query.charter_type as string | undefined,
      };

      const userId = req.user?.userId;
      const schedules = service.findSchedules(filters, userId);

      res.json({ schedules, total: schedules.length });
    } catch (err) {
      logger.error('Schedule', 'Schedules error', err);
      res.status(500).json({ error: 'Failed to fetch schedules' });
    }
  });

  // GET /api/schedules/:id — auth optional
  router.get('/schedules/:id', optionalAuthMiddleware, (req, res) => {
    try {
      const id = parseInt(req.params.id as string, 10);
      if (isNaN(id)) {
        res.status(400).json({ error: 'Invalid schedule ID' });
        return;
      }

      const userId = req.user?.userId;
      const schedule = service.findScheduleById(id, userId);

      if (!schedule) {
        res.status(404).json({ error: 'Schedule not found' });
        return;
      }

      res.json(schedule);
    } catch (err) {
      logger.error('Schedule', 'Schedule detail error', err);
      res.status(500).json({ error: 'Failed to fetch schedule' });
    }
  });

  // POST /api/bids — auth required (aircraft selection at bid time)
  router.post('/bids', authMiddleware, (req, res) => {
    try {
      const { scheduleId, aircraftId } = req.body as { scheduleId?: number; aircraftId?: number };

      if (!scheduleId || typeof scheduleId !== 'number') {
        res.status(400).json({ error: 'scheduleId (number) is required' });
        return;
      }
      if (!aircraftId || typeof aircraftId !== 'number') {
        res.status(400).json({ error: 'aircraftId (number) is required' });
        return;
      }

      const result = service.placeBid(req.user!.userId, scheduleId, aircraftId);
      if ('error' in result) {
        res.status(409).json({ error: result.error });
        return;
      }

      res.status(201).json({ bid: result.bid, warnings: result.warnings });
    } catch (err) {
      logger.error('Schedule', 'Place bid error', err);
      res.status(500).json({ error: 'Failed to place bid' });
    }
  });

  // DELETE /api/bids/:id — auth required
  router.delete('/bids/:id', authMiddleware, (req, res) => {
    try {
      const bidId = parseInt(req.params.id as string, 10);
      if (isNaN(bidId)) {
        res.status(400).json({ error: 'Invalid bid ID' });
        return;
      }

      const removed = service.removeBid(bidId, req.user!.userId);
      if (!removed) {
        res.status(404).json({ error: 'Bid not found' });
        return;
      }

      res.status(204).send();
    } catch (err) {
      logger.error('Schedule', 'Remove bid error', err);
      res.status(500).json({ error: 'Failed to remove bid' });
    }
  });

  // DELETE /api/bids/:id/force — admin force-remove (any bid)
  router.delete('/bids/:id/force', authMiddleware, adminMiddleware, (req, res) => {
    try {
      const bidId = parseInt(req.params.id as string, 10);
      if (isNaN(bidId)) {
        res.status(400).json({ error: 'Invalid bid ID' });
        return;
      }

      const result = service.forceRemoveBid(bidId);
      if (!result) {
        res.status(404).json({ error: 'Bid not found' });
        return;
      }

      // Notify the affected pilot via socket
      if (io) {
        for (const [, socket] of io.sockets.sockets) {
          const s = socket as any;
          if (s.user?.userId === result.userId) {
            socket.emit('bid:expired', { bidId, flightNumber: result.flightNumber, reason: 'admin_removed' });
          }
        }
      }

      logger.info('Schedule', `Admin ${req.user!.callsign} force-removed bid ${bidId} (flight ${result.flightNumber})`);
      res.status(204).send();
    } catch (err) {
      logger.error('Schedule', 'Force remove bid error', err);
      res.status(500).json({ error: 'Failed to remove bid' });
    }
  });

  // GET /api/bids/my — auth required
  router.get('/bids/my', authMiddleware, (req, res) => {
    try {
      const bids = service.findMyBids(req.user!.userId);
      res.json({ bids, total: bids.length });
    } catch (err) {
      logger.error('Schedule', 'My bids error', err);
      res.status(500).json({ error: 'Failed to fetch bids' });
    }
  });

  // GET /api/bids/all — auth required (all VA bids for dashboard)
  router.get('/bids/all', authMiddleware, (_req, res) => {
    try {
      const bids = service.findAllBids();
      res.json({ bids, total: bids.length });
    } catch (err) {
      logger.error('Schedule', 'All bids error', err);
      res.status(500).json({ error: 'Failed to fetch bids' });
    }
  });

  // GET /api/charters/random-number — generate a random available flight number
  router.get('/charters/random-number', authMiddleware, (req, res) => {
    try {
      const depIcao = req.query.dep_icao as string | undefined;
      const arrIcao = req.query.arr_icao as string | undefined;
      const flightNumber = randomFlightNumber(getDb(), depIcao, arrIcao);
      res.json({ flightNumber });
    } catch (err) {
      logger.error('Schedule', 'Random flight number error', err);
      res.status(500).json({ error: 'Failed to generate flight number' });
    }
  });

  // POST /api/charters — auth required (create charter, no auto-bid)
  const VALID_CHARTER_TYPES = new Set<CharterType>(['reposition', 'cargo', 'passenger']);

  router.post('/charters', authMiddleware, (req, res) => {
    try {
      const body = req.body as Partial<CreateCharterRequest>;

      if (!body.charterType || !VALID_CHARTER_TYPES.has(body.charterType)) {
        res.status(400).json({ error: 'charterType must be reposition, cargo, or passenger' });
        return;
      }
      if (!body.depIcao || !body.arrIcao || !body.depTime) {
        res.status(400).json({ error: 'depIcao, arrIcao, and depTime are required' });
        return;
      }
      if (body.depIcao === body.arrIcao) {
        res.status(400).json({ error: 'Departure and arrival airports must be different' });
        return;
      }
      if (!/^\d{2}:\d{2}$/.test(body.depTime)) {
        res.status(400).json({ error: 'depTime must be in HH:MM format' });
        return;
      }

      // Optional flight number validation
      if (body.flightNumber !== undefined) {
        if (typeof body.flightNumber !== 'string' || body.flightNumber.trim().length === 0) {
          res.status(400).json({ error: 'flightNumber must be a non-empty string if provided' });
          return;
        }
        // Normalize: strip whitespace
        body.flightNumber = body.flightNumber.trim().toUpperCase();
      }

      const result = service.createCharter(req.user!.userId, body as CreateCharterRequest);
      if (!result) {
        res.status(400).json({ error: 'Invalid airports' });
        return;
      }

      res.status(201).json(result);
    } catch (err) {
      logger.error('Schedule', 'Create charter error', err);
      res.status(500).json({ error: 'Failed to create charter' });
    }
  });

  return router;
}

