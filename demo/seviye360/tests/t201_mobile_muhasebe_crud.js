const { chromium } = require('playwright');
const APP = 'file://' + require('path').resolve(__dirname, '../seviye360-app.html');

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const page = await browser.newPage({ viewport: { width: 430, height: 900 } });
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

  // Şube müdürü kimlik bilgilerini al ve mobil (Android) tarafına geç.
  const branchCreds = await page.evaluate(() => {
    const s = STUDENT_DIRECTORY.find(st => st.installmentAmount > 0 && st.paymentStatus !== "Güncel")
      || STUDENT_DIRECTORY.find(st => st.installmentAmount > 0);
    if (s) s.paymentStatus = "1 taksit yaklaşıyor";
    renderAll();
    const b = BRANCHES.find(x => x.id === (s ? s.branchId : CURRENT_BRANCH.id));
    return { u: b.managerUsername, p: b.managerPassword, branchId: b.id, studentId: s ? s.id : null, studentName: s ? s.name : null };
  });
  check('Kurulum: bekleyen taksitli bir öğrenci ve şube müdürü kimlik bilgisi hazırlandı', !!branchCreds.u, JSON.stringify(branchCreds));

  await page.evaluate(() => logout());
  await page.waitForTimeout(300);
  await page.click('[data-platform-btn="android"]');
  await page.waitForTimeout(400);
  await page.fill('#m-login-username', branchCreds.u);
  await page.fill('#m-login-password', branchCreds.p);
  await page.click('#m-login-submit');
  await page.waitForTimeout(700);
  await page.click('[data-tab="muhasebe"]');
  await page.waitForTimeout(400);

  // ===== 1) Yeni Kayıt Ekle =====
  const ledgerCountBefore = await page.evaluate(() => CURRENT_BRANCH.ledger.length);
  await page.click('#m-ledger-add');
  await page.waitForTimeout(300);
  check('Yeni Kayıt Ekle sheet\'i açılıyor', await page.locator('#m-ledger-category').count() > 0);
  await page.fill('#m-ledger-category', 'Mobil Test Kaydı');
  await page.fill('#m-ledger-amount', '2500');
  await page.click('#m-ledger-save');
  await page.waitForTimeout(300);
  const ledgerCountAfterAdd = await page.evaluate(() => CURRENT_BRANCH.ledger.length);
  check('Mobilden eklenen kayıt CURRENT_BRANCH.ledger\'a yazıldı', ledgerCountAfterAdd === ledgerCountBefore + 1, ledgerCountAfterAdd);
  const addedEntry = await page.evaluate(() => CURRENT_BRANCH.ledger[0]);
  check('Eklenen kaydın kategorisi doğru', addedEntry && addedEntry.category === 'Mobil Test Kaydı', JSON.stringify(addedEntry));

  // ===== 2) Tahsilat Bekleyen listesinde öğrenci görünüyor, Tahsil Et akışı =====
  const bodyText = await page.locator('#m-app-content').innerText();
  check('Tahsilat Bekleyen bölümünde bekleyen öğrenci listeleniyor', branchCreds.studentName ? bodyText.includes(branchCreds.studentName) : true, bodyText.slice(0, 300));

  if (branchCreds.studentId) {
    const dekontCountBefore = await page.evaluate(() => CURRENT_BRANCH.dekontlar.length);
    await page.click(`[data-m-tahsilat="${branchCreds.studentId}"]`);
    await page.waitForTimeout(300);
    check('Tahsilat İşle sheet\'i açılıyor', await page.locator('#m-tahsilat-amount').count() > 0);
    await page.fill('#m-tahsilat-amount', '3000');
    await page.click('#m-tahsilat-confirm');
    await page.waitForTimeout(400);
    const afterTahsilat = await page.evaluate((sid) => {
      const s = STUDENT_DIRECTORY.find(x => x.id === sid);
      return { paid: s.paidInstallments, status: s.paymentStatus, dekontCount: CURRENT_BRANCH.dekontlar.length, lastDekont: CURRENT_BRANCH.dekontlar[0] };
    }, branchCreds.studentId);
    check('Mobil tahsilat sonrası paidInstallments arttı', afterTahsilat.paid > 0, afterTahsilat.paid);
    check('Mobil tahsilat sonrası otomatik Dekont oluştu', afterTahsilat.dekontCount === dekontCountBefore + 1, afterTahsilat.dekontCount);
    check('Otomatik Dekont TAHSILAT türünde ve tutar doğru', afterTahsilat.lastDekont && afterTahsilat.lastDekont.type === 'TAHSILAT' && afterTahsilat.lastDekont.amount === 3000, JSON.stringify(afterTahsilat.lastDekont));
  } else {
    check('Tahsilat testi atlandı (uygun öğrenci bulunamadı)', true);
  }

  // ===== 3) Kayıt Sil (iki adımlı onay) =====
  await page.waitForTimeout(200);
  const ledgerCountBeforeDelete = await page.evaluate(() => CURRENT_BRANCH.ledger.length);
  await page.click('[data-m-ledger-delete="0"]');
  await page.waitForTimeout(300);
  check('Silme onay sheet\'i açılıyor', await page.locator('#m-ledger-delete-confirm').count() > 0);
  await page.click('#m-ledger-delete-cancel');
  await page.waitForTimeout(300);
  const ledgerCountAfterCancel = await page.evaluate(() => CURRENT_BRANCH.ledger.length);
  check('Vazgeç sonrası kayıt sayısı değişmedi', ledgerCountAfterCancel === ledgerCountBeforeDelete, ledgerCountAfterCancel);

  await page.click('[data-m-ledger-delete="0"]');
  await page.waitForTimeout(300);
  await page.click('#m-ledger-delete-confirm');
  await page.waitForTimeout(300);
  const ledgerCountAfterDelete = await page.evaluate(() => CURRENT_BRANCH.ledger.length);
  check('Evet, Sil sonrası kayıt sayısı 1 azaldı', ledgerCountAfterDelete === ledgerCountBeforeDelete - 1, ledgerCountAfterDelete);

  check('Konsol/sayfa hatası oluşmadı', errors.length === 0, errors.join(' | '));

  console.log('\n=== ÖZET ===');
  const fails = results.filter(r => !r.ok);
  console.log(`Toplam: ${results.length} | Başarılı: ${results.length - fails.length} | Başarısız: ${fails.length}`);
  await browser.close();
  process.exit(fails.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
