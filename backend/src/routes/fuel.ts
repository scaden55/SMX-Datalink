import { Router } from 'express';
import type { TelemetryService } from '../services/telemetry.js';

export function fuelRouter(telemetry: TelemetryService, simconnectEnabled: boolean): Router {
  const router = Router();

  router.get('/fuel', (_req, res) => {
    if (!simconnectEnabled) {
      res.json({ status: 'simconnect_unavailable' });
      return;
    }
    res.json(telemetry.getFuelData());
  });

  return router;
}
