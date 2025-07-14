-- Migration number: 0010
-- Purpose: Add a table to store web push notification subscriptions.

CREATE TABLE push_subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL UNIQUE, -- Ensures one subscription per user
  subscription_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create an index for quick lookups by user_id
CREATE INDEX idx_push_subscriptions_user_id ON push_subscriptions(user_id);
