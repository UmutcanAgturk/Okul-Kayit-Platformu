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

## Uygulanma Durumu

Bu politikalar artık yalnızca bir tasarım değil — `prisma/migrations/20260721154601_add_rls_policies`
ile gerçek bir PostgreSQL'e uygulandı ve `apps/web/scripts/test-rls-isolation.mjs`
ile 8 senaryoda doğrulandı (tenant değiştirince görünen veri değişiyor, `app.tenant_id`
set edilmemişse hiçbir satır görünmüyor, yanlış tenant'a INSERT engelleniyor,
`TEACHER` Muhasebe'yi göremiyor ama `BRANCH_ADMIN` görüyor, `superadmin_role`
her şeyi bypass ediyor).

**Bilinen boşluk:** `apps/web`'in taksit tahsilatı API'si (bkz.
`demo/seviye360/PRISMA-UZLASMA.md`) şu an DB'ye migration/geliştirme rolü olan
`seviye360` ile bağlanıyor — bu rol, `superadmin_role`'ü oluşturabilmek için
migration sırasında `BYPASSRLS` verildiğinden, **RLS'i tamamen atlıyor**. Yani
API bugün çalışıyor ama bunu RLS'in izin vermesinden değil, bağlandığı rolün
RLS'den muaf olmasından dolayı yapıyor. Üretime geçmeden önce şunlar ayrılmalı:
migration'ları çalıştıran rol (BYPASSRLS gerekebilir) ile uygulamanın istek
başına bağlandığı rol (`app_role`/`superadmin_role`, her istekte
`SET LOCAL app.tenant_id`/`app.role` ile) birbirinden kesin çizgilerle
ayrılmalı. Bu, RLS politikalarının kendisinin değil, **uygulamanın bağlantı
katmanının** henüz yapılmamış bir sonraki adımıdır.
