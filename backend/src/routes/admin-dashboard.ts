import { Router } from 'express';
import { authMiddleware, dispatcherMiddleware } from '../middleware/auth.js';
import { getDb } from '../db/index.js';
import { getDashboardData } from '../services/dashboard.js';
import { logger } from '../lib/logger.js';

export function adminDashboardRouter(): Router {
  const router = Router();

  // GET /api/admin/dashboard
  router.get('/admin/dashboard', authMiddleware, dispatcherMiddleware, (_req, res) => {
    try {
      const data = getDashboardData(getDb());
      res.json(data);
    } catch (err) {
      logger.error('Admin', 'Failed to fetch dashboard data', err);
      res.status(500).json({ error: 'Failed to fetch dashboard data' });
    }
  });

  return router;
}
