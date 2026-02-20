import { Router } from 'express';
import { SettingsService } from '../services/settings.js';
import { AuditService } from '../services/audit.js';
import { authMiddleware, adminMiddleware } from '../middleware/auth.js';

export function adminSettingsRouter(): Router {
  const router = Router();
  const settingsService = new SettingsService();
  const auditService = new AuditService();

  // GET /api/admin/settings
  router.get('/admin/settings', authMiddleware, adminMiddleware, (_req, res) => {
    try {
      const settings = settingsService.getAll();
      res.json({ settings });
    } catch (err) {
      console.error('[Admin] Get settings error:', err);
      res.status(500).json({ error: 'Failed to get settings' });
    }
  });

  // PUT /api/admin/settings — bulk update
  router.put('/admin/settings', authMiddleware, adminMiddleware, (req, res) => {
    try {
      const { settings } = req.body;
      if (!Array.isArray(settings)) {
        res.status(400).json({ error: 'settings array is required' });
        return;
      }
      settingsService.bulkUpdate(settings, req.user!.userId);
      auditService.log({ actorId: req.user!.userId, action: 'settings.update', targetType: 'settings', after: { settings } as any });
      res.json({ ok: true });
    } catch (err) {
      console.error('[Admin] Update settings error:', err);
      res.status(500).json({ error: 'Failed to update settings' });
    }
  });

  return router;
}
