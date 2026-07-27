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

  let bodyHtml = await page.locator('#muhasebe-body').innerHTML();
  check('"Maaş Ödemeleri" bölümü görünüyor', /Maaş Ödemeleri/.test(bodyHtml));
  const staffCount = await page.evaluate(() => CURRENT_BRANCH.staff.length);
  const payButtonsBefore = await page.locator('[data-pay-salary]').count();
  check('Her personel için "Öde" butonu var (henüz kimse ödenmedi)', payButtonsBefore === staffCount, `${payButtonsBefore} buton / ${staffCount} personel`);

  const firstStaff = await page.evaluate(() => ({ id: CURRENT_BRANCH.staff[0].id, name: CURRENT_BRANCH.staff[0].name, salary: CURRENT_BRANCH.staff[0].salary }));
  const ledgerBefore = await page.evaluate(() => CURRENT_BRANCH.ledger.length);
  const dekontBefore = await page.evaluate(() => CURRENT_BRANCH.dekontlar.length);

  await page.click(`[data-pay-salary="${firstStaff.id}"]`);
  await page.waitForTimeout(400);

  const toastText = await page.locator('#toast-stack').innerText().catch(() => '');
  check('Ödeme sonrası toast bildirimi gösteriliyor', /[Mm]aaş ödemesi kaydedildi/.test(toastText), toastText);

  const paymentRecord = await page.evaluate((sid) => CURRENT_BRANCH.salaryPayments.find(p => p.staffId === sid), firstStaff.id);
  check('salaryPayments dizisine kayıt eklendi', !!paymentRecord);
  check('Ödeme kaydındaki brüt tutar personelin maaşıyla eşleşiyor', paymentRecord && paymentRecord.gross === firstStaff.salary, JSON.stringify(paymentRecord && paymentRecord.gross));
  check('Net tutar brütten küçük (kesintiler uygulanmış)', paymentRecord && paymentRecord.netMaas < paymentRecord.gross);

  const ledgerAfter = await page.evaluate(() => CURRENT_BRANCH.ledger.length);
  check('Kayıt Defteri\'ne brüt maliyet kadar yeni bir GİDER kaydı düştü', ledgerAfter === ledgerBefore + 1, `${ledgerBefore} -> ${ledgerAfter}`);
  const lastLedgerEntry = await page.evaluate(() => CURRENT_BRANCH.ledger[CURRENT_BRANCH.ledger.length - 1]);
  check('Yeni defter kaydı "Personel Maaşı" kategorisinde ve brüt tutarda', lastLedgerEntry.category === 'Personel Maaşı' && lastLedgerEntry.amount === firstStaff.salary);

  const dekontAfter = await page.evaluate(() => CURRENT_BRANCH.dekontlar.length);
  check('Otomatik bir Ödeme Dekontu oluşturuldu', dekontAfter === dekontBefore + 1, `${dekontBefore} -> ${dekontAfter}`);
  const lastDekont = await page.evaluate(() => CURRENT_BRANCH.dekontlar[0]);
  check('Dekont net tutar üzerinden ve ilgili personel adına kesildi', lastDekont.type === 'ODEME' && lastDekont.personName === firstStaff.name && lastDekont.amount === paymentRecord.netMaas);

  // ===== Aynı ay için ikinci kez ödeme yapılamamalı (buton "Ödendi" rozetine döner) =====
  bodyHtml = await page.locator('#muhasebe-body').innerHTML();
  check('Ödenen personel için buton artık "Ödendi" rozetine dönüştü', new RegExp(`data-pay-salary="${firstStaff.id}"`).test(bodyHtml) === false);
  const payButtonsAfter = await page.locator('[data-pay-salary]').count();
  check('Kalan personel sayısı kadar "Öde" butonu kaldı', payButtonsAfter === staffCount - 1, `${payButtonsAfter}`);

  const duplicateAttempt = await page.evaluate((sid) => {
    const before = CURRENT_BRANCH.salaryPayments.length;
    const month = todayStr().slice(0, 7);
    const result = paySalary(sid, month);
    return { result, countUnchanged: CURRENT_BRANCH.salaryPayments.length === before };
  }, firstStaff.id);
  check('Aynı ay için tekrar paySalary() çağrısı null döner ve tekrar kayıt eklemez', duplicateAttempt.result === null && duplicateAttempt.countUnchanged);

  // ===== Ödeme Geçmişi görünürlüğü =====
  const historyText = await page.locator('#muhasebe-body').innerHTML();
  check('Ödeme Geçmişi\'nde personel adı görünüyor', historyText.includes(firstStaff.name));

  check('Konsol/sayfa hatası oluşmadı', errors.length === 0, errors.join(' | '));

  console.log('\n=== ÖZET ===');
  const fails = results.filter(r => !r.ok);
  console.log(`Toplam: ${results.length} | Başarılı: ${results.length - fails.length} | Başarısız: ${fails.length}`);
  await browser.close();
  process.exit(fails.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
