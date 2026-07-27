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

  await page.evaluate(() => { state.portal = 'branch'; state.screen = 'muhasebe'; muhasebeSubTab = 'belgeler'; belgelerTab = 'fatura'; renderAll(); });
  await page.waitForTimeout(400);

  // ===== 1) Tamamen boş gönderim: hem alıcı adı hem kalem invalid olmalı =====
  await page.click('#ft-create');
  await page.waitForTimeout(200);
  const buyerInvalid1 = await page.locator('#ft-buyer-name').evaluate(el => el.classList.contains('invalid'));
  check('Boş gönderimde alıcı adı input\'u invalid işaretleniyor', buyerInvalid1);
  const buyerErr1 = await page.locator('#ft-buyer-name-error').innerText();
  check('Boş gönderimde alıcı adı hata metni gösteriliyor', /zorunludur/i.test(buyerErr1), buyerErr1);
  const itemDescInvalid1 = await page.locator('[data-item-desc="0"]').evaluate(el => el.classList.contains('invalid'));
  check('Boş gönderimde ilk kalem açıklama input\'u invalid işaretleniyor', itemDescInvalid1);
  const itemErr1 = await page.locator('#ft-error').innerText();
  check('Boş gönderimde kalem hatası "1. kalemde" diyor', /1\. kalemde/.test(itemErr1), itemErr1);
  const invoiceCount1 = await page.evaluate(() => CURRENT_BRANCH.invoices.length);
  check('Boş gönderimde fatura oluşturulmadı', invoiceCount1 === 0, invoiceCount1);

  // ===== 2) Sadece alıcı adını doldur: alıcı adı invalid temizlenmeli, kalem hala invalid =====
  await page.fill('#ft-buyer-name', 'Test Alıcı');
  await page.waitForTimeout(150);
  const buyerInvalid2 = await page.locator('#ft-buyer-name').evaluate(el => el.classList.contains('invalid'));
  check('Alıcı adı girilince invalid sınıfı kalkıyor', !buyerInvalid2);
  const buyerErr2 = await page.locator('#ft-buyer-name-error').innerText();
  check('Alıcı adı girilince hata metni temizleniyor', buyerErr2 === '', buyerErr2);

  await page.click('#ft-create');
  await page.waitForTimeout(200);
  const itemDescInvalid2 = await page.locator('[data-item-desc="0"]').evaluate(el => el.classList.contains('invalid'));
  check('Kalem hala boşken ikinci denemede de invalid işaretleniyor', itemDescInvalid2);
  const invoiceCount2 = await page.evaluate(() => CURRENT_BRANCH.invoices.length);
  check('Kalem eksikken hala fatura oluşturulmadı', invoiceCount2 === 0, invoiceCount2);

  // ===== 3) Her şeyi doğru doldur: hiçbir invalid kalmamalı, fatura oluşmalı =====
  await page.fill('[data-item-desc="0"]', 'Eğitim Hizmeti');
  await page.fill('[data-item-qty="0"]', '1');
  await page.fill('[data-item-price="0"]', '1000');
  await page.waitForTimeout(150);
  await page.click('#ft-create');
  await page.waitForTimeout(300);
  const invoiceCount3 = await page.evaluate(() => CURRENT_BRANCH.invoices.length);
  check('Tüm alanlar doğru dolunca fatura oluşturuluyor', invoiceCount3 === 1, invoiceCount3);
  const remainingInvalidCount = await page.locator('#belgeler-tab-body .invalid').count();
  check('Başarılı gönderim sonrası hiç invalid alan kalmadı', remainingInvalidCount === 0, remainingInvalidCount);

  check('Konsol/sayfa hatası oluşmadı', errors.length === 0, errors.join(' | '));

  console.log('\n=== ÖZET ===');
  const fails = results.filter(r => !r.ok);
  console.log(`Toplam: ${results.length} | Başarılı: ${results.length - fails.length} | Başarısız: ${fails.length}`);
  await browser.close();
  process.exit(fails.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
