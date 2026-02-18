import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { ScheduleService } from '../services/schedule.js';
import { AuthService } from '../services/auth.js';
import { authMiddleware } from '../middleware/auth.js';
import type { ScheduleFilters } from '../services/schedule.js';
import type { CreateCharterRequest, CharterType } from '@acars/shared';

export function scheduleRouter(): Router {
  const router = Router();
  const service = new ScheduleService();

  // GET /api/airports — public (needed for filter dropdowns)
  router.get('/airports', (_req, res) => {
    try {
      const airports = service.findAllAirports();
      res.json(airports);
    } catch (err) {
      console.error('[Schedule] Airports error:', err);
      res.status(500).json({ error: 'Failed to fetch airports' });
    }
  });

  // GET /api/fleet — public
  router.get('/fleet', (_req, res) => {
    try {
      const fleet = service.findAllFleet();
      res.json(fleet);
    } catch (err) {
      console.error('[Schedule] Fleet error:', err);
      res.status(500).json({ error: 'Failed to fetch fleet' });
    }
  });

  // GET /api/fleet/types — public
  router.get('/fleet/types', (_req, res) => {
    try {
      const types = service.findDistinctAircraftTypes();
      res.json(types);
    } catch (err) {
      console.error('[Schedule] Fleet types error:', err);
      res.status(500).json({ error: 'Failed to fetch aircraft types' });
    }
  });

  // GET /api/stats — public
  router.get('/stats', (_req, res) => {
    try {
      const stats = service.getDashboardStats();
      res.json(stats);
    } catch (err) {
      console.error('[Schedule] Stats error:', err);
      res.status(500).json({ error: 'Failed to fetch stats' });
    }
  });

  // GET /api/schedules — auth optional (has_bid requires auth)
  router.get('/schedules', optionalAuth, (req, res) => {
    try {
      const filters: ScheduleFilters = {
        depIcao: req.query.dep_icao as string | undefined,
        arrIcao: req.query.arr_icao as string | undefined,
        aircraftType: req.query.aircraft_type as string | undefined,
        search: req.query.search as string | undefined,
      };

      const userId = req.user?.userId;
      const schedules = service.findSchedules(filters, userId);

      res.json({ schedules, total: schedules.length });
    } catch (err) {
      console.error('[Schedule] Schedules error:', err);
      res.status(500).json({ error: 'Failed to fetch schedules' });
    }
  });

  // GET /api/schedules/:id — auth optional
  router.get('/schedules/:id', optionalAuth, (req, res) => {
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
      console.error('[Schedule] Schedule detail error:', err);
      res.status(500).json({ error: 'Failed to fetch schedule' });
    }
  });

  // POST /api/bids — auth required
  router.post('/bids', authMiddleware, (req, res) => {
    try {
      const { scheduleId } = req.body as { scheduleId?: number };

      if (!scheduleId || typeof scheduleId !== 'number') {
        res.status(400).json({ error: 'scheduleId (number) is required' });
        return;
      }

      const bid = service.placeBid(req.user!.userId, scheduleId);
      if (!bid) {
        res.status(409).json({ error: 'Bid already exists or schedule not found' });
        return;
      }

      res.status(201).json({ bid });
    } catch (err) {
      console.error('[Schedule] Place bid error:', err);
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
      console.error('[Schedule] Remove bid error:', err);
      res.status(500).json({ error: 'Failed to remove bid' });
    }
  });

  // GET /api/bids/my — auth required
  router.get('/bids/my', authMiddleware, (req, res) => {
    try {
      const bids = service.findMyBids(req.user!.userId);
      res.json({ bids, total: bids.length });
    } catch (err) {
      console.error('[Schedule] My bids error:', err);
      res.status(500).json({ error: 'Failed to fetch bids' });
    }
  });

  // GET /api/bids/all — auth required (all VA bids for dashboard)
  router.get('/bids/all', authMiddleware, (_req, res) => {
    try {
      const bids = service.findAllBids();
      res.json({ bids, total: bids.length });
    } catch (err) {
      console.error('[Schedule] All bids error:', err);
      res.status(500).json({ error: 'Failed to fetch bids' });
    }
  });

  // POST /api/charters — auth required (create charter + auto-bid)
  const VALID_CHARTER_TYPES = new Set<CharterType>(['reposition', 'cargo', 'passenger']);

  router.post('/charters', authMiddleware, (req, res) => {
    try {
      const body = req.body as Partial<CreateCharterRequest>;

      if (!body.charterType || !VALID_CHARTER_TYPES.has(body.charterType)) {
        res.status(400).json({ error: 'charterType must be reposition, cargo, or passenger' });
        return;
      }
      if (!body.depIcao || !body.arrIcao || !body.aircraftType || !body.depTime) {
        res.status(400).json({ error: 'depIcao, arrIcao, aircraftType, and depTime are required' });
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

      const result = service.createCharter(req.user!.userId, body as CreateCharterRequest);
      if (!result) {
        res.status(400).json({ error: 'Invalid airports or aircraft type' });
        return;
      }

      res.status(201).json(result);
    } catch (err) {
      console.error('[Schedule] Create charter error:', err);
      res.status(500).json({ error: 'Failed to create charter' });
    }
  });

  return router;
}

// Optional auth middleware — sets req.user if token present, but doesn't reject
const optionalAuthService = new AuthService();

function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    next();
    return;
  }

  try {
    const token = header.slice(7);
    req.user = optionalAuthService.verifyAccessToken(token);
  } catch {
    // Invalid token — continue without user context
  }
  next();
}
