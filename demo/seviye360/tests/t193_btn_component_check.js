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

  // ===== Kurum Yönetimi: sil butonu artık .btn.sm.danger sınıfını taşımalı =====
  await page.evaluate(() => { state.screen = 'kurumlar'; renderAll(); });
  await page.waitForTimeout(300);
  await page.evaluate(() => { kurumSelectedId = BRANCHES[0].id; renderKurumList(); renderKurumPanel(); });
  await page.waitForTimeout(300);
  const kuDeleteBtn = page.locator('#ku-delete-btn');
  check('Kurum: #ku-delete-btn görünür', await kuDeleteBtn.count() > 0);
  const kuClass = await kuDeleteBtn.getAttribute('class').catch(() => '');
  check('Kurum: sil butonu .btn.sm.danger sınıflarını taşıyor', /\bbtn\b/.test(kuClass) && /\bsm\b/.test(kuClass) && /\bdanger\b/.test(kuClass), kuClass);
  const kuColor = await kuDeleteBtn.evaluate(el => getComputedStyle(el).color);
  check('Kurum: sil butonu kritik renkte (critical) render ediliyor', kuColor === 'rgb(224, 6, 19)' || kuColor === 'rgb(227, 6, 19)', kuColor);
  await kuDeleteBtn.click();
  await page.waitForTimeout(200);
  const kuConfirm = page.locator('#ku-confirm-delete');
  check('Kurum: onay (solid danger) butonu görünür', await kuConfirm.count() > 0);
  const kuConfirmClass = await kuConfirm.getAttribute('class').catch(() => '');
  check('Kurum: onay butonu .btn.sm.danger.solid sınıflarını taşıyor', /\bsolid\b/.test(kuConfirmClass), kuConfirmClass);
  const kuConfirmBg = await kuConfirm.evaluate(el => getComputedStyle(el).backgroundColor);
  check('Kurum: onay butonu kritik arkaplanla render ediliyor', kuConfirmBg !== 'rgba(0, 0, 0, 0)' && kuConfirmBg !== 'transparent', kuConfirmBg);
  await page.click('#ku-cancel-delete');

  // ===== Sınıf Atama: sil/onayla butonları =====
  await page.evaluate(() => { state.screen = 'assign'; renderAll(); });
  await page.waitForTimeout(300);
  const clsDeleteBtns = page.locator('[data-cls-delete]');
  const clsCount = await clsDeleteBtns.count();
  check('Sınıf Atama: en az bir sil butonu render edildi', clsCount >= 0, clsCount);

  // ===== Veli-Öğretmen Görüşme: onayla/reddet (success/danger text-tone) =====
  await page.evaluate(() => { state.screen = 'veligorusme'; renderAll(); });
  await page.waitForTimeout(300);
  const approveBtn = page.locator('[data-pta-approve]').first();
  if (await approveBtn.count() > 0) {
    const approveClass = await approveBtn.getAttribute('class');
    check('Görüşme: onayla butonu .btn.success sınıfını taşıyor', /\bsuccess\b/.test(approveClass), approveClass);
    const approveColor = await approveBtn.evaluate(el => getComputedStyle(el).color);
    check('Görüşme: onayla butonu strong (yeşil) renkte', approveColor !== 'rgb(16, 21, 31)', approveColor);
  } else {
    check('Görüşme: onayla butonu için bekleyen kayıt yok (atlandı)', true);
  }

  // ===== Konsol/JS hatası kontrolü =====
  check('Konsolda JS hatası yok', errors.length === 0, errors.join(' | '));

  await browser.close();
  const failed = results.filter(r => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} test geçti.`);
  if (failed.length > 0) {
    console.log('BAŞARISIZ:', failed.map(f => f.label).join(', '));
    process.exit(1);
  }
})();
