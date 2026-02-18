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
  created_at: string;
  updated_at: string;
  simbrief_username: string | null;
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

  nextCallsign(): string {
    const row = getDb().prepare(
      "SELECT callsign FROM users WHERE callsign LIKE 'SMA-%' ORDER BY id DESC LIMIT 1"
    ).get() as { callsign: string } | undefined;

    if (!row) return 'SMA-001';

    const num = parseInt(row.callsign.split('-')[1], 10);
    return `SMA-${String(num + 1).padStart(3, '0')}`;
  }

  create(params: {
    email: string;
    passwordHash: string;
    firstName: string;
    lastName: string;
    role: UserRole;
    rank?: string;
    callsign?: string;
  }): UserRow {
    const callsign = params.callsign ?? this.nextCallsign();
    const rank = params.rank ?? 'First Officer';

    const result = getDb().prepare(`
      INSERT INTO users (email, callsign, password_hash, first_name, last_name, role, rank)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(params.email, callsign, params.passwordHash, params.firstName, params.lastName, params.role, rank);

    return this.findById(result.lastInsertRowid as number)!;
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
