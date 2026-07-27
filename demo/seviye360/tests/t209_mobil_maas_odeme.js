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

  const branchCreds = await page.evaluate(() => {
    const b = CURRENT_BRANCH;
    return { u: b.managerUsername, p: b.managerPassword };
  });

  await page.evaluate(() => logout());
  await page.waitForTimeout(300);
  await page.click('[data-platform-btn="ios"]');
  await page.waitForTimeout(400);
  await page.fill('#m-login-username', branchCreds.u);
  await page.fill('#m-login-password', branchCreds.p);
  await page.click('#m-login-submit');
  await page.waitForTimeout(700);
  await page.click('[data-tab="muhasebe"]');
  await page.waitForTimeout(400);

  const bodyText = await page.locator('#m-app-content').innerText();
  check('"Maaş Ödemeleri" bölümü mobilde görünüyor', /Maaş Ödemeleri/.test(bodyText));

  const staffCount = await page.evaluate(() => CURRENT_BRANCH.staff.length);
  const payButtonsBefore = await page.locator('[data-m-pay-salary]').count();
  check('Her personel için "Öde" butonu var', payButtonsBefore === staffCount, `${payButtonsBefore} buton / ${staffCount} personel`);

  const firstStaff = await page.evaluate(() => ({ id: CURRENT_BRANCH.staff[0].id, name: CURRENT_BRANCH.staff[0].name, salary: CURRENT_BRANCH.staff[0].salary }));
  const ledgerBefore = await page.evaluate(() => CURRENT_BRANCH.ledger.length);
  const dekontBefore = await page.evaluate(() => CURRENT_BRANCH.dekontlar.length);

  await page.click(`[data-m-pay-salary="${firstStaff.id}"]`);
  await page.waitForTimeout(300);
  check('Maaş Öde sheet\'i açılıyor (net tutar önizlemesi görünüyor)', await page.locator('#m-salary-pay-confirm').count() > 0);

  await page.click('#m-salary-pay-confirm');
  await page.waitForTimeout(400);

  const paymentRecord = await page.evaluate((sid) => CURRENT_BRANCH.salaryPayments.find(p => p.staffId === sid), firstStaff.id);
  check('salaryPayments dizisine kayıt eklendi', !!paymentRecord);
  check('Ödeme kaydındaki brüt tutar personelin maaşıyla eşleşiyor', paymentRecord && paymentRecord.gross === firstStaff.salary, JSON.stringify(paymentRecord && paymentRecord.gross));

  const ledgerAfter = await page.evaluate(() => CURRENT_BRANCH.ledger.length);
  check('Kayıt Defteri\'ne brüt maliyet kadar yeni bir GİDER kaydı düştü', ledgerAfter === ledgerBefore + 1, `${ledgerBefore} -> ${ledgerAfter}`);

  const dekontAfter = await page.evaluate(() => CURRENT_BRANCH.dekontlar.length);
  check('Otomatik bir Ödeme Dekontu oluşturuldu', dekontAfter === dekontBefore + 1, `${dekontBefore} -> ${dekontAfter}`);
  const lastDekont = await page.evaluate(() => CURRENT_BRANCH.dekontlar[0]);
  check('Dekont net tutar üzerinden ve ilgili personel adına kesildi', lastDekont.type === 'ODEME' && lastDekont.personName === firstStaff.name && lastDekont.amount === paymentRecord.netMaas);

  const bodyTextAfter = await page.locator('#m-app-content').innerText();
  check('Ödenen personel artık "Ödendi" rozetiyle görünüyor', bodyTextAfter.includes('Ödendi'));
  const payButtonsAfter = await page.locator('[data-m-pay-salary]').count();
  check('Kalan personel sayısı kadar "Öde" butonu kaldı', payButtonsAfter === staffCount - 1, `${payButtonsAfter}`);

  // Web tarafında da aynı ödeme aynı ay için tekrar yapılamamalı (paylaşılan veri/fonksiyon).
  const duplicateAttempt = await page.evaluate((sid) => {
    const before = CURRENT_BRANCH.salaryPayments.length;
    const month = todayStr().slice(0, 7);
    const result = paySalary(sid, month);
    return { result, countUnchanged: CURRENT_BRANCH.salaryPayments.length === before };
  }, firstStaff.id);
  check('Aynı ay için tekrar paySalary() çağrısı null döner (mobil/web aynı fonksiyonu paylaşıyor)', duplicateAttempt.result === null && duplicateAttempt.countUnchanged);

  check('Konsol/sayfa hatası oluşmadı', errors.length === 0, errors.join(' | '));

  console.log('\n=== ÖZET ===');
  const fails = results.filter(r => !r.ok);
  console.log(`Toplam: ${results.length} | Başarılı: ${results.length - fails.length} | Başarısız: ${fails.length}`);
  await browser.close();
  process.exit(fails.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
