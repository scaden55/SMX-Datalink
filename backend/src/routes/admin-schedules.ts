import { Router } from 'express';
import { ScheduleAdminService } from '../services/schedule-admin.js';
import { CharterGeneratorService, currentMonth } from '../services/charter-generator.js';
import { VatsimEventsService } from '../services/vatsim-events.js';
import { authMiddleware, dispatcherMiddleware } from '../middleware/auth.js';
import { logger } from '../lib/logger.js';

export function adminSchedulesRouter(): Router {
  const router = Router();
  const scheduleService = new ScheduleAdminService();
  const charterGen = new CharterGeneratorService();
  const vatsimEvents = new VatsimEventsService();

  // GET /api/admin/schedules/autofill — progressive airport/distance/time lookup
  router.get('/admin/schedules/autofill', authMiddleware, dispatcherMiddleware, (req, res) => {
    try {
      const result = scheduleService.autofill({
        depIcao: req.query.depIcao as string | undefined,
        arrIcao: req.query.arrIcao as string | undefined,
        aircraftType: req.query.aircraftType as string | undefined,
        depTime: req.query.depTime as string | undefined,
      });
      res.json(result);
    } catch (err) {
      logger.error('Admin', 'Autofill error', err);
      res.status(500).json({ error: 'Autofill lookup failed' });
    }
  });

  // GET /api/admin/schedules
  router.get('/admin/schedules', authMiddleware, dispatcherMiddleware, (req, res) => {
    try {
      const filters = {
        depIcao: req.query.depIcao as string | undefined,
        arrIcao: req.query.arrIcao as string | undefined,
        aircraftType: req.query.aircraftType as string | undefined,
        search: req.query.search as string | undefined,
        isActive: req.query.isActive !== undefined ? req.query.isActive === 'true' : undefined,
        charterType: req.query.charterType as string | undefined,
      };
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize as string) || 50));

      const result = scheduleService.findAll(filters, page, pageSize);
      res.json({ ...result, page, pageSize });
    } catch (err) {
      logger.error('Admin', 'List schedules error', err);
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
      logger.error('Admin', 'Create schedule error', err);
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
      logger.error('Admin', 'Update schedule error', err);
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
      logger.error('Admin', 'Delete schedule error', err);
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
      logger.error('Admin', 'Toggle schedule error', err);
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
      logger.error('Admin', 'Clone schedule error', err);
      res.status(500).json({ error: 'Failed to clone schedule' });
    }
  });

  // ── Dynamic Charter Management ──────────────────────────────

  // GET /api/admin/charters/status — generation status for current month
  router.get('/admin/charters/status', authMiddleware, dispatcherMiddleware, (_req, res) => {
    try {
      const month = currentMonth();
      const status = vatsimEvents.getGenerationStatus(month);
      res.json(status ?? { month, generatedAt: null, charterCount: 0, eventCount: 0 });
    } catch (err) {
      logger.error('Admin', 'Charter status error', err);
      res.status(500).json({ error: 'Failed to get charter status' });
    }
  });

  // POST /api/admin/charters/generate — manual trigger for charter generation (force re-run)
  router.post('/admin/charters/generate', authMiddleware, dispatcherMiddleware, (_req, res) => {
    try {
      const result = charterGen.generateMonthlyCharters(undefined, true);
      res.json(result);
    } catch (err) {
      logger.error('Admin', 'Charter generation error', err);
      res.status(500).json({ error: 'Failed to generate charters' });
    }
  });

  // POST /api/admin/events/refresh — manual trigger for VATSIM event poll
  router.post('/admin/events/refresh', authMiddleware, dispatcherMiddleware, async (_req, res) => {
    try {
      const polled = await vatsimEvents.pollEvents();
      const created = vatsimEvents.generateEventCharters();
      res.json({ eventsCached: polled, chartersCreated: created });
    } catch (err) {
      logger.error('Admin', 'VATSIM events refresh error', err);
      res.status(500).json({ error: 'Failed to refresh VATSIM events' });
    }
  });

  // GET /api/admin/events — list cached VATSIM events
  router.get('/admin/events', authMiddleware, dispatcherMiddleware, (_req, res) => {
    try {
      const events = vatsimEvents.getUpcomingEvents();
      res.json({ events, total: events.length });
    } catch (err) {
      logger.error('Admin', 'List events error', err);
      res.status(500).json({ error: 'Failed to list events' });
    }
  });

  return router;
}
