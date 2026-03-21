import { Router } from 'express';
import { authMiddleware, adminMiddleware } from '../middleware/auth.js';
import { MaintenanceService } from '../services/maintenance.js';
import { logger } from '../lib/logger.js';

const TAG = 'Maintenance';

export function adminMaintenanceRouter(): Router {
  const router = Router();
  const service = new MaintenanceService();

  // ═══════════════════════════════════════════════════════════
  // Fleet Status
  // ═══════════════════════════════════════════════════════════

  // GET /api/admin/maintenance/fleet-status
  router.get('/admin/maintenance/fleet-status', authMiddleware, adminMiddleware, (_req, res) => {
    try {
      const fleet = service.getFleetStatus();
      res.json({ fleet });
    } catch (err) {
      logger.error(TAG, 'Get fleet status error', err);
      res.status(500).json({ error: 'Failed to get fleet status' });
    }
  });

  // PATCH /api/admin/maintenance/aircraft/:id/hours
  router.patch('/admin/maintenance/aircraft/:id/hours', authMiddleware, adminMiddleware, (req, res) => {
    try {
      const { totalHours, totalCycles, reason } = req.body;
      if (!reason) {
        res.status(400).json({ error: 'reason is required' });
        return;
      }
      const result = service.adjustHours(
        parseInt(req.params.id as string),
        { totalHours, totalCycles, reason },
        req.user!.userId,
      );
      if (!result) {
        res.status(404).json({ error: 'Aircraft not found' });
        return;
      }
      res.json(result);
    } catch (err) {
      logger.error(TAG, 'Adjust hours error', err);
      res.status(500).json({ error: 'Failed to adjust hours' });
    }
  });

  // POST /api/admin/maintenance/aircraft/:id/return-to-service
  router.post('/admin/maintenance/aircraft/:id/return-to-service', authMiddleware, adminMiddleware, (req, res) => {
    try {
      const ok = service.returnToService(parseInt(req.params.id as string), req.user!.userId);
      if (ok) {
        res.json({ ok: true, message: 'Aircraft returned to service' });
      } else {
        res.json({ ok: false, message: 'Cannot return to service — overdue checks, ADs, or expired MELs remain' });
      }
    } catch (err) {
      logger.error(TAG, 'Return to service error', err);
      res.status(500).json({ error: 'Failed to return aircraft to service' });
    }
  });

  // ═══════════════════════════════════════════════════════════
  // Maintenance Log
  // ═══════════════════════════════════════════════════════════

  // GET /api/admin/maintenance/log
  router.get('/admin/maintenance/log', authMiddleware, adminMiddleware, (req, res) => {
    try {
      const filters = {
        aircraftId: req.query.aircraftId ? parseInt(req.query.aircraftId as string) : undefined,
        checkType: req.query.checkType as string | undefined,
        status: req.query.status as string | undefined,
        dateFrom: req.query.dateFrom as string | undefined,
        dateTo: req.query.dateTo as string | undefined,
      };
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize as string) || 50));

      const result = service.findAllLog(filters, page, pageSize);
      res.json({ ...result, page, pageSize });
    } catch (err) {
      logger.error(TAG, 'List maintenance log error', err);
      res.status(500).json({ error: 'Failed to list maintenance log' });
    }
  });

  // GET /api/admin/maintenance/log/:id
  router.get('/admin/maintenance/log/:id', authMiddleware, adminMiddleware, (req, res) => {
    try {
      const entry = service.getLogEntry(parseInt(req.params.id as string));
      if (!entry) {
        res.status(404).json({ error: 'Log entry not found' });
        return;
      }
      res.json(entry);
    } catch (err) {
      logger.error(TAG, 'Get log entry error', err);
      res.status(500).json({ error: 'Failed to get log entry' });
    }
  });

  // POST /api/admin/maintenance/log
  router.post('/admin/maintenance/log', authMiddleware, adminMiddleware, (req, res) => {
    try {
      const { aircraftId, checkType, title } = req.body;
      if (!aircraftId || !checkType || !title) {
        res.status(400).json({ error: 'aircraftId, checkType, and title are required' });
        return;
      }
      const entry = service.createLog(req.body, req.user!.userId);
      res.status(201).json(entry);
    } catch (err) {
      logger.error(TAG, 'Create log entry error', err);
      res.status(500).json({ error: 'Failed to create log entry' });
    }
  });

  // PATCH /api/admin/maintenance/log/:id
  router.patch('/admin/maintenance/log/:id', authMiddleware, adminMiddleware, (req, res) => {
    try {
      const entry = service.updateLog(parseInt(req.params.id as string), req.body, req.user!.userId);
      if (!entry) {
        res.status(404).json({ error: 'Log entry not found' });
        return;
      }
      res.json(entry);
    } catch (err) {
      logger.error(TAG, 'Update log entry error', err);
      res.status(500).json({ error: 'Failed to update log entry' });
    }
  });

  // POST /api/admin/maintenance/log/:id/complete
  router.post('/admin/maintenance/log/:id/complete', authMiddleware, adminMiddleware, (req, res) => {
    try {
      const entry = service.completeCheck(parseInt(req.params.id as string), req.user!.userId);
      if (!entry) {
        res.status(404).json({ error: 'Log entry not found' });
        return;
      }
      res.json(entry);
    } catch (err) {
      logger.error(TAG, 'Complete check error', err);
      res.status(500).json({ error: 'Failed to complete check' });
    }
  });

  // DELETE /api/admin/maintenance/log/:id
  router.delete('/admin/maintenance/log/:id', authMiddleware, adminMiddleware, (req, res) => {
    try {
      const ok = service.deleteLog(parseInt(req.params.id as string), req.user!.userId);
      if (!ok) {
        res.status(404).json({ error: 'Log entry not found' });
        return;
      }
      res.status(204).send();
    } catch (err) {
      logger.error(TAG, 'Delete log entry error', err);
      res.status(500).json({ error: 'Failed to delete log entry' });
    }
  });

  // ═══════════════════════════════════════════════════════════
  // Check Schedules
  // ═══════════════════════════════════════════════════════════

  // GET /api/admin/maintenance/check-schedules
  router.get('/admin/maintenance/check-schedules', authMiddleware, adminMiddleware, (_req, res) => {
    try {
      const schedules = service.findAllCheckSchedules();
      res.json({ schedules });
    } catch (err) {
      logger.error(TAG, 'List check schedules error', err);
      res.status(500).json({ error: 'Failed to list check schedules' });
    }
  });

  // POST /api/admin/maintenance/check-schedules
  router.post('/admin/maintenance/check-schedules', authMiddleware, adminMiddleware, (req, res) => {
    try {
      const { icaoType, checkType } = req.body;
      if (!icaoType || !checkType) {
        res.status(400).json({ error: 'icaoType and checkType are required' });
        return;
      }
      const schedule = service.createCheckSchedule(req.body, req.user!.userId);
      res.status(201).json(schedule);
    } catch (err: any) {
      if (err.status === 400) {
        res.status(400).json({ error: err.message });
        return;
      }
      logger.error(TAG, 'Create check schedule error', err);
      res.status(500).json({ error: 'Failed to create check schedule' });
    }
  });

  // PATCH /api/admin/maintenance/check-schedules/:id
  router.patch('/admin/maintenance/check-schedules/:id', authMiddleware, adminMiddleware, (req, res) => {
    try {
      const schedule = service.updateCheckSchedule(parseInt(req.params.id as string), req.body, req.user!.userId);
      if (!schedule) {
        res.status(404).json({ error: 'Check schedule not found' });
        return;
      }
      res.json(schedule);
    } catch (err: any) {
      if (err.status === 400) {
        res.status(400).json({ error: err.message });
        return;
      }
      logger.error(TAG, 'Update check schedule error', err);
      res.status(500).json({ error: 'Failed to update check schedule' });
    }
  });

  // DELETE /api/admin/maintenance/check-schedules/:id
  router.delete('/admin/maintenance/check-schedules/:id', authMiddleware, adminMiddleware, (req, res) => {
    try {
      const ok = service.deleteCheckSchedule(parseInt(req.params.id as string), req.user!.userId);
      if (!ok) {
        res.status(404).json({ error: 'Check schedule not found' });
        return;
      }
      res.status(204).send();
    } catch (err) {
      logger.error(TAG, 'Delete check schedule error', err);
      res.status(500).json({ error: 'Failed to delete check schedule' });
    }
  });

  // ═══════════════════════════════════════════════════════════
  // Airworthiness Directives
  // ═══════════════════════════════════════════════════════════

  // GET /api/admin/maintenance/ads
  router.get('/admin/maintenance/ads', authMiddleware, adminMiddleware, (req, res) => {
    try {
      const filters = {
        aircraftId: req.query.aircraftId ? parseInt(req.query.aircraftId as string) : undefined,
        status: req.query.status as string | undefined,
        needsReview: req.query.needsReview === 'true' ? true : undefined,
      };
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize as string) || 50));

      const result = service.findAllADs(filters, page, pageSize);
      res.json({ ...result, page, pageSize });
    } catch (err) {
      logger.error(TAG, 'List ADs error', err);
      res.status(500).json({ error: 'Failed to list airworthiness directives' });
    }
  });

  // POST /api/admin/maintenance/ads
  router.post('/admin/maintenance/ads', authMiddleware, adminMiddleware, (req, res) => {
    try {
      const { aircraftId, adNumber, title } = req.body;
      if (!aircraftId || !adNumber || !title) {
        res.status(400).json({ error: 'aircraftId, adNumber, and title are required' });
        return;
      }
      const ad = service.createAD(req.body, req.user!.userId);
      res.status(201).json(ad);
    } catch (err) {
      logger.error(TAG, 'Create AD error', err);
      res.status(500).json({ error: 'Failed to create airworthiness directive' });
    }
  });

  // PATCH /api/admin/maintenance/ads/:id
  router.patch('/admin/maintenance/ads/:id', authMiddleware, adminMiddleware, (req, res) => {
    try {
      const ad = service.updateAD(parseInt(req.params.id as string), req.body, req.user!.userId);
      if (!ad) {
        res.status(404).json({ error: 'Airworthiness directive not found' });
        return;
      }
      res.json(ad);
    } catch (err) {
      logger.error(TAG, 'Update AD error', err);
      res.status(500).json({ error: 'Failed to update airworthiness directive' });
    }
  });

  // DELETE /api/admin/maintenance/ads/:id
  router.delete('/admin/maintenance/ads/:id', authMiddleware, adminMiddleware, (req, res) => {
    try {
      const ok = service.deleteAD(parseInt(req.params.id as string), req.user!.userId);
      if (!ok) {
        res.status(404).json({ error: 'Airworthiness directive not found' });
        return;
      }
      res.status(204).send();
    } catch (err) {
      logger.error(TAG, 'Delete AD error', err);
      res.status(500).json({ error: 'Failed to delete airworthiness directive' });
    }
  });

  // ═══════════════════════════════════════════════════════════
  // MEL Deferrals
  // ═══════════════════════════════════════════════════════════

  // GET /api/admin/maintenance/mel
  router.get('/admin/maintenance/mel', authMiddleware, adminMiddleware, (req, res) => {
    try {
      const filters = {
        aircraftId: req.query.aircraftId ? parseInt(req.query.aircraftId as string) : undefined,
        status: req.query.status as string | undefined,
        category: req.query.category as string | undefined,
      };
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize as string) || 50));

      const result = service.findAllMEL(filters, page, pageSize);
      res.json({ ...result, page, pageSize });
    } catch (err) {
      logger.error(TAG, 'List MEL deferrals error', err);
      res.status(500).json({ error: 'Failed to list MEL deferrals' });
    }
  });

  // POST /api/admin/maintenance/mel
  router.post('/admin/maintenance/mel', authMiddleware, adminMiddleware, (req, res) => {
    try {
      const { aircraftId, itemNumber, title, category, deferralDate, expiryDate } = req.body;
      if (!aircraftId || !itemNumber || !title || !category || !deferralDate || !expiryDate) {
        res.status(400).json({ error: 'aircraftId, itemNumber, title, category, deferralDate, and expiryDate are required' });
        return;
      }
      const mel = service.createMEL(req.body, req.user!.userId);
      res.status(201).json(mel);
    } catch (err) {
      logger.error(TAG, 'Create MEL deferral error', err);
      res.status(500).json({ error: 'Failed to create MEL deferral' });
    }
  });

  // PATCH /api/admin/maintenance/mel/:id
  router.patch('/admin/maintenance/mel/:id', authMiddleware, adminMiddleware, (req, res) => {
    try {
      const mel = service.updateMEL(parseInt(req.params.id as string), req.body, req.user!.userId);
      if (!mel) {
        res.status(404).json({ error: 'MEL deferral not found' });
        return;
      }
      res.json(mel);
    } catch (err) {
      logger.error(TAG, 'Update MEL deferral error', err);
      res.status(500).json({ error: 'Failed to update MEL deferral' });
    }
  });

  // DELETE /api/admin/maintenance/mel/:id
  router.delete('/admin/maintenance/mel/:id', authMiddleware, adminMiddleware, (req, res) => {
    try {
      const ok = service.deleteMEL(parseInt(req.params.id as string), req.user!.userId);
      if (!ok) {
        res.status(404).json({ error: 'MEL deferral not found' });
        return;
      }
      res.status(204).send();
    } catch (err: any) {
      if (err.status === 400) {
        res.status(400).json({ error: err.message });
        return;
      }
      logger.error(TAG, 'Delete MEL deferral error', err);
      res.status(500).json({ error: 'Failed to delete MEL deferral' });
    }
  });

  // ═══════════════════════════════════════════════════════════
  // Components
  // ═══════════════════════════════════════════════════════════

  // GET /api/admin/maintenance/components
  router.get('/admin/maintenance/components', authMiddleware, adminMiddleware, (req, res) => {
    try {
      const filters = {
        aircraftId: req.query.aircraftId ? parseInt(req.query.aircraftId as string) : undefined,
        componentType: req.query.componentType as string | undefined,
        status: req.query.status as string | undefined,
      };
      const components = service.findAllComponents(filters);
      res.json({ components });
    } catch (err) {
      logger.error(TAG, 'List components error', err);
      res.status(500).json({ error: 'Failed to list components' });
    }
  });

  // POST /api/admin/maintenance/components
  router.post('/admin/maintenance/components', authMiddleware, adminMiddleware, (req, res) => {
    try {
      const { aircraftId, componentType } = req.body;
      if (!aircraftId || !componentType) {
        res.status(400).json({ error: 'aircraftId and componentType are required' });
        return;
      }
      const component = service.createComponent(req.body, req.user!.userId);
      res.status(201).json(component);
    } catch (err) {
      logger.error(TAG, 'Create component error', err);
      res.status(500).json({ error: 'Failed to create component' });
    }
  });

  // PATCH /api/admin/maintenance/components/:id
  router.patch('/admin/maintenance/components/:id', authMiddleware, adminMiddleware, (req, res) => {
    try {
      const component = service.updateComponent(parseInt(req.params.id as string), req.body, req.user!.userId);
      if (!component) {
        res.status(404).json({ error: 'Component not found' });
        return;
      }
      res.json(component);
    } catch (err) {
      logger.error(TAG, 'Update component error', err);
      res.status(500).json({ error: 'Failed to update component' });
    }
  });

  // POST /api/admin/maintenance/components/:id/overhaul
  router.post('/admin/maintenance/components/:id/overhaul', authMiddleware, adminMiddleware, (req, res) => {
    try {
      const component = service.resetComponentOverhaul(parseInt(req.params.id as string), req.user!.userId);
      if (!component) {
        res.status(404).json({ error: 'Component not found' });
        return;
      }
      res.json(component);
    } catch (err) {
      logger.error(TAG, 'Reset component overhaul error', err);
      res.status(500).json({ error: 'Failed to reset component overhaul' });
    }
  });

  // DELETE /api/admin/maintenance/components/:id
  router.delete('/admin/maintenance/components/:id', authMiddleware, adminMiddleware, (req, res) => {
    try {
      const ok = service.deleteComponent(parseInt(req.params.id as string), req.user!.userId);
      if (!ok) {
        res.status(404).json({ error: 'Component not found' });
        return;
      }
      res.status(204).send();
    } catch (err) {
      logger.error(TAG, 'Delete component error', err);
      res.status(500).json({ error: 'Failed to delete component' });
    }
  });

  // ═══════════════════════════════════════════════════════════
  // Aircraft Timeline
  // ═══════════════════════════════════════════════════════════

  // GET /api/admin/maintenance/aircraft/:id/timeline
  router.get('/admin/maintenance/aircraft/:id/timeline', authMiddleware, adminMiddleware, (req, res) => {
    try {
      const aircraftId = parseInt(req.params.id as string);
      const page = parseInt(req.query.page as string) || 1;
      const pageSize = parseInt(req.query.pageSize as string) || 50;
      const result = service.getAircraftTimeline(aircraftId, page, pageSize);
      res.json(result);
    } catch (err) {
      logger.error(TAG, 'Get aircraft timeline error', err);
      res.status(500).json({ error: 'Failed to get aircraft timeline' });
    }
  });

  // ═══════════════════════════════════════════════════════════
  // MEL Stats
  // ═══════════════════════════════════════════════════════════

  // GET /api/admin/maintenance/mel/stats
  router.get('/admin/maintenance/mel/stats', authMiddleware, adminMiddleware, (_req, res) => {
    try {
      const stats = service.getMelStats();
      res.json(stats);
    } catch (err) {
      logger.error(TAG, 'Get MEL stats error', err);
      res.status(500).json({ error: 'Failed to get MEL stats' });
    }
  });

  // POST /api/admin/maintenance/ads/sync — trigger FAA AD sync
  router.post('/admin/maintenance/ads/sync', authMiddleware, adminMiddleware, async (req, res) => {
    try {
      const { FaaAdSyncService } = await import('../services/faa-ad-sync.js');
      const syncService = new FaaAdSyncService();
      const result = await syncService.syncAll();
      res.json(result);
    } catch (err) {
      logger.error(TAG, 'AD sync error', err);
      res.status(500).json({ error: 'Failed to sync ADs' });
    }
  });

  return router;
}
