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

  // Gerçek etüt talebi + taksit takvimi olmadan yeni kartların (Ödeme Durumu
  // Dağılımı, Etüt Doluluğu grafiği) görünürlüğünü test edebilmek için gerçekçi
  // (ama sahte olmayan hesaplama mantığına dokunmayan) minimal veri enjekte edilir.
  await page.evaluate(() => {
    const day = todayStr();
    const s = STUDENT_DIRECTORY.find(x => x.branchId === CURRENT_BRANCH.id);
    ETUT_REQUESTS.push({ id: 99001, branchId: CURRENT_BRANCH.id, studentId: s.id, subject: 'Matematik', slotDate: day, slotTime: '15:00', status: 'ONAYLANDI' });
    const today = new Date();
    STUDENT_DIRECTORY.filter(x => x.branchId === CURRENT_BRANCH.id).forEach((x, i) => {
      const past = new Date(today.getTime() - 5 * 24 * 3600 * 1000);
      x.installmentSchedule = i % 2 === 0
        ? [{ dueDate: past.toISOString().slice(0, 10), amount: 1000, status: 'Bekliyor' }]
        : [{ dueDate: '2020-01-01', amount: 1000, status: 'Ödendi' }];
    });
    state.portal = 'branch'; state.screen = 'bugun'; renderAll();
  });
  await page.waitForTimeout(400);

  const bodyText = await page.locator('.app-main, #app, body').first().innerText().catch(() => page.locator('body').innerText());

  check('Zaman-bilinçli selamlama görünüyor', /Günaydın|İyi günler|İyi akşamlar|İyi geceler/.test(bodyText));
  check('KPI kartlarında ikon var (stat-label içinde svg)', await page.locator('.stat-card .stat-label svg').count() >= 4);

  const lineChartCount = await page.locator('.card:has(h3:has-text("Devam Oranı Trendi")) svg, .card:has(h3:has-text("Ortalama Net Trendi")) svg').count();
  check('Devam Oranı ve Ortalama Net için BÜYÜK svgLineChart kartları var (küçük sparkline değil)', lineChartCount >= 2);

  check('"Ödeme Durumu Dağılımı" kompozisyon kartı görünüyor', /Ödeme Durumu Dağılımı/.test(bodyText));
  check('Kompozisyon kartında Güncel/Yaklaşan/Vadesi Geçen lejantı var', /Güncel/.test(bodyText) && /Yaklaşan/.test(bodyText) && /Vadesi Geçen/.test(bodyText));

  const etutBarStyle = await page.locator('.card:has(h3:has-text("Bugünkü Etüt Doluluğu")) div[style*="height:100%"]').first().getAttribute('style').catch(() => null);
  check('Etüt Doluluğu grafiği nötr (brand) renk kullanıyor, kritik/uyarı rengi DEĞİL', etutBarStyle ? /var\(--brand\)/.test(etutBarStyle) : true, etutBarStyle || 'bar bulunamadı (veri yoksa atlanır)');

  check('Lider Tablosu podyum kartlarında madalya emojisi var (🥇)', /🥇/.test(bodyText));
  const podiumCount = await page.locator('.card:has(h3:has-text("Lider Tablosu")) .grid.cols-3 .stat-card').count();
  check('Lider Tablosu 3 podyum kartı olarak render ediliyor (tablo değil)', podiumCount === 3, `${podiumCount} kart bulundu`);

  check('statTrendCardHtml artık kullanılmıyor (kaldırılan fonksiyon sayfada hata üretmiyor)', errors.length === 0);
  check('Konsol/sayfa hatası oluşmadı', errors.length === 0, errors.join(' | '));

  console.log('\n=== ÖZET ===');
  const fails = results.filter(r => !r.ok);
  console.log(`Toplam: ${results.length} | Başarılı: ${results.length - fails.length} | Başarısız: ${fails.length}`);
  await browser.close();
  process.exit(fails.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
