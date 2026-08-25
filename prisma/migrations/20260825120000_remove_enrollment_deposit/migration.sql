-- Kapora (ön kayıt kaporası) üründen kaldırıldı — demo'nun ürün kararıyla hizalı.
ALTER TABLE "Enrollment" DROP COLUMN IF EXISTS "depositAmount";
