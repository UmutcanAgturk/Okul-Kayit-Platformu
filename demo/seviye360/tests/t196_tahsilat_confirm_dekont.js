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

  // Deterministik bir öğrenci seç ve "Gecikmiş ödeme var" + taksit planı ata.
  const setup = await page.evaluate(() => {
    const s = STUDENT_DIRECTORY.find(st => st.branchId === CURRENT_BRANCH.id);
    if (!s) return null;
    s.paymentStatus = 'Gecikmiş ödeme var';
    s.installmentAmount = 3000;
    s.installmentCount = 10;
    s.paidInstallments = 2;
    return { id: s.id, name: s.name, dekontCountBefore: CURRENT_BRANCH.dekontlar.length };
  });
  check('Kurulum: test öğrencisine gecikmiş ödeme durumu atandı', !!setup, JSON.stringify(setup));

  await page.evaluate(() => { state.portal = 'branch'; state.screen = 'muhasebe'; muhasebeSubTab = 'tahsilat'; renderAll(); });
  await page.waitForTimeout(400);

  const row = page.locator('tr', { hasText: setup.name });
  await row.locator('[data-tahsilat-amount]').fill('3000');
  await row.locator('[data-tahsilat-al]').click();
  await page.waitForTimeout(300);

  const paidBefore = await page.evaluate(id => STUDENT_DIRECTORY.find(s => s.id === id).paidInstallments, setup.id);
  check('Onay ekranında paidInstallments henüz artmadı', paidBefore === 2, paidBefore);
  const rowTextAfterClick = await row.innerText();
  check('Onay satırı "tahsil edilsin mi?" metnini gösteriyor', /tahsil edilsin mi\?/.test(rowTextAfterClick), rowTextAfterClick);
  check('Vazgeç butonu görünüyor', await row.locator('[data-tahsilat-cancel]').count() > 0);

  // Vazgeç yolu: mutasyon olmamalı.
  await row.locator('[data-tahsilat-cancel]').click();
  await page.waitForTimeout(300);
  const afterCancel = await page.evaluate(id => ({
    paid: STUDENT_DIRECTORY.find(s => s.id === id).paidInstallments,
    dekontCount: CURRENT_BRANCH.dekontlar.length,
  }), setup.id);
  check('Vazgeç sonrası paidInstallments değişmedi', afterCancel.paid === 2, afterCancel.paid);
  check('Vazgeç sonrası Dekont oluşturulmadı', afterCancel.dekontCount === setup.dekontCountBefore, afterCancel.dekontCount);

  // Onayla yolu: tüm mutasyonlar + otomatik Dekont.
  await row.locator('[data-tahsilat-amount]').fill('3000');
  await row.locator('[data-tahsilat-al]').click();
  await page.waitForTimeout(300);
  await page.locator(`[data-tahsilat-confirm="${setup.id}"]`).click();
  await page.waitForTimeout(400);

  const afterConfirm = await page.evaluate(id => {
    const s = STUDENT_DIRECTORY.find(st => st.id === id);
    return {
      paid: s.paidInstallments,
      status: s.paymentStatus,
      dekontCount: CURRENT_BRANCH.dekontlar.length,
      lastDekont: CURRENT_BRANCH.dekontlar[0],
      ledgerCount: CURRENT_BRANCH.ledger.length,
    };
  }, setup.id);
  check('Onay sonrası paidInstallments 1 arttı', afterConfirm.paid === 3, afterConfirm.paid);
  check('Onay sonrası öğrenci durumu güncellendi (artık Gecikmiş değil)', afterConfirm.status !== 'Gecikmiş ödeme var', afterConfirm.status);
  check('Onay sonrası Dekont sayısı 1 arttı', afterConfirm.dekontCount === setup.dekontCountBefore + 1, afterConfirm.dekontCount);
  check('Otomatik oluşan Dekont türü TAHSILAT ve tutar eşleşiyor', afterConfirm.lastDekont && afterConfirm.lastDekont.type === 'TAHSILAT' && afterConfirm.lastDekont.amount === 3000, JSON.stringify(afterConfirm.lastDekont));

  const toastText = await page.locator('#toast-stack').innerText().catch(() => '');
  check('Tahsilat sonrası toast bildirimi gösteriliyor', /Tahsilat alındı/.test(toastText), toastText);

  check('Konsol/sayfa hatası oluşmadı', errors.length === 0, errors.join(' | '));

  console.log('\n=== ÖZET ===');
  const fails = results.filter(r => !r.ok);
  console.log(`Toplam: ${results.length} | Başarılı: ${results.length - fails.length} | Başarısız: ${fails.length}`);
  await browser.close();
  process.exit(fails.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
