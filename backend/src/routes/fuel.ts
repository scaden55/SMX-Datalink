import { Router } from 'express';
import type { TelemetryService } from '../services/telemetry.js';

export function fuelRouter(telemetry: TelemetryService): Router {
  const router = Router();

  router.get('/fuel', (_req, res) => {
    res.json(telemetry.getFuelData());
  });

  return router;
}
