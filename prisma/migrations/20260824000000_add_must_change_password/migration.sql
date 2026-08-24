-- Öğrenci/veli hesapları kayıtta geçici şifre olarak kendi T.C. Kimlik No'larıyla
-- oluşturulur; bu bayrak, ilk girişte oturum açmadan önce yeni bir şifre
-- belirlemeyi zorunlu kılar (bkz. app/api/auth/login, .../login/set-password).
ALTER TABLE "User" ADD COLUMN "mustChangePassword" BOOLEAN NOT NULL DEFAULT false;
