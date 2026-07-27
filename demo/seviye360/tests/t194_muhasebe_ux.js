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

  // ===== Muhasebe ekranına git (henüz seed atılmamış — defter boş olmalı) =====
  await page.evaluate(() => { state.portal = 'branch'; state.screen = 'muhasebe'; muhasebeSubTab = 'genel'; renderAll(); });
  await page.waitForTimeout(400);

  // ===== Rozet netleştirmesi: yanıltıcı "Doğrulandı" ifadesi yerine doğru bilgi =====
  const headerText = await page.locator('h1', { hasText: 'Muhasebe' }).first().innerText();
  check('Rozet artık "Demo Verisi — Cihazda Saklanır" diyor', headerText.includes('Demo Verisi'), headerText);
  check('Rozet artık yanıltıcı "Gerçek Backend\'de Doğrulandı" demiyor', !headerText.includes('Gerçek Backend'), headerText);

  // ===== Boş defter CTA'sı: hiç kayıt yokken yönlendirici mesaj =====
  const ledgerEntriesCount = await page.evaluate(() => muhasebeLedgerEntries().length);
  if (ledgerEntriesCount === 0) {
    const tbodyText = await page.locator('#ledger-tbody').innerText();
    check('Boş defterde yönlendirici CTA metni görünüyor', /ilk kaydınızı ekleyin/i.test(tbodyText), tbodyText);
  } else {
    check('Boş defter kontrolü atlandı (defterde zaten kayıt var)', true);
  }

  // Arama/filtre sıfır sonuç verdiğinde farklı bir mesaj göstermeli (ör. bir kayıt ekleyip aramayı boşa çıkar)
  await page.evaluate(() => {
    document.getElementById('ledger-type').value = 'GELIR';
    document.getElementById('ledger-category').value = 'Test Kategori';
    document.getElementById('ledger-amount').value = '100';
  });
  await page.click('#ledger-add');
  await page.waitForTimeout(300);
  await page.fill('#ledger-search', 'kesinlikle-eslesmeyecek-xyz');
  await page.waitForTimeout(300);
  const searchEmptyText = await page.locator('#ledger-tbody').innerText();
  check('Arama sonucu boşken "Arama/filtreye uyan kayıt bulunamadı" mesajı görünüyor', /Arama\/filtreye uyan kayıt bulunamadı/.test(searchEmptyText), searchEmptyText);
  await page.fill('#ledger-search', '');
  await page.waitForTimeout(300);

  // ===== Vergi Ayarları: alert() yerine toast kullanılıyor =====
  await page.evaluate(() => { muhasebeSubTab = 'belgeler'; renderAll(); });
  await page.waitForTimeout(400);
  let alertFired = false;
  page.once('dialog', async d => { alertFired = true; await d.dismiss(); });
  await page.fill('#tax-kdv-rate', '18');
  await page.click('#tax-save');
  await page.waitForTimeout(300);
  check('Vergi ayarlarını kaydetme artık blocking alert() açmıyor', !alertFired);
  const toastText = await page.locator('#toast-stack').innerText().catch(() => '');
  check('Vergi ayarları kaydında toast bildirimi gösteriliyor', /Vergi ayarları kaydedildi/.test(toastText), toastText);

  check('Konsol/sayfa hatası oluşmadı', errors.length === 0, errors.join(' | '));

  console.log('\n=== ÖZET ===');
  const fails = results.filter(r => !r.ok);
  console.log(`Toplam: ${results.length} | Başarılı: ${results.length - fails.length} | Başarısız: ${fails.length}`);
  await browser.close();
  process.exit(fails.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
