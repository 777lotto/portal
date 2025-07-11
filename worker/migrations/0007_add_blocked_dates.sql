-- Migration number: 0007
-- Purpose: Add a table for admins to manually block dates on the calendar.

CREATE TABLE blocked_dates (
  date TEXT PRIMARY KEY NOT NULL, -- YYYY-MM-DD format
  reason TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  user_id INTEGER, -- The admin who blocked the date
  FOREIGN KEY(user_id) REFERENCES users(id)
);
