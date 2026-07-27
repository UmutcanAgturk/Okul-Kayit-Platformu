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

  // ===== Belgeler > Vergi Ayarları/Fatura: Stopaj ve KDV istisnası terimlerine tooltip =====
  // Bu iki terim artık genel bir dipnotta değil, doğrudan ilgili işlevin
  // yanında (Kira Stopaj Oranı alanı ve Fatura'daki KDV istisnası onay kutusu) görselleştiriliyor.
  await page.evaluate(() => { state.portal = 'branch'; state.screen = 'muhasebe'; muhasebeSubTab = 'belgeler'; belgelerTab = 'fatura'; renderAll(); });
  await page.waitForTimeout(400);
  const stopajTitle = await page.locator('span[title*="Stopaj"], span[title*="stopaj" i]').first().getAttribute('title').catch(() => null);
  check('"stopajı" teriminde açıklayıcı tooltip var', !!stopajTitle && /kesinti/i.test(stopajTitle), stopajTitle);
  const kdvTitle = await page.locator('span[title*="KDV"]').first().getAttribute('title').catch(() => null);
  check('"KDV Kanunu 17/2-b istisnası" teriminde açıklayıcı tooltip var', !!kdvTitle && /muaf/i.test(kdvTitle), kdvTitle);

  // ===== Belgeler > Dekont: "Dekont" tanımı =====
  await page.evaluate(() => { muhasebeSubTab = 'belgeler'; belgelerTab = 'dekont'; renderAll(); });
  await page.waitForTimeout(400);
  const dkTitle = await page.locator('#belgeler-tab-body span[title*="makbuz" i]').first().getAttribute('title').catch(() => null);
  check('"Dekont" başlığında tanım tooltip\'i var', !!dkTitle && /makbuz/i.test(dkTitle), dkTitle);

  // ===== Belgeler > Senet: "Senet" tanımı =====
  await page.evaluate(() => { belgelerTab = 'senet'; renderBelgelerTabBody(); });
  await page.waitForTimeout(300);
  const snTitle = await page.locator('#belgeler-tab-body span[title*="kambiyo" i]').first().getAttribute('title').catch(() => null);
  check('"Senet" başlığında tanım tooltip\'i var', !!snTitle && /borçlunun/i.test(snTitle), snTitle);

  check('Konsol/sayfa hatası oluşmadı', errors.length === 0, errors.join(' | '));

  console.log('\n=== ÖZET ===');
  const fails = results.filter(r => !r.ok);
  console.log(`Toplam: ${results.length} | Başarılı: ${results.length - fails.length} | Başarısız: ${fails.length}`);
  await browser.close();
  process.exit(fails.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
