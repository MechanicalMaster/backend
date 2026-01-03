-- Add paisa columns to existing tables for integer-based financial calculations
-- This migration preserves existing data by immediately populating the new columns

-- 1. Add paisa columns to invoice_totals
ALTER TABLE invoice_totals ADD COLUMN subtotal_paisa INTEGER;
ALTER TABLE invoice_totals ADD COLUMN tax_total_paisa INTEGER;
ALTER TABLE invoice_totals ADD COLUMN cgst_paisa INTEGER;
ALTER TABLE invoice_totals ADD COLUMN sgst_paisa INTEGER;
ALTER TABLE invoice_totals ADD COLUMN igst_paisa INTEGER;
ALTER TABLE invoice_totals ADD COLUMN round_off_paisa INTEGER;
ALTER TABLE invoice_totals ADD COLUMN grand_total_paisa INTEGER;

-- Populate paisa columns from existing decimal values
UPDATE invoice_totals SET 
  subtotal_paisa = CAST(subtotal * 100 AS INTEGER),
  tax_total_paisa = CAST(tax_total * 100 AS INTEGER),
  cgst_paisa = CAST(COALESCE(cgst, 0) * 100 AS INTEGER),
  sgst_paisa = CAST(COALESCE(sgst, 0) * 100 AS INTEGER),
  igst_paisa = CAST(COALESCE(igst, 0) * 100 AS INTEGER),
  round_off_paisa = CAST(COALESCE(round_off, 0) * 100 AS INTEGER),
  grand_total_paisa = CAST(grand_total * 100 AS INTEGER);

-- 2. Add paisa column to customers
ALTER TABLE customers ADD COLUMN balance_paisa INTEGER;

UPDATE customers SET balance_paisa = CAST(balance * 100 AS INTEGER);

-- 3. Add paisa column to vendors
ALTER TABLE vendors ADD COLUMN balance_paisa INTEGER;

UPDATE vendors SET balance_paisa = CAST(balance * 100 AS INTEGER);

-- 4. Add paisa column to payments
ALTER TABLE payments ADD COLUMN amount_paisa INTEGER;

UPDATE payments SET amount_paisa = CAST(amount * 100 AS INTEGER);
