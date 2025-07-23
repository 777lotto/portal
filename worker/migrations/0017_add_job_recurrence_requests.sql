-- Migration number: 0017
-- Purpose: Add a table to manage customer requests for job recurrence.

CREATE TABLE job_recurrence_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id TEXT NOT NULL,
  user_id INTEGER NOT NULL,
  frequency INTEGER NOT NULL, -- e.g., every 7 days, every 30 days
  requested_day INTEGER, -- Day of the week (0=Sun, 1=Mon, ..., 6=Sat)
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'countered')),
  admin_notes TEXT, -- For counters or declines
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(job_id) REFERENCES jobs(id) ON DELETE CASCADE,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_job_recurrence_requests_job_id ON job_recurrence_requests(job_id);
CREATE INDEX idx_job_recurrence_requests_status ON job_recurrence_requests(status);
