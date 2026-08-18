# Seviye 360 — Claude çalışma talimatları

## Çoklu platform kuralı (kalıcı)

Bu proje üç istemciyi tek bir backend'e (`apps/web`'in Next.js API route'ları,
`prisma/schema.prisma`) karşı besler:

- **Web**: `apps/web` (Next.js 14 App Router).
- **Mobil (Android + iOS)**: `apps/mobile` (Expo/React Native, expo-router).
  Tek kod tabanından hem Android hem iOS üretilir — ayrı native (Swift/Kotlin)
  kod tabanları YOKTUR, bilinçli bir tercihtir (bkz. proje geçmişi).

**Kural**: Kullanıcı web tarafında bir güncelleme/özellik istediğinde — özellikle
kimlik doğrulama, ana modüller (Bugün, Öğrenciler, Muhasebe, Taksitler, Etüt,
Sınıf Röntgeni gibi zaten mobilde karşılığı olanlar) ile ilgiliyse — aynı
değişikliğin `apps/mobile`'a da yansıtılması gerekip gerekmediğini değerlendir.
Backend zaten ortak olduğundan (yeni bir route eklenmedikçe) genellikle ek bir
API değişikliği gerekmez; iş `apps/mobile/src` içindeki ilgili ekran(lar)ı web
ile aynı davranışa getirmektir. Kapsam netse (kullanıcı "web ve mobil" ya da
"tüm platformlar" demişse, ya da değişiklik açıkça hem web hem mobilde
kullanılan bir akışı etkiliyorsa) sormadan uygula; belirsizse kısaca sor.

`apps/mobile` henüz web'deki HER modülü kapsamıyor (bkz. `apps/mobile/README.md`
"Kapsam" notu) — kapsam dışı bir modül istenirse önce apps/mobile'a o modülün
ekranını/API tüketimini eklemek gerekir, backend'de zaten route'u vardır.

## Mimari özeti

- **Backend**: `apps/web/app/api/**` (Next.js route handler'ları) + Prisma/
  PostgreSQL (`prisma/schema.prisma`), Row-Level Security ile multi-tenant
  izolasyon (bkz. `prisma/rls/README.md`, `apps/web/lib/db-context.ts`).
- **Kimlik doğrulama**: httpOnly imzalı oturum çerezi (bkz. `apps/web/lib/
  auth.ts`, `apps/web/lib/session.ts`). Personel e-posta/kullanıcı adı + şifre
  ile, Öğrenci/Veli YALNIZCA T.C. Kimlik No + şifre ile girer (bkz.
  `apps/web/app/api/auth/login/route.ts`). Hem web hem `apps/mobile` aynı
  `/api/auth/login`'e karşı çalışır — istemciler arasında ayrı bir token
  mekanizması yoktur, tarayıcı/native fetch çerezi otomatik taşır.
- **Kök `README.md`**: monorepo yapısı, FAZ 1 kapsamı ve yerel geliştirme
  kurulumu için kaynak — büyük mimari kararlardan önce oraya bakılmalı.
