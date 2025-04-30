CREATE TABLE IF NOT EXISTS services (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  service_date TEXT NOT NULL,
  status TEXT DEFAULT 'upcoming',
  FOREIGN KEY (user_id) REFERENCES users(id)
);
