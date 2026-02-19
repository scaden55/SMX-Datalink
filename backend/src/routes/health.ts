import { Router } from 'express';
import type { ISimConnectManager } from '../simconnect/types.js';
import { getDb } from '../db/index.js';

export function healthRouter(simConnect: ISimConnectManager): Router {
  const router = Router();

  router.get('/health', (_req, res) => {
    const simStatus = simConnect.getConnectionStatus();

    let dbOk = false;
    try {
      const row = getDb().prepare('SELECT 1 AS ok').get() as { ok: number } | undefined;
      dbOk = row?.ok === 1;
    } catch { /* db unavailable */ }

    const healthy = dbOk;
    res.status(healthy ? 200 : 503).json({
      status: healthy ? 'ok' : 'degraded',
      uptime: process.uptime(),
      database: dbOk ? 'ok' : 'unavailable',
      simulator: simStatus,
    });
  });

  return router;
}
