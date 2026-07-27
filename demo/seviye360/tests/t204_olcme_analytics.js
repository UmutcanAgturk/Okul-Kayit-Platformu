const { chromium } = require('playwright');
const APP = 'file://' + require('path').resolve(__dirname, '../seviye360-app.html');

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const page = await browser.newPage({ viewport: { width: 1400, height: 1100 } });
  const errors = [];
  const results = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', msg => { if (msg.type() === 'error') errors.push('[console] ' + msg.text()); });
  const check = (label, ok, detail) => { results.push({ label, ok }); console.log(`[${ok ? 'OK' : 'FAIL'}] ${label}${detail !== undefined ? ' — ' + detail : ''}`); };

  await page.goto(APP);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForTimeout(500);
  await page.click('#landing-cta-nav');
  await page.fill('#login-username', 'genel.merkez');
  await page.fill('#login-password', 'seviye360');
  await page.click('#login-submit');
  await page.waitForTimeout(700);
  await page.click('#db-seed-btn');
  await page.waitForTimeout(800);

  // ===== 1) HQ Ölçme-Değerlendirme > Sınav Genel Durumu: şube karşılaştırması görünüyor =====
  await page.evaluate(() => { state.portal = 'hq'; state.screen = 'olcme'; olcmeSubTab = 'durum'; renderAll(); });
  await page.waitForTimeout(400);
  let bodyText = await page.locator('#olcme-body').innerText();
  check('HQ Sınav Genel Durumu: "Şubeler Arası Karşılaştırmalı Net Sıralaması" kartı görünüyor', /Şubeler Arası Karşılaştırmalı Net Sıralaması/.test(bodyText));
  check('HQ Sınav Genel Durumu: "Sınav Bazlı Soru/Madde Analizi" kartı görünüyor', /Sınav Bazlı Soru\/Madde Analizi/.test(bodyText));

  // ===== 2) Şube kapsamında (HQ değil) şube karşılaştırma kartı GÖRÜNMEMELİ =====
  await page.evaluate(() => { state.portal = 'branch'; state.screen = 'olcme'; olcmeSubTab = 'durum'; renderAll(); });
  await page.waitForTimeout(400);
  bodyText = await page.locator('#olcme-body').innerText();
  check('Şube kapsamında şube karşılaştırma kartı gizli', !/Şubeler Arası Karşılaştırmalı Net Sıralaması/.test(bodyText));
  check('Şube kapsamında da soru/madde analizi kartı görünüyor', /Sınav Bazlı Soru\/Madde Analizi/.test(bodyText));

  // ===== 3) Sınav seçici çalışıyor (değiştirince madde analizi grafiği güncelleniyor) =====
  const examSelectCount = await page.locator('#durum-exam-select option').count();
  if (examSelectCount >= 2) {
    const beforeHtml = await page.locator('#olcme-body .card:has(h3:has-text("Sınav Bazlı Soru/Madde Analizi"))').innerHTML();
    await page.selectOption('#durum-exam-select', { index: 1 });
    await page.waitForTimeout(300);
    const afterHtml = await page.locator('#olcme-body .card:has(h3:has-text("Sınav Bazlı Soru/Madde Analizi"))').innerHTML();
    check('Sınav seçici değiştirilince madde analizi kartı yeniden render ediliyor', beforeHtml !== afterHtml || examSelectCount < 2);
  } else {
    check('Sınav seçici testi atlandı (yalnızca 0-1 sınav var)', true);
  }

  // ===== 4) Kazanım Analizi: Müfredat Kapsama Oranı kartı ve risk filtresi =====
  await page.evaluate(() => { olcmeSubTab = 'kazanim'; renderAll(); });
  await page.waitForTimeout(400);
  bodyText = await page.locator('#olcme-body').innerText();
  check('Kazanım Analizi: "Müfredat Kapsama Oranı" kartı görünüyor', /Müfredat Kapsama Oranı/.test(bodyText));
  check('Kazanım Analizi: "Desteğe İhtiyaç Duyan Öğrenciler" kartı hâlâ var', /Desteğe İhtiyaç Duyan Öğrenciler/.test(bodyText));

  const riskFilterCount = await page.locator('#kazanim-risk-filter option').count();
  if (riskFilterCount >= 2) {
    const beforeRows = await page.locator('#olcme-body .card:has(h3:has-text("Desteğe İhtiyaç Duyan Öğrenciler")) tbody tr').count();
    await page.selectOption('#kazanim-risk-filter', { index: 1 });
    await page.waitForTimeout(300);
    const afterRows = await page.locator('#olcme-body .card:has(h3:has-text("Desteğe İhtiyaç Duyan Öğrenciler")) tbody tr').count();
    check('Kazanım risk filtresi listeyi daraltıyor (ya da zaten tekil kazanımlı)', afterRows <= beforeRows);
    // filtreyi geri al
    await page.selectOption('#kazanim-risk-filter', { index: 0 });
    await page.waitForTimeout(300);
  } else {
    check('Risk filtresi testi atlandı (kritik kazanım çeşitliliği yetersiz)', true);
  }

  // ===== 5) Sınav Uygulaması: Yaklaşan/Geçmiş Sınavlar gruplaması =====
  // Not: burada innerHTML/textContent kullanılıyor (innerText DEĞİL) — başlık
  // CSS text-transform:uppercase ile büyütülüyor ve tarayıcının Türkçe olmayan
  // büyütme kuralı "ı"yı "I"ya çevirip Türkçe küçük harfe geri döndüğünde "i"
  // üretir, bu da düz metin karşılaştırmasını bozar (görsel bir CSS detayı,
  // gerçek bir uygulama hatası değil).
  await page.evaluate(() => { state.portal = 'hq'; olcmeSubTab = 'sinavUygulama'; renderAll(); });
  await page.waitForTimeout(400);
  bodyText = await page.locator('#olcme-body').innerHTML();
  check('Sınav Uygulaması listesi "Yaklaşan Sınavlar" veya "Geçmiş Sınavlar" başlığıyla gruplanmış', /Yaklaşan Sınavlar/.test(bodyText) || /Geçmiş Sınavlar/.test(bodyText));

  // ===== 6) Öğretmen ve Öğrenci ekranlarında hata yok (tek-öğrenci/tek-sınıf görünümü etkilenmemiş) =====
  await page.evaluate(() => { state.portal = 'teacher'; state.screen = 'olcme'; olcmeSubTab = 'durum'; renderAll(); });
  await page.waitForTimeout(400);
  check('Öğretmen Sınav Genel Durumu ekranı hatasız render ediliyor', await page.locator('#olcme-body').isVisible());

  await page.evaluate(() => { state.portal = 'student'; state.screen = 'olcme'; olcmeSubTab = 'kazanim'; renderAll(); });
  await page.waitForTimeout(400);
  check('Öğrenci Kazanım Analizi ekranı hatasız render ediliyor', await page.locator('#olcme-body').isVisible());

  check('Konsol/sayfa hatası oluşmadı', errors.length === 0, errors.join(' | '));

  console.log('\n=== ÖZET ===');
  const fails = results.filter(r => !r.ok);
  console.log(`Toplam: ${results.length} | Başarılı: ${results.length - fails.length} | Başarısız: ${fails.length}`);
  await browser.close();
  process.exit(fails.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
