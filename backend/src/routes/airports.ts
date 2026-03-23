import { Router } from 'express';
import { AirportDetailService } from '../services/airport-detail.js';
import { getDb } from '../db/index.js';
import { logger } from '../lib/logger.js';

export function airportDetailRouter(): Router {
  const router = Router();
  const service = new AirportDetailService();

  // GET /api/airports/map — minimal airport list for map labels (public, cached)
  router.get('/airports/map', (_req, res) => {
    try {
      const airports = service.getMapAirports();
      res.set('Cache-Control', 'public, max-age=3600');
      return res.json(airports);
    } catch (err) {
      logger.error('AirportDetail', 'Map airports error', err);
      return res.status(500).json({ error: 'Failed to fetch map airports' });
    }
  });

  // GET /api/airports/search?q=<query>&limit=10
  router.get('/airports/search', (req, res) => {
    try {
      const q = (req.query.q as string || '').trim();
      if (q.length < 2) {
        return res.json([]);
      }
      const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);
      const results = service.searchAirports(q, limit);
      return res.json(results);
    } catch (err) {
      logger.error('AirportDetail', 'Search error', err);
      return res.status(500).json({ error: 'Failed to search airports' });
    }
  });

  // GET /api/airports/runways/bbox?n=&s=&e=&w= — runways in viewport (public, cached)
  router.get('/airports/runways/bbox', (req, res) => {
    try {
      const n = parseFloat(req.query.n as string);
      const s = parseFloat(req.query.s as string);
      const e = parseFloat(req.query.e as string);
      const w = parseFloat(req.query.w as string);

      if ([n, s, e, w].some(v => isNaN(v))) {
        return res.status(400).json({ error: 'Missing or invalid bbox params (n, s, e, w)' });
      }
      if (s >= n || n > 90 || s < -90 || e > 180 || w < -180) {
        return res.status(400).json({ error: 'Invalid bbox range' });
      }

      const db = getDb();

      // Handle antimeridian: when w > e, the viewport crosses the date line
      const crossesAntimeridian = w > e;

      const lonCondition = crossesAntimeridian
        ? '((lon BETWEEN ? AND 180) OR (lon BETWEEN -180 AND ?))'
        : '(lon BETWEEN ? AND ?)';

      const sql = `
        SELECT airport_ident, le_ident, he_ident, length_ft, width_ft, surface,
               le_latitude_deg, le_longitude_deg, le_heading_degT, le_displaced_threshold_ft,
               he_latitude_deg, he_longitude_deg, he_heading_degT, he_displaced_threshold_ft
        FROM oa_runways
        WHERE closed != 1
          AND length_ft IS NOT NULL AND width_ft IS NOT NULL AND width_ft > 0
          AND le_latitude_deg IS NOT NULL AND le_longitude_deg IS NOT NULL
          AND he_latitude_deg IS NOT NULL AND he_longitude_deg IS NOT NULL
          AND surface NOT IN ('WATER')
          AND (
            (le_latitude_deg BETWEEN ? AND ? AND ${lonCondition.replace(/lon/g, 'le_longitude_deg')})
            OR
            (he_latitude_deg BETWEEN ? AND ? AND ${lonCondition.replace(/lon/g, 'he_longitude_deg')})
          )
        LIMIT 2000
      `;

      // Build params: s, n, w, e — twice (for le and he)
      const lonParams = [w, e];
      const params = [s, n, ...lonParams, s, n, ...lonParams];

      const rows = db.prepare(sql).all(...params);
      res.set('Cache-Control', 'public, max-age=3600');
      return res.json(rows);
    } catch (err) {
      logger.error('AirportDetail', 'Runway bbox error', err);
      return res.status(500).json({ error: 'Failed to fetch runways' });
    }
  });

  // GET /api/airports/:icao — public, no auth required
  router.get('/airports/:icao', (req, res) => {
    try {
      const { icao } = req.params;

      if (!icao || icao.length < 3 || icao.length > 4) {
        return res.status(400).json({ error: 'Invalid ICAO code' });
      }

      const detail = service.getByIcao(icao);

      if (!detail) {
        return res.status(404).json({ error: 'Airport not found' });
      }

      return res.json(detail);
    } catch (err) {
      logger.error('AirportDetail', 'Error', err);
      return res.status(500).json({ error: 'Failed to fetch airport detail' });
    }
  });

  return router;
}
