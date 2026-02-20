import { getDb } from '../db/index.js';
import type { UserProfile, UserRole } from '@acars/shared';

interface UserRow {
  id: number;
  email: string;
  callsign: string;
  password_hash: string;
  first_name: string;
  last_name: string;
  role: UserRole;
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

export class UserService {
  findByEmail(email: string): UserRow | undefined {
    return getDb().prepare('SELECT * FROM users WHERE email = ?').get(email) as UserRow | undefined;
  }

  findById(id: number): UserRow | undefined {
    return getDb().prepare('SELECT * FROM users WHERE id = ?').get(id) as UserRow | undefined;
  }

  findAll(): UserRow[] {
    return getDb().prepare('SELECT * FROM users ORDER BY id').all() as UserRow[];
  }

  emailExists(email: string): boolean {
    const row = getDb().prepare('SELECT 1 FROM users WHERE email = ?').get(email);
    return row !== undefined;
  }

  /**
   * Generate next callsign and create user atomically in a transaction
   * to prevent duplicate callsigns from concurrent registrations.
   */
  create(params: {
    email: string;
    passwordHash: string;
    firstName: string;
    lastName: string;
    role: UserRole;
    rank?: string;
    callsign?: string;
  }): UserRow {
    const db = getDb();
    const rank = params.rank ?? 'First Officer';

    const txn = db.transaction(() => {
      // Generate callsign inside the transaction for atomicity
      let callsign = params.callsign;
      if (!callsign) {
        const row = db.prepare(
          "SELECT callsign FROM users WHERE callsign LIKE 'SMA-%' ORDER BY id DESC LIMIT 1"
        ).get() as { callsign: string } | undefined;

        if (!row) {
          callsign = 'SMA-001';
        } else {
          const num = parseInt(row.callsign.split('-')[1], 10);
          callsign = `SMA-${String(num + 1).padStart(3, '0')}`;
        }
      }

      const result = db.prepare(`
        INSERT INTO users (email, callsign, password_hash, first_name, last_name, role, rank)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(params.email, callsign, params.passwordHash, params.firstName, params.lastName, params.role, rank);

      return this.findById(result.lastInsertRowid as number)!;
    });

    return txn();
  }

  toProfile(row: UserRow): UserProfile {
    return {
      id: row.id,
      email: row.email,
      callsign: row.callsign,
      firstName: row.first_name,
      lastName: row.last_name,
      role: row.role,
      rank: row.rank,
      hoursTotal: row.hours_total,
      createdAt: row.created_at,
      simbriefUsername: row.simbrief_username ?? undefined,
      status: row.status ?? 'active',
      lastLogin: row.last_login ?? null,
    };
  }

  getSimbriefUsername(userId: number): string | null {
    const row = getDb().prepare('SELECT simbrief_username FROM users WHERE id = ?').get(userId) as { simbrief_username: string | null } | undefined;
    return row?.simbrief_username ?? null;
  }

  updateSimbriefUsername(userId: number, username: string | null): void {
    getDb().prepare('UPDATE users SET simbrief_username = ? WHERE id = ?').run(username, userId);
  }
}
