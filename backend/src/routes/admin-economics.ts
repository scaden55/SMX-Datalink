import { Router, Request, Response } from 'express';
import { authMiddleware, adminMiddleware } from '../middleware/auth.js';
import { getDb } from '../db/index.js';
import { logger } from '../lib/logger.js';
import { FlightCostEngine } from '../services/flight-cost-engine.js';
import { MonthlyCloseService } from '../services/monthly-close.js';

const TAG = 'AdminEconomics';

export function adminEconomicsRouter(): Router {
  const router = Router();

  // ── Flight P&L (paginated) ──────────────────────────────────────
  router.get('/admin/economics/flight-pnl', authMiddleware, adminMiddleware, (req: Request, res: Response) => {
    try {
      const db = getDb();
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize as string) || 25));
      const offset = (page - 1) * pageSize;
      const aircraftId = req.query.aircraftId as string | undefined;

      let countSql = 'SELECT COUNT(*) AS total FROM finance_flight_pnl fp';
      let dataSql = `
        SELECT fp.*, l.flight_number, u.callsign as pilot_callsign
        FROM finance_flight_pnl fp
        LEFT JOIN logbook l ON l.id = fp.logbook_id
        LEFT JOIN users u ON u.id = fp.pilot_id
      `;
      const params: unknown[] = [];

      if (aircraftId) {
        const whereClause = ' WHERE fp.aircraft_id = ?';
        countSql += whereClause;
        dataSql += whereClause;
        params.push(aircraftId);
      }

      dataSql += ' ORDER BY fp.created_at DESC LIMIT ? OFFSET ?';

      const totalRow = db.prepare(countSql).get(...params) as { total: number };
      const rows = db.prepare(dataSql).all(...params, pageSize, offset);

      res.json({
        data: rows,
        total: totalRow.total,
        page,
        pageSize,
        totalPages: Math.ceil(totalRow.total / pageSize),
      });
    } catch (err) {
      logger.error(TAG, 'Failed to fetch flight P&L list', err);
      res.status(500).json({ error: 'Failed to fetch flight P&L data' });
    }
  });

  // ── Single flight P&L by pirep ID ──────────────────────────────
  router.get('/admin/economics/flight-pnl/:pirepId', authMiddleware, adminMiddleware, (req: Request, res: Response) => {
    try {
      const db = getDb();
      const row = db.prepare(`
        SELECT fp.*, l.flight_number, u.callsign as pilot_callsign
        FROM finance_flight_pnl fp
        LEFT JOIN logbook l ON l.id = fp.logbook_id
        LEFT JOIN users u ON u.id = fp.pilot_id
        WHERE fp.logbook_id = ?
      `).get(req.params.pirepId);

      if (!row) {
        return res.status(404).json({ error: 'Flight P&L not found' });
      }
      res.json(row);
    } catch (err) {
      logger.error(TAG, 'Failed to fetch flight P&L detail', err);
      res.status(500).json({ error: 'Failed to fetch flight P&L detail' });
    }
  });

  // ── Period P&L summaries ───────────────────────────────────────
  router.get('/admin/economics/period-pnl', authMiddleware, adminMiddleware, (_req: Request, res: Response) => {
    try {
      const db = getDb();
      const rows = db.prepare('SELECT * FROM finance_period_pnl ORDER BY period_key DESC').all();
      res.json(rows);
    } catch (err) {
      logger.error(TAG, 'Failed to fetch period P&L', err);
      res.status(500).json({ error: 'Failed to fetch period P&L data' });
    }
  });

  // ── Single period P&L detail ───────────────────────────────────
  router.get('/admin/economics/period-pnl/:periodKey', authMiddleware, adminMiddleware, (req: Request, res: Response) => {
    try {
      const db = getDb();
      const row = db.prepare('SELECT * FROM finance_period_pnl WHERE period_key = ?').get(req.params.periodKey);
      if (!row) {
        return res.status(404).json({ error: 'Period P&L not found' });
      }
      res.json(row);
    } catch (err) {
      logger.error(TAG, 'Failed to fetch period P&L detail', err);
      res.status(500).json({ error: 'Failed to fetch period P&L detail' });
    }
  });

  // ── Lane rates ─────────────────────────────────────────────────
  router.get('/admin/economics/lane-rates', authMiddleware, adminMiddleware, (_req: Request, res: Response) => {
    try {
      const db = getDb();
      const rows = db.prepare('SELECT * FROM finance_lane_rates ORDER BY rate_per_lb DESC').all();
      res.json(rows);
    } catch (err) {
      logger.error(TAG, 'Failed to fetch lane rates', err);
      res.status(500).json({ error: 'Failed to fetch lane rates' });
    }
  });

  // ── Airport fee tiers ──────────────────────────────────────────
  router.get('/admin/economics/airport-tiers', authMiddleware, adminMiddleware, (_req: Request, res: Response) => {
    try {
      const db = getDb();
      const rows = db.prepare('SELECT * FROM airport_fee_tiers').all();
      res.json(rows);
    } catch (err) {
      logger.error(TAG, 'Failed to fetch airport fee tiers', err);
      res.status(500).json({ error: 'Failed to fetch airport fee tiers' });
    }
  });

  // ── Update airport fee tier ────────────────────────────────────
  router.put('/admin/economics/airport-tiers/:tier', authMiddleware, adminMiddleware, (req: Request, res: Response) => {
    try {
      const db = getDb();
      const { landingPer1000lbs, handlingPer1000lbs, parkingPerHour, navPerNm, fuelPricePerLb } = req.body;
      const tier = req.params.tier;

      const result = db.prepare(`
        UPDATE airport_fee_tiers
        SET landing_per_1000lbs = ?, handling_per_1000lbs = ?, parking_per_hour = ?, nav_per_nm = ?, fuel_price_per_lb = ?
        WHERE tier = ?
      `).run(landingPer1000lbs, handlingPer1000lbs, parkingPerHour, navPerNm, fuelPricePerLb, tier);

      if (result.changes === 0) {
        return res.status(404).json({ error: 'Tier not found' });
      }
      res.json({ message: 'Tier updated' });
    } catch (err) {
      logger.error(TAG, 'Failed to update airport fee tier', err);
      res.status(500).json({ error: 'Failed to update airport fee tier' });
    }
  });

  // ── Sim settings (finance_rate_config) ─────────────────────────
  router.get('/admin/economics/sim-settings', authMiddleware, adminMiddleware, (_req: Request, res: Response) => {
    try {
      const db = getDb();
      const rows = db.prepare('SELECT key, value FROM finance_rate_config').all() as Array<{ key: string; value: string }>;
      const settings: Record<string, string> = {};
      for (const row of rows) {
        settings[row.key] = row.value;
      }
      res.json(settings);
    } catch (err) {
      logger.error(TAG, 'Failed to fetch sim settings', err);
      res.status(500).json({ error: 'Failed to fetch sim settings' });
    }
  });

  // ── Update sim settings ────────────────────────────────────────
  router.put('/admin/economics/sim-settings', authMiddleware, adminMiddleware, (req: Request, res: Response) => {
    try {
      const db = getDb();
      const entries = Object.entries(req.body) as Array<[string, string]>;

      if (entries.length === 0) {
        return res.status(400).json({ error: 'No settings provided' });
      }

      const upsert = db.prepare(`
        INSERT INTO finance_rate_config (key, value) VALUES (?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value
      `);

      const runAll = db.transaction(() => {
        for (const [key, value] of entries) {
          upsert.run(key, String(value));
        }
      });
      runAll();

      // Invalidate FlightCostEngine cache so new rates take effect
      const costEngine = new FlightCostEngine();
      costEngine.invalidateCache();

      res.json({ message: `Updated ${entries.length} setting(s)` });
    } catch (err) {
      logger.error(TAG, 'Failed to update sim settings', err);
      res.status(500).json({ error: 'Failed to update sim settings' });
    }
  });

  // ── Manual monthly close ───────────────────────────────────────
  router.post('/admin/economics/close-month', authMiddleware, adminMiddleware, (_req: Request, res: Response) => {
    try {
      const monthlyClose = new MonthlyCloseService();
      const periodKey = monthlyClose.triggerManualClose();
      res.json({ periodKey, message: 'Monthly close completed' });
    } catch (err) {
      logger.error(TAG, 'Failed to trigger monthly close', err);
      res.status(500).json({ error: 'Failed to trigger monthly close' });
    }
  });

  // ── Fleet financials ───────────────────────────────────────────
  router.get('/admin/economics/fleet-financials', authMiddleware, adminMiddleware, (_req: Request, res: Response) => {
    try {
      const db = getDb();
      const rows = db.prepare(`
        SELECT id, registration, icao_type, name, status, acquisition_type, acquisition_cost,
               down_payment, loan_balance, interest_rate, loan_term_months,
               lease_monthly, lease_start, lease_end, insurance_monthly,
               book_value, useful_life_years, depreciation_monthly
        FROM fleet WHERE is_active = 1
        ORDER BY registration
      `).all();
      res.json(rows);
    } catch (err) {
      logger.error(TAG, 'Failed to fetch fleet financials', err);
      res.status(500).json({ error: 'Failed to fetch fleet financials' });
    }
  });

  // ── Update aircraft financing ──────────────────────────────────
  router.patch('/admin/economics/fleet-financials/:id', authMiddleware, adminMiddleware, (req: Request, res: Response) => {
    try {
      const db = getDb();
      const id = req.params.id;

      const allowedFields: Record<string, string> = {
        acquisitionType: 'acquisition_type',
        acquisitionCost: 'acquisition_cost',
        downPayment: 'down_payment',
        loanBalance: 'loan_balance',
        interestRate: 'interest_rate',
        loanTermMonths: 'loan_term_months',
        leaseMonthly: 'lease_monthly',
        leaseStart: 'lease_start',
        leaseEnd: 'lease_end',
        insuranceMonthly: 'insurance_monthly',
        bookValue: 'book_value',
        usefulLifeYears: 'useful_life_years',
        depreciationMonthly: 'depreciation_monthly',
      };

      const setClauses: string[] = [];
      const values: unknown[] = [];

      for (const [bodyKey, dbColumn] of Object.entries(allowedFields)) {
        if (bodyKey in req.body) {
          setClauses.push(`${dbColumn} = ?`);
          values.push(req.body[bodyKey]);
        }
      }

      if (setClauses.length === 0) {
        return res.status(400).json({ error: 'No valid fields provided' });
      }

      values.push(id);
      const result = db.prepare(`UPDATE fleet SET ${setClauses.join(', ')} WHERE id = ?`).run(...values);

      if (result.changes === 0) {
        return res.status(404).json({ error: 'Aircraft not found' });
      }
      res.json({ message: 'Aircraft financing updated' });
    } catch (err) {
      logger.error(TAG, 'Failed to update aircraft financing', err);
      res.status(500).json({ error: 'Failed to update aircraft financing' });
    }
  });

  return router;
}
