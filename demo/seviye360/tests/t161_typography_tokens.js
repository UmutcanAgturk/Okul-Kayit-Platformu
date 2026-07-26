const { chromium } = require('playwright');
const APP = 'file://' + require('path').resolve(__dirname, '../seviye360-app.html');

// Tipografi/boşluk tutarlılık geçişi: --text-*/--space-* token'larının :root'ta
// tanımlı olduğunu ve daha önce elle (inline style ile) tekrar tekrar
// üretilen "istatistik kartı" bloklarının artık paylaşılan .stat-card/.stat-value
// sınıflarını kullandığını (ve hepsinin AYNI font-size'a sahip olduğunu) doğrular.
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

  // ===== 1) Tipografi/boşluk token'ları :root'ta tanımlı =====
  const tokens = await page.evaluate(() => {
    const cs = getComputedStyle(document.documentElement);
    return {
      textXl: cs.getPropertyValue('--text-xl').trim(),
      text2xl: cs.getPropertyValue('--text-2xl').trim(),
      space4: cs.getPropertyValue('--space-4').trim(),
    };
  });
  check('--text-xl token tanımlı (22px)', tokens.textXl === '22px', tokens.textXl);
  check('--text-2xl token tanımlı (23px)', tokens.text2xl === '23px', tokens.text2xl);
  check('--space-4 token tanımlı (16px)', tokens.space4 === '16px', tokens.space4);

  // ===== 2) Genel Merkez → Günlük Operasyon: 4 istatistik kartı da .stat-value kullanmalı =====
  await page.click('#landing-cta-nav');
  await page.fill('#login-username', 'genel.merkez');
  await page.fill('#login-password', 'seviye360');
  await page.click('#login-submit');
  await page.waitForTimeout(700);
  await page.evaluate(() => { state.screen = 'ops'; renderAll(); });
  await page.waitForTimeout(500);

  const opsStatSizes = await page.evaluate(() =>
    Array.from(document.querySelectorAll('#ops-body .stat-value, [id$="-body"] .stat-value'))
      .map((el) => getComputedStyle(el).fontSize),
  );
  check('Günlük Operasyon: en az 4 .stat-value kartı render edildi', opsStatSizes.length >= 4, opsStatSizes.length);
  check(
    'Günlük Operasyon: tüm .stat-value kartları AYNI font-size (22px)',
    opsStatSizes.length > 0 && opsStatSizes.every((s) => s === '22px'),
    JSON.stringify(opsStatSizes),
  );

  // Eski, elle yazılmış "inline font-size:22px" deseninin artık kalmadığını doğrula
  const inlineLeftovers = await page.evaluate(() =>
    Array.from(document.querySelectorAll('[style*="font-size:22px"], [style*="font-size: 22px"]')).length,
  );
  check('Eski inline "font-size:22px" deseni kalmamış (şimdi .stat-value)', inlineLeftovers === 0, inlineLeftovers);

  check('Konsol/sayfa hatası oluşmadı', errors.length === 0, errors.join(' | '));

  console.log('\n=== ÖZET ===');
  const fails = results.filter((r) => !r.ok);
  console.log(`Toplam: ${results.length} | Başarılı: ${results.length - fails.length} | Başarısız: ${fails.length}`);
  await browser.close();
  process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
