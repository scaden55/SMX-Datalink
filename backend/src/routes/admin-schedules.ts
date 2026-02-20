import { Router } from 'express';
import { ScheduleAdminService } from '../services/schedule-admin.js';
import { authMiddleware, dispatcherMiddleware } from '../middleware/auth.js';

export function adminSchedulesRouter(): Router {
  const router = Router();
  const scheduleService = new ScheduleAdminService();

  // GET /api/admin/schedules
  router.get('/admin/schedules', authMiddleware, dispatcherMiddleware, (req, res) => {
    try {
      const filters = {
        depIcao: req.query.depIcao as string | undefined,
        arrIcao: req.query.arrIcao as string | undefined,
        aircraftType: req.query.aircraftType as string | undefined,
        search: req.query.search as string | undefined,
        isActive: req.query.isActive !== undefined ? req.query.isActive === 'true' : undefined,
      };
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize as string) || 50));

      const result = scheduleService.findAll(filters, page, pageSize);
      res.json({ ...result, page, pageSize });
    } catch (err) {
      console.error('[Admin] List schedules error:', err);
      res.status(500).json({ error: 'Failed to list schedules' });
    }
  });

  // POST /api/admin/schedules
  router.post('/admin/schedules', authMiddleware, dispatcherMiddleware, (req, res) => {
    try {
      const { flightNumber, depIcao, arrIcao, aircraftType, depTime, arrTime, distanceNm, flightTimeMin, daysOfWeek } = req.body;
      if (!flightNumber || !depIcao || !arrIcao || !aircraftType || !depTime || !arrTime) {
        res.status(400).json({ error: 'Missing required fields' });
        return;
      }
      const schedule = scheduleService.create(req.body, req.user!.userId);
      res.status(201).json(schedule);
    } catch (err) {
      console.error('[Admin] Create schedule error:', err);
      res.status(500).json({ error: 'Failed to create schedule' });
    }
  });

  // PATCH /api/admin/schedules/:id
  router.patch('/admin/schedules/:id', authMiddleware, dispatcherMiddleware, (req, res) => {
    try {
      const updated = scheduleService.update(parseInt(req.params.id as string), req.body, req.user!.userId);
      if (!updated) { res.status(404).json({ error: 'Schedule not found' }); return; }
      res.json(updated);
    } catch (err) {
      console.error('[Admin] Update schedule error:', err);
      res.status(500).json({ error: 'Failed to update schedule' });
    }
  });

  // DELETE /api/admin/schedules/:id
  router.delete('/admin/schedules/:id', authMiddleware, dispatcherMiddleware, (req, res) => {
    try {
      const deleted = scheduleService.delete(parseInt(req.params.id as string), req.user!.userId);
      if (!deleted) { res.status(404).json({ error: 'Schedule not found' }); return; }
      res.status(204).end();
    } catch (err) {
      console.error('[Admin] Delete schedule error:', err);
      res.status(500).json({ error: 'Failed to delete schedule' });
    }
  });

  // POST /api/admin/schedules/:id/toggle
  router.post('/admin/schedules/:id/toggle', authMiddleware, dispatcherMiddleware, (req, res) => {
    try {
      const updated = scheduleService.toggleActive(parseInt(req.params.id as string), req.user!.userId);
      if (!updated) { res.status(404).json({ error: 'Schedule not found' }); return; }
      res.json(updated);
    } catch (err) {
      console.error('[Admin] Toggle schedule error:', err);
      res.status(500).json({ error: 'Failed to toggle schedule' });
    }
  });

  // POST /api/admin/schedules/:id/clone
  router.post('/admin/schedules/:id/clone', authMiddleware, dispatcherMiddleware, (req, res) => {
    try {
      const { flightNumber } = req.body;
      if (!flightNumber) { res.status(400).json({ error: 'flightNumber is required' }); return; }
      const cloned = scheduleService.clone(parseInt(req.params.id as string), flightNumber, req.user!.userId);
      if (!cloned) { res.status(404).json({ error: 'Schedule not found' }); return; }
      res.status(201).json(cloned);
    } catch (err) {
      console.error('[Admin] Clone schedule error:', err);
      res.status(500).json({ error: 'Failed to clone schedule' });
    }
  });

  return router;
}
