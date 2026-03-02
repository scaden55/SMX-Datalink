import { Router } from 'express';
import { authMiddleware, dispatcherMiddleware } from '../middleware/auth.js';
import { getDb } from '../db/index.js';
import { logger } from '../lib/logger.js';

export function adminSearchRouter(): Router {
  const router = Router();

  // GET /api/admin/search?q=<query>
  router.get('/admin/search', authMiddleware, dispatcherMiddleware, (req, res) => {
    try {
      const q = (req.query.q as string || '').trim();
      if (!q || q.length < 2) {
        res.json({ users: [], flights: [], aircraft: [], schedules: [] });
        return;
      }

      const db = getDb();
      const like = `%${q}%`;

      // Users: search callsign, name, email (limit 5)
      const users = db.prepare(`
        SELECT id, callsign, first_name || ' ' || last_name AS name, role
        FROM users
        WHERE callsign LIKE ? OR first_name || ' ' || last_name LIKE ? OR email LIKE ?
        LIMIT 5
      `).all(like, like, like);

      // Flights (logbook): search flight_number, dep_icao, arr_icao (limit 5)
      const flights = db.prepare(`
        SELECT l.id, l.flight_number AS flightNumber,
               l.dep_icao || ' → ' || l.arr_icao AS route,
               l.status
        FROM logbook l
        WHERE l.flight_number LIKE ? OR l.dep_icao LIKE ? OR l.arr_icao LIKE ?
        ORDER BY l.created_at DESC
        LIMIT 5
      `).all(like, like, like);

      // Aircraft (fleet): search registration (limit 5)
      const aircraft = db.prepare(`
        SELECT id, registration, icao_type AS type, status
        FROM fleet
        WHERE registration LIKE ? OR icao_type LIKE ?
        LIMIT 5
      `).all(like, like);

      // Schedules: search flight_number, dep/arr (limit 5)
      const schedules = db.prepare(`
        SELECT id, flight_number AS flightNumber,
               dep_icao || ' → ' || arr_icao AS route
        FROM scheduled_flights
        WHERE flight_number LIKE ? OR dep_icao LIKE ? OR arr_icao LIKE ?
        LIMIT 5
      `).all(like, like, like);

      res.json({ users, flights, aircraft, schedules });
    } catch (err) {
      logger.error('AdminSearch', 'Search error', err);
      res.status(500).json({ error: 'Search failed' });
    }
  });

  return router;
}
