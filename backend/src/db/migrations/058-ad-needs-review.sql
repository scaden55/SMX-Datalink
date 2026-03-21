-- 058-ad-needs-review.sql
-- Flag for ADs where the parser couldn't confidently classify recurring vs one-time

ALTER TABLE airworthiness_directives ADD COLUMN needs_review INTEGER NOT NULL DEFAULT 0;
ALTER TABLE airworthiness_directives ADD COLUMN classification_reason TEXT;
