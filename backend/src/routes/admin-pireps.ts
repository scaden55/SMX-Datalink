import { Router } from 'express';
import { PirepAdminService } from '../services/pirep-admin.js';
import { LogbookService } from '../services/logbook.js';
import { authMiddleware, dispatcherMiddleware } from '../middleware/auth.js';

export function adminPirepsRouter(): Router {
  const router = Router();
  const pirepService = new PirepAdminService();
  const logbookService = new LogbookService();

  // GET /api/admin/pireps
  router.get('/admin/pireps', authMiddleware, dispatcherMiddleware, (req, res) => {
    try {
      const filters = {
        userId: req.query.userId ? parseInt(req.query.userId as string) : undefined,
        status: req.query.status as any,
        search: req.query.search as string | undefined,
        dateFrom: req.query.dateFrom as string | undefined,
        dateTo: req.query.dateTo as string | undefined,
      };
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize as string) || 50));

      const result = pirepService.findAll(filters, page, pageSize);
      const pendingCount = pirepService.getPendingCount();
      res.json({ ...result, page, pageSize, pendingCount });
    } catch (err) {
      console.error('[Admin] List PIREPs error:', err);
      res.status(500).json({ error: 'Failed to list PIREPs' });
    }
  });

  // GET /api/admin/pireps/:id
  router.get('/admin/pireps/:id', authMiddleware, dispatcherMiddleware, (req, res) => {
    try {
      const entry = logbookService.findById(parseInt(req.params.id as string));
      if (!entry) { res.status(404).json({ error: 'PIREP not found' }); return; }
      res.json(entry);
    } catch (err) {
      console.error('[Admin] Get PIREP error:', err);
      res.status(500).json({ error: 'Failed to get PIREP' });
    }
  });

  // POST /api/admin/pireps/:id/review
  router.post('/admin/pireps/:id/review', authMiddleware, dispatcherMiddleware, (req, res) => {
    try {
      const { status, notes } = req.body;
      if (!status || !['approved', 'rejected'].includes(status)) {
        res.status(400).json({ error: 'status must be approved or rejected' });
        return;
      }
      const ok = pirepService.review(parseInt(req.params.id as string), req.user!.userId, status, notes);
      if (!ok) { res.status(404).json({ error: 'PIREP not found' }); return; }
      res.json({ ok: true });
    } catch (err) {
      console.error('[Admin] Review PIREP error:', err);
      res.status(500).json({ error: 'Failed to review PIREP' });
    }
  });

  // POST /api/admin/pireps/bulk-review
  router.post('/admin/pireps/bulk-review', authMiddleware, dispatcherMiddleware, (req, res) => {
    try {
      const { ids, status, notes } = req.body;
      if (!ids?.length || !status || !['approved', 'rejected'].includes(status)) {
        res.status(400).json({ error: 'ids array and valid status required' });
        return;
      }
      const count = pirepService.bulkReview(ids, req.user!.userId, status, notes);
      res.json({ ok: true, count });
    } catch (err) {
      console.error('[Admin] Bulk review error:', err);
      res.status(500).json({ error: 'Failed to bulk review PIREPs' });
    }
  });

  return router;
}
