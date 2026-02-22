import { Router } from 'express';
import { NavdataService } from '../services/navdata.js';

export function navdataRouter(): Router {
  const router = Router();
  const service = new NavdataService();

  // GET /api/navdata/search?q=WAV&types=fix,VOR,NDB&limit=20
  router.get('/navdata/search', (req, res) => {
    try {
      const q = String(req.query.q ?? '').trim();
      if (!q) return res.status(400).json({ error: 'Missing q parameter' });

      const types = req.query.types
        ? String(req.query.types).split(',').map((t) => t.trim())
        : undefined;
      const limit = Math.min(Math.max(parseInt(String(req.query.limit)) || 20, 1), 50);

      const results = service.search(q, types, limit);
      res.set('Cache-Control', 'public, max-age=300');
      return res.json(results);
    } catch (err) {
      console.error('[Navdata] Search error:', err);
      return res.status(500).json({ error: 'Search failed' });
    }
  });

  // GET /api/navdata/route?fixes=KJFK,DCT,WAVEY,J6,LGA
  router.get('/navdata/route', (req, res) => {
    try {
      const fixesParam = String(req.query.fixes ?? '').trim();
      if (!fixesParam) return res.status(400).json({ error: 'Missing fixes parameter' });

      const tokens = fixesParam.split(',').map((t) => t.trim()).filter(Boolean);
      if (tokens.length === 0) return res.status(400).json({ error: 'No valid fixes' });
      if (tokens.length > 100) return res.status(400).json({ error: 'Too many fixes (max 100)' });

      const results = service.resolveRoute(tokens);
      res.set('Cache-Control', 'public, max-age=3600');
      return res.json(results);
    } catch (err) {
      console.error('[Navdata] Route resolve error:', err);
      return res.status(500).json({ error: 'Route resolution failed' });
    }
  });

  // GET /api/navdata/navaids?bounds=42,-75,40,-72&zoom=7&types=VOR,NDB
  router.get('/navdata/navaids', (req, res) => {
    try {
      const boundsParam = String(req.query.bounds ?? '').trim();
      const zoomParam = parseInt(String(req.query.zoom));

      if (!boundsParam) return res.status(400).json({ error: 'Missing bounds parameter' });
      if (isNaN(zoomParam)) return res.status(400).json({ error: 'Missing or invalid zoom' });

      const parts = boundsParam.split(',').map(Number);
      if (parts.length !== 4 || parts.some(isNaN)) {
        return res.status(400).json({ error: 'bounds must be latN,lonW,latS,lonE' });
      }

      const [latN, lonW, latS, lonE] = parts;
      const types = req.query.types
        ? String(req.query.types).split(',').map((t) => t.trim())
        : undefined;

      const results = service.getNavaidsInBounds(latN, lonW, latS, lonE, types, zoomParam);
      res.set('Cache-Control', 'public, max-age=60');
      return res.json(results);
    } catch (err) {
      console.error('[Navdata] Navaids viewport error:', err);
      return res.status(500).json({ error: 'Failed to fetch navaids' });
    }
  });

  return router;
}
