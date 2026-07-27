const { chromium } = require('playwright');
const APP = 'file://' + require('path').resolve(__dirname, '../seviye360-app.html');

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const page = await browser.newPage({ viewport: { width: 1400, height: 1200 } });
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

  // ===== Global Analytics: yeni KPI satırı + akademik podyum =====
  await page.evaluate(() => { state.portal = 'hq'; state.screen = 'analytics'; renderAll(); });
  await page.waitForTimeout(400);
  let bodyText = await page.locator('body').innerHTML();
  check('Global Analytics: yeni KPI satırı (Toplam Kurum/Öğrenci/Ortalama Net/Ciro) görünüyor', /Toplam Kurum/.test(bodyText) && /Toplam Öğrenci/.test(bodyText) && /Genel Ortalama Net/.test(bodyText) && /Toplam Aylık Ciro/.test(bodyText));
  check('Global Analytics: KPI kartlarında ikon var', await page.locator('.stat-card .stat-label svg').count() >= 4);
  check('Global Analytics: "Akademik Olarak En Başarılı Şubeler" podyumu görünüyor', /Akademik Olarak En Başarılı Şubeler/.test(bodyText));
  const podiumCards = await page.locator('.card:has(h3:has-text("Akademik Olarak En Başarılı Şubeler")) .stat-card').count();
  check('Podyum kartı sayısı gerçek veriyle tutarlı (1-3 arası, sıfır değil)', podiumCards >= 1 && podiumCards <= 3, `${podiumCards} kart`);
  // Tek kartlı podyum tam genişliğe gerilmemeli (max-width sınırlı)
  const podiumCardWidth = await page.locator('.card:has(h3:has-text("Akademik Olarak En Başarılı Şubeler")) .stat-card').first().evaluate(el => el.getBoundingClientRect().width);
  check('Podyum kartı aşırı genişlemiyor (max-width uygulanmış)', podiumCardWidth <= 300, `${Math.round(podiumCardWidth)}px`);

  // ===== Öğrenciler (HQ): KPI ikonları =====
  await page.evaluate(() => { state.screen = 'students'; renderAll(); });
  await page.waitForTimeout(400);
  check('HQ Öğrenciler ekranında KPI ikonları var', await page.locator('.stat-card .stat-label svg').count() >= 4);

  // ===== Muhasebe Genel Bakış: ikonlu KPI kartları =====
  await page.evaluate(() => { state.portal = 'branch'; state.screen = 'muhasebe'; renderAll(); });
  await page.waitForTimeout(400);
  bodyText = await page.locator('body').innerHTML();
  check('Muhasebe Genel Bakış ekranında Toplam Gelir/Gider/Net Kâr kartları ikonlu', await page.locator('.stat-card .stat-label svg').count() >= 3);

  // ===== Ölçme-Değerlendirme Sınav Genel Durumu: ikonlu KPI kartları =====
  await page.evaluate(() => { state.screen = 'olcme'; olcmeSubTab = 'durum'; renderAll(); });
  await page.waitForTimeout(400);
  check('Ölçme-Değerlendirme Sınav Genel Durumu KPI kartları ikonlu', await page.locator('#olcme-body .stat-card .stat-label svg').count() >= 4);

  check('Konsol/sayfa hatası oluşmadı', errors.length === 0, errors.join(' | '));

  console.log('\n=== ÖZET ===');
  const fails = results.filter(r => !r.ok);
  console.log(`Toplam: ${results.length} | Başarılı: ${results.length - fails.length} | Başarısız: ${fails.length}`);
  await browser.close();
  process.exit(fails.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
