import { Router } from 'express';
import { ReportsService } from '../services/reports.js';
import { authMiddleware } from '../middleware/auth.js';

const MONTH_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/;

export function reportsRouter(): Router {
  const router = Router();
  const service = new ReportsService();

  // GET /api/reports?month=YYYY-MM  (omit month for all-time)
  router.get('/reports', authMiddleware, (req, res) => {
    try {
      const month = req.query.month as string | undefined;

      if (month && !MONTH_REGEX.test(month)) {
        res.status(400).json({ error: 'Invalid month format. Expected YYYY-MM.' });
        return;
      }

      const report = service.getReport(month || undefined);
      res.json(report);
    } catch (err) {
      console.error('[Reports] Error:', err);
      res.status(500).json({ error: 'Failed to generate report' });
    }
  });

  return router;
}
