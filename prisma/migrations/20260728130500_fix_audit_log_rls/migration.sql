-- AuditLogEntry'ye HERHANGİ bir rol (TEACHER/PARENT/STUDENT dahil) yazabilmeli
-- (demo'daki logActivity()'nin tüm rollerden çağrılması gibi) ama yalnızca
-- SUPERADMIN/BRANCH_ADMIN OKUYABİLMELİ. Tek bir USING politikası (diğer
-- tenant_and_role_isolation tablolarındaki gibi) hem SELECT hem INSERT'e aynı
-- kısıtlamayı uygular ve bu ihtiyacı karşılayamaz — bu yüzden burada özel
-- olarak SELECT/INSERT için ayrı politikalar tanımlanır.
DROP POLICY IF EXISTS tenant_and_role_isolation ON "AuditLogEntry";

CREATE POLICY audit_log_select ON "AuditLogEntry"
  FOR SELECT
  USING (
    "tenantId" = current_setting('app.tenant_id', true)
    AND current_setting('app.role', true) IN ('SUPERADMIN', 'BRANCH_ADMIN')
  );

CREATE POLICY audit_log_insert ON "AuditLogEntry"
  FOR INSERT
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
