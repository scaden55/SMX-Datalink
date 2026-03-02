-- Add category for transaction classification
ALTER TABLE finances ADD COLUMN category TEXT DEFAULT 'admin';

-- Track voided transactions (offsetting entry reference)
ALTER TABLE finances ADD COLUMN voided_by INTEGER REFERENCES finances(id);

-- Track draft status for payroll generation
ALTER TABLE finances ADD COLUMN is_draft INTEGER DEFAULT 0;

-- Backfill existing categories based on type
UPDATE finances SET category = 'payroll' WHERE type IN ('pay', 'bonus', 'deduction');
UPDATE finances SET category = 'revenue' WHERE type = 'income';
UPDATE finances SET category = 'expense' WHERE type = 'expense';
