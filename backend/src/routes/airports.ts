import { Router } from 'express';
import { AirportDetailService } from '../services/airport-detail.js';

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
      console.error('[AirportDetail] Map airports error:', err);
      return res.status(500).json({ error: 'Failed to fetch map airports' });
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
      console.error('[AirportDetail] Error:', err);
      return res.status(500).json({ error: 'Failed to fetch airport detail' });
    }
  });

  return router;
}
