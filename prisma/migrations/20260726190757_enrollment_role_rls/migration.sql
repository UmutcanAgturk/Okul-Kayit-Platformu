-- Enrollment (Normal Kayıt/Ön Kayıt aday verisi — isim/telefon gibi PII
-- içerir) şimdiye kadar yalnızca tenant_isolation ile korunuyordu; ilk gerçek
-- API (bkz. apps/web/app/api/branch/enrollments) eklenirken, AccountingLedgerEntry/
-- PayrollRecord ile aynı savunma derinliğine getirildi: TEACHER/STUDENT/PARENT
-- aynı tenant'ta olsa bile kayıt adaylarını hiçbir zaman göremez.
DROP POLICY IF EXISTS tenant_isolation ON "Enrollment";
CREATE POLICY tenant_and_role_isolation ON "Enrollment"
  USING (
    "tenantId" = current_setting('app.tenant_id', true)
    AND current_setting('app.role', true) IN ('SUPERADMIN', 'BRANCH_ADMIN', 'GUIDANCE_COORDINATOR')
  );
