-- worker/migrations/0005_create_notifications.sql
CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  type TEXT NOT NULL,
  channels TEXT NOT NULL, -- JSON array of channels used (e.g., ["email", "sms"])
  status TEXT NOT NULL CHECK (status IN ('pending', 'sent', 'failed')),
  metadata TEXT NOT NULL, -- JSON with details about each channel's success/failure
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);
CREATE INDEX IF NOT EXISTS idx_notifications_status ON notifications(status);
