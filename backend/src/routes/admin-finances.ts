import { Router } from 'express';
import { FinanceService } from '../services/finance.js';
import { AuditService } from '../services/audit.js';
import { authMiddleware, adminMiddleware } from '../middleware/auth.js';

export function adminFinancesRouter(): Router {
  const router = Router();
  const financeService = new FinanceService();
  const auditService = new AuditService();

  // GET /api/admin/finances
  router.get('/admin/finances', authMiddleware, adminMiddleware, (req, res) => {
    try {
      const filters = {
        pilotId: req.query.pilotId ? parseInt(req.query.pilotId as string) : undefined,
        type: req.query.type as any,
        dateFrom: req.query.dateFrom as string | undefined,
        dateTo: req.query.dateTo as string | undefined,
      };
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize as string) || 50));

      const result = financeService.findAll(filters, page, pageSize);
      res.json({ ...result, page, pageSize });
    } catch (err) {
      console.error('[Admin] List finances error:', err);
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
      console.error('[Admin] Create finance error:', err);
      res.status(500).json({ error: 'Failed to create finance entry' });
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
      console.error('[Admin] Delete finance error:', err);
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
      console.error('[Admin] Finance summary error:', err);
      res.status(500).json({ error: 'Failed to get finance summary' });
    }
  });

  // GET /api/admin/finances/balances
  router.get('/admin/finances/balances', authMiddleware, adminMiddleware, (_req, res) => {
    try {
      const balances = financeService.getAllBalances();
      res.json({ balances });
    } catch (err) {
      console.error('[Admin] Finance balances error:', err);
      res.status(500).json({ error: 'Failed to get balances' });
    }
  });

  return router;
}
