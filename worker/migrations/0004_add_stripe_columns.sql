-- 0004_add_stripe_columns.sql

/* Users ↔ Stripe */
ALTER TABLE users
  ADD COLUMN stripe_customer_id TEXT;

/* Services ↔ Stripe */
ALTER TABLE services
  ADD COLUMN price_cents INTEGER;

ALTER TABLE services
  ADD COLUMN stripe_invoice_id TEXT;

