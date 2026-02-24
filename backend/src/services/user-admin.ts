import bcrypt from 'bcryptjs';
import { getDb } from '../db/index.js';
import { AuthService } from './auth.js';
import { AuditService } from './audit.js';
import type { AdminUserProfile, UserStatus, AdminUserFilters, UserRole } from '@acars/shared';

interface UserRow {
  id: number;
  email: string;
  callsign: string;
  password_hash: string;
  first_name: string;
  last_name: string;
  role: string;
  rank: string;
  hours_total: number;
  is_active: number;
  status: string;
  last_login: string | null;
  force_password_reset: number;
  simbrief_username: string | null;
  created_at: string;
  updated_at: string;
}

const authService = new AuthService();
const auditService = new AuditService();

export class UserAdminService {

  findAll(filters?: AdminUserFilters, page = 1, pageSize = 50): { users: AdminUserProfile[]; total: number } {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (filters?.role) {
      conditions.push('role = ?');
      params.push(filters.role);
    }
    if (filters?.status) {
      conditions.push('status = ?');
      params.push(filters.status);
    }
    if (filters?.search) {
      conditions.push('(email LIKE ? OR callsign LIKE ? OR first_name LIKE ? OR last_name LIKE ?)');
      const term = `%${filters.search}%`;
      params.push(term, term, term, term);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const { count: total } = getDb().prepare(`SELECT COUNT(*) as count FROM users ${where}`).get(...params) as { count: number };

    const offset = (page - 1) * pageSize;
    const rows = getDb().prepare(`SELECT * FROM users ${where} ORDER BY id LIMIT ? OFFSET ?`).all(...params, pageSize, offset) as UserRow[];

    return { users: rows.map(this.toAdminProfile), total };
  }

  findById(id: number): AdminUserProfile | undefined {
    const row = getDb().prepare('SELECT * FROM users WHERE id = ?').get(id) as UserRow | undefined;
    return row ? this.toAdminProfile(row) : undefined;
  }

  async update(userId: number, data: {
    firstName?: string;
    lastName?: string;
    email?: string;
    callsign?: string;
    role?: UserRole;
    rank?: string;
    status?: UserStatus;
    forcePasswordReset?: boolean;
    password?: string;
  }, actorId: number): Promise<AdminUserProfile | undefined> {
    const db = getDb();
    const existing = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as UserRow | undefined;
    if (!existing) return undefined;

    const before = this.toAdminProfile(existing);

    // Validate password if provided
    if (data.password !== undefined) {
      if (data.password.length < 8) throw new Error('Password must be at least 8 characters');
      if (data.password.length > 128) throw new Error('Password must be at most 128 characters');
    }

    // Validate email if provided
    if (data.email !== undefined && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
      throw new Error('Invalid email format');
    }

    // Build profile field updates
    const sets: string[] = [];
    const params: unknown[] = [];

    if (data.firstName !== undefined) { sets.push('first_name = ?'); params.push(data.firstName); }
    if (data.lastName !== undefined) { sets.push('last_name = ?'); params.push(data.lastName); }
    if (data.email !== undefined) { sets.push('email = ?'); params.push(data.email); }
    if (data.callsign !== undefined) { sets.push('callsign = ?'); params.push(data.callsign); }
    if (data.role !== undefined) { sets.push('role = ?'); params.push(data.role); }
    if (data.rank !== undefined) { sets.push('rank = ?'); params.push(data.rank); }
    if (data.status !== undefined) {
      sets.push('status = ?');
      params.push(data.status);
      sets.push('is_active = ?');
      params.push(data.status === 'active' ? 1 : 0);
    }
    if (data.forcePasswordReset !== undefined) { sets.push('force_password_reset = ?'); params.push(data.forcePasswordReset ? 1 : 0); }

    // Hash password asynchronously if provided
    let passwordHash: string | undefined;
    if (data.password) {
      passwordHash = await bcrypt.hash(data.password, 10);
      sets.push('password_hash = ?');
      params.push(passwordHash);
    }

    if (sets.length === 0) return this.findById(userId);

    // Single atomic UPDATE for all fields including password
    params.push(userId);
    db.prepare(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`).run(...params);

    const after = this.findById(userId)!;
    auditService.log({ actorId, action: 'user.update', targetType: 'user', targetId: userId, before: before as unknown as Record<string, unknown>, after: after as unknown as Record<string, unknown> });
    return after;
  }

  suspend(userId: number, actorId: number): Promise<AdminUserProfile | undefined> {
    return this.update(userId, { status: 'suspended' }, actorId);
  }

  hardDelete(userId: number, actorId: number): boolean {
    const db = getDb();
    const existing = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as UserRow | undefined;
    if (!existing) return false;

    const before = this.toAdminProfile(existing);
    auditService.log({ actorId, action: 'user.delete', targetType: 'user', targetId: userId, before: before as unknown as Record<string, unknown> });

    const del = db.transaction(() => {
      // Null out non-cascading FK references
      db.prepare('UPDATE audit_log SET actor_id = NULL WHERE actor_id = ?').run(userId);
      db.prepare('UPDATE va_settings SET updated_by = NULL WHERE updated_by = ?').run(userId);
      db.prepare('UPDATE logbook SET reviewer_id = NULL WHERE reviewer_id = ?').run(userId);
      db.prepare('UPDATE finances SET created_by = NULL WHERE created_by = ?').run(userId);
      db.prepare('UPDATE scheduled_flights SET created_by = NULL WHERE created_by = ?').run(userId);
      db.prepare('DELETE FROM acars_messages WHERE sender_id = ?').run(userId);
      // CASCADE foreign keys handle refresh_tokens, active_bids, logbook, finances, notifications, news
      db.prepare('DELETE FROM users WHERE id = ?').run(userId);
    });
    del();
    return true;
  }

  reactivate(userId: number, actorId: number): Promise<AdminUserProfile | undefined> {
    return this.update(userId, { status: 'active' }, actorId);
  }

  recordLogin(userId: number): void {
    getDb().prepare("UPDATE users SET last_login = datetime('now') WHERE id = ?").run(userId);
  }

  impersonate(targetUserId: number, actorId: number): { accessToken: string } | null {
    const target = getDb().prepare('SELECT * FROM users WHERE id = ?').get(targetUserId) as UserRow | undefined;
    if (!target) return null;

    // Don't allow impersonating inactive/suspended users
    if (target.is_active !== 1) return null;

    auditService.log({ actorId, action: 'user.impersonate', targetType: 'user', targetId: targetUserId });

    const accessToken = authService.generateAccessToken({
      userId: target.id,
      email: target.email,
      callsign: target.callsign,
      role: target.role as UserRole,
    });

    return { accessToken };
  }

  private toAdminProfile(row: UserRow): AdminUserProfile {
    return {
      id: row.id,
      email: row.email,
      callsign: row.callsign,
      firstName: row.first_name,
      lastName: row.last_name,
      role: row.role as UserRole,
      rank: row.rank,
      hoursTotal: row.hours_total,
      status: (row.status ?? 'active') as UserStatus,
      lastLogin: row.last_login,
      forcePasswordReset: row.force_password_reset === 1,
      simbriefUsername: row.simbrief_username,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
