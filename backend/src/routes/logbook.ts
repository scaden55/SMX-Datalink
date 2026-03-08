import { Router } from 'express';
import { LogbookService } from '../services/logbook.js';
import { authMiddleware } from '../middleware/auth.js';
import type { LogbookFilters, LogbookStatus } from '@acars/shared';
import { logger } from '../lib/logger.js';
import { ExceedanceService } from '../services/exceedance.js';
import { FinanceService } from '../services/finance.js';
import { FinanceEngineStore } from '../services/finance-engine/store.js';

export function logbookRouter(): Router {
  const router = Router();
  const service = new LogbookService();
  const exceedanceService = new ExceedanceService();
  const financeService = new FinanceService();
  const financeStore = new FinanceEngineStore();

  // GET /api/logbook — paginated list (auth required)
  // Pilots can only see their own entries; admins/dispatchers can see all
  router.get('/logbook', authMiddleware, (req, res) => {
    try {
      const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
      const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize as string, 10) || 50));
      const isPrivileged = req.user!.role === 'admin' || req.user!.role === 'dispatcher';

      const filters: LogbookFilters = {
        // Pilots are forced to see only their own entries
        userId: isPrivileged
          ? (req.query.userId ? parseInt(req.query.userId as string, 10) : undefined)
          : req.user!.userId,
        depIcao: req.query.depIcao as string | undefined,
        arrIcao: req.query.arrIcao as string | undefined,
        aircraftType: req.query.aircraftType as string | undefined,
        status: typeof req.query.status === 'string' ? req.query.status as LogbookStatus : undefined,
        search: req.query.search as string | undefined,
        dateFrom: req.query.dateFrom as string | undefined,
        dateTo: req.query.dateTo as string | undefined,
        vatsimOnly: req.query.vatsimOnly === 'true',
      };

      const { entries, total } = service.findAll(filters, page, pageSize);
      res.json({ entries, total, page, pageSize });
    } catch (err) {
      logger.error('Logbook', 'List error', err);
      res.status(500).json({ error: 'Failed to fetch logbook entries' });
    }
  });

  // GET /api/logbook/:id — single entry detail (auth required)
  // Pilots can only see their own entries; admins/dispatchers can see all
  router.get('/logbook/:id', authMiddleware, (req, res) => {
    try {
      const id = parseInt(req.params.id as string, 10);
      if (isNaN(id)) {
        res.status(400).json({ error: 'Invalid logbook entry ID' });
        return;
      }

      const entry = service.findById(id);
      if (!entry) {
        res.status(404).json({ error: 'Logbook entry not found' });
        return;
      }

      // Ownership check — pilots can only view their own entries
      const isPrivileged = req.user!.role === 'admin' || req.user!.role === 'dispatcher';
      if (!isPrivileged && entry.userId !== req.user!.userId) {
        res.status(404).json({ error: 'Logbook entry not found' });
        return;
      }

      res.json(entry);
    } catch (err) {
      logger.error('Logbook', 'Detail error', err);
      res.status(500).json({ error: 'Failed to fetch logbook entry' });
    }
  });

  // GET /api/logbook/:id/exceedances — exceedance events for a flight
  router.get('/logbook/:id/exceedances', authMiddleware, (req, res) => {
    try {
      const id = parseInt(req.params.id as string, 10);
      if (isNaN(id)) {
        res.status(400).json({ error: 'Invalid logbook entry ID' });
        return;
      }

      const entry = service.findById(id);
      if (!entry) {
        res.status(404).json({ error: 'Logbook entry not found' });
        return;
      }

      const isPrivileged = req.user!.role === 'admin' || req.user!.role === 'dispatcher';
      if (!isPrivileged && entry.userId !== req.user!.userId) {
        res.status(404).json({ error: 'Logbook entry not found' });
        return;
      }

      const exceedances = exceedanceService.findByLogbookId(id);
      res.json(exceedances);
    } catch (err) {
      logger.error('Logbook', 'Exceedances fetch error', err);
      res.status(500).json({ error: 'Failed to fetch exceedances' });
    }
  });

  // GET /api/logbook/:id/finances — financial summary for a flight
  router.get('/logbook/:id/finances', authMiddleware, (req, res) => {
    try {
      const id = parseInt(req.params.id as string, 10);
      if (isNaN(id)) {
        res.status(400).json({ error: 'Invalid logbook entry ID' });
        return;
      }

      const entry = service.findById(id);
      if (!entry) {
        res.status(404).json({ error: 'Logbook entry not found' });
        return;
      }

      const isPrivileged = req.user!.role === 'admin' || req.user!.role === 'dispatcher';
      if (!isPrivileged && entry.userId !== req.user!.userId) {
        res.status(404).json({ error: 'Logbook entry not found' });
        return;
      }

      // Try finance engine P&L first (detailed breakdown)
      const pnl = financeStore.getFlightPnL(id);
      if (pnl) {
        res.json({
          source: 'engine',
          cargoRevenue: pnl.cargo_revenue,
          fuelCost: pnl.fuel_cost,
          landingFee: pnl.landing_fee,
          parkingFee: pnl.parking_fee,
          handlingFee: pnl.handling_fee,
          navFee: pnl.nav_fee,
          deiceFee: pnl.deice_fee,
          uldFee: pnl.uld_fee,
          crewCost: pnl.crew_cost,
          totalVariableCost: pnl.total_variable_cost,
          maintReserve: pnl.maint_reserve,
          leaseAlloc: pnl.lease_alloc,
          insuranceAlloc: pnl.insurance_alloc,
          totalFixedAlloc: pnl.total_fixed_alloc,
          grossProfit: pnl.gross_profit,
          marginPct: pnl.margin_pct,
          loadFactor: pnl.load_factor,
          blockHours: pnl.block_hours,
          payloadLbs: pnl.payload_lbs,
        });
        return;
      }

      // Fallback: simple pay entry from finances table
      const pay = financeService.findByPirepId(id);
      res.json({
        source: 'simple',
        pilotPay: pay?.amount ?? null,
        description: pay?.description ?? null,
      });
    } catch (err) {
      logger.error('Logbook', 'Finances fetch error', err);
      res.status(500).json({ error: 'Failed to fetch flight finances' });
    }
  });

  return router;
}
