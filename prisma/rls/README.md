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

**Güncelleme — migration rolü / uygulama rolü artık ayrıldı:** Yukarıda
tarif edilen boşluk kapatıldı. `apps/web` artık DB'ye `seviye360` (migration/
sahip, `BYPASSRLS`'li) rolüyle DEĞİL, `app_role` (`apps/web/.env`'deki
`DATABASE_URL`) ile bağlanıyor — bu rol RLS'e tam olarak tabidir. Bkz.
`apps/web/lib/db-context.ts`:

- `resolveActingUser(userId)` — isteği yapan kullanıcının tenant/rolünü
  **istemcinin beyanından değil**, `User` tablosundaki gerçek kayıttan okur
  (`User` tablosunda RLS yok, herkesçe okunabilir referans verisidir).
- `withTenantContext(actor, fn)` — `SUPERADMIN` için ayrı bir bağlantı
  (`apps/web/lib/prisma-superadmin.ts`, `superadmin_role`/`BYPASSRLS`,
  `SUPERADMIN_DATABASE_URL`) kullanır; diğer roller için TEK bir Postgres
  transaction'ı içinde `set_config('app.tenant_id', ..., true)` ve
  `set_config('app.role', ..., true)` (yani `SET LOCAL`) set edip sorguları
  o transaction'ın içinde çalıştırır — transaction bitince ayarlar otomatik
  sıfırlanır, connection pool'daki başka bir isteğe sızmaz.

`apps/web/scripts/test-payment-installments.mjs` bunu API seviyesinde de
doğruluyor: Çankaya (başka tenant) yöneticisi Mezitli'nin taksitini ne
görebiliyor ne de tahsil edebiliyor (ikisi de 404 — tenant varlığı sızdırılmıyor),
ve `STUDENT` rolü tahsilat işlemine hiç yetkili değil (403).

**Kalan, hâlâ açık boşluk — gerçek kimlik doğrulama:** `resolveActingUser`
yalnızca "bu `userId`'nin tenant/rolü nedir?" sorusunu cevaplar; "isteği yapan
kişi gerçekten bu `userId`'nin sahibi mi?" sorusunu cevaplamaz — çünkü depoda
henüz şifre kontrolü/oturum/JWT yok, `collectedByUserId`/`requestedByUserId`
şu an istemcinin serbestçe beyan ettiği bir alan. RLS artık "yanlış tenant'ın
verisini görme" sınıfındaki açığı tamamen kapatıyor; ama "başkasının kimliğine
bürünme" sınıfındaki açık gerçek bir auth sistemi (login + oturum) kurulmadan
kapanmaz. Bu, bu depodaki bir sonraki güvenlik önceliği olmalı.
