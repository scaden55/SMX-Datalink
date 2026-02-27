-- 028-bid-expiration.sql
-- Add expiration timestamp to active_bids for 24-hour bid reservations
ALTER TABLE active_bids ADD COLUMN expires_at TEXT;

-- Backfill existing bids: set expires_at to 24 hours from created_at
UPDATE active_bids SET expires_at = datetime(created_at, '+24 hours') WHERE expires_at IS NULL;
