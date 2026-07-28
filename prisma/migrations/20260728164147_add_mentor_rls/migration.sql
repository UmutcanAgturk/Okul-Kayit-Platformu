-- RowLevelSecurity
ALTER TABLE "MentorRequest" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MentorRequest" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "MentorRequest"
  USING ("tenantId" = current_setting('app.tenant_id', true));
