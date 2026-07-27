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

  // Deterministik test için doğrudan bir fatura/dekont/senet enjekte ediyoruz.
  await page.evaluate(() => {
    state.portal = 'branch';
    state.screen = 'muhasebe';
    muhasebeSubTab = 'belgeler';
    belgelerTab = 'fatura';
    createInvoice({ buyerName: 'Test Alıcı', date: todayStr(), buyerTaxNo: '', buyerAddress: '', kdvRate: 20, items: [{ description: 'Eğitim Hizmeti', quantity: 1, unitPrice: 1000 }], note: '' });
    createDekont({ type: 'TAHSILAT', date: todayStr(), personName: 'Test Kişi', amount: 500, method: 'NAKIT', description: 'Test dekont' });
    createSenet({ debtorName: 'Test Borçlu', dueDate: todayStr(), amount: 750, date: todayStr(), note: '' });
    renderAll();
  });
  await page.waitForTimeout(400);

  // ===== Fatura: bağlantısızlık notu + iki adımlı silme =====
  let hintText = await page.locator('#belgeler-tab-body').innerText();
  check('Fatura listesinde defter-bağlantısızlığı notu görünüyor', /Kayıt Defteri'nden bağımsızdır/.test(hintText), hintText.slice(0, 300));

  const invoiceCountBefore = await page.evaluate(() => CURRENT_BRANCH.invoices.length);
  await page.click('[data-ft-delete]');
  await page.waitForTimeout(200);
  let bodyText = await page.locator('#belgeler-tab-body').innerText();
  check('Fatura Sil tıklanınca onay satırı görünüyor ("silinsin mi?")', /silinsin mi\?/.test(bodyText));
  check('Fatura Vazgeç butonu görünüyor', await page.locator('[data-ft-cancel-delete]').count() > 0);
  const invoiceCountAfterClick = await page.evaluate(() => CURRENT_BRANCH.invoices.length);
  check('Onay ekranında fatura henüz silinmedi', invoiceCountAfterClick === invoiceCountBefore, invoiceCountAfterClick);

  await page.click('[data-ft-cancel-delete]');
  await page.waitForTimeout(200);
  const invoiceCountAfterCancel = await page.evaluate(() => CURRENT_BRANCH.invoices.length);
  check('Vazgeç sonrası fatura sayısı değişmedi', invoiceCountAfterCancel === invoiceCountBefore, invoiceCountAfterCancel);

  await page.click('[data-ft-delete]');
  await page.waitForTimeout(200);
  await page.click('[data-ft-confirm-delete]');
  await page.waitForTimeout(200);
  const invoiceCountAfterConfirm = await page.evaluate(() => CURRENT_BRANCH.invoices.length);
  check('Evet, Sil sonrası fatura sayısı 1 azaldı', invoiceCountAfterConfirm === invoiceCountBefore - 1, invoiceCountAfterConfirm);

  // ===== Dekont: aynı akış =====
  await page.evaluate(() => { belgelerTab = 'dekont'; renderBelgelerTabBody(); });
  await page.waitForTimeout(300);
  hintText = await page.locator('#belgeler-tab-body').innerText();
  check('Dekont listesinde defter-bağlantısızlığı notu görünüyor', /Kayıt Defteri'nden bağımsızdır/.test(hintText));
  const dkCountBefore = await page.evaluate(() => CURRENT_BRANCH.dekontlar.length);
  await page.click('[data-dk-delete]');
  await page.waitForTimeout(200);
  check('Dekont Sil tıklanınca onay satırı görünüyor', await page.locator('[data-dk-confirm-delete]').count() > 0);
  const dkCountAfterClick = await page.evaluate(() => CURRENT_BRANCH.dekontlar.length);
  check('Onay ekranında dekont henüz silinmedi', dkCountAfterClick === dkCountBefore);
  await page.click('[data-dk-confirm-delete]');
  await page.waitForTimeout(200);
  const dkCountAfterConfirm = await page.evaluate(() => CURRENT_BRANCH.dekontlar.length);
  check('Evet, Sil sonrası dekont sayısı 1 azaldı', dkCountAfterConfirm === dkCountBefore - 1, dkCountAfterConfirm);

  // ===== Senet: aynı akış (Vazgeç yolu) =====
  await page.evaluate(() => { belgelerTab = 'senet'; renderBelgelerTabBody(); });
  await page.waitForTimeout(300);
  hintText = await page.locator('#belgeler-tab-body').innerText();
  check('Senet listesinde defter-bağlantısızlığı notu görünüyor', /Kayıt Defteri'nden bağımsızdır/.test(hintText));
  const snCountBefore = await page.evaluate(() => CURRENT_BRANCH.senetler.length);
  await page.click('[data-sn-delete]');
  await page.waitForTimeout(200);
  check('Senet Sil tıklanınca onay satırı görünüyor', await page.locator('[data-sn-confirm-delete]').count() > 0);
  await page.click('[data-sn-cancel-delete]');
  await page.waitForTimeout(200);
  const snCountAfterCancel = await page.evaluate(() => CURRENT_BRANCH.senetler.length);
  check('Senet Vazgeç sonrası sayı değişmedi', snCountAfterCancel === snCountBefore, snCountAfterCancel);

  check('Konsol/sayfa hatası oluşmadı', errors.length === 0, errors.join(' | '));

  console.log('\n=== ÖZET ===');
  const fails = results.filter(r => !r.ok);
  console.log(`Toplam: ${results.length} | Başarılı: ${results.length - fails.length} | Başarısız: ${fails.length}`);
  await browser.close();
  process.exit(fails.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
