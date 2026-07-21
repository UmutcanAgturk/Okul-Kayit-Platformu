-- Row-Level Security (multi-tenant izolasyon) — bkz. prisma/rls/README.md.
-- Bu migration'a kadar RLS yalnızca bir tasarım dokümanıydı; hiçbir zaman
-- gerçek bir veritabanına uygulanmamıştı. Uygulama bu tablolara SUPERUSER
-- veya tablo SAHİBİ olarak bağlanırsa RLS hiçbir işe yaramaz (Postgres,
-- FORCE ROW LEVEL SECURITY verilmedikçe tablo sahibini politikalardan muaf
-- tutar) — bu yüzden aşağıda uygulamanın gerçekte bağlanacağı, tabloların
-- SAHİBİ OLMAYAN iki rol tanımlanıyor.

-- ---------------------------------------------------------------------------
-- ROLLER
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_role') THEN
    CREATE ROLE app_role LOGIN PASSWORD 'app_role_dev_only';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'superadmin_role') THEN
    CREATE ROLE superadmin_role LOGIN PASSWORD 'superadmin_dev_only' BYPASSRLS;
  END IF;
END
$$;

GRANT USAGE ON SCHEMA public TO app_role, superadmin_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_role, superadmin_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_role, superadmin_role;

-- ---------------------------------------------------------------------------
-- TENANT İZOLASYONU — doğrudan bir tenantId sütunu taşıyan her tablo
-- ---------------------------------------------------------------------------
-- FORCE ROW LEVEL SECURITY eklenmesinin nedeni: bu tabloların SAHİBİ
-- ("seviye360" migration rolü) app_role/superadmin_role değil — ama ileride
-- biri app_role'ü tablo sahibi yapmaya karar verirse bile politika hâlâ
-- geçerli olsun diye savunma amaçlı ekleniyor.
ALTER TABLE "StudentProfile" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StudentProfile" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "StudentProfile"
  USING ("tenantId" = current_setting('app.tenant_id', true));

ALTER TABLE "Classroom" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Classroom" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "Classroom"
  USING ("tenantId" = current_setting('app.tenant_id', true));

ALTER TABLE "Enrollment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Enrollment" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "Enrollment"
  USING ("tenantId" = current_setting('app.tenant_id', true));

ALTER TABLE "Exam" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Exam" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "Exam"
  USING ("tenantId" = current_setting('app.tenant_id', true));

ALTER TABLE "ExamResult" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ExamResult" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "ExamResult"
  USING ("tenantId" = current_setting('app.tenant_id', true));

ALTER TABLE "StudySession" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StudySession" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "StudySession"
  USING ("tenantId" = current_setting('app.tenant_id', true));

ALTER TABLE "PaymentInstallment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PaymentInstallment" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "PaymentInstallment"
  USING ("tenantId" = current_setting('app.tenant_id', true));

ALTER TABLE "PaymentMethod" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PaymentMethod" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "PaymentMethod"
  USING ("tenantId" = current_setting('app.tenant_id', true));

-- ---------------------------------------------------------------------------
-- MUHASEBE — tenant izolasyonuna EK olarak rol kısıtlaması
-- ---------------------------------------------------------------------------
-- TEACHER/STUDENT/PARENT/GUIDANCE_COORDINATOR aynı tenant'a ait olsa bile bu
-- tabloyu hiçbir zaman göremez — veritabanı seviyesinde garanti edilir.
ALTER TABLE "AccountingLedgerEntry" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AccountingLedgerEntry" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_and_role_isolation ON "AccountingLedgerEntry"
  USING (
    "tenantId" = current_setting('app.tenant_id', true)
    AND current_setting('app.role', true) IN ('SUPERADMIN', 'BRANCH_ADMIN', 'ACCOUNTING')
  );
