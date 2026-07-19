const { chromium } = require('playwright');
const APP = 'file://' + require('path').resolve(__dirname, '../seviye360-app.html');

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const page = await browser.newPage({ viewport: { width: 1400, height: 1100 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));

  // ---- Soğuk yükleme (cold load) ----
  const t0 = Date.now();
  await page.goto(APP, { waitUntil: 'load' });
  const coldLoadMs = Date.now() - t0;

  const nav = await page.evaluate(() => {
    const n = performance.getEntriesByType('navigation')[0];
    return n ? { domContentLoaded: n.domContentLoadedEventEnd - n.startTime, loadEvent: n.loadEventEnd - n.startTime, domInteractive: n.domInteractive - n.startTime } : null;
  });
  const scriptParseMarks = await page.evaluate(() => performance.now());

  console.log('=== SOĞUK YÜKLEME ===');
  console.log('page.goto (load event) toplam süre:', coldLoadMs, 'ms');
  console.log('Navigation Timing:', JSON.stringify(nav));
  console.log('performance.now() (script tamamen çalıştı):', scriptParseMarks.toFixed(1), 'ms');

  // ---- Login + seed sonrası DOM/heap ----
  await page.click('#landing-cta-nav');
  await page.fill('#login-username', 'genel.merkez');
  await page.fill('#login-password', 'seviye360');
  const tLogin0 = Date.now();
  await page.click('#login-submit');
  await page.waitForTimeout(500);
  const tLoginMs = Date.now() - tLogin0;
  await page.click('#db-seed-btn');
  await page.waitForTimeout(800);

  const domStats = await page.evaluate(() => {
    return {
      totalNodes: document.getElementsByTagName('*').length,
      bodyInnerHTMLBytes: document.body.innerHTML.length,
      localStorageBytes: JSON.stringify(localStorage).length,
    };
  });
  console.log('\n=== LOGIN + SEED SONRASI ===');
  console.log('Login tıklama -> ekran render süresi:', tLoginMs, 'ms');
  console.log('DOM stats:', JSON.stringify(domStats));

  // ---- Ağır ekranlar arası gezinme süresi (Muhasebe - SVG grafik yoğun) ----
  const navTimes = {};
  const screens = [
    { name: 'Öğrenciler', sel: '[data-screen="students"]' },
    { name: 'Muhasebe', sel: '[data-screen="muhasebe"]' },
    { name: 'Ölçme-Değerlendirme', sel: '[data-screen="olcme"]' },
    { name: 'Global Analytics', sel: '[data-screen="analytics"]' },
  ];
  for (const s of screens) {
    const el = await page.$(s.sel);
    if (!el) { navTimes[s.name] = 'BULUNAMADI'; continue; }
    const t = Date.now();
    await el.click();
    await page.waitForTimeout(50);
    await page.waitForFunction(() => true);
    navTimes[s.name] = Date.now() - t;
  }
  console.log('\n=== EKRAN GEÇİŞ SÜRELERİ (tıklama -> sonraki tick) ===');
  console.log(JSON.stringify(navTimes, null, 2));

  // ---- Reload sonrası (localStorage dolu haldeyken hydrate) ----
  const tReload0 = Date.now();
  await page.reload({ waitUntil: 'load' });
  const reloadMs = Date.now() - tReload0;
  console.log('\n=== RELOAD (dolu localStorage ile hydrate) ===');
  console.log('Reload toplam süre:', reloadMs, 'ms');

  console.log('\nJS ERRORS:', errors.length);
  errors.forEach(e => console.log(' ERR:', e));

  await browser.close();
})();
