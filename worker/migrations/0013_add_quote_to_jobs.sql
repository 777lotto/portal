-- Migration number: 0013
-- Purpose: Add a column to the jobs table to link them to Stripe Quotes.
ALTER TABLE jobs ADD COLUMN stripe_quote_id TEXT;
