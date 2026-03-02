import { Router } from 'express';
import { FinanceService } from '../services/finance.js';
import { AuditService } from '../services/audit.js';
import { authMiddleware, adminMiddleware } from '../middleware/auth.js';
import type { FinanceType } from '@acars/shared';
import { logger } from '../lib/logger.js';

export function adminFinancesRouter(): Router {
  const router = Router();
  const financeService = new FinanceService();
  const auditService = new AuditService();

  // GET /api/admin/finances
  router.get('/admin/finances', authMiddleware, adminMiddleware, (req, res) => {
    try {
      const filters = {
        pilotId: req.query.pilotId ? parseInt(req.query.pilotId as string) : undefined,
        type: typeof req.query.type === 'string' ? req.query.type as FinanceType : undefined,
        dateFrom: req.query.dateFrom as string | undefined,
        dateTo: req.query.dateTo as string | undefined,
      };
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize as string) || 50));

      const result = financeService.findAll(filters, page, pageSize);
      res.json({ ...result, page, pageSize });
    } catch (err) {
      logger.error('Admin', 'List finances error', err);
      res.status(500).json({ error: 'Failed to list finances' });
    }
  });

  // POST /api/admin/finances — manual entry
  router.post('/admin/finances', authMiddleware, adminMiddleware, (req, res) => {
    try {
      const { pilotId, type, amount, description } = req.body;
      if (!pilotId || !type || amount === undefined) {
        res.status(400).json({ error: 'pilotId, type, and amount are required' });
        return;
      }
      const validTypes = ['pay', 'bonus', 'deduction', 'expense', 'income'];
      if (!validTypes.includes(type)) {
        res.status(400).json({ error: `type must be one of: ${validTypes.join(', ')}` });
        return;
      }
      if (typeof amount !== 'number' || !isFinite(amount)) {
        res.status(400).json({ error: 'amount must be a finite number' });
        return;
      }
      const id = financeService.create({ pilotId, type, amount, description }, req.user!.userId);
      auditService.log({ actorId: req.user!.userId, action: 'finance.create', targetType: 'finance', targetId: id, after: req.body });
      res.status(201).json({ id });
    } catch (err) {
      logger.error('Admin', 'Create finance error', err);
      res.status(500).json({ error: 'Failed to create finance entry' });
    }
  });

  // GET /api/admin/finances/revenue — revenue by flight (paginated)
  router.get('/admin/finances/revenue', authMiddleware, adminMiddleware, (req, res) => {
    try {
      const filters = {
        pilotId: req.query.pilotId ? parseInt(req.query.pilotId as string) : undefined,
        dateFrom: req.query.dateFrom as string | undefined,
        dateTo: req.query.dateTo as string | undefined,
      };
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize as string) || 50));
      const result = financeService.getRevenueByFlight(filters, page, pageSize);
      res.json({ ...result, page, pageSize });
    } catch (err) {
      logger.error('Admin', 'Revenue by flight error', err);
      res.status(500).json({ error: 'Failed to get revenue by flight' });
    }
  });

  // GET /api/admin/finances/route-profit — route profitability ranking
  router.get('/admin/finances/route-profit', authMiddleware, adminMiddleware, (req, res) => {
    try {
      const data = financeService.getRouteProfitability(
        req.query.dateFrom as string | undefined,
        req.query.dateTo as string | undefined,
      );
      res.json({ routes: data });
    } catch (err) {
      logger.error('Admin', 'Route profitability error', err);
      res.status(500).json({ error: 'Failed to get route profitability' });
    }
  });

  // GET /api/admin/finances/pilot-pay — pilot pay summary
  router.get('/admin/finances/pilot-pay', authMiddleware, adminMiddleware, (req, res) => {
    try {
      const data = financeService.getPilotPaySummary(
        req.query.dateFrom as string | undefined,
        req.query.dateTo as string | undefined,
      );
      res.json({ pilots: data });
    } catch (err) {
      logger.error('Admin', 'Pilot pay summary error', err);
      res.status(500).json({ error: 'Failed to get pilot pay summary' });
    }
  });

  // POST /api/admin/finances/:id/void — void a finance entry
  router.post('/admin/finances/:id/void', authMiddleware, adminMiddleware, (req, res) => {
    try {
      const reversalId = financeService.voidEntry(parseInt(req.params.id as string), req.user!.userId);
      if (reversalId === null) {
        res.status(404).json({ error: 'Finance entry not found' });
        return;
      }
      auditService.log({ actorId: req.user!.userId, action: 'finance.void', targetType: 'finance', targetId: parseInt(req.params.id as string) });
      res.json({ reversalId });
    } catch (err) {
      logger.error('Admin', 'Void finance entry error', err);
      res.status(500).json({ error: 'Failed to void finance entry' });
    }
  });

  // DELETE /api/admin/finances/:id
  router.delete('/admin/finances/:id', authMiddleware, adminMiddleware, (req, res) => {
    try {
      const deleted = financeService.delete(parseInt(req.params.id as string));
      if (!deleted) { res.status(404).json({ error: 'Finance entry not found' }); return; }
      auditService.log({ actorId: req.user!.userId, action: 'finance.delete', targetType: 'finance', targetId: parseInt(req.params.id as string) });
      res.status(204).end();
    } catch (err) {
      logger.error('Admin', 'Delete finance error', err);
      res.status(500).json({ error: 'Failed to delete finance entry' });
    }
  });

  // GET /api/admin/finances/summary
  router.get('/admin/finances/summary', authMiddleware, adminMiddleware, (req, res) => {
    try {
      const summary = financeService.getSummary(
        req.query.dateFrom as string | undefined,
        req.query.dateTo as string | undefined,
      );
      res.json(summary);
    } catch (err) {
      logger.error('Admin', 'Finance summary error', err);
      res.status(500).json({ error: 'Failed to get finance summary' });
    }
  });

  // GET /api/admin/finances/balances
  router.get('/admin/finances/balances', authMiddleware, adminMiddleware, (_req, res) => {
    try {
      const balances = financeService.getAllBalances();
      res.json({ balances });
    } catch (err) {
      logger.error('Admin', 'Finance balances error', err);
      res.status(500).json({ error: 'Failed to get balances' });
    }
  });

  return router;
}
