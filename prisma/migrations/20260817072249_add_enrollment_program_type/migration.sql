-- Ön Kayıt/Normal Kayıt formuna "Kayıt Türü" alanı — demo'daki
-- KAYIT_TURU_OPTIONS ("Normal Kayıt"/"Deneme Kulübü"/"Yaz Kursu"/"Kış Kursu").
ALTER TABLE "Enrollment" ADD COLUMN     "programType" TEXT NOT NULL DEFAULT 'Normal Kayıt';
