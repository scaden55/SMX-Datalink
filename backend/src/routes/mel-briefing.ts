import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { getDb } from '../db/index.js';
import { logger } from '../lib/logger.js';

const TAG = 'MelBriefing';

export function melBriefingRouter(): Router {
  const router = Router();

  // GET /api/aircraft/:id/mel-briefing — active MELs for aircraft
  router.get('/aircraft/:id/mel-briefing', authMiddleware, (req, res) => {
    try {
      const aircraftId = parseInt(req.params.id as string);
      const aircraft = getDb().prepare('SELECT id, registration FROM fleet WHERE id = ?').get(aircraftId) as { id: number; registration: string } | undefined;
      if (!aircraft) { res.status(404).json({ error: 'Aircraft not found' }); return; }

      const mels = getDb().prepare(`
        SELECT m.id, m.item_number, m.title, m.category, m.ata_chapter,
          COALESCE(a.title, '') as ata_chapter_title,
          m.deferral_date, m.expiry_date, m.placard_info, m.operations_procedure, m.remarks
        FROM mel_deferrals m
        LEFT JOIN ata_chapters a ON m.ata_chapter = a.chapter
        WHERE m.aircraft_id = ? AND m.status = 'open'
        ORDER BY m.expiry_date ASC
      `).all(aircraftId);

      res.json({ aircraftId, registration: aircraft.registration, activeMels: mels });
    } catch (err) {
      logger.error(TAG, 'Get MEL briefing error', err);
      res.status(500).json({ error: 'Failed to get MEL briefing' });
    }
  });

  // POST /api/aircraft/:id/mel-briefing/ack — acknowledge MEL briefing
  router.post('/aircraft/:id/mel-briefing/ack', authMiddleware, (req, res) => {
    try {
      const aircraftId = parseInt(req.params.id as string);
      const userId = req.user!.userId;
      const now = new Date().toISOString();

      const aircraft = getDb().prepare('SELECT icao_type FROM fleet WHERE id = ?').get(aircraftId) as { icao_type: string } | undefined;
      if (!aircraft) { res.status(404).json({ error: 'Aircraft not found' }); return; }

      const result = getDb().prepare(`
        UPDATE active_bids SET mel_ack_at = ?
        WHERE user_id = ? AND id = (
          SELECT ab.id FROM active_bids ab
          JOIN scheduled_flights sf ON ab.schedule_id = sf.id
          WHERE ab.user_id = ? AND sf.aircraft_type = ?
          ORDER BY ab.created_at DESC LIMIT 1
        ) AND mel_ack_at IS NULL
      `).run(now, userId, userId, aircraft.icao_type);

      res.json({ acknowledged: result.changes > 0 });
    } catch (err) {
      logger.error(TAG, 'Acknowledge MEL briefing error', err);
      res.status(500).json({ error: 'Failed to acknowledge MEL briefing' });
    }
  });

  return router;
}
