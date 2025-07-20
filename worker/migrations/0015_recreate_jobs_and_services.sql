-- Migration number: 0015_recreate_jobs_and_services.sql
-- Purpose: Consolidates all recent changes into a single migration.
-- This script DROPS the existing jobs and services tables and recreates them
-- with the correct schema, including the new 'total_amount_cents' column in jobs.
-- NOTE: This will delete all existing data in the jobs and services tables.

PRAGMA foreign_keys=off;

-- Drop the old tables
DROP TABLE IF EXISTS services;
DROP TABLE IF EXISTS jobs;

-- Recreate the 'jobs' table with the ideal schema
CREATE TABLE jobs (
  id TEXT PRIMARY KEY,
  customerId TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  start TEXT NOT NULL,
  end TEXT NOT NULL,
  status TEXT NOT NULL,
  recurrence TEXT NOT NULL,
  rrule TEXT,
  crewId TEXT,
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt TEXT NOT NULL DEFAULT (datetime('now')),
  stripe_invoice_id TEXT,
  stripe_quote_id TEXT,
  invoice_created_at TEXT,
  total_amount_cents INTEGER -- New column for the total job value
);

-- Recreate the 'services' table (as line items) with the ideal schema
CREATE TABLE services (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  job_id TEXT, -- Correct TEXT type for UUID
  service_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'upcoming',
  notes TEXT,
  price_cents INTEGER,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE
);

-- Recreate the index for the job_id foreign key
CREATE INDEX idx_services_job_id ON services(job_id);

PRAGMA foreign_keys=on;

