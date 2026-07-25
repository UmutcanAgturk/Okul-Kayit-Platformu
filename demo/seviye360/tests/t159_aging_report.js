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

  // Dört farklı yaşlandırma aralığına (0-30 / 31-60 / 61-90 / 90+) birer gecikmiş
  // taksit düşecek şekilde deterministik bir installmentSchedule enjekte ediyoruz —
  // "Küçük Kurum Demosu" seed'i installmentSchedule'ı boş bırakıyor (yalnızca
  // Normal Kayıt/CSV akışları dolduruyor), bu yüzden test kendi verisini kurmalı.
  const injected = await page.evaluate(() => {
    const students = STUDENT_DIRECTORY.filter(s => s.branchId === CURRENT_BRANCH.id).slice(0, 4);
    if (students.length < 4) return null;
    const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); };
    const plan = [
      { student: students[0], days: 10, amount: 5000 },   // 0-30
      { student: students[1], days: 45, amount: 7000 },   // 31-60
      { student: students[2], days: 75, amount: 9000 },   // 61-90
      { student: students[3], days: 130, amount: 11000 }, // 90+
    ];
    plan.forEach(({ student, days, amount }) => {
      student.installmentSchedule = [{ no: 1, dueDate: daysAgo(days), amount, status: 'Bekliyor' }];
      student.paymentStatus = 'Gecikmiş ödeme var';
    });
    return plan.map(p => ({ id: p.student.id, name: p.student.name, days: p.days, amount: p.amount }));
  });
  check('Kurulum: 4 öğrenciye 4 farklı yaşlandırma aralığında gecikmiş taksit enjekte edildi', !!injected, JSON.stringify(injected));

  // ===== Muhasebe > Tahsilat Takibi'ne git =====
  await page.evaluate(() => { state.portal = 'branch'; state.screen = 'muhasebe'; muhasebeSubTab = 'tahsilat'; renderAll(); });
  await page.waitForTimeout(400);

  const agingCard = page.locator('#aging-report-card');
  check('Tahsilat Yaşlandırma kartı render ediliyor', await agingCard.count() > 0);

  const bucketCards = await agingCard.locator('.stat-card').count();
  check('Tahsilat Yaşlandırma: 4 aralık kartı (0-30/31-60/61-90/90+) render ediliyor', bucketCards === 4, bucketCards);

  const sectionText = await agingCard.innerText();
  check('Aralık kartlarında "0-30 gün" etiketi var', /0-30 gün/.test(sectionText), sectionText.slice(0, 200));
  check('Aralık kartlarında "90+ gün" etiketi var', /90\+ gün/.test(sectionText), sectionText.slice(0, 200));

  for (const p of injected) {
    check(`Detay tablosunda ${p.name} listeleniyor (${p.days} gün gecikme)`, sectionText.includes(p.name) && sectionText.includes(`${p.days} gün`), sectionText.includes(p.name));
  }

  // Toplam tutarların doğru toplandığını, en azından her kartın altında ₺ formatlı bir tutar
  // olduğunu doğrula (tam TL formatlama locale'e bağlı olabileceğinden yalnızca ₺ işaretini kontrol ediyoruz).
  const amountLabels = await agingCard.locator('.stat-card .stat-sub').allInnerTexts();
  check('Her aralık kartının altında ₺ tutarı gösteriliyor', amountLabels.length === 4 && amountLabels.every(t => t.includes('₺')), amountLabels.join(' | '));

  // Boş durum: enjekte ettiğimiz öğrencileri "Ödendi" yapınca liste boşalmalı.
  await page.evaluate(() => {
    STUDENT_DIRECTORY.forEach(s => {
      if (Array.isArray(s.installmentSchedule)) s.installmentSchedule.forEach(r => { r.status = 'Ödendi'; });
    });
    renderAll();
  });
  await page.waitForTimeout(300);
  const emptyText = await page.locator('#aging-report-card').innerText();
  check('Tüm taksitler ödenince "Gecikmiş ödeme yok" mesajı görünüyor', /Gecikmiş ödeme yok/.test(emptyText), emptyText.slice(0, 200));

  check('Konsol/sayfa hatası oluşmadı', errors.length === 0, errors.join(' | '));

  console.log('\n=== ÖZET ===');
  const fails = results.filter(r => !r.ok);
  console.log(`Toplam: ${results.length} | Başarılı: ${results.length - fails.length} | Başarısız: ${fails.length}`);
  await browser.close();
  process.exit(fails.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
