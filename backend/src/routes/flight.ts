import { Router } from 'express';
import type { TelemetryService } from '../services/telemetry.js';

export function flightRouter(telemetry: TelemetryService, simconnectEnabled: boolean): Router {
  const router = Router();

  router.get('/flight', (_req, res) => {
    if (!simconnectEnabled) {
      res.json({ status: 'simconnect_unavailable' });
      return;
    }
    res.json(telemetry.getFlightData());
  });

  return router;
}
