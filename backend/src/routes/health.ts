import { Router } from 'express';
import type { ISimConnectManager } from '../simconnect/types.js';

export function healthRouter(simConnect: ISimConnectManager): Router {
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
