-- Veli, ödeme akışında (bkz. task #55) şubenin IBAN'ını / nakit teslim
-- noktasını görebilmeli — RLS politikası PARENT'ı da kapsayacak şekilde
-- genişletilir. Uygulama katmanında (app/api/branch/payment-method-catalog)
-- PARENT yalnızca GET ile ve yalnızca isActive kayıtları görebilir; POST/PATCH/
-- DELETE hâlâ yalnızca BRANCH_ADMIN/ACCOUNTING'e açıktır.
DROP POLICY tenant_and_role_isolation ON "InstitutionPaymentMethod";

CREATE POLICY tenant_and_role_isolation ON "InstitutionPaymentMethod"
  USING (
    "tenantId" = current_setting('app.tenant_id', true)
    AND current_setting('app.role', true) IN ('SUPERADMIN', 'BRANCH_ADMIN', 'ACCOUNTING', 'PARENT')
  );
