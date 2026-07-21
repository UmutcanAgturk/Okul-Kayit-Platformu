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

## Yerel Geliştirme (Veritabanı)

Bu depodaki diğer tüm ekranlar/route'lar (`apps/web/app/api/teacher/...` dahil)
şu ana kadar bilinçli olarak **mock veri** kullanıyordu (bkz. route dosyalarındaki
"Mockup endpoint" notu). Taksit Tahsilatı API'si ise gerçek bir Postgres'e karşı
çalışan **ilk** özellik. Yerelde çalıştırmak için:

```bash
# 1) PostgreSQL'i başlat (Debian/Ubuntu örneği; kendi ortamınıza göre uyarlayın)
pg_ctlcluster 16 main start
sudo -u postgres psql -c "CREATE USER seviye360 WITH PASSWORD 'seviye360dev' CREATEDB;"
sudo -u postgres psql -c "CREATE DATABASE seviye360 OWNER seviye360;"

# 2) apps/web/.env dosyasına DATABASE_URL ekleyin
echo 'DATABASE_URL="postgresql://seviye360:seviye360dev@localhost:5432/seviye360?schema=public"' > apps/web/.env

# 3) Bağımlılıkları kurun, migration'ı uygulayın, demo veri yükleyin
cd apps/web
npm install
npx prisma migrate dev   # prisma/migrations altındaki mevcut migration'ı uygular
npx tsx ../../prisma/seed.ts   # 1 kurum, 1 öğrenci, 9 taksit (ilk 2'si ödenmiş) oluşturur

# 4) Next.js sunucusunu başlatın
npm run dev

# 5) (ayrı bir terminalde) uçtan uca entegrasyon testini çalıştırın
DATABASE_URL="postgresql://seviye360:seviye360dev@localhost:5432/seviye360?schema=public" \
  node scripts/test-payment-installments.mjs
```
