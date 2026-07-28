-- RowLevelSecurity
-- MessageRecipient'te tenantId kolonu yoktur (bkz. şemadaki not — ClubMembership
-- ile aynı desen) bu yüzden yalnızca Message üzerinde RLS uygulanır.
ALTER TABLE "Message" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Message" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "Message"
  USING ("tenantId" = current_setting('app.tenant_id', true));
