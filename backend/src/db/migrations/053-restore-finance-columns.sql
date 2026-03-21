-- 053-restore-finance-columns.sql: Re-add columns lost when migration 049 recreated finances table
-- Migration 035 added category, voided_by, is_draft to finances.
-- Migration 049 copy-swapped finances without those columns, dropping them.

ALTER TABLE finances ADD COLUMN category TEXT DEFAULT 'admin';
ALTER TABLE finances ADD COLUMN voided_by INTEGER REFERENCES finances(id);
ALTER TABLE finances ADD COLUMN is_draft INTEGER DEFAULT 0;

-- Backfill categories based on type (same logic as 035)
UPDATE finances SET category = 'payroll' WHERE type IN ('pay', 'bonus', 'deduction');
UPDATE finances SET category = 'revenue' WHERE type = 'income';
UPDATE finances SET category = 'expense' WHERE type = 'expense';

-- Re-create indexes that were lost (from 039)
CREATE INDEX IF NOT EXISTS idx_finances_category ON finances(category);
