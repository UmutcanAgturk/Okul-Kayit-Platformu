# Seviye 360 — Satış Sunumu Script'i

Bu doküman, `seviye360-app.html`'in yerleşik **Rehberli Tur** özelliğini (uygulama
içinde "Rehberli Tur" butonu — tur otomatik olarak doğru ekrana/platforma geçer, siz
yalnızca "İleri" tıklayıp konuşursunuz) bir satış görüşmesi akışına çeviren sunum
notlarıdır. Tur'un kendisi kodda `TOUR_STEPS` sabiti olarak tanımlıdır; bu script onun
üzerine **neyi vurgulayacağınızı ve hangi soruları bekleyeceğinizi** ekler.

## Hazırlık (görüşmeden 2 dakika önce)

1. `seviye360-app.html`'i tarayıcıda açın, gerekirse **Verileri Sıfırla** ile temiz başlayın.
2. Giriş: `genel.merkez` / `seviye360`
3. Karşınızdaki müşteriye göre preset seçin (aşağıdaki tabloya bakın), sağ üstteki ilgili butona tıklayın.
4. **Rehberli Tur** butonuna basın — tur, `TOUR_STEPS` sırasına göre ilerler; her adımda sadece "İleri" tıklamanız yeterli, ekran/platform geçişini tur kendisi yapar.

| Müşteri profili | Hangi preset | Neden |
|---|---|---|
| Tek şubeli dershane/okul sahibi | **Küçük Kurum Demosu** | Kendi ölçeğini görsün, karmaşık gelmesin — 12 öğrenci, tek şube üzerinden akıcı bir anlatım |
| Zincir okul / birden fazla şubesi olan işletme | **Büyük Zincir Demosu** | Genel Merkez'in 6 farklı şehirdeki kurumu tek ekrandan nasıl yönettiğini gösterir — Şube Performans Haritası ve Global Analytics burada asıl gücünü gösterir |
| Yatırımcı / genel tanıtım | **Büyük Zincir Demosu** | Ölçeklenebilirliği ve çok-kurumlu veri modelini kanıtlar |

---

## Açılış (30 saniye)

> "Şu an gördüğünüz şey bir mockup değil — canlı, tıklanabilir bir uygulama. Az önce
> tek tıkla yüklediğim bu veri gerçek: her öğrenci, her ödeme, her yoklama kaydı
> aynı veritabanından geliyor. Turu gezerken hangi ekranda olursak olalım, gösterdiğim
> her sayı hesaplanmış gerçek veri — hazırlanmış bir ekran görüntüsü değil."

Bu cümle önemli: demo'nun tüm bu oturum boyunca kanıtlanmış temel iddiasını
(tek veri kaynağı, platformlar arası senkron, hiçbir sayının uydurulmamış olması)
daha ilk 30 saniyede karşı tarafa aktarır.

---

## Tur Adımları — Konuşma Notları

### 1. Bugün: Günlük Nabız
**Ekranda:** Genel Merkez'in "Bugün" özeti — devamsızlık, ödeme, aktivite kutuları + net trend grafiği.
**Söyleyin:** "Genel Merkez'e giren biri her sabah bunu görür — hangi şubede sorun var, hangi ödeme gecikmiş, önceki haftaya göre akademik trend nasıl. Tek ekran, tek bakış."
**Dikkat çekin:** Trend grafiğinin gerçek sınav sonuçlarından hesaplandığını — "bu bir illüstrasyon değil, gerçek net ortalamaları çiziyor."

### 2. Tek Uygulama, 3 Platform
**Ekranda:** Sistem otomatik olarak iOS görünümüne geçer.
**Söyleyin:** "Şimdi platform değişti ama giriş yaptığım hesap, gördüğüm veri aynı. Web'de yaptığınız her işlemi — yoklama, ödeme, mesaj — öğretmeniniz telefonunda, veliniz kendi uygulamasında **anında** görür. Ayrı bir 'senkronize et' butonu yok, çünkü zaten tek bir veritabanından besleniyor."
**Soru beklentisi — "Bu gerçekten senkron mu, yoksa iki ayrı demo mu?"** Cevap: Bu oturumda bunu uçtan uca test ettik (bkz. `t155_full_sync_verification.js`) — bir platformda yazılan veri, diğerinde anında okunuyor, ayrı bir arka plan işi yok.

### 3. Şube Performans Haritası
**Ekranda:** Türkiye haritası, şehir bazlı drill-down.
**Söyleyin (Büyük Zincir'de özellikle güçlü):** "Altı farklı şehirdeki kurumunuzu tek haritadan karşılaştırın — hangi şube doluluk hedefinin altında, hangisi tahsilatta geride. Şehre tıklayınca o kurumun detayına iniyorsunuz."

### 4. Ölçme-Değerlendirme & Yapay Zeka
**Ekranda:** Optik okuma sonuçları, kazanım analizi, AI yorumları.
**Söyleyin:** "Optik formu taradıktan sonra sistem otomatik olarak her öğrencinin hangi kazanımda zayıf olduğunu çıkarıyor ve yapay zeka bunun üzerine kişiselleştirilmiş bir yorum üretiyor — öğretmen manuel analiz yapmak zorunda kalmıyor."

### 5. Aynı Grafikler, Cepte de
**Ekranda:** Sistem Android'e ve Ölçme-Değerlendirme moduna geçer.
**Söyleyin:** "Şube müdürü sahada, telefonundan aynı grafiklere bakabiliyor — masaüstüne dönmesi gerekmiyor."

### 6. Gamification & Lider Tablosu
**Ekranda:** XP, seviye, rozet, lider tablosu.
**Söyleyin:** "Öğrenci motivasyonu için ayrı bir sistem kurmanıza gerek yok — XP ve rozetler zaten sınav, devamsızlık, etüt ve kulüp katılımından otomatik hesaplanıyor."

### 7. Karne / Rapor Kartı
**Ekranda:** Dönemsel karne önizlemesi + net ilerleme trendi.
**Söyleyin:** "Karne dönem sonunda elle hazırlanmıyor — sistem zaten elindeki veriden otomatik üretiyor, yazdırılabilir ve indirilebilir halde."

### 8. Aktivite Akışı
**Ekranda:** Kronolojik denetim izi.
**Söyleyin:** "Kim, ne zaman, hangi kaydı değiştirdi — bu platformdaki her kritik işlem burada denetlenebilir. Kurumsal müşterilerin sorduğu ilk sorulardan biri budur."

### 9. Hızlı Arama (Ctrl/Cmd+K)
**Ekranda:** Komut paleti açılır.
**Söyleyin:** "Ve gündelik kullanım için — herhangi bir ekrandan Ctrl+K ile bir öğrenciyi, personeli ya da kurumu saniyeler içinde bulabilirsiniz."

---

## Kapanış (30 saniye)

> "Gördüğünüz her şey — Genel Merkez'den öğretmene, öğretmenden veliye kadar — tek
> bir veri modelinin farklı görünümleri. Bu bir prototip değil; [demo/seviye360/tests
> altındaki] otomatik test paketiyle platformlar ve roller arası senkronizasyonu
> uçtan uca doğruladık. Sorularınızı alalım."

## Sık Sorulan Sorular

**"Verilerimiz güvende mi?"** → Muhasebe gibi hassas modüller rol bazlı kısıtlanıyor;
gerçek backend'e geçişte bu, veritabanı seviyesinde Row-Level Security ile
güçlendirilecek (bkz. `prisma/rls/README.md`).

**"Kaç şubeye kadar ölçekleniyor?"** → Bu demoda 6 şube gösteriyoruz (Büyük Zincir
preset'i), ama veri modeli sınırlı bir sayıya bağlı değil — Genel Merkez ekranı
kurum sayısından bağımsız çalışır.

**"Mobil uygulamalar gerçek mi, yoksa bu bir simülasyon mu?"** → Bu spesifik demo tek
bir HTML dosyasında Web/iOS/Android görünümlerini birleştiriyor; gerçek App
Store/Play Store dağıtımı ayrı bir mühendislik adımıdır, ama veri modeli ve iş
akışları burada kanıtlandığı gibi taşınabilir (bkz. `PRISMA-UZLASMA.md`).
