import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { CargoService } from '../services/cargo.js';
import { logger } from '../lib/logger.js';

export function cargoRouter(): Router {
  const router = Router();
  const service = new CargoService();

  // Generate cargo manifest for a flight
  router.post('/cargo/generate', authMiddleware, (req, res) => {
    try {
      const userId = req.user!.userId;
      const { flightId, aircraftIcao, payloadKg, payloadUnit, cargoMode, primaryCategory, useRealWorldCompanies } = req.body;

      if (!flightId || !aircraftIcao || payloadKg == null) {
        res.status(400).json({ error: 'flightId, aircraftIcao, and payloadKg are required' });
        return;
      }

      const manifest = service.generate({
        flightId,
        aircraftIcao,
        payloadKg,
        payloadUnit: payloadUnit || 'KGS',
        cargoMode: cargoMode || 'mixed',
        primaryCategory,
        useRealWorldCompanies,
      }, userId);

      res.json(manifest);
    } catch (err) {
      logger.error('Cargo', 'Generate error', err);
      res.status(500).json({ error: 'Failed to generate cargo manifest' });
    }
  });

  // Get cargo manifest for a flight
  router.get('/cargo/:flightId', authMiddleware, (req, res) => {
    try {
      const flightId = Number(req.params.flightId);
      if (isNaN(flightId)) {
        res.status(400).json({ error: 'Invalid flight ID' });
        return;
      }

      const manifest = service.getByFlightId(flightId);
      if (!manifest) {
        res.status(404).json({ error: 'No cargo manifest found for this flight' });
        return;
      }

      res.json(manifest);
    } catch (err) {
      logger.error('Cargo', 'Get error', err);
      res.status(500).json({ error: 'Failed to get cargo manifest' });
    }
  });

  // Delete cargo manifest (for regeneration)
  router.delete('/cargo/:manifestId', authMiddleware, (req, res) => {
    try {
      const userId = req.user!.userId;
      const manifestId = Number(req.params.manifestId);
      if (isNaN(manifestId)) {
        res.status(400).json({ error: 'Invalid manifest ID' });
        return;
      }

      const deleted = service.delete(manifestId, userId);
      if (!deleted) {
        res.status(404).json({ error: 'Manifest not found or not owned by user' });
        return;
      }

      res.json({ success: true });
    } catch (err) {
      logger.error('Cargo', 'Delete error', err);
      res.status(500).json({ error: 'Failed to delete cargo manifest' });
    }
  });

  return router;
}
