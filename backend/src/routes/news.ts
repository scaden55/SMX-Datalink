import { Router } from 'express';
import { NewsService } from '../services/news.js';
import { authMiddleware, adminMiddleware } from '../middleware/auth.js';
import type { CreateNewsRequest, UpdateNewsRequest } from '@acars/shared';
import { logger } from '../lib/logger.js';

export function newsRouter(): Router {
  const router = Router();
  const service = new NewsService();

  // GET /api/news?page=1&pageSize=10 — paginated list (pinned first)
  router.get('/news', authMiddleware, (req, res) => {
    try {
      const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
      const pageSize = Math.min(50, Math.max(1, parseInt(req.query.pageSize as string, 10) || 10));

      const result = service.findAll(page, pageSize);
      res.json(result);
    } catch (err) {
      logger.error('News', 'List error', err);
      res.status(500).json({ error: 'Failed to fetch news' });
    }
  });

  // GET /api/news/:id — single post
  router.get('/news/:id', authMiddleware, (req, res) => {
    try {
      const id = parseInt(req.params.id as string, 10);
      if (isNaN(id)) {
        res.status(400).json({ error: 'Invalid post ID' });
        return;
      }

      const post = service.findById(id);
      if (!post) {
        res.status(404).json({ error: 'Post not found' });
        return;
      }

      res.json(post);
    } catch (err) {
      logger.error('News', 'Get error', err);
      res.status(500).json({ error: 'Failed to fetch post' });
    }
  });

  // POST /api/news — create post (admin only)
  router.post('/news', authMiddleware, adminMiddleware, (req, res) => {
    try {
      const body = req.body as Partial<CreateNewsRequest>;

      if (!body.title?.trim() || !body.body?.trim()) {
        res.status(400).json({ error: 'title and body are required' });
        return;
      }

      const post = service.create(req.user!.userId, {
        title: body.title.trim(),
        body: body.body.trim(),
        pinned: body.pinned,
      });
      res.status(201).json(post);
    } catch (err) {
      logger.error('News', 'Create error', err);
      res.status(500).json({ error: 'Failed to create post' });
    }
  });

  // PATCH /api/news/:id — update post (admin only)
  router.patch('/news/:id', authMiddleware, adminMiddleware, (req, res) => {
    try {
      const id = parseInt(req.params.id as string, 10);
      if (isNaN(id)) {
        res.status(400).json({ error: 'Invalid post ID' });
        return;
      }

      const body = req.body as UpdateNewsRequest;
      const post = service.update(id, body);
      if (!post) {
        res.status(404).json({ error: 'Post not found' });
        return;
      }

      res.json(post);
    } catch (err) {
      logger.error('News', 'Update error', err);
      res.status(500).json({ error: 'Failed to update post' });
    }
  });

  // DELETE /api/news/:id — delete post (admin only)
  router.delete('/news/:id', authMiddleware, adminMiddleware, (req, res) => {
    try {
      const id = parseInt(req.params.id as string, 10);
      if (isNaN(id)) {
        res.status(400).json({ error: 'Invalid post ID' });
        return;
      }

      const deleted = service.delete(id);
      if (!deleted) {
        res.status(404).json({ error: 'Post not found' });
        return;
      }

      res.status(204).send();
    } catch (err) {
      logger.error('News', 'Delete error', err);
      res.status(500).json({ error: 'Failed to delete post' });
    }
  });

  return router;
}
