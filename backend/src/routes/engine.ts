import { Router } from 'express';
import type { TelemetryService } from '../services/telemetry.js';

export function engineRouter(telemetry: TelemetryService, simconnectEnabled: boolean): Router {
  const router = Router();

  router.get('/engine', (_req, res) => {
    if (!simconnectEnabled) {
      res.json({ status: 'simconnect_unavailable' });
      return;
    }
    res.json(telemetry.getEngineData());
  });

  return router;
}
