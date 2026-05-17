ALTER TABLE guests
  ADD COLUMN IF NOT EXISTS booked_hotel_room_count integer;
