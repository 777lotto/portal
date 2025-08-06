-- Migration number: 0005

-- Add an address column to the users table for service locations.
ALTER TABLE users ADD COLUMN address TEXT;
