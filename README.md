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
