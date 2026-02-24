import { Router } from 'express';
import { NotificationService } from '../services/notification.js';
import { authMiddleware } from '../middleware/auth.js';
import { logger } from '../lib/logger.js';

export function notificationsRouter(): Router {
  const router = Router();
  const notificationService = new NotificationService();

  // GET /api/notifications
  router.get('/notifications', authMiddleware, (req, res) => {
    try {
      const result = notificationService.getForUser(req.user!.userId);
      res.json(result);
    } catch (err) {
      logger.error('Notifications', 'Get error', err);
      res.status(500).json({ error: 'Failed to get notifications' });
    }
  });

  // POST /api/notifications/:id/read
  router.post('/notifications/:id/read', authMiddleware, (req, res) => {
    try {
      notificationService.markRead(parseInt(req.params.id as string), req.user!.userId);
      res.json({ ok: true });
    } catch (err) {
      logger.error('Notifications', 'Mark read error', err);
      res.status(500).json({ error: 'Failed to mark notification as read' });
    }
  });

  // POST /api/notifications/read-all
  router.post('/notifications/read-all', authMiddleware, (req, res) => {
    try {
      notificationService.markAllRead(req.user!.userId);
      res.json({ ok: true });
    } catch (err) {
      logger.error('Notifications', 'Mark all read error', err);
      res.status(500).json({ error: 'Failed to mark notifications as read' });
    }
  });

  return router;
}
