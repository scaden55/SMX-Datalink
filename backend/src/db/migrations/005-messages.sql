CREATE TABLE IF NOT EXISTS acars_messages (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  bid_id     INTEGER NOT NULL REFERENCES active_bids(id) ON DELETE CASCADE,
  sender_id  INTEGER NOT NULL REFERENCES users(id),
  type       TEXT NOT NULL CHECK (type IN ('DISPATCHER','PILOT','SYSTEM')),
  content    TEXT NOT NULL,
  source     TEXT NOT NULL DEFAULT 'manual',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_messages_bid ON acars_messages(bid_id);
