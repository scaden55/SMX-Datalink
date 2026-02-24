import { Router } from 'express';
import { TrackService } from '../services/track.js';
import { getDb } from '../db/index.js';
import { authMiddleware } from '../middleware/auth.js';
import { logger } from '../lib/logger.js';

export function trackRouter(): Router {
  const router = Router();
  const service = new TrackService();

  // GET /api/flights/:bidId/track — fetch track points for a flight
  // Auth required: pilot can only fetch own, admin/dispatcher can fetch any
  router.get('/flights/:bidId/track', authMiddleware, (req, res) => {
    try {
      const bidId = parseInt(req.params.bidId as string, 10);
      if (isNaN(bidId)) {
        return res.status(400).json({ error: 'Invalid bid ID' });
      }

      // Check bid ownership (unless admin)
      const user = req.user!;
      if (user.role !== 'admin' && user.role !== 'dispatcher') {
        const bid = getDb()
          .prepare('SELECT user_id FROM active_bids WHERE id = ?')
          .get(bidId) as { user_id: number } | undefined;

        if (!bid || bid.user_id !== user.userId) {
          return res.status(403).json({ error: 'Not authorized to view this track' });
        }
      }

      const points = service.getTrack(bidId);
      return res.json({ bidId, points });
    } catch (err) {
      logger.error('Track', 'Error fetching track', err);
      return res.status(500).json({ error: 'Failed to fetch track' });
    }
  });

  return router;
}
