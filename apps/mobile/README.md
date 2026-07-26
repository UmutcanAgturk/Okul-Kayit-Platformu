# Seviye 360 — Mobil (Expo)

`apps/web`'deki gerçek Next.js API route'larına (auth, taksit tahsilatı, etüt
onay/red, muhasebe defteri, AI Sınıf Röntgeni) doğrudan konuşan bir React
Native/Expo uygulaması. Ayrı bir backend YOKTUR — kimlik doğrulama da dahil
tüm veri, `apps/web`'in çalışan sunucusundan gelir.

## Mimari notları

- **Kimlik doğrulama**: `apps/web/lib/auth.ts`'deki httpOnly oturum çerezine
  dayanır. React Native'in `fetch`'i (native networking üzerinden) bu çerezi
  bir tarayıcı gibi otomatik saklar/gönderir — istemci tarafında token
  yönetimi yoktur (bkz. `src/lib/api.ts`).
- **Rol yönlendirmesi**: Giriş sonrası `GET /api/me` (bkz.
  `apps/web/app/api/me/route.ts`) çağrılır; dönen role göre
  `src/app/_layout.tsx`'teki `Stack.Protected` grupları arasından doğru
  portala (`(student)`, `(teacher)`, `(branch)`, `(admin)`, `(other)`)
  otomatik geçilir.
- **Kapsam**: Yalnızca gerçek bir Postgres'e karşı çalışan uçtan uca
  özellikler tüketilir (bkz. kök `README.md`'deki FAZ 1 listesi). Mock veri
  kullanan ekranlar (demo/seviye360-app.html'deki gibi) burada yoktur.

## Yeni eklenen API'ler (bu mobil istemci için)

Mobil istemcinin kendi kimliğini/kaynaklarını keşfedebilmesi için `apps/web`'e
salt-okunur endpoint'ler eklendi:

- `GET /api/me` — oturumdaki kullanıcı + role özgü ID'ler (öğrenci/veli için
  bağlı öğrenci listesi, öğretmen için `teacherId`).
- `GET /api/branch/payment-installments` — şubenin taksitlerini listeler
  (`?status=PENDING|PAID` filtresiyle); mevcut `.../[installmentId]/collect`
  route'u yalnızca ID ile çalıştığından, tahsil edilecek taksiti önce
  görebilmek için gerekliydi.
- `GET /api/branch/payment-installments/aging` — vadesi geçmiş taksitleri
  öğrenciye göre gruplayıp 0-30/31-60/61-90/90+ gün yaşlandırma kovalarına
  ayırır (Şube Yönetimi ana ekranında "Tahsilat Yaşlandırma" kartı).
- `GET /api/hq/accounting-ledger` — yalnızca SUPERADMIN: tüm kurumların
  konsolide gelir/gider/net özeti + genel toplam (`(admin)` ana ekranı).

## Kurulum

```bash
cd apps/mobile
npm install
cp .env.example .env   # EXPO_PUBLIC_API_BASE_URL'i düzenleyin
npx expo start
```

`apps/web`'in ayrıca çalışıyor olması gerekir (bkz. kök `README.md` —
"Yerel Geliştirme" bölümü, `npm run dev`).

`EXPO_PUBLIC_API_BASE_URL`, Next.js sunucusunun adresidir:

- **Web/Expo Go (aynı makine)**: `http://localhost:3000`
- **Android emülatörü**: `http://10.0.2.2:3000`
- **iOS simülatörü**: `http://localhost:3000`
- **Fiziksel cihaz**: bilgisayarınızın LAN IP'si, ör. `http://192.168.1.20:3000`

## Kapsam dışı

- AI Sınıf Röntgeni ekranı, sınav/sınıf seçimi için bir keşif (listeleme)
  API'si olmadığından examId/classroomId'yi elle ister — web tarafındaki
  `apps/web/app/(teacher)/sinif-rontgeni/[examId]/page.tsx` da aynı şekilde
  URL parametresine dayanır.
