-- Purge legacy soft-deleted users and all cascaded child rows
-- Null out non-cascading FK references first
UPDATE audit_log SET actor_id = NULL WHERE actor_id IN (SELECT id FROM users WHERE status = 'deleted');
UPDATE va_settings SET updated_by = NULL WHERE updated_by IN (SELECT id FROM users WHERE status = 'deleted');
UPDATE logbook SET reviewer_id = NULL WHERE reviewer_id IN (SELECT id FROM users WHERE status = 'deleted');
UPDATE finances SET created_by = NULL WHERE created_by IN (SELECT id FROM users WHERE status = 'deleted');
UPDATE scheduled_flights SET created_by = NULL WHERE created_by IN (SELECT id FROM users WHERE status = 'deleted');
DELETE FROM acars_messages WHERE sender_id IN (SELECT id FROM users WHERE status = 'deleted');
DELETE FROM users WHERE status = 'deleted';
