-- Migration number: 0014
-- Purpose: Refactor the services table to function as line items for jobs.
ALTER TABLE services ADD COLUMN job_id INTEGER REFERENCES jobs(id) ON DELETE CASCADE;

-- This will create an index for faster lookups of services related to a job.
CREATE INDEX idx_services_job_id ON services(job_id);

-- The 'stripe_invoice_id' column on 'services' is now redundant.
-- For safety, we'll rename it rather than dropping it immediately.
ALTER TABLE services RENAME COLUMN stripe_invoice_id TO _deprecated_stripe_invoice_id;
