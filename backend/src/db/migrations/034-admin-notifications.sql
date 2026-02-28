-- Admin-sent notifications log: tracks what admins/dispatchers have broadcast
-- Actual delivery to individual users uses the existing `notifications` table

CREATE TABLE IF NOT EXISTS admin_notifications (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  type        TEXT    NOT NULL DEFAULT 'info' CHECK (type IN ('info', 'success', 'warning', 'error')),
  message     TEXT    NOT NULL,
  target_type TEXT    NOT NULL DEFAULT 'all' CHECK (target_type IN ('all', 'user', 'role')),
  target_id   TEXT,
  created_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_admin_notifications_created ON admin_notifications(created_at);
