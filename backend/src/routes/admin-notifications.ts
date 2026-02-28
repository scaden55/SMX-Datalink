import { Router } from 'express';
import { authMiddleware, dispatcherMiddleware } from '../middleware/auth.js';
import { getDb } from '../db/index.js';
import { createNotification, getNotifications } from '../services/admin-notifications.js';
import { logger } from '../lib/logger.js';

export function adminNotificationsRouter(): Router {
  const router = Router();

  // POST /api/admin/notifications — Create and broadcast a notification
  router.post('/admin/notifications', authMiddleware, dispatcherMiddleware, (req, res) => {
    try {
      const { type, message, targetType, targetId } = req.body;

      if (!message || typeof message !== 'string' || message.trim().length === 0) {
        res.status(400).json({ error: 'Message is required' });
        return;
      }

      const validTypes = ['info', 'success', 'warning', 'error'];
      if (type && !validTypes.includes(type)) {
        res.status(400).json({ error: `Invalid type. Must be one of: ${validTypes.join(', ')}` });
        return;
      }

      const validTargets = ['all', 'user', 'role'];
      if (targetType && !validTargets.includes(targetType)) {
        res.status(400).json({ error: `Invalid targetType. Must be one of: ${validTargets.join(', ')}` });
        return;
      }

      if (targetType === 'user' && !targetId) {
        res.status(400).json({ error: 'targetId is required when targetType is "user"' });
        return;
      }

      if (targetType === 'role' && !targetId) {
        res.status(400).json({ error: 'targetId (role name) is required when targetType is "role"' });
        return;
      }

      const notification = createNotification(getDb(), {
        type: type || 'info',
        message: message.trim(),
        targetType: targetType || 'all',
        targetId: targetId ?? null,
        createdBy: req.user!.userId,
      });

      res.status(201).json(notification);
    } catch (err) {
      logger.error('AdminNotifications', 'Failed to create notification', err);
      res.status(500).json({ error: 'Failed to create notification' });
    }
  });

  // GET /api/admin/notifications — List sent notifications with pagination
  router.get('/admin/notifications', authMiddleware, dispatcherMiddleware, (req, res) => {
    try {
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize as string) || 20));

      const result = getNotifications(getDb(), { page, pageSize });
      res.json(result);
    } catch (err) {
      logger.error('AdminNotifications', 'Failed to fetch notifications', err);
      res.status(500).json({ error: 'Failed to fetch notifications' });
    }
  });

  return router;
}
