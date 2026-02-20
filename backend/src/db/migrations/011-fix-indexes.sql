-- Fix: idx_logbook_date was on created_at but all queries filter on actual_dep
-- Add composite indexes for the most common query patterns

-- Composite index for date-range queries by user (logbook page, reports)
CREATE INDEX IF NOT EXISTS idx_logbook_user_dep ON logbook(user_id, actual_dep);

-- Composite index for status + date filtering (leaderboard, pirep admin, reports)
CREATE INDEX IF NOT EXISTS idx_logbook_status_dep ON logbook(status, actual_dep);

-- Index on actual_dep alone for global date-range queries
CREATE INDEX IF NOT EXISTS idx_logbook_actual_dep ON logbook(actual_dep);

-- Drop the unused created_at index (safe — it was never hit by any query)
DROP INDEX IF EXISTS idx_logbook_date;
