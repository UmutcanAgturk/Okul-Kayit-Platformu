-- İki faktörlü kimlik doğrulama (TOTP) alanları. User tablosu tenantId FK
-- taşır ve zaten RLS altındadır (bkz. 20260721154601_add_rls_policies) —
-- yeni kolonlar mevcut politikalara tabidir, ek politika gerekmez.
ALTER TABLE "User" ADD COLUMN "totpSecret" TEXT;
ALTER TABLE "User" ADD COLUMN "totpEnabled" BOOLEAN NOT NULL DEFAULT false;
