-- 0008_create_payment_reminders.sql
CREATE TABLE IF NOT EXISTS payment_reminders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  service_id INTEGER NOT NULL,
  reminder_count INTEGER NOT NULL DEFAULT 0,
  last_sent_at TEXT,
  next_scheduled_at TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'sent', 'paid', 'cancelled'
  FOREIGN KEY (service_id) REFERENCES services(id)
);

-- Index for faster querying
CREATE INDEX IF NOT EXISTS idx_payment_reminders_service ON payment_reminders(service_id);
CREATE INDEX IF NOT EXISTS idx_payment_reminders_status ON payment_reminders(status);
CREATE INDEX IF NOT EXISTS idx_payment_reminders_next ON payment_reminders(next_scheduled_at);
