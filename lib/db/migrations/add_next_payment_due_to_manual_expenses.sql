-- Add next_payment_due column to manual_expenses so budget rows can
-- display a Next Payment date alongside vendor-synced expenses. Idempotent.
ALTER TABLE manual_expenses ADD COLUMN IF NOT EXISTS next_payment_due TEXT;
