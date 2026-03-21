import { Router } from 'express';
import { authMiddleware, adminMiddleware, dispatcherMiddleware } from '../middleware/auth.js';
import { getDb } from '../db/index.js';
import { logger } from '../lib/logger.js';

const TAG = 'RepairEstimates';

export function adminRepairEstimatesRouter(): Router {
  const router = Router();

  router.get('/admin/maintenance/repair-estimates', authMiddleware, dispatcherMiddleware, (_req, res) => {
    try {
      const rows = getDb().prepare('SELECT * FROM repair_estimates ORDER BY ata_chapter_prefix').all();
      res.json(rows);
    } catch (err) {
      logger.error(TAG, 'List repair estimates error', err);
      res.status(500).json({ error: 'Failed to list repair estimates' });
    }
  });

  router.put('/admin/maintenance/repair-estimates/:id', authMiddleware, adminMiddleware, (req, res) => {
    try {
      const { grounding_hours, grounding_cost, non_grounding_hours, non_grounding_cost } = req.body;
      getDb().prepare(`
        UPDATE repair_estimates
        SET grounding_hours = ?, grounding_cost = ?, non_grounding_hours = ?, non_grounding_cost = ?,
            updated_at = datetime('now')
        WHERE id = ?
      `).run(grounding_hours, grounding_cost, non_grounding_hours, non_grounding_cost, req.params.id);
      res.json({ success: true });
    } catch (err) {
      logger.error(TAG, 'Update repair estimate error', err);
      res.status(500).json({ error: 'Failed to update repair estimate' });
    }
  });

  return router;
}
