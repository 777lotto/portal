-- worker/migrations/0002_add_features.sql

-- Migration number: 0002

-- Add the 'role' column to the existing users table
ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'customer';

-- Add a table for photos
CREATE TABLE photos (
    id TEXT PRIMARY KEY, -- A UUID for the photo
    user_id INTEGER NOT NULL,
    invoice_id TEXT,
    service_id INTEGER,
    job_id TEXT,
    url TEXT NOT NULL, -- This will store the Cloudflare Images URL
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY(user_id) REFERENCES users(id),
    FOREIGN KEY(service_id) REFERENCES services(id),
    FOREIGN KEY(job_id) REFERENCES jobs(id)
);

-- Add a table for notes
CREATE TABLE notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    photo_id TEXT,
    invoice_id TEXT,
    service_id INTEGER,
    job_id TEXT,
    content TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY(user_id) REFERENCES users(id),
    FOREIGN KEY(photo_id) REFERENCES photos(id),
    FOREIGN KEY(service_id) REFERENCES services(id),
    FOREIGN KEY(job_id) REFERENCES jobs(id)
);
