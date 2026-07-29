-- CrmLead veli PII'sı içerir (Enrollment ile aynı hassasiyet) — yalnızca
-- SUPERADMIN/BRANCH_ADMIN/GUIDANCE_COORDINATOR görebilir, aynı tenant'taki
-- TEACHER/STUDENT/PARENT dahi göremez (bkz. migration 20260726190757_enrollment_role_rls).
ALTER TABLE "CrmLead" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CrmLead" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_and_role_isolation ON "CrmLead"
  USING (
    "tenantId" = current_setting('app.tenant_id', true)
    AND current_setting('app.role', true) IN ('SUPERADMIN', 'BRANCH_ADMIN', 'GUIDANCE_COORDINATOR')
  );
