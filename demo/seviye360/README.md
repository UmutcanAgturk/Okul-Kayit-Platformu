# Seviye 360 — Demo Artifact

Tek dosyalık, self-contained HTML demo (`seviye360-app.html`): Türkiye çapında şube
işleten bir eğitim kurumu için kayıt/muhasebe/akademik yönetim platformu. Web, iOS ve
Android görünümlerinin tamamı **tek bir dosyada, tek bir JS çalışma zamanında ve tek bir
veri modelinde** çalışır — platform anahtarı sadece görünümü (skin) değiştirir, veri
kaynağı her zaman aynıdır.

Yayınlanan (Claude Artifact) sürüm: https://claude.ai/code/artifact/dd30385d-3e03-46f7-9680-68c879e1bdf3

Bu klasördeki `seviye360-app.html`, o yayının kaynak kopyasıdır — çalışma zamanı bir
Claude Artifact oturumunda yaşadığı için, kaynağın kalıcı bir versiyonunun bu depoda da
bulunması amaçlanmıştır.

## Nasıl çalıştırılır

Derlemeye/bağımlılığa ihtiyaç yoktur — dosyayı doğrudan bir tarayıcıda açmak yeterlidir:

```bash
open seviye360-app.html   # macOS
xdg-open seviye360-app.html   # Linux
```

Veri `localStorage`'da tutulur; "Demo Verisi Yükle" butonu örnek bir şube/öğretmen/öğrenci
seti oluşturur.

## Testler

`tests/` klasöründe Playwright ile yazılmış uçtan uca bir regresyon paketi bulunur:
platformlar arası (Web/iOS/Android) ve roller arası (Genel Merkez, Şube, Öğretmen,
Öğrenci, Veli) veri senkronizasyonunu, RBAC kurallarını, erişilebilirliği ve rehberli
turu doğrular.

```bash
cd tests
npm install
./run_regression.sh
```

`seviye360-app.html` üzerinde yapılacak **her değişiklikten sonra** bu script
çalıştırılmalı — `t155_full_sync_verification.js` (tüm platform/rol senkron
doğrulaması) paketin daimi bir parçasıdır, ayrıca hatırlanıp koşulması gerekmez.
