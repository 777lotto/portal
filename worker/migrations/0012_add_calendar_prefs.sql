-- Migration number: 0012
-- Purpose: Add columns for user-configurable calendar reminders.

-- Add a column to enable/disable iCal feed reminders, defaulting to ON (true).
ALTER TABLE users ADD COLUMN calendar_reminders_enabled INTEGER NOT NULL DEFAULT 1;

-- Add a column for the reminder time in minutes, defaulting to 60.
ALTER TABLE users ADD COLUMN calendar_reminder_minutes INTEGER NOT NULL DEFAULT 60;
