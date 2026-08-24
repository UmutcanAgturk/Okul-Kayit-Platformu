-- HealthScreening (sağlık taramaları) hassas veridir — kardeş tablosu
-- MedicalCase gibi rol-kısıtlı olmalı. Düz tenant_isolation'ı kaldırıp
-- tenant_and_role_isolation ile değiştir (yalnızca yönetim/rehberlik).
-- Savunma-derinliği: API guard'ı zaten kısıtlıyor, RLS de artık aynı hizada.
DROP POLICY IF EXISTS tenant_isolation ON "HealthScreening";
CREATE POLICY tenant_and_role_isolation ON "HealthScreening"
  USING (
    "tenantId" = current_setting('app.tenant_id', true)
    AND current_setting('app.role', true) IN ('SUPERADMIN', 'BRANCH_ADMIN', 'GUIDANCE_COORDINATOR')
  );
