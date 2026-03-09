import { Router } from 'express';
import { authMiddleware, adminMiddleware } from '../middleware/auth.js';
import { getDb } from '../db/index.js';
import { logger } from '../lib/logger.js';

export function adminRevenueModelRouter(): Router {
  const router = Router();
  const auth = [authMiddleware, adminMiddleware] as const;

  // GET - return current config
  router.get('/admin/revenue-model', ...auth, (_req, res) => {
    try {
      const config = getDb().prepare('SELECT * FROM revenue_model_config WHERE id = 1').get();
      res.json(config);
    } catch (err) {
      logger.error('RevenueModel', 'Get config error', err);
      res.status(500).json({ error: 'Failed to get revenue model config' });
    }
  });

  // PUT - update config
  router.put('/admin/revenue-model', ...auth, (req, res) => {
    try {
      const fields = [
        'class_i_standard', 'class_i_nonstandard', 'class_i_hazard',
        'class_ii_standard', 'class_ii_nonstandard', 'class_ii_hazard',
        'class_iii_standard', 'class_iii_nonstandard', 'class_iii_hazard',
        'pilot_pay_per_hour',
        'manifest_std_pct', 'manifest_nonstd_pct', 'manifest_hazard_pct',
        'reference_nm',
      ];

      const setClauses: string[] = [];
      const values: unknown[] = [];

      for (const field of fields) {
        if (req.body[field] !== undefined) {
          setClauses.push(`${field} = ?`);
          values.push(Number(req.body[field]));
        }
      }

      if (setClauses.length === 0) {
        return res.status(400).json({ error: 'No valid fields provided' });
      }

      setClauses.push("updated_at = datetime('now')");
      values.push(1); // WHERE id = 1

      getDb().prepare(`UPDATE revenue_model_config SET ${setClauses.join(', ')} WHERE id = ?`).run(...values);

      const updated = getDb().prepare('SELECT * FROM revenue_model_config WHERE id = 1').get();
      res.json(updated);
    } catch (err) {
      logger.error('RevenueModel', 'Update config error', err);
      res.status(500).json({ error: 'Failed to update revenue model config' });
    }
  });

  return router;
}
