-- Migration number: 0018
-- Purpose: Add an expires_at column to the jobs table for quotes and invoices.
ALTER TABLE jobs ADD COLUMN expires_at TEXT;
