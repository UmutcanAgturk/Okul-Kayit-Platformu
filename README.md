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
│   ├── mobile/                       # Expo (React Native) - apps/web'in gerçek API'lerine konuşan mobil istemci
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
11. **Dördüncü gerçek modül: Muhasebe Defteri** (`apps/web/app/api/branch/accounting-ledger`) —
    `AccountingLedgerEntry` tablosu RLS'de zaten yalnızca `BRANCH_ADMIN`/`ACCOUNTING`/`SUPERADMIN`
    rollerine açıktı, ama buna karşı çalışan bir API yoktu; artık `GET` ile
    şubenin defterini + gelir/gider özetini listeleyip `POST` ile yeni bir
    kayıt (gelir/gider) ekleyebiliyorsunuz — `TEACHER`/`STUDENT`/`PARENT`
    rolleri hem uygulama katmanında hem veritabanı seviyesinde engellenir.
12. **Gerçek mobil istemci** (`apps/mobile`) — Expo (React Native), yukarıdaki
    gerçek API'lere (auth, taksit tahsilatı, etüt onay/red, muhasebe defteri,
    AI Sınıf Röntgeni) doğrudan konuşur; ayrı bir backend'i yoktur. Bunun
    için iki salt-okunur endpoint eklendi: `GET /api/me` (oturumdaki
    kullanıcının rolüne göre kendi öğrenci/öğretmen kaydını keşfetmesi için)
    ve `GET /api/branch/payment-installments` (taksit tahsilatı ekranının
    önce hangi taksitin tahsil edileceğini listeleyebilmesi için). Ayrıntılar
    için bkz. `apps/mobile/README.md`.
13. **Taksit tahsilatı yaşlandırma raporu** (`apps/web/app/api/branch/payment-installments/aging`) —
    vadesi geçmiş (PENDING + `dueDate` < bugün) taksitleri öğrenciye göre
    gruplayıp standart bir muhasebe yaşlandırma aralığına (0-30/31-60/61-90/90+
    gün) ayırır — demo/seviye360-app.html'deki `agingReportRows`/`t159_aging_report.js`'in
    gerçek Postgres'e karşı çalışan karşılığı. Mobil uygulamada Şube Yönetimi
    ana ekranına eklendi.
14. **Genel Merkez (Superadmin) konsolide muhasebe görünümü** (`apps/web/app/api/hq/accounting-ledger`) —
    `/api/branch/accounting-ledger`'ın kasıtlı olarak dışarıda bıraktığı SUPERADMIN
    rolüne özel: `withTenantContext`'in SUPERADMIN için otomatik geçtiği
    `superadmin_role` (BYPASSRLS) bağlantısıyla tüm kurumların gelir/gider/net
    özetini + genel toplamı döner; `?tenantId=` ile tek bir kurumun kayıtlarına
    drill-down yapılabilir. Mobil uygulamadaki Superadmin yer tutucu ekranının
    yerini aldı.
15. **Türk vergi sistemine göre Muhasebe genişletmeleri** — gerçek bir GİB/
    e-Beyanname entegrasyonu DEĞİLDİR; sayıları doğru hesaplayıp raporlar:
    - **KDV**: `AccountingLedgerEntry.vatRate` (nullable — KDV Kanunu 17/2-b
      uyarınca lisanslı eğitim kurumlarının eğitim geliri gibi istisna
      kalemlerinde null kalır). `amount` her zaman KDV dahildir; matrah/KDV
      ayrıştırması `apps/web/lib/tax.ts`'te, hem `GET/POST /api/branch/accounting-ledger`
      hem yeni `GET /api/branch/accounting-ledger/vat-summary`'de (Hesaplanan/
      İndirilecek/Ödenecek/Devreden KDV) kullanılır.
    - **Stopaj (GVK md 94)**: `AccountingLedgerEntry.withholdingRate` — örn.
      gerçek kişiden kiralanan işyeri kirasında %20. `amount` kesintiden
      ÖNCEKİ tutardır; kesilen pay/kalan net `lib/tax.ts`'te hesaplanır.
    - **Basitleştirilmiş bordro**: yeni `PayrollRecord` modeli + `GET/POST
      /api/branch/payroll` (`apps/web/lib/payroll.ts`). Brüt maaştan SGK/
      işsizlik işçi-işveren payları, gelir vergisi (basitleştirilmiş ilk
      dilim — kümülatif yıllık dilim takibi ve asgari ücret istisnası
      MODELLENMEMİŞTİR, bkz. dosyadaki yorum), damga vergisi hesaplar; her
      bordro, işveren toplam maliyetini otomatik olarak Muhasebe defterine
      "Personel Maaşı" gider kalemi olarak da yazar. `PayrollRecord`,
      `AccountingLedgerEntry` ile aynı rol kısıtlı RLS politikasını taşır
      (yalnızca SUPERADMIN/BRANCH_ADMIN/ACCOUNTING).
16. **Normal Kayıt / Ön Kayıt — gerçek Enrollment API'si** (`apps/web/app/api/branch/enrollments`) —
    `Enrollment` modeli şemada ve RLS'de baştan beri vardı ama hiçbir zaman
    buna karşı çalışan bir API yoktu (demo/seviye360-app.html'deki CRM/Ön Kayıt/
    Normal Kayıt ekranları yalnızca localStorage'a yazıyordu). `GET/POST` bir
    adayı (henüz User/StudentProfile olmadan) tenant'a kaydeder;
    `POST .../[id]/complete` bir NORMAL_KAYIT adayını tamamlar: otomatik
    kullanıcı adı/şifre üretir (`apps/web/lib/enrollment.ts`), gerçek bir
    `User`(STUDENT) + `StudentProfile` + taksit planı (`PaymentInstallment[]`)
    oluşturur ve `Enrollment.stage`'i `KAYIT_TAMAMLANDI`'ya taşır — kayıt geliri
    burada YAZILMAZ, her taksit fiilen tahsil edildiğinde zaten mevcut
    `.../collect` route'u tarafından yazılıyor (çifte sayımı önler). `Enrollment`
    RLS'i bu route eklenirken `AccountingLedgerEntry`/`PayrollRecord` ile aynı
    rol-kısıtlı politikaya yükseltildi (yalnızca BRANCH_ADMIN/GUIDANCE_COORDINATOR/
    SUPERADMIN — aday PII'sı hassastır).
17. **Rate limiting** (`apps/web/middleware.ts`, `apps/web/lib/rate-limit.ts`) —
    RLS README'de "kalan gerçekçi adım" olarak işaretlenmiş boşluğu kapatır.
    Tüm `/api/*` için IP bazlı genel bir üst sınır (120 istek/dk); `/api/auth/login`
    için ayrıca daha sıkı bir IP limiti (20/5dk) VE bağımsız bir hesap (e-posta)
    bazlı kilitlenme (5 başarısız deneme/15dk, yalnızca başarısız denemeler
    sayılır) uygulanır. Bellek içi, tek süreçli dağıtım (`next start`) için
    doğru çalışır — yatay ölçeklenirse paylaşılan bir depo (Redis) gerekir,
    bkz. dosyadaki not.
18. **JWT_SECRET sertleştirme** (`apps/web/lib/auth.ts`) — en az 32 karakter
    zorunlu kılınır; `NODE_ENV=production`'da "dev-only"/"changeme"/"secret"
    gibi bariz bir placeholder içeriyorsa uygulama hiç başlamaz. Bkz.
    `apps/web/.env.example` — üretimde bir secret yöneticisinden enjekte
    edilmesi gerektiği not düşülmüştür.
19. **Muhasebe modülünün ilk gerçek (localStorage değil) arayüzü** —
    `apps/web/app/login`, `apps/web/app/(branch)/muhasebe`,
    `apps/web/components/muhasebe/*`. Bu depodaki route'ların çoğunun (yukarıdaki
    1-18 dahil) hiç kullanıcı arayüzü yoktu — yalnızca API + Prisma modeli
    olarak duruyorlardı. Bu ekran, `/api/auth/login`'e karşı çalışan gerçek bir
    giriş formuyla başlayıp Kayıt Defteri (ekle/sil + KDV özeti), Tahsilat
    Takibi (bekleyen taksitler + yaşlandırma raporu) ve Bordro (öğretmen bazlı)
    sekmelerini `fetch()` ile doğrudan yukarıdaki gerçek API'lere bağlar — hiçbir
    yerde `localStorage` kullanılmaz. Seed veriyle örnek giriş:
    `merve.aslan@seviye360.com` / `seviye360dev-pw` (bkz. "Yerel Geliştirme").
    Fatura/Dekont/Senet artık burada "kapsam dışı" değil — bkz. madde 22.
20. **Personel modülü (öğretmen dışı personel) — beşinci gerçek modül**
    (`prisma/schema.prisma`'daki `StaffProfile` modeli,
    `apps/web/app/api/branch/staff`, `apps/web/app/(branch)/personel`,
    `apps/web/components/personel/PersonelDashboard.tsx`) — madde 19'daki
    "Bordro yalnızca `TeacherProfile`'ı kapsar" sınırını kapatır. `StaffProfile`,
    `TeacherProfile`'ın aksine kendi `tenantId`'sini taşır ve
    `PayrollRecord`/`AccountingLedgerEntry` ile aynı `tenant_and_role_isolation`
    RLS politikasına tabidir (bkz. `prisma/migrations/20260728064932_add_staff_profile`).
    `PayrollRecord.teacherId`/`staffProfileId` artık ikisi de opsiyonel — tam
    olarak biri dolu olmalıdır; bu hem uygulama katmanında hem de veritabanı
    seviyesinde bir `CHECK (num_nonnulls("teacherId", "staffProfileId") = 1)`
    kısıtıyla (`PayrollRecord_teacher_or_staff_check`) garanti edilir. Yeni
    personel eklendiğinde (Şube Müdürü/Muhasebe Görevlisi/Rehber Öğretmen rolüyle)
    otomatik bir kullanıcı adı/şifre üretilir (bkz. `lib/enrollment.ts`'deki
    `generateStaffEmail`) ve yalnızca oluşturma anında düz metin olarak
    gösterilir. Personel "silinmez", yalnızca deaktive edilir (`User.isActive=false`)
    — bordro/defter geçmişiyle FK ilişkisi olan bir kaydı gerçekten silmek veri
    bütünlüğünü bozar. Bordro sekmesindeki kişi seçici artık Öğretmen/Öğretmen
    Dışı Personel arasında geçiş yapabiliyor.
21. **Giriş sonrası modül hub'ı** (`apps/web/app/dashboard`,
    `apps/web/components/dashboard/DashboardHub.tsx`) — `/login` başarılı
    girişten sonra artık sabit bir modüle (eskiden `/muhasebe`) değil,
    `/dashboard`'a yönlendirir. Bu ekran `/api/me`'den dönen role göre erişilebilir
    gerçek modülleri (şu an Muhasebe + Personel, yalnızca `BRANCH_ADMIN`/
    `ACCOUNTING` için) kart olarak listeler; henüz gerçek bir modülü olmayan
    roller için (`TEACHER`/`STUDENT`/`PARENT`/`SUPERADMIN`/`GUIDANCE_COORDINATOR`)
    bunu dürüstçe belirtip demo dosyasına (`demo/seviye360/seviye360-app.html`)
    işaret eder — sessizce boş bir ekran göstermez.
22. **Belgeler: Fatura/Dekont/Senet — altıncı gerçek modül**
    (`prisma/schema.prisma`'daki `Invoice`/`Receipt`/`PromissoryNote` modelleri,
    `apps/web/app/api/branch/invoices`, `.../receipts`, `.../promissory-notes`,
    `apps/web/components/muhasebe/BelgelerPanel.tsx` — Muhasebe'nin yeni
    "Belgeler" sekmesi). Üçü de `AccountingLedgerEntry`/`PayrollRecord`/
    `StaffProfile` ile aynı `tenant_and_role_isolation` RLS politikasına
    tabidir (bkz. `prisma/migrations/20260728073342_add_documents`). Demo'daki
    (`demo/seviye360/seviye360-app.html`) karşılığı gibi bu üç belge türü
    BİLİNÇLİ OLARAK Kayıt Defteri'ne otomatik yazılmaz — birbirinden bağımsız
    belgelerdir (bkz. `lib/documents.ts`). Belge numaraları (`FT-2026-000001`
    gibi) tenant+yıl bazında sıralıdır; üretimi INSERT'i catch-retry ile DEĞİL,
    önce boş bir numara arayıp SONRA tek bir INSERT çalıştırarak yapılır —
    bir Postgres transaction'ı içinde bir INSERT hata verdiğinde transaction'ın
    tamamı "aborted" olur ve aynı transaction içindeki hiçbir sonraki komut
    (bir retry dahil) çalışmaz; bu, geliştirme sırasında gerçek bir hataydı ve
    `scripts/test-documents-module.mjs` ile doğrulanarak düzeltildi. Senet
    için ayrıca bir "Ödendi İşaretle" aksiyonu (`.../promissory-notes/[id]/mark-paid`)
    vardır.

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
# Tarayıcıda http://localhost:3000/login açın. Giriş sonrası /dashboard'a
# yönlendirilirsiniz — buradaki modül kartları (Muhasebe, Personel) role göre
# değişir; şu an yalnızca Şube Yöneticisi/Muhasebe rollerinin gerçek
# (localStorage değil) bir arayüzü var (bkz. yukarıdaki madde 19-20).

# 6) (ayrı bir terminalde) entegrasyon testlerini çalıştırın
node scripts/test-auth.mjs                   # /api/auth/login ve /logout
node scripts/test-session-revocation.mjs     # oturum iptali: çoklu cihaz, logout-all, süre dolması
node scripts/test-payment-installments.mjs   # taksit tahsilatı API'si (login + tenant izolasyonu + yetki kontrolü)
node scripts/test-study-sessions.mjs         # etüt onay/red API'si (login + tenant izolasyonu + yetki kontrolü)
node scripts/test-class-xray.mjs             # AI Sınıf Röntgeni API'si (login + tenant izolasyonu + yetki kontrolü)
node scripts/test-accounting-ledger.mjs      # Muhasebe defteri API'si (login + tenant izolasyonu + yetki kontrolü)
node scripts/test-muhasebe-ui-endpoints.mjs  # Muhasebe arayüzü için eklenen DELETE ledger + GET teachers
node scripts/test-staff-module.mjs           # Personel (StaffProfile) CRUD + staffProfileId ile bordro + DB CHECK constraint
node scripts/test-documents-module.mjs       # Fatura/Dekont/Senet CRUD + KDV hesabı + belge no üretimi + tenant izolasyonu
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
