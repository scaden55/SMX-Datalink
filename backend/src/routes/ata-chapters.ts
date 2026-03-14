import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { getDb } from '../db/index.js';

export function ataChaptersRouter(): Router {
  const router = Router();

  // GET /api/ata-chapters — list all ATA chapters
  router.get('/ata-chapters', authMiddleware, (_req, res) => {
    try {
      const rows = getDb().prepare('SELECT * FROM ata_chapters ORDER BY chapter').all();
      res.json({ chapters: rows });
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch ATA chapters' });
    }
  });

  return router;
}
