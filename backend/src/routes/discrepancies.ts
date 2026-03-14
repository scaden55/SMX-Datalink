import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { DiscrepancyService } from '../services/discrepancy.js';
import { logger } from '../lib/logger.js';

const TAG = 'Discrepancies';

export function discrepancyRouter(): Router {
  const router = Router();
  const service = new DiscrepancyService();

  // POST /api/discrepancies — pilot creates discrepancy
  router.post('/discrepancies', authMiddleware, (req, res) => {
    try {
      const result = service.create(req.body, req.user!.userId);
      res.status(201).json(result);
    } catch (err: any) {
      logger.error(TAG, 'Create discrepancy error', err);
      res.status(err.status || 500).json({ error: err.message || 'Failed to create discrepancy' });
    }
  });

  // GET /api/discrepancies — pilot's own discrepancies
  router.get('/discrepancies', authMiddleware, (req, res) => {
    try {
      const result = service.findByUser(req.user!.userId);
      res.json(result);
    } catch (err) {
      logger.error(TAG, 'List discrepancies error', err);
      res.status(500).json({ error: 'Failed to list discrepancies' });
    }
  });

  return router;
}
