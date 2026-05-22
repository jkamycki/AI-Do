ALTER TABLE hotel_blocks
  ADD COLUMN IF NOT EXISTS check_in_date text,
  ADD COLUMN IF NOT EXISTS check_out_date text;
