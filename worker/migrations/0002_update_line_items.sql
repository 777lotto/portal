-- Migration to update the line_items table using ALTER TABLE.

-- Step 1: Rename the 'item' column to 'description' to match the code.
ALTER TABLE line_items RENAME COLUMN item TO description;

-- Step 2: Add the 'quantity' column with a default value.
ALTER TABLE line_items ADD COLUMN quantity INTEGER NOT NULL DEFAULT 1;

-- Step 3: Rename 'total_amount_cents' to 'unit_total_amount_cents'.
ALTER TABLE line_items RENAME COLUMN total_amount_cents TO unit_total_amount_cents;
