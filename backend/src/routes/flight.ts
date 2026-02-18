import { Router } from 'express';
import type { TelemetryService } from '../services/telemetry.js';

export function flightRouter(telemetry: TelemetryService): Router {
  const router = Router();

  router.get('/flight', (_req, res) => {
    res.json(telemetry.getFlightData());
  });

  return router;
}
