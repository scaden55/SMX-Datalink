import { Router } from 'express';
import { getDb } from '../db/index.js';
import { authMiddleware, dispatcherMiddleware } from '../middleware/auth.js';
import { logger } from '../lib/logger.js';

export function adminFlightActivityRouter(): Router {
  const router = Router();

  router.get('/admin/dashboard/flight-activity', authMiddleware, dispatcherMiddleware, (_req, res) => {
    try {
      const db = getDb();

      // Scheduled flights (active bids) — next upcoming departures
      const scheduled = db.prepare(`
        SELECT
          sf.flight_number AS flightNumber,
          u.callsign,
          sf.dep_icao AS depIcao,
          sf.arr_icao AS arrIcao,
          sf.dep_time AS depTime
        FROM active_bids ab
        JOIN scheduled_flights sf ON sf.id = ab.schedule_id
        JOIN users u ON u.id = ab.user_id
        WHERE sf.is_active = 1
        ORDER BY sf.dep_time ASC
        LIMIT 5
      `).all();

      // Recently completed flights (last 24 hours)
      const completed = db.prepare(`
        SELECT
          l.flight_number AS flightNumber,
          u.callsign,
          l.dep_icao AS depIcao,
          l.arr_icao AS arrIcao,
          l.actual_arr AS completedAt
        FROM logbook l
        JOIN users u ON u.id = l.user_id
        WHERE l.created_at > datetime('now', '-24 hours')
          AND l.status IN ('completed', 'approved')
        ORDER BY l.actual_arr DESC
        LIMIT 5
      `).all();

      res.json({ scheduled, completed });
    } catch (err) {
      logger.error('Admin', 'Failed to fetch flight activity', err);
      res.status(500).json({ error: 'Failed to fetch flight activity' });
    }
  });

  return router;
}
