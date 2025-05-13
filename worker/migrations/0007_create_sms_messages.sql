-- 0007_create_sms_messages.sql
CREATE TABLE IF NOT EXISTS sms_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('incoming', 'outgoing')),
  phone_number TEXT NOT NULL,
  message TEXT NOT NULL,
  message_sid TEXT, -- VoIP.ms message ID for tracking
  status TEXT NOT NULL, -- 'delivered', 'failed', 'pending'
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Index for faster querying of conversations
CREATE INDEX IF NOT EXISTS idx_sms_messages_user_phone ON sms_messages(user_id, phone_number);
CREATE INDEX IF NOT EXISTS idx_sms_messages_created_at ON sms_messages(created_at);
