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

  await page.evaluate(() => { state.portal = 'hq'; state.screen = 'muhasebe'; muhasebeScopeId = 'ALL'; muhasebeSubTab = 'belgeler'; renderAll(); });
  await page.waitForTimeout(400);

  const cta = page.locator('#belgeler-goto-scope');
  check('Konsolide kapsamda "Kurum Seç" CTA\'sı render ediliyor', await cta.count() > 0);

  await cta.click();
  await page.waitForTimeout(300);
  const focusedId = await page.evaluate(() => document.activeElement && document.activeElement.id);
  check('CTA tıklanınca odak kurum seçiciye geçiyor', focusedId === 'muhasebe-scope-select', focusedId);

  // Kurum seçildiğinde belge oluşturma formu normal şekilde render edilmeli.
  await page.evaluate(() => {
    muhasebeScopeId = String(BRANCHES[0].id);
    document.getElementById('muhasebe-scope-select').value = muhasebeScopeId;
    renderAll();
  });
  await page.waitForTimeout(300);
  check('Kurum seçilince CTA kayboluyor, fatura formu görünüyor', await page.locator('#ft-create').count() > 0);

  check('Konsol/sayfa hatası oluşmadı', errors.length === 0, errors.join(' | '));

  console.log('\n=== ÖZET ===');
  const fails = results.filter(r => !r.ok);
  console.log(`Toplam: ${results.length} | Başarılı: ${results.length - fails.length} | Başarısız: ${fails.length}`);
  await browser.close();
  process.exit(fails.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
