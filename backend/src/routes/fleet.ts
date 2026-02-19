import { Router } from 'express';
import { FleetService } from '../services/fleet.js';
import { authMiddleware, adminMiddleware } from '../middleware/auth.js';
import type { FleetFilters } from '../services/fleet.js';
import type { FleetStatus, CreateFleetAircraftRequest, UpdateFleetAircraftRequest } from '@acars/shared';

const VALID_STATUSES = new Set<FleetStatus>(['active', 'stored', 'retired']);

export function fleetManageRouter(): Router {
  const router = Router();
  const service = new FleetService();

  // GET /api/fleet/manage — all fleet with filters (auth required)
  router.get('/fleet/manage', authMiddleware, (req, res) => {
    try {
      const filters: FleetFilters = {
        icaoType: req.query.type as string | undefined,
        status: VALID_STATUSES.has(req.query.status as FleetStatus)
          ? (req.query.status as FleetStatus)
          : undefined,
        search: req.query.search as string | undefined,
      };

      const fleet = service.findAll(filters);
      res.json({ fleet, total: fleet.length });
    } catch (err) {
      console.error('[Fleet] List error:', err);
      res.status(500).json({ error: 'Failed to fetch fleet' });
    }
  });

  // GET /api/fleet/manage/types — distinct ICAO types including inactive (auth required)
  router.get('/fleet/manage/types', authMiddleware, (_req, res) => {
    try {
      const types = service.findDistinctTypes();
      res.json(types);
    } catch (err) {
      console.error('[Fleet] Types error:', err);
      res.status(500).json({ error: 'Failed to fetch aircraft types' });
    }
  });

  // POST /api/fleet/manage — create aircraft (admin only)
  router.post('/fleet/manage', authMiddleware, adminMiddleware, (req, res) => {
    try {
      const body = req.body as Partial<CreateFleetAircraftRequest>;

      if (!body.icaoType || !body.name || !body.registration) {
        res.status(400).json({ error: 'icaoType, name, and registration are required' });
        return;
      }
      if (body.rangeNm == null || body.cruiseSpeed == null || body.paxCapacity == null || body.cargoCapacityLbs == null) {
        res.status(400).json({ error: 'rangeNm, cruiseSpeed, paxCapacity, and cargoCapacityLbs are required' });
        return;
      }

      const aircraft = service.create(body as CreateFleetAircraftRequest);
      res.status(201).json(aircraft);
    } catch (err: any) {
      if (err?.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        res.status(409).json({ error: 'Registration already exists' });
        return;
      }
      console.error('[Fleet] Create error:', err);
      res.status(500).json({ error: 'Failed to create aircraft' });
    }
  });

  // PATCH /api/fleet/manage/:id — update aircraft (admin only)
  router.patch('/fleet/manage/:id', authMiddleware, adminMiddleware, (req, res) => {
    try {
      const id = parseInt(req.params.id as string, 10);
      if (isNaN(id)) {
        res.status(400).json({ error: 'Invalid aircraft ID' });
        return;
      }

      const body = req.body as UpdateFleetAircraftRequest;
      const aircraft = service.update(id, body);
      if (!aircraft) {
        res.status(404).json({ error: 'Aircraft not found' });
        return;
      }

      res.json(aircraft);
    } catch (err: any) {
      if (err?.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        res.status(409).json({ error: 'Registration already exists' });
        return;
      }
      console.error('[Fleet] Update error:', err);
      res.status(500).json({ error: 'Failed to update aircraft' });
    }
  });

  // DELETE /api/fleet/manage/:id — remove aircraft (admin only)
  router.delete('/fleet/manage/:id', authMiddleware, adminMiddleware, (req, res) => {
    try {
      const id = parseInt(req.params.id as string, 10);
      if (isNaN(id)) {
        res.status(400).json({ error: 'Invalid aircraft ID' });
        return;
      }

      const deleted = service.delete(id);
      if (!deleted) {
        res.status(404).json({ error: 'Aircraft not found' });
        return;
      }

      res.status(204).send();
    } catch (err) {
      console.error('[Fleet] Delete error:', err);
      res.status(500).json({ error: 'Failed to delete aircraft' });
    }
  });

  return router;
}
