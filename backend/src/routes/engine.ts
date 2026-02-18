import { Router } from 'express';
import type { TelemetryService } from '../services/telemetry.js';

export function engineRouter(telemetry: TelemetryService): Router {
  const router = Router();

  router.get('/engine', (_req, res) => {
    res.json(telemetry.getEngineData());
  });

  return router;
}
