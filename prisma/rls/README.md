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
