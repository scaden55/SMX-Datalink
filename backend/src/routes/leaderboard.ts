import { Router } from 'express';
import { LeaderboardService } from '../services/leaderboard.js';
import { authMiddleware } from '../middleware/auth.js';
import { logger } from '../lib/logger.js';

const MONTH_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/;

export function leaderboardRouter(): Router {
  const router = Router();
  const service = new LeaderboardService();

  // GET /api/leaderboard?month=YYYY-MM  (defaults to current month)
  router.get('/leaderboard', authMiddleware, (req, res) => {
    try {
      const month = req.query.month as string | undefined;

      if (month && !MONTH_REGEX.test(month)) {
        res.status(400).json({ error: 'Invalid month format. Expected YYYY-MM.' });
        return;
      }

      const result = service.getLeaderboard(month || undefined);
      res.json(result);
    } catch (err) {
      logger.error('Leaderboard', 'Error', err);
      res.status(500).json({ error: 'Failed to fetch leaderboard' });
    }
  });

  return router;
}
