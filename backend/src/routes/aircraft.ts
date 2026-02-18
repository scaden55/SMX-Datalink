import { Router } from 'express';
import type { TelemetryService } from '../services/telemetry.js';

export function aircraftRouter(telemetry: TelemetryService, simconnectEnabled: boolean): Router {
  const router = Router();

  router.get('/aircraft', (_req, res) => {
    if (!simconnectEnabled) {
      res.json({ status: 'simconnect_unavailable' });
      return;
    }
    res.json(telemetry.getAircraftData());
  });

  return router;
}
