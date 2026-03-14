import { Router } from 'express';
import { LogbookService } from '../services/logbook.js';
import { authMiddleware } from '../middleware/auth.js';
import type { LogbookFilters, LogbookStatus } from '@acars/shared';
import { logger } from '../lib/logger.js';
import { ExceedanceService } from '../services/exceedance.js';
import { getDb } from '../db/index.js';

export function logbookRouter(): Router {
  const router = Router();
  const service = new LogbookService();
  const exceedanceService = new ExceedanceService();

  // GET /api/logbook — paginated list (auth required)
  // Pilots can only see their own entries; admins/dispatchers can see all
  router.get('/logbook', authMiddleware, (req, res) => {
    try {
      const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
      const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize as string, 10) || 50));
      const isPrivileged = req.user!.role === 'admin' || req.user!.role === 'dispatcher';

      const filters: LogbookFilters = {
        // Pilots are forced to see only their own entries
        userId: isPrivileged
          ? (req.query.userId ? parseInt(req.query.userId as string, 10) : undefined)
          : req.user!.userId,
        depIcao: req.query.depIcao as string | undefined,
        arrIcao: req.query.arrIcao as string | undefined,
        aircraftType: req.query.aircraftType as string | undefined,
        status: typeof req.query.status === 'string' ? req.query.status as LogbookStatus : undefined,
        search: req.query.search as string | undefined,
        dateFrom: req.query.dateFrom as string | undefined,
        dateTo: req.query.dateTo as string | undefined,
        vatsimOnly: req.query.vatsimOnly === 'true',
      };

      const { entries, total } = service.findAll(filters, page, pageSize);
      res.json({ entries, total, page, pageSize });
    } catch (err) {
      logger.error('Logbook', 'List error', err);
      res.status(500).json({ error: 'Failed to fetch logbook entries' });
    }
  });

  // GET /api/logbook/:id — single entry detail (auth required)
  // Pilots can only see their own entries; admins/dispatchers can see all
  router.get('/logbook/:id', authMiddleware, (req, res) => {
    try {
      const id = parseInt(req.params.id as string, 10);
      if (isNaN(id)) {
        res.status(400).json({ error: 'Invalid logbook entry ID' });
        return;
      }

      const entry = service.findById(id);
      if (!entry) {
        res.status(404).json({ error: 'Logbook entry not found' });
        return;
      }

      // Ownership check — pilots can only view their own entries
      const isPrivileged = req.user!.role === 'admin' || req.user!.role === 'dispatcher';
      if (!isPrivileged && entry.userId !== req.user!.userId) {
        res.status(404).json({ error: 'Logbook entry not found' });
        return;
      }

      res.json(entry);
    } catch (err) {
      logger.error('Logbook', 'Detail error', err);
      res.status(500).json({ error: 'Failed to fetch logbook entry' });
    }
  });

  // GET /api/logbook/:id/exceedances — exceedance events for a flight
  router.get('/logbook/:id/exceedances', authMiddleware, (req, res) => {
    try {
      const id = parseInt(req.params.id as string, 10);
      if (isNaN(id)) {
        res.status(400).json({ error: 'Invalid logbook entry ID' });
        return;
      }

      const entry = service.findById(id);
      if (!entry) {
        res.status(404).json({ error: 'Logbook entry not found' });
        return;
      }

      const isPrivileged = req.user!.role === 'admin' || req.user!.role === 'dispatcher';
      if (!isPrivileged && entry.userId !== req.user!.userId) {
        res.status(404).json({ error: 'Logbook entry not found' });
        return;
      }

      const exceedances = exceedanceService.findByLogbookId(id);
      res.json(exceedances);
    } catch (err) {
      logger.error('Logbook', 'Exceedances fetch error', err);
      res.status(500).json({ error: 'Failed to fetch exceedances' });
    }
  });

  // GET /api/logbook/:id/finances — financial summary for a flight
  router.get('/logbook/:id/finances', authMiddleware, (req, res) => {
    try {
      const id = parseInt(req.params.id as string, 10);
      if (isNaN(id)) {
        res.status(400).json({ error: 'Invalid logbook entry ID' });
        return;
      }

      const entry = service.findById(id);
      if (!entry) {
        res.status(404).json({ error: 'Logbook entry not found' });
        return;
      }

      const isPrivileged = req.user!.role === 'admin' || req.user!.role === 'dispatcher';
      if (!isPrivileged && entry.userId !== req.user!.userId) {
        res.status(404).json({ error: 'Logbook entry not found' });
        return;
      }

      const rows = getDb().prepare(
        'SELECT type, amount, description FROM finances WHERE pirep_id = ?',
      ).all(id) as { type: string; amount: number; description: string | null }[];
      const pilotPay = rows.find(r => r.type === 'pay');
      const cargoRevenue = rows.find(r => r.type === 'income');
      res.json({
        pilotPay: pilotPay?.amount ?? null,
        cargoRevenue: cargoRevenue?.amount ?? null,
        pilotPayDescription: pilotPay?.description ?? null,
        cargoRevenueDescription: cargoRevenue?.description ?? null,
      });
    } catch (err) {
      logger.error('Logbook', 'Finances fetch error', err);
      res.status(500).json({ error: 'Failed to fetch flight finances' });
    }
  });

  return router;
}
