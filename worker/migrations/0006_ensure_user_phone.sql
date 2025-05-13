
-- worker/migrations/0006_ensure_user_phone.sql
-- Just create an index on the existing phone column if not exists
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
