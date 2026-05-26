ALTER TABLE vendor_payments
ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS vendor_payments_vendor_due_idx
ON vendor_payments (vendor_id, due_date);

CREATE TABLE IF NOT EXISTS manual_expense_payments (
  id SERIAL PRIMARY KEY,
  manual_expense_id INTEGER NOT NULL REFERENCES manual_expenses(id) ON DELETE CASCADE,
  description TEXT NOT NULL DEFAULT '',
  amount NUMERIC(12, 2) NOT NULL,
  due_date TEXT NOT NULL,
  is_paid BOOLEAN NOT NULL DEFAULT FALSE,
  paid_at TIMESTAMP,
  notes TEXT,
  receipt_url TEXT,
  receipt_name TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS manual_expense_payments_expense_due_idx
ON manual_expense_payments (manual_expense_id, due_date);

CREATE INDEX IF NOT EXISTS manual_expense_payments_unpaid_due_idx
ON manual_expense_payments (due_date)
WHERE is_paid = FALSE;
