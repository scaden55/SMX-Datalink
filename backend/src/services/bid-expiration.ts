import type { Server as SocketServer } from 'socket.io';
import type { ServerToClientEvents, ClientToServerEvents } from '@acars/shared';
import { getDb } from '../db/index.js';
import { logger } from '../lib/logger.js';

/**
 * Sweeps expired bids every 5 minutes.
 * Bids with flight_plan_phase = 'airborne' or 'active' are protected from expiry.
 */
export class BidExpirationService {
  private interval: ReturnType<typeof setInterval> | null = null;
  private io: SocketServer<ClientToServerEvents, ServerToClientEvents>;

  constructor(io: SocketServer<ClientToServerEvents, ServerToClientEvents>) {
    this.io = io;
  }

  start(): void {
    this.sweep();
    this.interval = setInterval(() => this.sweep(), 5 * 60 * 1000);
    this.interval.unref();
    logger.info('BidExpiration', 'Sweep service started (every 5 min)');
  }

  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  private sweep(): void {
    const db = getDb();

    const expiredBids = db.prepare(`
      SELECT ab.id, ab.user_id, ab.schedule_id, ab.aircraft_id,
             sf.flight_number, sf.flight_type, sf.created_by, sf.expires_at, ab.flight_plan_phase
      FROM active_bids ab
      JOIN scheduled_flights sf ON sf.id = ab.schedule_id
      WHERE ab.expires_at IS NOT NULL
        AND ab.expires_at < datetime('now')
        AND (ab.flight_plan_phase IS NULL OR ab.flight_plan_phase NOT IN ('airborne', 'active'))
    `).all() as {
      id: number;
      user_id: number;
      schedule_id: number;
      aircraft_id: number | null;
      flight_number: string;
      flight_type: string | null;
      created_by: number | null;
      expires_at: string | null;
      flight_plan_phase: string | null;
    }[];

    if (expiredBids.length === 0) return;

    for (const bid of expiredBids) {
      db.prepare('DELETE FROM active_bids WHERE id = ?').run(bid.id);

      if (bid.created_by != null && bid.expires_at == null && bid.flight_type != null) {
        db.prepare('DELETE FROM scheduled_flights WHERE id = ?').run(bid.schedule_id);
      }

      this.notifyUser(bid.user_id, bid.id, bid.flight_number, 'expired');
      logger.info('BidExpiration', `Expired bid ${bid.id} for flight ${bid.flight_number} (user ${bid.user_id})`);
    }
  }

  /** Notify a specific user about bid expiration via their connected sockets */
  notifyUser(userId: number, bidId: number, flightNumber: string, reason: 'expired' | 'admin_removed'): void {
    for (const [, socket] of this.io.sockets.sockets) {
      const s = socket as any;
      if (s.user?.userId === userId) {
        socket.emit('bid:expired', { bidId, flightNumber, reason });
      }
    }
  }
}
