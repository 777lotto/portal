PRAGMA defer_foreign_keys=TRUE;
CREATE TABLE blocked_dates (
  date TEXT PRIMARY KEY NOT NULL, 
  reason TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  user_id INTEGER, 
  FOREIGN KEY(user_id) REFERENCES users(id)
);
