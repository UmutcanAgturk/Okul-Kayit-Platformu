# Prisma Şeması ↔ Demo Veri Modeli Uzlaştırması

Bu doküman, `prisma/schema.prisma`'daki (gerçek backend için tasarlanmış) veri modeli
ile `seviye360-app.html`'deki (tarayıcıda çalışan, `localStorage`'a yazan) demo veri
modelini karşılaştırır. Amaç: demo'da kanıtlanmış iş akışlarından hangilerinin gerçek
şemaya zaten karşılık geldiğini, hangilerinin eksik olduğunu ve hangi noktalarda iki
model kasıtlı olarak farklı tasarım kararları içerdiğini netleştirmek — böylece gerçek
backend'e geçişte hangi alanların taşınacağına bilinçli karar verilebilir.

**Kapsam notu:** `apps/web` şu an yalnızca demo'daki ~30 modülden **birini** (Öğretmen
Portalı → AI Sınıf Röntgeni) gerçek Next.js bileşenleri + bir API route ile
implemente ediyor. Aşağıdaki karşılaştırma bu nedenle çoğunlukla **şema ↔ demo veri
şekli** düzeyinde; gerçek UI/route karşılaştırması yalnızca Sınıf Röntgeni için mümkün.

---

## 1. Tenant hiyerarşisi (Genel Merkez → Şube → Bölüm)

| | Prisma | Demo |
|---|---|---|
| Model | `Tenant` — kendine referanslı (`parentId`), `TenantType` enum'u (`GENEL_MERKEZ`/`SUBE`/`BOLUM`) ile **3 seviyeli** gerçek hiyerarşi | `BRANCHES[]` düz bir dizi; Genel Merkez ayrı bir satır değil, portal modunda (`state.portal === "hq"`) örtük olarak var — bir `Tenant` satırı olarak **hiç modellenmemiş** |
| Bölüm (BOLUM) seviyesi | Var (`TenantType.BOLUM`) | Yok — demo'da şubenin altında doğrudan `classrooms[]` (9-A, 9-B gibi fiziksel sınıflar) var, ayrı bir "bölüm" tenant katmanı yok |
| Kurum meta verisi | `code`, `city`, `district`, `isActive` | Çok daha zengin: `kurumTuru`, `address`, `phone`, `email`, `openDate`, `capacity`, `managerName/Phone`, `taxNo`, `ciro` — bunların hiçbiri Prisma şemasında yok |

**Sonuç:** Demo'nun Kurum Yönetimi ekranında girilen zengin alanlar (adres, vergi no,
kapasite, kuruluş tarihi) `Tenant` modeline eklenmeli. Genel Merkez'in kendisinin de
`TenantType.GENEL_MERKEZ` tipinde bir kök `Tenant` satırı olması gerekiyor (demo'da
bu satır yok, sadece bir UI modu).

## 2. Kullanıcı / roller / kimlik doğrulama

| | Prisma | Demo |
|---|---|---|
| Roller | `UserRole` enum: `SUPERADMIN, BRANCH_ADMIN, GUIDANCE_COORDINATOR, ACCOUNTING, TEACHER, STUDENT, PARENT` (**7 rol**) | Portal anahtarları: `hq, branch, ogretmen, veli` (öğrenci/veli aynı girişi paylaşır, `loggedInAsGuardian` bayrağıyla ayrılır) — **`GUIDANCE_COORDINATOR`（Rehber Öğretmen/Koordinatör) ve ayrı bir `ACCOUNTING` rolü demo'da hiç yok**; Muhasebe her zaman Şube Yöneticisi/Genel Merkez'in bir alt sekmesi |
| Kimlik bilgisi | `passwordHash` (hash'lenmiş), `email`/`phone` `@unique` | Düz metin `password: "seviye360"` her yerde sabit, `username` serbest string — **demo bilinçli olarak güvensiz** (tek kullanıcılık tarayıcı demosu için kabul edilebilir, ama Prisma'ya taşınırken asla birebir kopyalanmamalı) |
| Personel rolü | Yok — `TeacherProfile` tek bir "öğretmen" profili; diğer personel türleri (`BRANCH_ADMIN` vb. `User.role` üzerinden) ayrı kayıt değil | Demo'nun `staff[]` dizisinde serbest metin `role` alanı var ("Öğretmen", "Muhasebeci", "Rehber Öğretmen" gibi herhangi bir string olabilir) — Prisma'daki sabit enum'dan daha esnek ama tip güvenliği yok |

**Sonuç:** `GUIDANCE_COORDINATOR` ve `ACCOUNTING` rolleri Prisma'da tanımlı olmasına
rağmen demo'da hiç kullanılmamış — ya demo'ya bu rollerin ayrı giriş/portalları
eklenmeli, ya da Prisma'dan çıkarılıp Şube Yöneticisi'nin alt yetkisi olarak
modellenmeli (demo'nun yaklaşımı).

## 3. Öğrenci / veli / sınıf ataması

| | Prisma | Demo |
|---|---|---|
| Sınıf düzeyi | `GradeLevel` enum (`SINIF_9` vb.) — tip güvenli, sabit liste | Serbest string (`"9. Sınıf"`) — aynı kavram, enum değil |
| Sınıf ataması | `StudentProfile.classroomId` → gerçek `Classroom.id` FK (nullable = henüz atanmamış) | `student.classroom` bir **kod string**'i (`"9-A"`), branch'in `classrooms[]` dizisindeki `code` alanıyla string eşleşmesi yapılıyor — gerçek bir FK değil |
| Veli | `StudentGuardian` join tablosu — **çoklu veli** desteği (`relation`, `isBillingResponsible`) | Öğrenci kaydında tek bir `guardian`/`guardianPhone`/`guardianUsername` alanı — **tek veli** varsayımı |
| Hedef (hedef üniversite/bölüm) | `StudentProfile.targetGoal` (opsiyonel string) | `s.hedef` benzeri alan mevcut (Roadmap özelliğinde) — kavramsal olarak örtüşüyor |

**Sonuç:** En somut boşluk **çoklu veli** desteği — demo'nun tek-veli varsayımı,
boşanmış/ayrı velayetli aileler gibi gerçek senaryoları karşılamıyor. Prisma'nın
`StudentGuardian` modeli gerçek backend için doğru; demo bu noktada bilinçli
basitleştirme yapmış.

## 4. Kayıt (Ön Kayıt → Normal Kayıt)

| | Prisma | Demo |
|---|---|---|
| Durum makinesi | `EnrollmentStage` enum: `ON_KAYIT_ALINDI → SOZLESME_BEKLENIYOR → ODEME_PLANI_OLUSTURULDU → KAYIT_TAMAMLANDI` (+ `IPTAL_EDILDI`) — **açık, denetlenebilir bir durum makinesi** | `crm[]` (Kanban aşamaları) + ayrı `onKayit[]` dizisi + öğrencinin `kayitTuru` alanı — aşamalar arası geçiş UI'da yönetiliyor ama **tek bir enum/durum makinesi olarak modellenmemiş**, üç ayrı veri yapısına dağılmış |
| Kapora | `depositAmount` (`Decimal`) | Demo'dan **kaldırılmış** (bkz. tamamlanan görev #35 "Ön Kayıt: kapora kaldır") — Prisma şeması hâlâ kaporayı varsayıyor, demo'nun ürün kararını yansıtmıyor |

**Sonuç:** İki farklı nokta çelişiyor: (a) demo'nun CRM/Ön Kayıt/Normal Kayıt üçlü
yapısı Prisma'nın tek `Enrollment` + `EnrollmentStage` modeline göre daha parçalı;
(b) Prisma hâlâ "kapora" varsayıyor ama ürün kararı bunu kaldırmak yönünde değişti —
şema bu ürün kararını yakalamalı.

## 5. Müfredat / Sınav / Kazanım

| | Prisma | Demo |
|---|---|---|
| Müfredat ağacı | `CurriculumNode` (SUBJECT→UNIT→TOPIC→ACHIEVEMENT), MEB kazanım kodu | Demo'nun Kazanım Yükleme ekranı (CSV/TSV/xlsx içe aktarma) kavramsal olarak aynı ağacı üretiyor, ama düz bir liste/nesne olarak tutuluyor — hiyerarşik `parentId` ilişkisi yok |
| Sınav | `Exam` + `ExamQuestion` (IRT `irtDifficulty`/`irtDiscrimination` parametreleriyle) | Demo'nun Sınav Uygulaması/Genel Sınav Merkezi modülünde **IRT parametreleri hiç yok** — netScore/percentile daha basit, doğrudan doğru/yanlış/boş sayımından hesaplanıyor |
| **Salon oturma (seating)** | `ExamResult.seatingRoomId`, `seatNo`, `bookletType` hâlâ şemada duruyor | **Tamamen kaldırıldı** (bkz. tamamlanan görev #32 "Sınav Salonu Dağıtımı modülünü tamamen kaldır") |

**Sonuç:** En net uyumsuzluk burada — Prisma şeması hâlâ, ürün kararıyla demo'dan
tamamen silinmiş olan salon/kitapçık oturma özelliğinin alanlarını taşıyor. Bu üç alan
(`seatingRoomId`, `seatNo`, `bookletType`) ya şemadan çıkarılmalı ya da bilinçli olarak
"gelecekte geri gelebilir" notuyla bırakılmalı — şu haliyle şema, artık geçerli
olmayan bir ürün kararını yansıtıyor.

## 6. Ödeme / Taksit / Ödeme Yöntemi

| | Prisma | Demo |
|---|---|---|
| Taksit modeli | `PaymentInstallment` — **her taksit ayrı bir satır** (`installmentNo`, `dueDate`, `paidAt`, `status`) | Öğrenci kaydında **sayaç alanları**: `installmentCount`, `installmentAmount`, `paidInstallments` (kaçı ödendi sayısı) + tek bir `paymentStatus` string'i (`"Güncel"` / `"1 taksit yaklaşıyor"` / `"Gecikmiş ödeme var"`) |
| Tahsilat işlemi | Muhasebe: ilgili `PaymentInstallment.status = PAID` + `AccountingLedgerEntry.relatedInstallmentId` ile izlenebilir | Web Muhasebe'deki "Tahsilat Al" butonu doğrudan `paidInstallments += 1` yapıp `ledger`'a satır ekliyor — **hangi taksitin ödendiğine dair kayıt yok**, sadece sayaç artıyor |
| Ödeme yöntemi | `PaymentMethod` — tokenize kart referansı (`providerCardToken`), maskelenmiş numara | Demo'da 3D Secure kart formu ve dekont yükleme **var** ama gerçek bir token/PCI-uyumlu saklama yok (demo olduğu için beklenen) |

**Sonuç:** Bu, iki model arasındaki **en önemli yapısal fark**. Prisma'nın
taksit-başına-satır modeli doğru ve production-ready; demo'nun sayaç yaklaşımı
(`paidInstallments += 1`) hangi taksitin ne zaman ödendiğini kaybediyor — gerçek
backend'e geçişte demo'nun bu kısmı **birebir taşınmamalı**, Prisma'nın modeli esas
alınmalı.

> **Güncelleme:** Bu madde artık yalnızca bir öneri değil — gerçek bir PostgreSQL
> veritabanına karşı uçtan uca inşa edildi. Bkz. kök `README.md`'deki "Yerel
> Geliştirme (Veritabanı)" bölümü: gerçek bir `prisma migrate dev` migration'ı
> (`prisma/migrations/20260721152831_init`), bir tahsilat API'si
> (`apps/web/app/api/branch/payment-installments/[installmentId]/collect`) ve
> bunu 13 senaryoyla doğrulayan bir entegrasyon testi
> (`apps/web/scripts/test-payment-installments.mjs`). Bu, depodaki gerçek bir
> veritabanına bağlanan **ilk** özellik — `apps/web`'deki diğer tüm route'lar
> (AI Sınıf Röntgeni dahil) hâlâ mock veri döndürüyor.

## 7. Muhasebe

| | Prisma | Demo |
|---|---|---|
| Kayıt | `AccountingLedgerEntry` — `createdByUserId` (kim girdi) ve `relatedInstallmentId` (hangi taksitle ilişkili) alanlarıyla **izlenebilir** | `ledger[]` — yalnızca `type`, `category`, `amount`, `date`; **kim girdiğine dair kayıt yok** |
| Erişim kontrolü | Veritabanı seviyesinde RLS + rol politikası (`prisma/rls/README.md`) — `TEACHER/STUDENT/PARENT/GUIDANCE_COORDINATOR` bu tabloyu **sorgulayamaz bile** | Yalnızca uygulama kodunda (`if` ile ekran/route gizleme) — demo'da mobil Muhasebe zaten salt-okunur ve rolü olmayanlara hiç gösterilmiyor, ama bu istemci tarafı bir kısıtlama |

**Sonuç:** Demo'daki RBAC (kimin hangi ekranı gördüğü) tamamen istemci tarafında;
gerçek backend'e geçerken bu, Prisma'nın önerdiği **veritabanı seviyesi RLS** ile
değiştirilmeli — istemci tarafı gizleme tek başına bir güvenlik sınırı değildir.

> **Güncelleme:** RLS artık gerçek bir Postgres'e uygulandı ve test edildi —
> bkz. `prisma/rls/README.md`'deki "Uygulanma Durumu" bölümü. Orada da not
> edildiği gibi, bugünkü taksit tahsilatı API'si henüz RLS'e tabi olmayan
> (`BYPASSRLS`) bir rolle bağlandığı için politikaların kendisi doğrulanmış
> olsa da API'nin bağlantı katmanı henüz bunlardan gerçekten faydalanmıyor —
> bu ayrı, sonraki bir adım.

## 8. Etüt (StudySession / VIP Eğitim)

| | Prisma | Demo |
|---|---|---|
| Durum | `StudySessionStatus`: `AI_SUGGESTED → TEACHER_APPROVED/TEACHER_REJECTED → COMPLETED/CANCELLED` | Demo'nun Etüt Modülü (randevu + öğretmen onayı) kavramsal olarak aynı akışı izliyor — bu, iki model arasında **en iyi örtüşen** alan |
| Kaynak | `StudySessionSource`: `AI_AUTO_ASSIGNED` / `MANUAL` | Demo'da AI Otomatik Etüt Atama servisi (`apps/services/study-session-assignment`, Kafka dinleyici + Smart Matching) zaten bu ayrımı öngörerek tasarlanmış |

**Sonuç:** Bu modülde ek bir uzlaştırmaya gerek yok — ikisi de aynı kavramsal modele
dayanıyor.

---

## Öncelik sırasına göre eylem listesi

1. **Taksit modelini düzelt** — Prisma'nın taksit-başına-satır yaklaşımı esas alınmalı; demo'nun sayaç yaklaşımı gerçek backend'e taşınmamalı.
2. **Seating/booklet alanlarını şemadan temizle** (`ExamResult.seatingRoomId/seatNo/bookletType`) — artık geçerli olmayan bir ürün kararını yansıtıyorlar.
3. **`Tenant` modeline Genel Merkez kök satırı + zengin kurum meta verisi ekle** (adres, vergi no, kapasite, kuruluş tarihi) — demo'da var, şemada yok.
4. **Kapora (`depositAmount`) alanının ürün kararıyla çelişmesini çöz** — ya şemadan kaldır ya da "artık kullanılmıyor" notu düş.
5. **Çoklu veli desteğini demo tarafında da göz önünde bulundur** — Prisma zaten doğru modellemiş, demo'nun tek-veli varsayımı gerçek backend'e geçişte genişletilmeli.
6. **`GUIDANCE_COORDINATOR`/`ACCOUNTING` rollerinin demo'da karşılığı yok** — ya demo'ya eklenmeli ya da Prisma'dan sadeleştirilmeli.
