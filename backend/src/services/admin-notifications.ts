import type Database from 'better-sqlite3';
import { logger } from '../lib/logger.js';

// ── Types ────────────────────────────────────────────────────────

type NotificationType = 'info' | 'success' | 'warning' | 'error';
type TargetType = 'all' | 'user' | 'role';

export interface CreateNotificationParams {
  type: NotificationType;
  message: string;
  targetType: TargetType;
  targetId?: number | string | null;
  createdBy: number;
}

export interface AdminNotification {
  id: number;
  type: NotificationType;
  message: string;
  targetType: TargetType;
  targetId: string | null;
  createdBy: number | null;
  createdByCallsign: string | null;
  createdAt: string;
  recipientCount: number;
}

interface AdminNotificationRow {
  id: number;
  type: string;
  message: string;
  target_type: string;
  target_id: string | null;
  created_by: number | null;
  created_at: string;
  callsign: string | null;
}

interface PaginatedResult {
  notifications: AdminNotification[];
  total: number;
  page: number;
  pageSize: number;
}

// ── Service functions ────────────────────────────────────────────

/**
 * Create an admin notification: logs it in admin_notifications and delivers
 * to individual user(s) via the notifications table.
 */
export function createNotification(
  db: Database.Database,
  params: CreateNotificationParams,
): AdminNotification {
  const { type, message, targetType, targetId, createdBy } = params;
  const targetIdStr = targetId != null ? String(targetId) : null;

  // 1. Insert into admin_notifications (broadcast log)
  const result = db.prepare(`
    INSERT INTO admin_notifications (type, message, target_type, target_id, created_by)
    VALUES (?, ?, ?, ?, ?)
  `).run(type, message, targetType, targetIdStr, createdBy);

  const adminNotifId = Number(result.lastInsertRowid);

  // 2. Deliver to individual users via the notifications table
  let recipientCount = 0;

  if (targetType === 'all') {
    // Send to all active users
    const users = db.prepare(
      `SELECT id FROM users WHERE status = 'active'`
    ).all() as Array<{ id: number }>;

    const insertStmt = db.prepare(
      `INSERT INTO notifications (user_id, message, type) VALUES (?, ?, ?)`
    );
    const deliverAll = db.transaction(() => {
      for (const u of users) {
        insertStmt.run(u.id, message, type);
        recipientCount++;
      }
    });
    deliverAll();

  } else if (targetType === 'user' && targetIdStr) {
    const userId = parseInt(targetIdStr, 10);
    if (!isNaN(userId)) {
      db.prepare(
        `INSERT INTO notifications (user_id, message, type) VALUES (?, ?, ?)`
      ).run(userId, message, type);
      recipientCount = 1;
    }

  } else if (targetType === 'role' && targetIdStr) {
    const users = db.prepare(
      `SELECT id FROM users WHERE role = ? AND status = 'active'`
    ).all(targetIdStr) as Array<{ id: number }>;

    const insertStmt = db.prepare(
      `INSERT INTO notifications (user_id, message, type) VALUES (?, ?, ?)`
    );
    const deliverRole = db.transaction(() => {
      for (const u of users) {
        insertStmt.run(u.id, message, type);
        recipientCount++;
      }
    });
    deliverRole();
  }

  logger.info('AdminNotifications', `Created notification: ${targetType}=${targetIdStr ?? 'all'}, ${recipientCount} recipients`);

  // Fetch the sender callsign for the response
  const senderRow = db.prepare(
    `SELECT callsign FROM users WHERE id = ?`
  ).get(createdBy) as { callsign: string } | undefined;

  return {
    id: adminNotifId,
    type,
    message,
    targetType,
    targetId: targetIdStr,
    createdBy,
    createdByCallsign: senderRow?.callsign ?? null,
    createdAt: new Date().toISOString(),
    recipientCount,
  };
}

/**
 * List admin-sent notifications with pagination.
 */
export function getNotifications(
  db: Database.Database,
  opts: { page: number; pageSize: number },
): PaginatedResult {
  const { page, pageSize } = opts;
  const offset = (page - 1) * pageSize;

  const countRow = db.prepare(
    `SELECT COUNT(*) AS cnt FROM admin_notifications`
  ).get() as { cnt: number };
  const total = countRow.cnt;

  const rows = db.prepare(`
    SELECT an.*, u.callsign
    FROM admin_notifications an
    LEFT JOIN users u ON u.id = an.created_by
    ORDER BY an.created_at DESC
    LIMIT ? OFFSET ?
  `).all(pageSize, offset) as AdminNotificationRow[];

  const notifications: AdminNotification[] = rows.map((r) => ({
    id: r.id,
    type: r.type as NotificationType,
    message: r.message,
    targetType: r.target_type as TargetType,
    targetId: r.target_id,
    createdBy: r.created_by,
    createdByCallsign: r.callsign,
    createdAt: r.created_at,
    recipientCount: 0, // not tracked per-row; could add later
  }));

  return { notifications, total, page, pageSize };
}
