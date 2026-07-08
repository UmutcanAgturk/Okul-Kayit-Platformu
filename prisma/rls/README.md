# Row-Level Security (Multi-Tenant İzolasyon)

Her tenant-scoped tabloda (`Tenant` FK içeren) RLS aktive edilir. Örnek migration (`prisma/migrations/.../migration.sql` sonuna eklenir):

```sql
ALTER TABLE "Exam" ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON "Exam"
  USING ("tenantId" = current_setting('app.tenant_id', true));
```

Uygulama katmanı (NestJS interceptor / Prisma middleware) her istek başında bağlantı düzeyinde tenant context'i set eder:

```sql
SET LOCAL app.tenant_id = '<request-tenant-id>';
```

`SUPERADMIN` rolü Genel Merkez Portalı için `app.tenant_id` yerine `app.bypass_rls = 'on'` bayrağıyla çalışan ayrı bir veritabanı rolü (`superadmin_role`) kullanır; bu role tenant politikalarından muaftır (`BYPASSRLS`).

## Rol bazlı ek kısıtlama: `AccountingLedgerEntry`

Muhasebe tablosu, tenant izolasyonuna ek olarak bir rol kontrolü de taşır — yalnızca Şube Yöneticisi ve Muhasebe rolündeki kullanıcılar erişebilir. Uygulama katmanı `SET LOCAL app.tenant_id` ile birlikte `SET LOCAL app.role` değerini de set eder:

```sql
ALTER TABLE "AccountingLedgerEntry" ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_and_role_isolation ON "AccountingLedgerEntry"
  USING (
    "tenantId" = current_setting('app.tenant_id', true)
    AND current_setting('app.role', true) IN ('SUPERADMIN', 'BRANCH_ADMIN', 'ACCOUNTING')
  );
```

Bu sayede `TEACHER`, `STUDENT`, `PARENT` ve `GUIDANCE_COORDINATOR` rolündeki bir kullanıcı, aynı tenant'a ait olsa bile Muhasebe kayıtlarını hiçbir zaman sorgulayamaz — veritabanı seviyesinde garanti edilir, sadece UI'da gizlenmiş olmaz.
