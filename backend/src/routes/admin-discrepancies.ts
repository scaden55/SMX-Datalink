import { Router } from 'express';
import { authMiddleware, dispatcherMiddleware } from '../middleware/auth.js';
import { DiscrepancyService } from '../services/discrepancy.js';
import { logger } from '../lib/logger.js';

const TAG = 'AdminDiscrepancies';

export function adminDiscrepancyRouter(): Router {
  const router = Router();
  const service = new DiscrepancyService();

  // GET /api/admin/discrepancies — list all with filters
  router.get('/admin/discrepancies', authMiddleware, dispatcherMiddleware, (req, res) => {
    try {
      const { status, search, aircraftId, page, pageSize } = req.query;
      const result = service.findAll({
        status: status as string | undefined,
        search: search as string | undefined,
        aircraftId: aircraftId ? parseInt(aircraftId as string) : undefined,
        page: page ? parseInt(page as string) : undefined,
        pageSize: pageSize ? parseInt(pageSize as string) : undefined,
      });
      res.json(result);
    } catch (err) {
      logger.error(TAG, 'List discrepancies error', err);
      res.status(500).json({ error: 'Failed to list discrepancies' });
    }
  });

  // GET /api/admin/discrepancies/stats
  router.get('/admin/discrepancies/stats', authMiddleware, dispatcherMiddleware, (_req, res) => {
    try {
      res.json(service.getStats());
    } catch (err) {
      logger.error(TAG, 'Get discrepancy stats error', err);
      res.status(500).json({ error: 'Failed to get stats' });
    }
  });

  // GET /api/admin/discrepancies/:id
  router.get('/admin/discrepancies/:id', authMiddleware, dispatcherMiddleware, (req, res) => {
    try {
      const result = service.findById(parseInt(req.params.id as string));
      if (!result) { res.status(404).json({ error: 'Discrepancy not found' }); return; }
      res.json(result);
    } catch (err) {
      logger.error(TAG, 'Get discrepancy error', err);
      res.status(500).json({ error: 'Failed to get discrepancy' });
    }
  });

  // PATCH /api/admin/discrepancies/:id
  router.patch('/admin/discrepancies/:id', authMiddleware, dispatcherMiddleware, (req, res) => {
    try {
      const result = service.update(parseInt(req.params.id as string), req.body, req.user!.userId);
      if (!result) { res.status(404).json({ error: 'Discrepancy not found' }); return; }
      res.json(result);
    } catch (err: any) {
      logger.error(TAG, 'Update discrepancy error', err);
      res.status(err.status || 500).json({ error: err.message || 'Failed to update discrepancy' });
    }
  });

  // POST /api/admin/discrepancies/:id/resolve
  router.post('/admin/discrepancies/:id/resolve', authMiddleware, dispatcherMiddleware, (req, res) => {
    try {
      const result = service.resolve(parseInt(req.params.id as string), req.body, req.user!.userId);
      res.json(result);
    } catch (err: any) {
      logger.error(TAG, 'Resolve discrepancy error', err);
      res.status(err.status || 500).json({ error: err.message || 'Failed to resolve discrepancy' });
    }
  });

  // POST /api/admin/discrepancies/:id/defer
  router.post('/admin/discrepancies/:id/defer', authMiddleware, dispatcherMiddleware, (req, res) => {
    try {
      const result = service.defer(parseInt(req.params.id as string), req.body, req.user!.userId);
      res.json(result);
    } catch (err: any) {
      logger.error(TAG, 'Defer discrepancy error', err);
      res.status(err.status || 500).json({ error: err.message || 'Failed to defer discrepancy' });
    }
  });

  // POST /api/admin/discrepancies/:id/ground
  router.post('/admin/discrepancies/:id/ground', authMiddleware, dispatcherMiddleware, (req, res) => {
    try {
      const result = service.ground(parseInt(req.params.id as string), req.user!.userId);
      res.json(result);
    } catch (err: any) {
      logger.error(TAG, 'Ground aircraft error', err);
      res.status(err.status || 500).json({ error: err.message || 'Failed to ground aircraft' });
    }
  });

  return router;
}
