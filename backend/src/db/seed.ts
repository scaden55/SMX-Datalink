import bcrypt from 'bcryptjs';
import { getDb } from './index.js';

export function seedDatabase(): void {
  const db = getDb();

  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
  if (userCount.count > 0) {
    console.log('[Seed] Users already exist — skipping seed');
    return;
  }

  const passwordHash = bcrypt.hashSync('changeme', 10);

  db.prepare(`
    INSERT INTO users (email, callsign, password_hash, first_name, last_name, role, rank)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run('admin@smavirtual.com', 'SMA-001', passwordHash, 'Admin', 'User', 'admin', 'Captain');

  console.log('[Seed] Admin user created: admin@smavirtual.com / changeme');
}
