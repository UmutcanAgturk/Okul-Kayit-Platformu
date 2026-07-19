const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const page = await browser.newPage({ viewport: { width: 1500, height: 1100 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', msg => { if (msg.type() === 'error') errors.push('[console] ' + msg.text()); });

  await page.goto('file://' + require('path').resolve(__dirname, '../seviye360-app.html'));
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForTimeout(500);
  await page.click('#landing-cta-nav');
  await page.fill('#login-username', 'genel.merkez');
  await page.fill('#login-password', 'seviye360');
  await page.click('#login-submit');
  await page.waitForTimeout(700);

  await page.click('#tour-start-btn');
  await page.waitForTimeout(500);

  const stepCount = await page.evaluate(() => TOUR_STEPS.length);
  console.log('total tour steps:', stepCount);

  for (let i = 0; i < stepCount; i++) {
    const info = await page.evaluate(() => ({
      tourStep, title: document.querySelector('.tour-card-title')?.textContent,
      platformMode: state.platformMode,
      mobileShellVisible: document.getElementById('mobile-shell').style.display !== 'none',
      appRootVisible: document.getElementById('app-root').style.display !== 'none',
      tourCardVisible: document.getElementById('tour-card').style.display !== 'none',
    }));
    console.log(`[step ${i}]`, JSON.stringify(info));
    await page.screenshot({ path: `test/shot_tour_step${i}.png` });
    await page.click('#tour-next-btn');
    await page.waitForTimeout(400);
  }

  // after last "next" click (which calls endTour), tour should be closed and back on web
  const final = await page.evaluate(() => ({
    tourActive, platformMode: state.platformMode,
    appRootVisible: document.getElementById('app-root').style.display !== 'none',
    tourCardVisible: document.getElementById('tour-card').style.display !== 'none',
  }));
  console.log('[after tour ends]', JSON.stringify(final));

  // re-run tour but exercise Geri (prev) button and the platform step's back-navigation restoring web
  await page.click('#tour-start-btn');
  await page.waitForTimeout(400);
  await page.click('#tour-next-btn'); // -> platform step (ios)
  await page.waitForTimeout(400);
  const midInfo = await page.evaluate(() => ({ platformMode: state.platformMode, mobileShellVisible: document.getElementById('mobile-shell').style.display !== 'none' }));
  console.log('[after advancing to platform step]', JSON.stringify(midInfo));
  await page.click('#tour-next-btn'); // -> map step, should restore web
  await page.waitForTimeout(400);
  const afterPlatform = await page.evaluate(() => ({ platformMode: state.platformMode, screen: state.screen, appRootVisible: document.getElementById('app-root').style.display !== 'none' }));
  console.log('[after leaving platform step forward]', JSON.stringify(afterPlatform));
  await page.click('#tour-prev-btn'); // back into platform step again
  await page.waitForTimeout(400);
  const backToPlatform = await page.evaluate(() => ({ platformMode: state.platformMode, mobileShellVisible: document.getElementById('mobile-shell').style.display !== 'none' }));
  console.log('[after Geri back into platform step]', JSON.stringify(backToPlatform));

  // close tour via X while mid-platform-step -> should restore web mode
  const closeBtn = page.locator('#tour-card-close');
  await closeBtn.click();
  await page.waitForTimeout(400);
  const afterClose = await page.evaluate(() => ({ tourActive, platformMode: state.platformMode, appRootVisible: document.getElementById('app-root').style.display !== 'none' }));
  console.log('[after closing tour mid-platform-step]', JSON.stringify(afterClose));

  console.log('\nJS ERRORS:', errors.length);
  errors.forEach(e => console.log(' ERR:', e));
  await browser.close();
})();
