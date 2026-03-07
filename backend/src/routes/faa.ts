import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { logger } from '../lib/logger.js';

const FAA_NAS_URL = 'https://nasstatus.faa.gov/api/airport-events';
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

let cachedData: unknown = null;
let cachedAt = 0;

export function faaRouter(): Router {
  const router = Router();

  // GET /api/faa/airport-events — proxy FAA NAS status with 5-min cache
  router.get('/faa/airport-events', authMiddleware, async (_req, res) => {
    try {
      const now = Date.now();
      if (cachedData && now - cachedAt < CACHE_TTL) {
        res.json(cachedData);
        return;
      }

      const upstream = await fetch(FAA_NAS_URL);
      if (!upstream.ok) {
        logger.warn('FAA', `Upstream returned ${upstream.status}`);
        // Return stale cache if available
        if (cachedData) {
          res.json(cachedData);
          return;
        }
        res.status(502).json({ error: 'FAA API unavailable' });
        return;
      }

      const json = await upstream.json();
      cachedData = json;
      cachedAt = now;
      res.json(json);
    } catch (err) {
      logger.error('FAA', 'Proxy error', err);
      // Return stale cache on network error
      if (cachedData) {
        res.json(cachedData);
        return;
      }
      res.status(502).json({ error: 'Failed to fetch FAA data' });
    }
  });

  return router;
}
