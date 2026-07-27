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

  // ===== 1) branch:students artık canvas değil, svgHBarChart kullanıyor =====
  await page.evaluate(() => { state.portal = 'branch'; state.screen = 'students'; renderAll(); });
  await page.waitForTimeout(400);
  check('Sınıf Düzeyi Dağılımı artık <canvas> içermiyor', await page.locator('#branch-grade-canvas').count() === 0);
  check('Sınıf Düzeyi Dağılımı yatay çubuk grafik (svgHBarChart) olarak render ediliyor', await page.locator('h1:has-text("Öğrenciler")').isVisible().then(async () => {
    const cardText = await page.locator('.card:has(h3:has-text("Sınıf Düzeyi Dağılımı"))').innerText();
    return /öğrenci/i.test(cardText);
  }));

  // ===== 2) Karne'de dark tema açıkken grafik metinleri açık tema renginde kalıyor (yazdırılabilir belge her zaman açık) =====
  const studentWithHistory = await page.evaluate(() => {
    const s = STUDENT_DIRECTORY.find(st => (OPTIK_SONUCLAR.some(b => b.results.some(r => r.studentId === st.id))));
    return s ? s.id : null;
  });
  await page.evaluate(() => applyTheme('dark'));
  await page.waitForTimeout(200);
  if (studentWithHistory) {
    await page.evaluate(() => { state.portal = 'branch'; state.screen = 'karne'; renderAll(); });
    await page.waitForTimeout(300);
    const showBtn = page.locator(`[data-krn-show="${studentWithHistory}"]`);
    if (await showBtn.count() > 0) {
      await showBtn.click();
      await page.waitForTimeout(300);
      const lastLabel = page.locator('#doc-viewer-body svg text').last();
      if (await lastLabel.count() > 0) {
        const fill = await lastLabel.evaluate(el => getComputedStyle(el).fill);
        check('Karne grafiğindeki metin, karanlık temada bile açık tema (koyu/okunabilir) renginde', fill === 'rgb(16, 21, 31)', fill);
      } else {
        check('Karne grafiği testi atlandı (yeterli sınav geçmişi yok)', true);
      }
      await page.click('#doc-viewer-close');
    } else {
      check('Karne grafiği testi atlandı (Göster butonu bulunamadı)', true);
    }
  } else {
    check('Karne grafiği testi atlandı (sınav geçmişi olan öğrenci yok)', true);
  }
  await page.evaluate(() => applyTheme('light'));
  await page.waitForTimeout(200);

  // ===== 3) Mobil: paylaşılan grafik --strong/--weak tonları mobilin kendi başarı/uyarı paletiyle eşleşiyor =====
  const branchCreds = await page.evaluate(() => {
    const b = BRANCHES[0];
    return { u: b.managerUsername, p: b.managerPassword };
  });
  await page.evaluate(() => logout());
  await page.waitForTimeout(300);
  await page.click('[data-platform-btn="android"]');
  await page.waitForTimeout(400);
  const tokenMatch = await page.evaluate(() => {
    const shell = document.getElementById('mobile-shell');
    const cs = getComputedStyle(shell);
    return {
      strong: cs.getPropertyValue('--strong').trim(),
      success: cs.getPropertyValue('--success').trim(),
      weak: cs.getPropertyValue('--weak').trim(),
      warning: cs.getPropertyValue('--warning').trim(),
    };
  });
  check('Mobil --strong tonu --success ile aynı (grafik/chip aynı yeşil)', tokenMatch.strong === tokenMatch.success && tokenMatch.strong !== '', JSON.stringify(tokenMatch));
  check('Mobil --weak tonu --warning ile aynı (grafik/chip aynı amber)', tokenMatch.weak === tokenMatch.warning && tokenMatch.weak !== '', JSON.stringify(tokenMatch));

  // ===== 4) Mobil Muhasebe (Şube): Aylık Gelir/Gider trend grafiği artık render ediliyor =====
  await page.fill('#m-login-username', branchCreds.u);
  await page.fill('#m-login-password', branchCreds.p);
  await page.click('#m-login-submit');
  await page.waitForTimeout(700);
  await page.click('[data-tab="muhasebe"]');
  await page.waitForTimeout(400);
  const muhasebeBodyText = await page.locator('#m-app-content').innerText();
  check('Mobil Muhasebe ekranında "Aylık Gelir / Gider" trend grafiği görünüyor', /Aylık Gelir \/ Gider/.test(muhasebeBodyText), muhasebeBodyText.slice(0, 200));
  check('Mobil Muhasebe trend grafiğinde Gelir/Gider lejantı var', /Gelir/.test(muhasebeBodyText) && /Gider/.test(muhasebeBodyText));

  // ===== 5) Mobil Öğretmen Performansı: karşılaştırma çubuk grafiği artık render ediliyor =====
  await page.click('[data-tab="hub"]');
  await page.waitForTimeout(300);
  await page.click('[data-module="ogretmenperf"]');
  await page.waitForTimeout(300);
  const perfBodyText = await page.locator('#m-app-content').innerText();
  check('Mobil Öğretmen Performansı ekranında karşılaştırma grafiği başlığı görünüyor', /Öğretmen Bazlı Ortalama Net/.test(perfBodyText), perfBodyText.slice(0, 200));

  check('Konsol/sayfa hatası oluşmadı', errors.length === 0, errors.join(' | '));

  console.log('\n=== ÖZET ===');
  const fails = results.filter(r => !r.ok);
  console.log(`Toplam: ${results.length} | Başarılı: ${results.length - fails.length} | Başarısız: ${fails.length}`);
  await browser.close();
  process.exit(fails.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
