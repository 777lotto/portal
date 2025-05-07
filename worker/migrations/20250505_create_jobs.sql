CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  customerId TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  start TEXT NOT NULL,   -- ISO timestamp (UTC)
  end   TEXT NOT NULL,
  recurrence TEXT NOT NULL, -- none | weekly | monthly | quarterly | custom
  rrule TEXT,            -- full RRULE for custom recurrence
  status TEXT NOT NULL,  -- scheduled | in_progress | completed | cancelled
  crewId TEXT,
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_jobs_start ON jobs(start);
CREATE INDEX IF NOT EXISTS idx_jobs_end   ON jobs(end);
