import Database from 'better-sqlite3';
import { readFileSync, readdirSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { config } from '../config.js';
import { logger } from '../lib/logger.js';

let db: Database.Database | null = null;

const __dirname = dirname(fileURLToPath(import.meta.url));

export function getDb(): Database.Database {
  if (!db) throw new Error('Database not initialized — call initializeDatabase() first');
  return db;
}

export function initializeDatabase(): void {
  // Ensure data directory exists
  const dbDir = dirname(config.dbPath);
  if (!existsSync(dbDir)) {
    mkdirSync(dbDir, { recursive: true });
  }

  db = new Database(config.dbPath);

  // Enable WAL mode and foreign keys
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  runMigrations(db);
  logger.info('DB', `SQLite database ready at ${config.dbPath}`);
}

export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
    logger.info('DB', 'Database closed');
  }
}

function runMigrations(database: Database.Database): void {
  // Create migrations tracking table
  database.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      filename  TEXT    NOT NULL UNIQUE,
      applied_at TEXT   NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Find migration files
  const migrationsDir = join(__dirname, 'migrations');
  if (!existsSync(migrationsDir)) {
    logger.info('DB', 'No migrations directory found — skipping');
    return;
  }

  const files = readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  if (files.length === 0) return;

  // Get already-applied migrations
  const applied = new Set(
    database.prepare('SELECT filename FROM schema_migrations').all()
      .map((row: any) => row.filename as string)
  );

  for (const file of files) {
    if (applied.has(file)) continue;

    const sql = readFileSync(join(migrationsDir, file), 'utf-8');
    database.exec(sql);
    database.prepare('INSERT INTO schema_migrations (filename) VALUES (?)').run(file);
    logger.info('DB', `Applied migration: ${file}`);
  }
}
