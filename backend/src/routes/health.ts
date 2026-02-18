import { Router } from 'express';
import type { SimConnectManager } from '../simconnect/connection.js';

export function healthRouter(simConnect: SimConnectManager): Router {
  const router = Router();

  router.get('/health', (_req, res) => {
    const status = simConnect.getConnectionStatus();
    res.json({
      status: 'ok',
      uptime: process.uptime(),
      simulator: status,
    });
  });

  return router;
}
