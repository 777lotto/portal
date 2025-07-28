-- Migration number: 0001
-- Purpose: Initial consolidated schema for the application.

-- Create users table
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE,
  name TEXT NOT NULL,
  password_hash TEXT,
  stripe_customer_id TEXT,
  phone TEXT UNIQUE,
  role TEXT NOT NULL DEFAULT 'customer',
  address TEXT,
  company_name TEXT,
  email_notifications_enabled INTEGER NOT NULL DEFAULT 1,
  sms_notifications_enabled INTEGER NOT NULL DEFAULT 1,
  preferred_contact_method TEXT CHECK(preferred_contact_method IN ('email', 'sms')) DEFAULT 'email',
  calendar_reminders_enabled INTEGER NOT NULL DEFAULT 1,
  calendar_reminder_minutes INTEGER NOT NULL DEFAULT 60
);
CREATE INDEX idx_users_phone ON users(phone);

-- Create jobs table
CREATE TABLE jobs (
  id TEXT PRIMARY KEY,
  customerId TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL,
  recurrence TEXT NOT NULL,
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt TEXT NOT NULL DEFAULT (datetime('now')),
  stripe_invoice_id TEXT,
  stripe_quote_id TEXT,
  total_amount_cents INTEGER,
  due TEXT
);

-- Create line_items table
CREATE TABLE line_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id TEXT,
  item TEXT,
  price_cents INTEGER,
  FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE
);
CREATE INDEX idx_line_items_job_id ON line_items(job_id);

-- Create photos table
CREATE TABLE photos (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    invoice_id TEXT,
    item_id INTEGER,
    job_id TEXT,
    url TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY(user_id) REFERENCES users(id),
    FOREIGN KEY(item_id) REFERENCES line_items(id),
    FOREIGN KEY(job_id) REFERENCES jobs(id)
);

-- Create notes table
CREATE TABLE notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    photo_id TEXT,
    invoice_id TEXT,
    item_id INTEGER,
    job_id TEXT,
    content TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY(user_id) REFERENCES users(id),
    FOREIGN KEY(photo_id) REFERENCES photos(id),
    FOREIGN KEY(item_id) REFERENCES line_items(id),
    FOREIGN KEY(job_id) REFERENCES jobs(id)
);

-- Create notifications table
CREATE TABLE notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  type TEXT NOT NULL,
  message TEXT NOT NULL,
  link TEXT,
  is_read INTEGER NOT NULL DEFAULT 0,
  channels TEXT, -- Store as JSON array: '["ui", "email", "sms", "push"]'
  status TEXT NOT NULL CHECK (status IN ('pending', 'sent', 'failed')),
  metadata TEXT, -- Store as JSON
  push_subscription_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX idx_notifications_user_id ON notifications(user_id);


-- Create calendar_events table
CREATE TABLE calendar_events (
  date TEXT PRIMARY KEY NOT NULL,
  reason TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  user_id INTEGER,
  FOREIGN KEY(user_id) REFERENCES users(id)
);

-- Create job_recurrence_requests table
CREATE TABLE job_recurrence_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id TEXT NOT NULL,
  user_id INTEGER NOT NULL,
  frequency INTEGER NOT NULL,
  requested_day INTEGER,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'countered')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(job_id) REFERENCES jobs(id) ON DELETE CASCADE,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX idx_job_recurrence_requests_job_id ON job_recurrence_requests(job_id);
CREATE INDEX idx_job_recurrence_requests_status ON job_recurrence_requests(status);


-- Unchanged tables
CREATE TABLE password_reset_tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  token TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE calendar_tokens (
  token TEXT PRIMARY KEY NOT NULL,
  user_id INTEGER NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX idx_calendar_tokens_user_id ON calendar_tokens(user_id);
