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

  await page.evaluate(() => { state.portal = 'branch'; state.screen = 'muhasebe'; muhasebeSubTab = 'beklenti'; renderAll(); });
  await page.waitForTimeout(400);

  const detailsCount = await page.locator('#muhasebe-body details').count();
  check('3 senaryo kartının her birinde "Nasıl hesaplandı?" açılır paneli var', detailsCount === 3, detailsCount);

  const summaries = await page.locator('#muhasebe-body details summary').allInnerTexts();
  check('Tüm panellerin başlığı "Nasıl hesaplandı?"', summaries.every(t => t.includes('Nasıl hesaplandı')), summaries.join(' | '));

  // İlk senaryonun açıklamasını aç ve hesaplanan net kâr rakamıyla eşleştiğini doğrula.
  const expected = await page.evaluate(() => {
    const months = ledgerMonthsSpanned();
    const bekleyenTaksit = expectedInstallmentIncome();
    const ledgerEntries = muhasebeLedgerEntries();
    const gelir = ledgerEntries.filter(e => e.type === "GELIR").reduce((s, e) => s + e.amount, 0);
    const gider = ledgerEntries.filter(e => e.type === "GIDER").reduce((s, e) => s + e.amount, 0);
    const s = FORECAST_SCENARIOS[0];
    const beklenenGelir = Math.round(gelir / months * (s.tahsilat / 85) + s.yeniKayit * 1500 + bekleyenTaksit * (s.tahsilat / 100));
    const beklenenGider = Math.round(gider / months);
    return { net: beklenenGelir - beklenenGider, beklenenGelir, beklenenGider };
  });

  await page.locator('#muhasebe-body details').first().locator('summary').click();
  await page.waitForTimeout(200);
  const explainerText = await page.locator('#muhasebe-body details').first().innerText();
  check('Açılan panel gerçek Beklenen Gelir rakamını içeriyor', explainerText.includes(expected.beklenenGelir.toLocaleString('tr-TR')), explainerText);
  check('Açılan panel gerçek Beklenen Gider rakamını içeriyor', explainerText.includes(expected.beklenenGider.toLocaleString('tr-TR')), explainerText);
  check('Açılan panel gerçek Net Kâr rakamını içeriyor', explainerText.includes(expected.net.toLocaleString('tr-TR')), explainerText);

  check('Konsol/sayfa hatası oluşmadı', errors.length === 0, errors.join(' | '));

  console.log('\n=== ÖZET ===');
  const fails = results.filter(r => !r.ok);
  console.log(`Toplam: ${results.length} | Başarılı: ${results.length - fails.length} | Başarısız: ${fails.length}`);
  await browser.close();
  process.exit(fails.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
