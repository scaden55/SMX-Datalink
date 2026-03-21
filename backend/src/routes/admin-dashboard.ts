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

  // GET /api/admin/dashboard/active-flights — DB-backed active flights with route info
  router.get('/admin/dashboard/active-flights', authMiddleware, dispatcherMiddleware, (_req, res) => {
    try {
      const db = getDb();
      const rows = db.prepare(`
        SELECT
          ab.id AS bid_id,
          u.id AS user_id,
          u.callsign,
          sf.flight_number,
          sf.dep_icao,
          sf.arr_icao,
          sf.aircraft_type,
          COALESCE(d.lat, oa_d.latitude_deg) AS dep_lat,
          COALESCE(d.lon, oa_d.longitude_deg) AS dep_lon,
          COALESCE(a.lat, oa_a.latitude_deg) AS arr_lat,
          COALESCE(a.lon, oa_a.longitude_deg) AS arr_lon
        FROM active_bids ab
        JOIN users u ON u.id = ab.user_id
        JOIN scheduled_flights sf ON sf.id = ab.schedule_id
        LEFT JOIN airports d ON d.icao = sf.dep_icao
        LEFT JOIN airports a ON a.icao = sf.arr_icao
        LEFT JOIN oa_airports oa_d ON oa_d.ident = sf.dep_icao
        LEFT JOIN oa_airports oa_a ON oa_a.ident = sf.arr_icao
        WHERE ab.flight_plan_phase IN ('active', 'airborne')
      `).all();
      res.json(rows);
    } catch (err) {
      logger.error('Admin', 'Failed to fetch active flights', err);
      res.status(500).json({ error: 'Failed to fetch active flights' });
    }
  });

  return router;
}
