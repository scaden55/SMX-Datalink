import { Router } from 'express';
import { AuditService } from '../services/audit.js';
import { authMiddleware, adminMiddleware } from '../middleware/auth.js';
import type { AuditLogFilters } from '@acars/shared';

export function adminAuditRouter(): Router {
  const router = Router();
  const auditService = new AuditService();

  // GET /api/admin/audit
  router.get('/admin/audit', authMiddleware, adminMiddleware, (req, res) => {
    try {
      const filters: AuditLogFilters = {
        actorId: req.query.actorId ? parseInt(req.query.actorId as string) : undefined,
        action: req.query.action as string | undefined,
        targetType: req.query.targetType as string | undefined,
        dateFrom: req.query.dateFrom as string | undefined,
        dateTo: req.query.dateTo as string | undefined,
      };
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize as string) || 50));

      const result = auditService.findAll(filters, page, pageSize);
      res.json({ ...result, page, pageSize });
    } catch (err) {
      console.error('[Admin] List audit log error:', err);
      res.status(500).json({ error: 'Failed to list audit log' });
    }
  });

  return router;
}
