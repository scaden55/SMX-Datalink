import { getDb } from '../db/index.js';
import type { Notification, NotificationType } from '@acars/shared';

interface NotificationRow {
  id: number;
  user_id: number;
  message: string;
  type: string;
  read: number;
  link: string | null;
  created_at: string;
}

export class NotificationService {

  send(params: {
    userId: number;
    message: string;
    type?: NotificationType;
    link?: string | null;
  }): void {
    getDb().prepare(`
      INSERT INTO notifications (user_id, message, type, link)
      VALUES (?, ?, ?, ?)
    `).run(params.userId, params.message, params.type ?? 'info', params.link ?? null);
  }

  getForUser(userId: number): { notifications: Notification[]; unreadCount: number } {
    // Purge notifications older than 30 days to prevent unbounded growth
    getDb().prepare(
      "DELETE FROM notifications WHERE user_id = ? AND created_at < datetime('now', '-30 days')"
    ).run(userId);

    const rows = getDb().prepare(`
      SELECT * FROM notifications WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT 50
    `).all(userId) as NotificationRow[];

    const { count } = getDb().prepare(
      'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND read = 0'
    ).get(userId) as { count: number };

    return {
      notifications: rows.map(this.toNotification),
      unreadCount: count,
    };
  }

  markRead(id: number, userId: number): boolean {
    const result = getDb().prepare(
      'UPDATE notifications SET read = 1 WHERE id = ? AND user_id = ?'
    ).run(id, userId);
    return result.changes > 0;
  }

  markAllRead(userId: number): void {
    getDb().prepare(
      'UPDATE notifications SET read = 1 WHERE user_id = ? AND read = 0'
    ).run(userId);
  }

  private toNotification(row: NotificationRow): Notification {
    return {
      id: row.id,
      userId: row.user_id,
      message: row.message,
      type: row.type as NotificationType,
      read: row.read === 1,
      link: row.link,
      createdAt: row.created_at,
    };
  }
}
