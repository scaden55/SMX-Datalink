import { Router } from 'express';
import { performance } from 'perf_hooks';
import type { ISimConnectManager } from '../simconnect/types.js';
import { getDb } from '../db/index.js';
import { authMiddleware, adminMiddleware } from '../middleware/auth.js';
import type { Server as SocketServer } from 'socket.io';

/** Track startup time for uptime display */
const startedAt = new Date().toISOString();

export function healthRouter(simConnect: ISimConnectManager, io?: SocketServer): Router {
  const router = Router();

  // GET /api/health — public, lightweight liveness probe
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

  // GET /api/admin/server-status — admin-only, detailed diagnostics
  router.get('/admin/server-status', authMiddleware, adminMiddleware, (_req, res) => {
    const mem = process.memoryUsage();
    const cpu = process.cpuUsage();

    // Database stats
    let dbStats: Record<string, unknown> = {};
    try {
      const db = getDb();
      const pageCount = (db.pragma('page_count') as { page_count: number }[])[0]?.page_count ?? 0;
      const pageSize = (db.pragma('page_size') as { page_size: number }[])[0]?.page_size ?? 0;
      const freePages = (db.pragma('freelist_count') as { freelist_count: number }[])[0]?.freelist_count ?? 0;

      const tokenCount = (db.prepare('SELECT COUNT(*) AS count FROM refresh_tokens').get() as { count: number })?.count ?? 0;
      const activeUsers = (db.prepare(
        "SELECT COUNT(*) AS count FROM users WHERE last_login_at > datetime('now', '-30 days')"
      ).get() as { count: number })?.count ?? 0;
      const totalUsers = (db.prepare('SELECT COUNT(*) AS count FROM users').get() as { count: number })?.count ?? 0;

      dbStats = {
        status: 'ok',
        sizeBytes: pageCount * pageSize,
        sizeMb: Math.round((pageCount * pageSize) / 1024 / 1024 * 100) / 100,
        freePages,
        activeRefreshTokens: tokenCount,
        totalUsers,
        activeUsers30d: activeUsers,
      };
    } catch (err) {
      dbStats = { status: 'error', error: String(err) };
    }

    // Socket.io metrics
    let socketStats: Record<string, unknown> = {};
    if (io && typeof (io as any).__getMetrics === 'function') {
      socketStats = (io as any).__getMetrics();
    }

    // Event loop utilization
    let elu: Record<string, number> | null = null;
    try {
      if (performance.eventLoopUtilization) {
        const raw = performance.eventLoopUtilization();
        elu = {
          idle: Math.round(raw.idle * 100) / 100,
          active: Math.round(raw.active * 100) / 100,
          utilization: Math.round(raw.utilization * 10000) / 100,
        };
      }
    } catch { /* not available */ }

    res.json({
      status: 'ok',
      startedAt,
      uptime: {
        seconds: Math.round(process.uptime()),
        human: formatUptime(process.uptime()),
      },
      process: {
        pid: process.pid,
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
      },
      memory: {
        rss: formatBytes(mem.rss),
        heapUsed: formatBytes(mem.heapUsed),
        heapTotal: formatBytes(mem.heapTotal),
        external: formatBytes(mem.external),
        arrayBuffers: formatBytes(mem.arrayBuffers),
        heapUsedPct: Math.round((mem.heapUsed / mem.heapTotal) * 100),
        raw: {
          rssBytes: mem.rss,
          heapUsedBytes: mem.heapUsed,
          heapTotalBytes: mem.heapTotal,
          externalBytes: mem.external,
        },
      },
      cpu: {
        userMicros: cpu.user,
        systemMicros: cpu.system,
      },
      sockets: socketStats,
      database: dbStats,
      simulator: simConnect.getConnectionStatus(),
      eventLoopUtilization: elu,
    });
  });

  return router;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const parts: string[] = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  if (m > 0) parts.push(`${m}m`);
  parts.push(`${s}s`);
  return parts.join(' ');
}
