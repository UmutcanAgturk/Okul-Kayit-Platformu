# Seviye 360

Seviye Eğitim Kurumları için geliştirilen, bulut tabanlı, yapay zeka destekli, olay güdümlü (event-driven) okul / kurs merkezi otomasyon platformu.

> Akıl ve bilimin ışığında, Atatürk ilke ve inkılaplarına bağlı, veri odaklı, modern, analitik ve saydam eğitim.

## Marka ve Terminoloji Kuralları

- Sistemde, veritabanında, loglarda ve dökümantasyonda **"dershane"** kelimesi kullanılmaz.
- Doğru terimler: **"Kurs Merkezi"**, **"VIP Eğitim"**.
- Kurum hiyerarşisi: Genel Merkez → Şube → Bölüm (örn. *"Özel Mezitli Seviye Anadolu Lisesi"*).

## Monorepo Yapısı

```
seviye-360/
├── apps/
│   ├── web/                          # Next.js 14 (App Router) - 4 portal (Superadmin, Şube, Öğretmen, Öğrenci/Veli)
│   │   └── components/teacher/class-xray/   # FAZ 1 - AI Sınıf Röntgeni
│   └── services/
│       └── study-session-assignment/  # NestJS - AI Otomatik Etüt Atama servisi (Kafka/RabbitMQ tüketicisi)
├── packages/
│   └── algorithms/
│       └── seating/                   # Sınav salonu oturma düzeni algoritması
└── prisma/
    └── schema.prisma                  # Çekirdek veri modeli (PostgreSQL, multi-tenant + RLS)
```

## Teknoloji Yığını

**Frontend:** Next.js (App Router), React 18, TypeScript, Tailwind CSS, Shadcn UI / Radix UI, Zustand, React Query, Recharts.

**Backend:** NestJS mikroservisleri, Domain-Driven Design, Kafka/RabbitMQ (olay güdümlü iletişim).

**Veri katmanı:** PostgreSQL (Row-Level Security ile multi-tenant izolasyon), MongoDB (loglar), Redis (cache/oturum).

**Yapay zeka / algoritmalar:** IRT tabanlı sınav analizi, çakışma önleyici sınav oturma algoritması (Z-pattern), timetabling tabanlı otomatik VIP etüt atama (Smart Matching).

## FAZ 1 Kapsamı

1. Öğretmen Portalı → **AI Sınıf Röntgeni** (kazanım ısı haritası) UI bileşeni.
2. Prisma şeması: `Tenant`, `User`, `CurriculumTree`, `Exam` / `ExamResult`, `StudySession`, `PaymentInstallment`.
3. Sınav salonu oturma düzeni (Seating) algoritması.
4. AI Otomatik Etüt Atama servisi (NestJS + Kafka/RabbitMQ event listener).
5. **Taksit Tahsilatı API'si** (`apps/web/app/api/branch/payment-installments/[installmentId]/collect`) —
   gerçek bir PostgreSQL veritabanına karşı çalışan ilk uçtan uca özellik: bir
   `PaymentInstallment` satırını `PAID` işaretler ve karşılığında bağlantılı
   (`relatedInstallmentId`) bir `AccountingLedgerEntry` oluşturur. Bkz. aşağıdaki
   "Yerel Geliştirme" bölümü.
6. **Row-Level Security, gerçekten bağlı** (`prisma/migrations/20260721154601_add_rls_policies`,
   `apps/web/lib/db-context.ts`) — `prisma/rls/README.md`'de tarif edilen tenant
   izolasyonu ve Muhasebe rol kısıtlaması yalnızca uygulanıp test edilmekle
   kalmadı, taksit tahsilatı API'sinin kendisi de artık `BYPASSRLS`'li migration
   rolüyle değil, tam RLS'e tabi `app_role`/`superadmin_role` ile çalışıyor.
7. **Gerçek kimlik doğrulama** (`apps/web/app/api/auth/login`, `lib/auth.ts`,
   `lib/session.ts`) — bcrypt şifre hash'i + imzalı JWT oturum çerezi. Bu,
   `prisma/rls/README.md`'de işaretlenen son açık güvenlik boşluğunu kapatır:
   artık `collectedByUserId` gibi istemcinin serbestçe beyan ettiği bir alan
   yok — kimlik yalnızca `/api/auth/login`'de doğrulanan bir oturumdan gelir.
8. **İkinci gerçek modül: Etüt (StudySession) onay/red** (`apps/web/app/api/teacher/study-sessions`) —
   taksit tahsilatındaki deseni (gerçek DB + RLS + oturum tabanlı kimlik)
   tekrarlayan, bir öğretmenin yapay zekanın önerdiği (`AI_SUGGESTED`) bir etüt
   seansını onaylayıp/reddedebildiği ikinci uçtan uca özellik.
9. **Oturum iptali (session revocation)** (`prisma/migrations/20260722130645_add_user_sessions`,
   `apps/web/app/api/auth/logout-all`) — imzalı bir JWT'nin 7 günlük geçerlilik
   süresi artık tek başına yeterli değil; her giriş bir `UserSession` satırı
   oluşturur ve bu satır iptal edilirse (logout) veya süresi dolarsa erişim
   hemen kesilir. `/api/auth/logout-all`, çalınmış bir token'a karşı "acil
   durum" düğmesidir — bir hesabın TÜM cihazlardaki oturumlarını tek seferde
   iptal eder.
10. **Üçüncü gerçek modül: AI Sınıf Röntgeni** (`apps/web/app/api/teacher/exams/[examId]/class-xray`) —
    artık sabit mock veri yerine gerçek `Exam`/`ExamResult`/`StudentAchievementResult`
    tablolarından, aynı gerçek DB + RLS + oturum deseniyle üretilen bir
    kazanım ısı haritası.

## Yerel Geliştirme (Veritabanı)

Bu depodaki diğer tüm ekranlar/route'lar (`apps/web/app/api/teacher/exams/...` dahil)
şu ana kadar bilinçli olarak **mock veri** kullanıyordu (bkz. route dosyalarındaki
"Mockup endpoint" notu). Taksit Tahsilatı ve Etüt Onay/Red API'leri ise gerçek
bir Postgres'e karşı, gerçek kimlik doğrulamayla çalışan özellikler. Yerelde
çalıştırmak için:

```bash
# 1) PostgreSQL'i başlat (Debian/Ubuntu örneği; kendi ortamınıza göre uyarlayın)
pg_ctlcluster 16 main start
sudo -u postgres psql -c "CREATE USER seviye360 WITH PASSWORD 'seviye360dev' CREATEDB CREATEROLE BYPASSRLS;"
sudo -u postgres psql -c "CREATE DATABASE seviye360 OWNER seviye360;"
# CREATEROLE + BYPASSRLS, bu rolün migration sırasında app_role/superadmin_role'ü
# oluşturabilmesi için gerekli (bkz. prisma/rls/README.md) — yalnızca yerel
# geliştirme/migration rolü için kabul edilebilir, üretimde ayrı rollere bölünmeli.

# 2) Kökte migration/seed rolüyle (owner) bir .env oluşturun
echo 'DATABASE_URL="postgresql://seviye360:seviye360dev@localhost:5432/seviye360?schema=public"' > .env

# 3) Kök bağımlılıkları kurun, migration'ları uygulayın (app_role/superadmin_role
#    rolleri de bu migration içinde oluşturulur), demo veri yükleyin
npm install
npx prisma migrate dev   # prisma/migrations altındaki tüm migration'ları (şema + RLS + roller) uygular
npm run seed             # 2 kurum, öğrenci/öğretmen/veli/etüt seansı — hepsi aynı SEED_DEV_PASSWORD ile giriş yapabilir

# 4) apps/web'de AYRI bir .env oluşturun — burası owner değil, RLS'e tabi
#    app_role/superadmin_role ile çalışır (bkz. lib/db-context.ts); JWT_SECRET
#    oturum çerezlerini imzalamak için kullanılır (bkz. lib/auth.ts)
cat > apps/web/.env << 'ENVEOF'
DATABASE_URL="postgresql://app_role:app_role_dev_only@localhost:5432/seviye360?schema=public"
SUPERADMIN_DATABASE_URL="postgresql://superadmin_role:superadmin_dev_only@localhost:5432/seviye360?schema=public"
JWT_SECRET="yerel-gelistirme-icin-rastgele-bir-deger"
ENVEOF

# 5) apps/web bağımlılıklarını kurup Next.js sunucusunu başlatın
cd apps/web
npm install
npm run dev

# 6) (ayrı bir terminalde) entegrasyon testlerini çalıştırın
node scripts/test-auth.mjs                   # /api/auth/login ve /logout
node scripts/test-session-revocation.mjs     # oturum iptali: çoklu cihaz, logout-all, süre dolması
node scripts/test-payment-installments.mjs   # taksit tahsilatı API'si (login + tenant izolasyonu + yetki kontrolü)
node scripts/test-study-sessions.mjs         # etüt onay/red API'si (login + tenant izolasyonu + yetki kontrolü)
node scripts/test-class-xray.mjs             # AI Sınıf Röntgeni API'si (login + tenant izolasyonu + yetki kontrolü)
node scripts/test-rls-isolation.mjs          # RLS: tenant izolasyonu + Muhasebe rol kısıtlaması (ham DB seviyesinde)
```

> Not: `prisma/schema.prisma` her değiştiğinde (yeni model/migration), hem
> kökte hem `apps/web` içinde AYRI birer `node_modules/@prisma/client` kopyası
> bulunduğundan (iki bağımsız npm projesi), `npx prisma generate` yalnızca
> kökteki kopyayı günceller. `apps/web`'in çalışan Next.js sunucusu güncel
> modelleri görsün diye, üretilen `.prisma/client` ve `@prisma/client`
> dosyalarını `apps/web/node_modules/` altına da kopyalamanız ve `npm run dev`
> sunucusunu yeniden başlatmanız gerekir.

Tüm seed kullanıcılarının şifresi aynıdır (`prisma/seed.ts`'deki `SEED_DEV_PASSWORD`,
şu an `seviye360dev-pw`) — örn. `merve.aslan@seviye360.com` (Mezitli şube
yöneticisi), `onur.kaya@seviye360.com` (Çankaya şube yöneticisi),
`ayse.demir@seviye360.com` (öğretmen), `elif.yilmaz@ogrenci.seviye360.com` (öğrenci,
9-A). AI Sınıf Röntgeni'ni test edebilmek için 9-A'da 3 öğrenci daha var:
`ahmet.yilmaz@ogrenci.seviye360.com`, `zeynep.kaya@ogrenci.seviye360.com`,
`mehmet.demir@ogrenci.seviye360.com` (hepsi aynı şifreyle).
