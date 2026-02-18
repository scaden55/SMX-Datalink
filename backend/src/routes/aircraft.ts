import { Router } from 'express';
import type { TelemetryService } from '../services/telemetry.js';

export function aircraftRouter(telemetry: TelemetryService): Router {
  const router = Router();

  router.get('/aircraft', (_req, res) => {
    res.json(telemetry.getAircraftData());
  });

  return router;
}
