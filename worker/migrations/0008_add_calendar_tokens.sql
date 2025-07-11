-- Migration number: 0008
-- Purpose: Create a table to store unique, secret tokens for calendar subscriptions.

CREATE TABLE calendar_tokens (
  token TEXT PRIMARY KEY NOT NULL, -- A long, random, unique string
  user_id INTEGER NOT NULL UNIQUE, -- Ensures one token per user
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create an index for quick lookups by user_id
CREATE INDEX idx_calendar_tokens_user_id ON calendar_tokens(user_id);
