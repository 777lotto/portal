-- Turn off foreign key constraints to allow table changes
PRAGMA foreign_keys=off;

-- Create a new temporary table with the corrected schema
CREATE TABLE users_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE,
  name TEXT NOT NULL,
  password_hash TEXT, -- This is the corrected, nullable column
  stripe_customer_id TEXT,
  phone TEXT UNIQUE,
  role TEXT NOT NULL DEFAULT 'customer' -- Preserving change from migration 0002
);

-- Copy all data from the old users table to the new one
INSERT INTO users_new (id, email, name, password_hash, stripe_customer_id, phone, role)
SELECT id, email, name, password_hash, stripe_customer_id, phone, role FROM users;

-- Delete the old, incorrect table
DROP TABLE users;

-- Rename the new table to the original name
ALTER TABLE users_new RENAME TO users;

-- Recreate any indexes from your original schema
CREATE INDEX idx_users_phone ON users(phone);

-- Turn foreign key constraints back on
PRAGMA foreign_keys=on;
