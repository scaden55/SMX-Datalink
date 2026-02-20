-- 010-admin-panel.sql: Admin panel schema changes
-- Adds: dispatcher role, user status, audit log, VA settings, finances, notifications
-- Migrates: logbook status 'completed' → 'approved', adds reviewer columns

-- ──────────────────────────────────────────────────────────────────
-- 1. Recreate users table with dispatcher role + admin columns
--    SQLite CHECK constraints require table recreation
-- ──────────────────────────────────────────────────────────────────

PRAGMA foreign_keys = OFF;

CREATE TABLE users_new (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  email                TEXT    NOT NULL UNIQUE COLLATE NOCASE,
  callsign             TEXT    NOT NULL UNIQUE,
  password_hash        TEXT    NOT NULL,
  first_name           TEXT    NOT NULL,
  last_name            TEXT    NOT NULL,
  role                 TEXT    NOT NULL DEFAULT 'pilot' CHECK (role IN ('admin', 'dispatcher', 'pilot')),
  rank                 TEXT    NOT NULL DEFAULT 'First Officer',
  hours_total          REAL    NOT NULL DEFAULT 0,
  is_active            INTEGER NOT NULL DEFAULT 1,
  status               TEXT    NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'deleted')),
  last_login           TEXT,
  force_password_reset INTEGER NOT NULL DEFAULT 0,
  simbrief_username    TEXT,
  created_at           TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at           TEXT    NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO users_new (id, email, callsign, password_hash, first_name, last_name, role, rank, hours_total, is_active, status, last_login, force_password_reset, simbrief_username, created_at, updated_at)
  SELECT id, email, callsign, password_hash, first_name, last_name, role, rank, hours_total, is_active, 'active', NULL, 0, simbrief_username, created_at, updated_at
  FROM users;

DROP TABLE users;
ALTER TABLE users_new RENAME TO users;

-- Recreate trigger
CREATE TRIGGER IF NOT EXISTS users_updated_at
  AFTER UPDATE ON users
  FOR EACH ROW
BEGIN
  UPDATE users SET updated_at = datetime('now') WHERE id = OLD.id;
END;

-- Recreate indexes
CREATE INDEX IF NOT EXISTS idx_users_email    ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_callsign ON users(callsign);
CREATE INDEX IF NOT EXISTS idx_users_role     ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_status   ON users(status);

PRAGMA foreign_keys = ON;

-- ──────────────────────────────────────────────────────────────────
-- 2. Logbook: add reviewer columns, migrate completed → approved
-- ──────────────────────────────────────────────────────────────────

ALTER TABLE logbook ADD COLUMN reviewer_id   INTEGER REFERENCES users(id);
ALTER TABLE logbook ADD COLUMN reviewed_at   TEXT;
ALTER TABLE logbook ADD COLUMN review_notes  TEXT;

UPDATE logbook SET status = 'approved' WHERE status = 'completed';

-- ──────────────────────────────────────────────────────────────────
-- 3. Audit log
-- ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS audit_log (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  actor_id    INTEGER REFERENCES users(id),
  action      TEXT    NOT NULL,
  target_type TEXT    NOT NULL,
  target_id   INTEGER,
  before_data TEXT,
  after_data  TEXT,
  ip_address  TEXT,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_audit_actor   ON audit_log(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_action  ON audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_target  ON audit_log(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_audit_date    ON audit_log(created_at);

-- ──────────────────────────────────────────────────────────────────
-- 4. VA settings (key-value store)
-- ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS va_settings (
  key        TEXT PRIMARY KEY,
  value      TEXT    NOT NULL,
  updated_by INTEGER REFERENCES users(id),
  updated_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ──────────────────────────────────────────────────────────────────
-- 5. Finances (pilot pay, bonuses, deductions)
-- ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS finances (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  pilot_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pirep_id    INTEGER REFERENCES logbook(id),
  type        TEXT    NOT NULL CHECK (type IN ('pay', 'bonus', 'deduction', 'expense', 'income')),
  amount      REAL    NOT NULL,
  description TEXT,
  created_by  INTEGER REFERENCES users(id),
  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_finances_pilot ON finances(pilot_id);
CREATE INDEX IF NOT EXISTS idx_finances_pirep ON finances(pirep_id);
CREATE INDEX IF NOT EXISTS idx_finances_type  ON finances(type);
CREATE INDEX IF NOT EXISTS idx_finances_date  ON finances(created_at);

-- ──────────────────────────────────────────────────────────────────
-- 6. Notifications
-- ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS notifications (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message    TEXT    NOT NULL,
  type       TEXT    NOT NULL DEFAULT 'info' CHECK (type IN ('info', 'success', 'warning', 'error')),
  read       INTEGER NOT NULL DEFAULT 0,
  link       TEXT,
  created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(user_id, read);
