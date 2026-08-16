-- task #53'te unutulan RLS: ExamBranchDispatch, diğer tüm tenant-scoped
-- tablolar gibi (bkz. prisma/rls/README.md) RLS'siz kalmıştı. Bugüne kadar
-- yalnızca SUPERADMIN-gated route'lar (app/api/hq/exams/...) üzerinden
-- erişildiği için bu sızıntı gerçek bir route üzerinden istismar edilebilir
-- değildi, ama defans-derinliği ilkesine göre kapatılır.
ALTER TABLE "ExamBranchDispatch" ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON "ExamBranchDispatch"
  USING ("tenantId" = current_setting('app.tenant_id', true));
