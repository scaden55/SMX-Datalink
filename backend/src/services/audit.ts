import { getDb } from '../db/index.js';
import type { AuditLogEntry, AuditLogFilters } from '@acars/shared';

interface AuditRow {
  id: number;
  actor_id: number | null;
  action: string;
  target_type: string;
  target_id: number | null;
  before_data: string | null;
  after_data: string | null;
  ip_address: string | null;
  created_at: string;
  actor_callsign?: string;
  actor_name?: string;
}

export class AuditService {

  log(params: {
    actorId: number | null;
    action: string;
    targetType: string;
    targetId?: number | null;
    before?: Record<string, unknown> | null;
    after?: Record<string, unknown> | null;
    ipAddress?: string | null;
  }): void {
    getDb().prepare(`
      INSERT INTO audit_log (actor_id, action, target_type, target_id, before_data, after_data, ip_address)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      params.actorId,
      params.action,
      params.targetType,
      params.targetId ?? null,
      params.before ? JSON.stringify(params.before) : null,
      params.after ? JSON.stringify(params.after) : null,
      params.ipAddress ?? null,
    );
  }

  findAll(filters?: AuditLogFilters, page = 1, pageSize = 50): { entries: AuditLogEntry[]; total: number } {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (filters?.actorId) {
      conditions.push('a.actor_id = ?');
      params.push(filters.actorId);
    }
    if (filters?.action) {
      conditions.push('a.action = ?');
      params.push(filters.action);
    }
    if (filters?.targetType) {
      conditions.push('a.target_type = ?');
      params.push(filters.targetType);
    }
    if (filters?.dateFrom) {
      conditions.push('a.created_at >= ?');
      params.push(filters.dateFrom);
    }
    if (filters?.dateTo) {
      conditions.push('a.created_at <= ?');
      params.push(filters.dateTo);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countSql = `SELECT COUNT(*) as count FROM audit_log a ${where}`;
    const { count: total } = getDb().prepare(countSql).get(...params) as { count: number };

    const offset = (page - 1) * pageSize;
    const sql = `
      SELECT a.*,
        u.callsign AS actor_callsign,
        u.first_name || ' ' || u.last_name AS actor_name
      FROM audit_log a
      LEFT JOIN users u ON u.id = a.actor_id
      ${where}
      ORDER BY a.created_at DESC
      LIMIT ? OFFSET ?
    `;

    const rows = getDb().prepare(sql).all(...params, pageSize, offset) as AuditRow[];
    return { entries: rows.map(this.toEntry), total };
  }

  private toEntry(row: AuditRow): AuditLogEntry {
    return {
      id: row.id,
      actorId: row.actor_id,
      actorCallsign: row.actor_callsign ?? null,
      actorName: row.actor_name ?? null,
      action: row.action,
      targetType: row.target_type,
      targetId: row.target_id,
      beforeData: row.before_data ? JSON.parse(row.before_data) : null,
      afterData: row.after_data ? JSON.parse(row.after_data) : null,
      ipAddress: row.ip_address,
      createdAt: row.created_at,
    };
  }
}
