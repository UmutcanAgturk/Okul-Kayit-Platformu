-- Takvim etkinliklerine rol bazlı görünürlük: BOŞ dizi = herkes görür.
ALTER TABLE "CalendarEvent"
  ADD COLUMN IF NOT EXISTS "visibleRoles" "UserRole"[] NOT NULL DEFAULT ARRAY[]::"UserRole"[];
