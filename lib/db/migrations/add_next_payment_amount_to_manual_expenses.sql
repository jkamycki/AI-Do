-- Add next_payment_amount column to manual_expenses so the Budget page
-- can show what the upcoming payment is and offer a one-click "Mark Paid"
-- that rolls the amount into amount_paid. Idempotent.
ALTER TABLE manual_expenses ADD COLUMN IF NOT EXISTS next_payment_amount NUMERIC(12, 2);
