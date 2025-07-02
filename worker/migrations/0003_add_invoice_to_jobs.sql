-- Migration number: 0003

-- Add columns to the jobs table to link them directly to Stripe invoices
-- This simplifies the logic for our payment status cron job.
ALTER TABLE jobs ADD COLUMN stripe_invoice_id TEXT;
ALTER TABLE jobs ADD COLUMN invoice_created_at TEXT;
