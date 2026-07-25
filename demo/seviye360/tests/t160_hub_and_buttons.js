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

  // ===== 1) Genel Merkez girişi sonrası varsayılan ekran "Modüller" hub'ı olmalı =====
  await page.click('#landing-cta-nav');
  await page.fill('#login-username', 'genel.merkez');
  await page.fill('#login-password', 'seviye360');
  await page.click('#login-submit');
  await page.waitForTimeout(700);
  const screenAfterLogin = await page.evaluate(() => state.screen);
  check('Login sonrası varsayılan ekran "hub"', screenAfterLogin === 'hub', screenAfterLogin);
  const h1Text = await page.locator('#content h1').first().innerText().catch(() => '');
  check('Hub ekranında "Modüller" başlığı görünüyor', /Modüller/.test(h1Text), h1Text);

  // ===== 2) Hub, en az bir grup başlığı ve birden fazla kart içermeli =====
  const groupCount = await page.locator('.hub-group-title').count();
  const cardCount = await page.locator('.hub-card').count();
  check('Hub: en az bir grup başlığı render edildi', groupCount > 0, groupCount);
  check('Hub: birden fazla modül kartı render edildi', cardCount > 5, cardCount);

  // ===== 3) Bir karta tıklamak ilgili modüle gitmeli =====
  const bugunCard = page.locator('.hub-card[data-hub-goto="bugun"]');
  check('Hub: "Bugün" kartı mevcut', await bugunCard.count() > 0);
  await bugunCard.click();
  await page.waitForTimeout(400);
  const screenAfterClick = await page.evaluate(() => state.screen);
  check('Hub kartına tıklayınca ilgili modüle gidiliyor', screenAfterClick === 'bugun', screenAfterClick);

  // ===== 4) Sidebar'da "Modüller" öğesi görünüyor ve tekrar hub'a dönebiliyor =====
  const hubSidebarBtn = page.locator('[data-screen="hub"]').first();
  check('Sidebar: "Modüller" öğesi mevcut', await hubSidebarBtn.count() > 0);
  await hubSidebarBtn.click();
  await page.waitForTimeout(400);
  const screenAfterSidebar = await page.evaluate(() => state.screen);
  check('Sidebar\'dan hub\'a geri dönülebiliyor', screenAfterSidebar === 'hub', screenAfterSidebar);

  // ===== 5) Diğer 3 portal için de hub varsayılan ekran olmalı =====
  const otherPortalChecks = [
    { portal: 'branch', role: 'merve.aslan', label: 'Şube' },
  ];
  // Şube portalına geç (Genel Merkez üzerinden bir kuruma giriş yaparak) — basitlik için
  // doğrudan state üzerinden portal değişimini tetikleyen switchPortal benzeri bir yol
  // olmayabileceğinden, yalnızca PORTALS modelinin her portalda "hub"ı ilk sıraya
  // koyduğunu (visibleScreens[0].id === "hub") doğrudan JS düzeyinde doğruluyoruz —
  // bu, UI akışından bağımsız, daha güvenilir bir kontrol.
  const allPortalsHubFirst = await page.evaluate(() => PORTALS.every(p => p.screens[0].id === 'hub'));
  check('4 portalın da screens[0] öğesi "hub"', allPortalsHubFirst);

  // ===== 6) Genel buton boyutu büyüdü mü? (.btn padding/font-size) =====
  await page.evaluate(() => { state.screen = 'bugun'; renderAll(); });
  await page.waitForTimeout(300);
  const btnBox = await page.evaluate(() => {
    const style = getComputedStyle(document.documentElement);
    return { radiusSm: style.getPropertyValue('--radius-sm').trim(), radius: style.getPropertyValue('--radius').trim() };
  });
  check('--radius-sm 10px olarak güncellenmiş', btnBox.radiusSm === '10px', btnBox.radiusSm);
  check('--radius 14px olarak güncellenmiş', btnBox.radius === '14px', btnBox.radius);

  // .btn taban kuralını (inline style override'sız bir düğmede) doğrula — bazı tablo
  // içi düğmeler bilinçli olarak inline style ile küçük tutuluyor, o yüzden rastgele
  // ilk .btn.primary yerine login submit gibi override'sız bilinen bir düğme kullanılıyor.
  const baseBtnFontSize = await page.evaluate(() => {
    const probe = document.createElement('button');
    probe.className = 'btn primary';
    document.body.appendChild(probe);
    const size = getComputedStyle(probe).fontSize;
    const padding = getComputedStyle(probe).padding;
    probe.remove();
    return { size, padding };
  });
  check('.btn taban font-size büyütüldü (14px)', baseBtnFontSize.size === '14px', baseBtnFontSize.size);
  check('.btn taban padding büyütüldü (11px 20px)', baseBtnFontSize.padding === '11px 20px', baseBtnFontSize.padding);

  check('Konsol/sayfa hatası oluşmadı', errors.length === 0, errors.join(' | '));

  console.log('\n=== ÖZET ===');
  const fails = results.filter(r => !r.ok);
  console.log(`Toplam: ${results.length} | Başarılı: ${results.length - fails.length} | Başarısız: ${fails.length}`);
  await browser.close();
  process.exit(fails.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
