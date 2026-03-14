import { Router } from 'express';
import { authMiddleware, dispatcherMiddleware, adminMiddleware } from '../middleware/auth.js';
import { MelMasterService } from '../services/mel-master.js';
import { logger } from '../lib/logger.js';

const TAG = 'MelMaster';

export function adminMelMasterRouter(): Router {
  const router = Router();
  const service = new MelMasterService();

  // GET /api/admin/maintenance/mel-master — list (dispatcher+)
  router.get('/admin/maintenance/mel-master', authMiddleware, dispatcherMiddleware, (req, res) => {
    try {
      const icaoType = req.query.icaoType as string | undefined;
      const items = service.findAll(icaoType);
      res.json({ items });
    } catch (err) {
      logger.error(TAG, 'List MEL master error', err);
      res.status(500).json({ error: 'Failed to list MEL master items' });
    }
  });

  // POST /api/admin/maintenance/mel-master — create (admin only)
  router.post('/admin/maintenance/mel-master', authMiddleware, adminMiddleware, (req, res) => {
    try {
      const result = service.create(req.body, req.user!.userId);
      res.status(201).json(result);
    } catch (err: any) {
      logger.error(TAG, 'Create MEL master error', err);
      res.status(err.status || 500).json({ error: err.message || 'Failed to create MEL master item' });
    }
  });

  // PATCH /api/admin/maintenance/mel-master/:id — update (admin only)
  router.patch('/admin/maintenance/mel-master/:id', authMiddleware, adminMiddleware, (req, res) => {
    try {
      const result = service.update(parseInt(req.params.id as string), req.body, req.user!.userId);
      if (!result) { res.status(404).json({ error: 'MEL master item not found' }); return; }
      res.json(result);
    } catch (err: any) {
      logger.error(TAG, 'Update MEL master error', err);
      res.status(err.status || 500).json({ error: err.message || 'Failed to update MEL master item' });
    }
  });

  // DELETE /api/admin/maintenance/mel-master/:id — deactivate (admin only)
  router.delete('/admin/maintenance/mel-master/:id', authMiddleware, adminMiddleware, (req, res) => {
    try {
      const result = service.deactivate(parseInt(req.params.id as string), req.user!.userId);
      if (!result) { res.status(404).json({ error: 'MEL master item not found' }); return; }
      res.json({ success: true });
    } catch (err) {
      logger.error(TAG, 'Deactivate MEL master error', err);
      res.status(500).json({ error: 'Failed to deactivate MEL master item' });
    }
  });

  return router;
}
