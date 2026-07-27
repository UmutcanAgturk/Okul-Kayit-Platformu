const { chromium } = require('playwright');
const APP = 'file://' + require('path').resolve(__dirname, '../seviye360-app.html');

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const page = await browser.newPage({ viewport: { width: 1400, height: 1400 } });
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

  await page.evaluate(() => { state.portal = 'branch'; state.screen = 'muhasebe'; muhasebeSubTab = 'belgeler'; belgelerTab = 'fatura'; renderAll(); });
  await page.waitForTimeout(400);

  const bodyHtml = await page.locator('#muhasebe-body').innerHTML();
  check('Eski "henüz görselleştirilmedi" uyarı metni artık gösterilmiyor', !/henüz görselleştirilmedi/.test(bodyHtml));
  check('KDV Özeti kartı görünüyor', /KDV Özeti/.test(bodyHtml));
  check('Kira Stopajı kartı görünüyor (GVK md 94)', /Kira Stopajı/.test(bodyHtml));
  check('Basitleştirilmiş Bordro kartı görünüyor', /Basitleştirilmiş Bordro/.test(bodyHtml));
  check('Kira Stopaj Oranı alanı Vergi Ayarları\'nda düzenlenebilir', await page.locator('#tax-kira-stopaj').count() === 1);

  // ===== Bordro tablosu: gerçek personel sayısı kadar satır =====
  const staffCount = await page.evaluate(() => CURRENT_BRANCH.staff.length);
  await page.click('#muhasebe-body details:has-text("Personel bazında dökümü gör") summary').catch(() => {});
  await page.waitForTimeout(200);
  const payrollRows = await page.locator('#muhasebe-body table tbody tr').count();
  check('Bordro tablosunda personel sayısı kadar satır var', payrollRows === staffCount, `${payrollRows} satır / ${staffCount} personel`);

  // ===== KDV Özeti: normal fatura kesildiğinde tahsil edilen KDV artmalı =====
  const kdvBefore = await page.evaluate(() => kdvSummary(CURRENT_BRANCH).tahsilEdilenKdv);
  await page.fill('#ft-buyer-name', 'Test Alıcı A.Ş.');
  await page.evaluate(() => { document.querySelector('[data-item-desc="0"]').value = 'Danışmanlık'; document.querySelector('[data-item-desc="0"]').dispatchEvent(new Event('input')); });
  await page.fill('[data-item-qty="0"]', '1');
  await page.fill('[data-item-price="0"]', '1000');
  await page.click('#ft-create');
  await page.waitForTimeout(300);
  const kdvAfter = await page.evaluate(() => kdvSummary(CURRENT_BRANCH).tahsilEdilenKdv);
  check('Normal (istisnasız) fatura kesilince tahsil edilen KDV arttı', kdvAfter > kdvBefore, `${kdvBefore} -> ${kdvAfter}`);

  // ===== KDV İstisnası (17/2-b) işaretli fatura: KDV alınmamalı, istisna tutarı artmalı =====
  const istisnaBefore = await page.evaluate(() => kdvSummary(CURRENT_BRANCH).istisnaTutari);
  await page.fill('#ft-buyer-name', 'Eğitim Hizmeti Alıcısı');
  await page.click('#ft-kdv-exempt');
  await page.evaluate(() => { document.querySelector('[data-item-desc="0"]').value = 'Eğitim Hizmeti'; document.querySelector('[data-item-desc="0"]').dispatchEvent(new Event('input')); });
  await page.fill('[data-item-qty="0"]', '1');
  await page.fill('[data-item-price="0"]', '2000');
  await page.click('#ft-create');
  await page.waitForTimeout(300);
  const lastInvoice = await page.evaluate(() => CURRENT_BRANCH.invoices[0]);
  check('KDV istisnası işaretli faturada kdvAmount 0', lastInvoice.kdvAmount === 0, JSON.stringify(lastInvoice.kdvAmount));
  check('KDV istisnası işaretli fatura kdvExempt:true olarak kaydedildi', lastInvoice.kdvExempt === true);
  const istisnaAfter = await page.evaluate(() => kdvSummary(CURRENT_BRANCH).istisnaTutari);
  check('KDV Özeti\'nde istisna tutarı arttı', istisnaAfter > istisnaBefore, `${istisnaBefore} -> ${istisnaAfter}`);
  const invoiceListHtml = await page.locator('#belgeler-tab-body').innerHTML();
  check('Fatura listesinde "KDV İstisnası" rozeti görünüyor', /KDV İstisnası/.test(invoiceListHtml));

  // ===== Kira Stopajı: oran değiştirip kaydedince özet güncellenmeli =====
  const stopajBefore = await page.evaluate(() => kiraStopajSummary(CURRENT_BRANCH).stopajKesintisi);
  await page.fill('#tax-kira-stopaj', '25');
  await page.click('#tax-save');
  await page.waitForTimeout(400);
  const stopajAfter = await page.evaluate(() => CURRENT_BRANCH.taxSettings.kiraStopajOrani);
  check('Kira Stopaj Oranı kaydedildi (%25)', stopajAfter === 25, String(stopajAfter));
  const kiraGiderVarMi = await page.evaluate(() => CURRENT_BRANCH.ledger.some(e => e.type === 'GIDER' && e.category === 'Kira'));
  if (kiraGiderVarMi) {
    const bodyHtml2 = await page.evaluate(() => { muhasebeSubTab = 'belgeler'; belgelerTab = 'fatura'; renderAll(); return document.getElementById('muhasebe-body').innerHTML; });
    check('Oran güncellendikten sonra Kira Stopajı kartı yeni oranı yansıtıyor', /%25/.test(bodyHtml2));
  } else {
    check('Kira gideri kaydı yok — stopaj tutarı testi atlandı (₺0 tutarlı, bu geçerli bir durum)', true);
  }

  check('Konsol/sayfa hatası oluşmadı', errors.length === 0, errors.join(' | '));

  console.log('\n=== ÖZET ===');
  const fails = results.filter(r => !r.ok);
  console.log(`Toplam: ${results.length} | Başarılı: ${results.length - fails.length} | Başarısız: ${fails.length}`);
  await browser.close();
  process.exit(fails.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
