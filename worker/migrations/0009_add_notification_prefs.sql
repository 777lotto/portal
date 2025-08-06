-- Migration number: 0009
-- Purpose: Add columns for user notification preferences.

-- Add a column to control email notifications, defaulting to ON (true)
ALTER TABLE users ADD COLUMN email_notifications_enabled INTEGER NOT NULL DEFAULT 1;

-- Add a column to control SMS notifications, defaulting to ON (true)
ALTER TABLE users ADD COLUMN sms_notifications_enabled INTEGER NOT NULL DEFAULT 1;
