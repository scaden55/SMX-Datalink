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

  router.get('/admin/dashboard/acars/recent', authMiddleware, dispatcherMiddleware, (_req, res) => {
    try {
      const db = getDb();
      const rows = db.prepare(`
        SELECT m.content, m.created_at,
               COALESCE(u.callsign, 'SMX???') AS callsign
        FROM acars_messages m
        LEFT JOIN active_bids ab ON ab.id = m.bid_id
        LEFT JOIN users u ON u.id = ab.user_id
        ORDER BY m.created_at DESC
        LIMIT 5
      `).all() as Array<{ content: string; created_at: string; callsign: string }>;

      res.json(rows.map(r => ({
        callsign: r.callsign,
        content: r.content,
        createdAt: r.created_at,
      })));
    } catch (err) {
      logger.error('Admin', 'Failed to fetch recent ACARS', err);
      res.status(500).json({ error: 'Failed to fetch recent ACARS messages' });
    }
  });

  return router;
}
