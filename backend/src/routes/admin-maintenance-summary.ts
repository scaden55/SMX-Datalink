import { Router } from 'express';
import { getDb } from '../db/index.js';
import { authMiddleware, dispatcherMiddleware } from '../middleware/auth.js';
import { logger } from '../lib/logger.js';

export function adminMaintenanceSummaryRouter(): Router {
  const router = Router();

  router.get('/admin/dashboard/maintenance-summary', authMiddleware, dispatcherMiddleware, (_req, res) => {
    try {
      const db = getDb();

      // Fleet status counts
      const activeAircraft = db.prepare(`SELECT id FROM fleet WHERE status = 'active'`).all() as { id: number }[];
      const melAircraftIds = db.prepare(`SELECT DISTINCT aircraft_id FROM mel_deferrals WHERE status = 'open'`).all() as { aircraft_id: number }[];
      const melIdSet = new Set(melAircraftIds.map(r => r.aircraft_id));

      let airworthy = 0;
      let melDispatch = 0;
      for (const ac of activeAircraft) {
        if (melIdSet.has(ac.id)) {
          melDispatch++;
        } else {
          airworthy++;
        }
      }

      const inCheckCount = (db.prepare(`SELECT COUNT(DISTINCT aircraft_id) as c FROM maintenance_log WHERE status = 'in_progress'`).get() as { c: number }).c;
      const aogCount = (db.prepare(`SELECT COUNT(*) as c FROM fleet WHERE status = 'maintenance'`).get() as { c: number }).c;

      // Critical MEL deferrals expiring within 48 hours
      const criticalMel = db.prepare(`
        SELECT
          f.registration,
          m.category,
          m.title,
          m.expiry_date AS expiryDate,
          ROUND((julianday(m.expiry_date) - julianday('now')) * 24, 1) AS hoursRemaining
        FROM mel_deferrals m
        JOIN fleet f ON f.id = m.aircraft_id
        WHERE m.status = 'open'
          AND m.expiry_date < datetime('now', '+48 hours')
          AND m.expiry_date > datetime('now')
        ORDER BY m.expiry_date ASC
      `).all();

      // Next scheduled checks — compute hours remaining per check type per aircraft
      const nextChecks = db.prepare(`
        SELECT
          f.registration,
          mc.check_type AS checkType,
          mc.interval_hours AS intervalHours,
          CASE mc.check_type
            WHEN 'A' THEN mc.interval_hours - (ah.total_hours - ah.hours_at_last_a)
            WHEN 'B' THEN mc.interval_hours - (ah.total_hours - ah.hours_at_last_b)
            WHEN 'C' THEN mc.interval_hours - (ah.total_hours - ah.hours_at_last_c)
            ELSE NULL
          END AS hoursRemaining,
          CASE mc.check_type
            WHEN 'A' THEN ROUND((mc.interval_hours - (ah.total_hours - ah.hours_at_last_a)) / mc.interval_hours * 100, 1)
            WHEN 'B' THEN ROUND((mc.interval_hours - (ah.total_hours - ah.hours_at_last_b)) / mc.interval_hours * 100, 1)
            WHEN 'C' THEN ROUND((mc.interval_hours - (ah.total_hours - ah.hours_at_last_c)) / mc.interval_hours * 100, 1)
            ELSE NULL
          END AS pctRemaining
        FROM aircraft_hours ah
        JOIN fleet f ON f.id = ah.aircraft_id
        JOIN maintenance_checks mc ON mc.icao_type = f.icao_type
        WHERE f.status IN ('active', 'maintenance')
          AND mc.interval_hours IS NOT NULL
        ORDER BY hoursRemaining ASC
        LIMIT 10
      `).all();

      // Open discrepancy counts
      const discrepancyCounts = db.prepare(`
        SELECT
          COALESCE(SUM(CASE WHEN status = 'open' THEN 1 ELSE 0 END), 0) AS open,
          COALESCE(SUM(CASE WHEN status = 'in_review' THEN 1 ELSE 0 END), 0) AS inReview,
          COALESCE(SUM(CASE WHEN status = 'deferred' THEN 1 ELSE 0 END), 0) AS deferred
        FROM discrepancies
        WHERE status IN ('open', 'in_review', 'deferred')
      `).get() as { open: number; inReview: number; deferred: number };

      res.json({
        fleetStatus: { airworthy, melDispatch, inCheck: inCheckCount, aog: aogCount },
        criticalMel,
        nextChecks,
        openDiscrepancies: {
          open: discrepancyCounts.open,
          inReview: discrepancyCounts.inReview,
          deferred: discrepancyCounts.deferred,
        },
      });
    } catch (err) {
      logger.error('Admin', 'Failed to fetch maintenance summary', err);
      res.status(500).json({ error: 'Failed to fetch maintenance summary' });
    }
  });

  return router;
}
