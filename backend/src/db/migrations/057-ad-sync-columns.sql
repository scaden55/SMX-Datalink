-- 057-ad-sync-columns.sql

ALTER TABLE airworthiness_directives ADD COLUMN federal_register_url TEXT;
ALTER TABLE airworthiness_directives ADD COLUMN source TEXT DEFAULT 'manual';
ALTER TABLE airworthiness_directives ADD COLUMN applicability TEXT;
ALTER TABLE airworthiness_directives ADD COLUMN compliance_summary TEXT;
