-- Migration number: 0011
-- Purpose: Add a column for the user's preferred contact method.

-- Add the column with a CHECK constraint to ensure data integrity and a default value.
ALTER TABLE users ADD COLUMN preferred_contact_method TEXT CHECK(preferred_contact_method IN ('email', 'sms')) DEFAULT 'email';
