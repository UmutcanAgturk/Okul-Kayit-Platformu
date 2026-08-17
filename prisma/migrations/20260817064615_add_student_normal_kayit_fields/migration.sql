-- Normal Kayıt tamamlama formu genişletmesi: T.C. Kimlik No, Doğum Tarihi,
-- Cinsiyet — demo'daki nk-tc/nk-dogum/nk-cinsiyet alanlarının karşılığı
-- (bkz. app/api/branch/enrollments/[enrollmentId]/complete). Hepsi opsiyonel.
ALTER TABLE "StudentProfile" ADD COLUMN     "birthDate" TIMESTAMP(3),
ADD COLUMN     "gender" TEXT,
ADD COLUMN     "nationalId" TEXT;

CREATE UNIQUE INDEX "StudentProfile_nationalId_key" ON "StudentProfile"("nationalId");
