-- Migration number: 0006

-- Add an optional company_name column to the users table
ALTER TABLE users ADD COLUMN company_name TEXT;
