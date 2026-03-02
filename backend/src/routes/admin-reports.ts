import { Router } from 'express';
import { authMiddleware, dispatcherMiddleware } from '../middleware/auth.js';
import { getDb } from '../db/index.js';
import {
  getFlightHours,
  getLandingRates,
  getFuelEfficiency,
  getOnTimePerformance,
  getRoutePopularity,
  getRouteProfitability,
  getFleetUtilization,
} from '../services/admin-reports.js';
import { logger } from '../lib/logger.js';

/**
 * Parses `from` and `to` query params, defaulting to last 30 days if missing.
 */
function parseDateRange(query: { from?: string; to?: string }): {
  from: string;
  to: string;
} {
  const now = new Date();
  const toDate = query.to || now.toISOString().slice(0, 10);

  let fromDate: string;
  if (query.from) {
    fromDate = query.from;
  } else {
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    fromDate = thirtyDaysAgo.toISOString().slice(0, 10);
  }

  return { from: fromDate, to: toDate };
}

export function adminReportsRouter(): Router {
  const router = Router();

  // GET /api/admin/reports/flight-hours?from=&to=
  router.get(
    '/admin/reports/flight-hours',
    authMiddleware,
    dispatcherMiddleware,
    (req, res) => {
      try {
        const { from, to } = parseDateRange(
          req.query as { from?: string; to?: string },
        );
        const data = getFlightHours(getDb(), from, to);
        res.json(data);
      } catch (err) {
        logger.error('AdminReports', 'Failed to fetch flight hours', err);
        res.status(500).json({ error: 'Failed to fetch flight hours' });
      }
    },
  );

  // GET /api/admin/reports/landing-rates?from=&to=
  router.get(
    '/admin/reports/landing-rates',
    authMiddleware,
    dispatcherMiddleware,
    (req, res) => {
      try {
        const { from, to } = parseDateRange(
          req.query as { from?: string; to?: string },
        );
        const data = getLandingRates(getDb(), from, to);
        res.json(data);
      } catch (err) {
        logger.error('AdminReports', 'Failed to fetch landing rates', err);
        res.status(500).json({ error: 'Failed to fetch landing rates' });
      }
    },
  );

  // GET /api/admin/reports/fuel-efficiency?from=&to=
  router.get(
    '/admin/reports/fuel-efficiency',
    authMiddleware,
    dispatcherMiddleware,
    (req, res) => {
      try {
        const { from, to } = parseDateRange(
          req.query as { from?: string; to?: string },
        );
        const data = getFuelEfficiency(getDb(), from, to);
        res.json(data);
      } catch (err) {
        logger.error('AdminReports', 'Failed to fetch fuel efficiency', err);
        res.status(500).json({ error: 'Failed to fetch fuel efficiency' });
      }
    },
  );

  // GET /api/admin/reports/on-time?from=&to=
  router.get(
    '/admin/reports/on-time',
    authMiddleware,
    dispatcherMiddleware,
    (req, res) => {
      try {
        const { from, to } = parseDateRange(
          req.query as { from?: string; to?: string },
        );
        const data = getOnTimePerformance(getDb(), from, to);
        res.json(data);
      } catch (err) {
        logger.error('AdminReports', 'Failed to fetch on-time performance', err);
        res.status(500).json({ error: 'Failed to fetch on-time performance' });
      }
    },
  );

  // GET /api/admin/reports/route-popularity?from=&to=
  router.get(
    '/admin/reports/route-popularity',
    authMiddleware,
    dispatcherMiddleware,
    (req, res) => {
      try {
        const { from, to } = parseDateRange(
          req.query as { from?: string; to?: string },
        );
        const data = getRoutePopularity(getDb(), from, to);
        res.json(data);
      } catch (err) {
        logger.error('AdminReports', 'Failed to fetch route popularity', err);
        res.status(500).json({ error: 'Failed to fetch route popularity' });
      }
    },
  );

  // GET /api/admin/reports/route-profitability?from=&to=
  router.get(
    '/admin/reports/route-profitability',
    authMiddleware,
    dispatcherMiddleware,
    (req, res) => {
      try {
        const { from, to } = parseDateRange(
          req.query as { from?: string; to?: string },
        );
        const data = getRouteProfitability(getDb(), from, to);
        res.json(data);
      } catch (err) {
        logger.error('AdminReports', 'Failed to fetch route profitability', err);
        res.status(500).json({ error: 'Failed to fetch route profitability' });
      }
    },
  );

  // GET /api/admin/reports/fleet-utilization?from=&to=
  router.get(
    '/admin/reports/fleet-utilization',
    authMiddleware,
    dispatcherMiddleware,
    (req, res) => {
      try {
        const { from, to } = parseDateRange(
          req.query as { from?: string; to?: string },
        );
        const data = getFleetUtilization(getDb(), from, to);
        res.json(data);
      } catch (err) {
        logger.error('AdminReports', 'Failed to fetch fleet utilization', err);
        res.status(500).json({ error: 'Failed to fetch fleet utilization' });
      }
    },
  );

  return router;
}
