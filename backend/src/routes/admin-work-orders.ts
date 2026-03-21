import { Router } from 'express';
import { authMiddleware, dispatcherMiddleware } from '../middleware/auth.js';
import { WorkOrderService } from '../services/work-order.js';
import { logger } from '../lib/logger.js';
import { getDb } from '../db/index.js';

const TAG = 'WorkOrderRoutes';

export function adminWorkOrderRouter(service: WorkOrderService): Router {
  const router = Router();

  router.post('/admin/maintenance/work-orders', authMiddleware, dispatcherMiddleware, (req, res) => {
    try {
      const { aircraftId, discrepancyId, ataChapter, severity } = req.body;
      if (!aircraftId || !discrepancyId || !ataChapter || !severity) {
        return res.status(400).json({ error: 'Missing required fields' });
      }
      const result = service.create({
        aircraftId, discrepancyId, ataChapter, severity,
        createdBy: req.user!.userId,
      });
      res.json(result);
    } catch (err: any) {
      logger.error(TAG, 'Create work order error', err);
      res.status(400).json({ error: err.message || 'Failed to create work order' });
    }
  });

  router.get('/admin/maintenance/work-orders', authMiddleware, dispatcherMiddleware, (req, res) => {
    try {
      const aircraft_id = req.query.aircraft_id as string | undefined;
      const status = req.query.status as string | undefined;
      let sql = `SELECT wo.*, f.registration, ac.title as ata_title
                 FROM work_orders wo
                 JOIN fleet f ON f.id = wo.aircraft_id
                 LEFT JOIN ata_chapters ac ON ac.chapter = wo.ata_chapter
                 WHERE 1=1`;
      const params: any[] = [];
      if (aircraft_id) { sql += ` AND wo.aircraft_id = ?`; params.push(aircraft_id); }
      if (status) { sql += ` AND wo.status = ?`; params.push(status); }
      sql += ` ORDER BY wo.created_at DESC`;
      const rows = getDb().prepare(sql).all(...params);
      res.json(rows);
    } catch (err) {
      logger.error(TAG, 'List work orders error', err);
      res.status(500).json({ error: 'Failed to list work orders' });
    }
  });

  router.post('/admin/maintenance/work-orders/:id/accept', authMiddleware, dispatcherMiddleware, (req, res) => {
    try {
      const result = service.accept(parseInt(req.params.id as string), req.user!.userId);
      res.json(result);
    } catch (err: any) {
      logger.error(TAG, 'Accept work order error', err);
      res.status(400).json({ error: err.message || 'Failed to accept work order' });
    }
  });

  return router;
}
