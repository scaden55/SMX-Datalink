import { Router } from 'express';
import { authMiddleware, adminMiddleware } from '../middleware/auth.js';
import { RegulatoryService } from '../services/regulatory.js';

export function regulatoryRouter(): Router {
  const router = Router();
  const service = new RegulatoryService();

  // GET /api/regulatory/assess — full regulatory assessment
  router.get('/regulatory/assess', authMiddleware, (req, res) => {
    try {
      const origin = (req.query.origin as string)?.trim();
      const dest = (req.query.dest as string)?.trim();
      if (!origin || !dest) {
        res.status(400).json({ error: 'origin and dest query params are required' });
        return;
      }

      const cruiseAlt = req.query.cruiseAlt ? Number(req.query.cruiseAlt) : undefined;
      const aircraftId = req.query.aircraftId ? Number(req.query.aircraftId) : undefined;
      const charterType = req.query.charterType as string | undefined;
      const includeRelease = req.query.includeRelease === 'true';

      // Optional coordinates for haversine distance
      const originLat = req.query.originLat ? Number(req.query.originLat) : undefined;
      const originLon = req.query.originLon ? Number(req.query.originLon) : undefined;
      const destLat = req.query.destLat ? Number(req.query.destLat) : undefined;
      const destLon = req.query.destLon ? Number(req.query.destLon) : undefined;

      const assessment = service.assess({
        origin,
        dest,
        cruiseAlt,
        aircraftId,
        charterType,
        includeRelease,
        originLat,
        originLon,
        destLat,
        destLon,
      });

      res.json(assessment);
    } catch (err) {
      console.error('[Regulatory] Assess error:', err);
      res.status(500).json({ error: 'Failed to assess regulatory requirements' });
    }
  });

  // GET /api/regulatory/classify — lightweight classification only
  router.get('/regulatory/classify', authMiddleware, (req, res) => {
    try {
      const origin = (req.query.origin as string)?.trim();
      const dest = (req.query.dest as string)?.trim();
      if (!origin || !dest) {
        res.status(400).json({ error: 'origin and dest query params are required' });
        return;
      }

      const charterType = req.query.charterType as string | undefined;
      const result = service.classifyFlight(origin, dest, charterType);
      res.json(result);
    } catch (err) {
      console.error('[Regulatory] Classify error:', err);
      res.status(500).json({ error: 'Failed to classify flight' });
    }
  });

  // GET /api/regulatory/opspecs — list all OpSpecs
  router.get('/regulatory/opspecs', authMiddleware, (req, res) => {
    try {
      const opspecs = service.findAllOpSpecs();
      res.json({ opspecs });
    } catch (err) {
      console.error('[Regulatory] List OpSpecs error:', err);
      res.status(500).json({ error: 'Failed to list OpSpecs' });
    }
  });

  // PATCH /api/regulatory/opspecs/:id — update OpSpec (admin only)
  router.patch('/regulatory/opspecs/:id', authMiddleware, adminMiddleware, (req, res) => {
    try {
      const id = Number(req.params.id);
      if (isNaN(id)) {
        res.status(400).json({ error: 'Invalid OpSpec ID' });
        return;
      }

      const { isActive, enforcement, description } = req.body as {
        isActive?: boolean;
        enforcement?: string;
        description?: string;
      };

      const updated = service.updateOpSpec(id, { isActive, enforcement, description });
      if (!updated) {
        res.status(404).json({ error: 'OpSpec not found' });
        return;
      }

      res.json(updated);
    } catch (err) {
      console.error('[Regulatory] Update OpSpec error:', err);
      res.status(500).json({ error: 'Failed to update OpSpec' });
    }
  });

  return router;
}
