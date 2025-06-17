-- Migration number: 0001 	 2025-06-17T18:21:31.917Z
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  stripe_customer_id TEXT,
  phone TEXT UNIQUE
);
CREATE INDEX idx_users_phone ON users(phone);

CREATE TABLE services (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  service_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'upcoming',
  notes TEXT,
  price_cents INTEGER,
  stripe_invoice_id TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  type TEXT NOT NULL,
  channels TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'sent', 'failed')),
  metadata TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE sms_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('incoming', 'outgoing')),
  phone_number TEXT NOT NULL,
  message TEXT NOT NULL,
  message_sid TEXT,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE payment_reminders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  service_id INTEGER NOT NULL,
  reminder_count INTEGER NOT NULL DEFAULT 0,
  last_sent_at TEXT,
  next_scheduled_at TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  FOREIGN KEY (service_id) REFERENCES services(id)
);

CREATE TABLE password_reset_tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  token TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE jobs (
  id TEXT PRIMARY KEY,
  customerId TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  start TEXT NOT NULL,
  end   TEXT NOT NULL,
  recurrence TEXT NOT NULL,
  rrule TEXT,
  status TEXT NOT NULL,
  crewId TEXT,
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
);
