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

  // ===== 1) Skip link: first Tab should reveal it, Enter should move focus into #content =====
  await page.keyboard.press('Tab');
  const firstFocused = await page.evaluate(() => ({ tag: document.activeElement.tagName, cls: document.activeElement.className, text: document.activeElement.textContent }));
  console.log('[a11y] first Tab stop:', firstFocused);
  const skipLinkTop = await page.evaluate(() => getComputedStyle(document.querySelector('.skip-link')).top);
  console.log('[a11y] skip-link CSS top when focused (should not be -100px):', skipLinkTop);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(150);
  const afterSkip = await page.evaluate(() => ({ id: document.activeElement.id, tag: document.activeElement.tagName }));
  console.log('[a11y] focus after activating skip link:', afterSkip);

  // ===== 2) theme-toggle-btn has aria-label + aria-pressed, and toggling flips aria-pressed =====
  const themeBtnBefore = await page.evaluate(() => {
    const b = Array.from(document.querySelectorAll('.theme-toggle-btn')).find(el => el.offsetParent !== null);
    return { ariaLabel: b.getAttribute('aria-label'), ariaPressed: b.getAttribute('aria-pressed') };
  });
  console.log('[a11y] theme-toggle-btn before click:', themeBtnBefore);
  await page.locator('.theme-toggle-btn:visible').first().click();
  await page.waitForTimeout(150);
  const themeBtnAfter = await page.evaluate(() => {
    const b = Array.from(document.querySelectorAll('.theme-toggle-btn')).find(el => el.offsetParent !== null);
    return { ariaLabel: b.getAttribute('aria-label'), ariaPressed: b.getAttribute('aria-pressed') };
  });
  console.log('[a11y] theme-toggle-btn after click:', themeBtnAfter);

  // ===== 3) Cmd+K palette input has a visible focus ring via :focus-within on the row =====
  await page.keyboard.press('Control+k');
  await page.waitForTimeout(300);
  const cmdkFocusRing = await page.evaluate(() => {
    const row = document.querySelector('.cmdk-input-row');
    const input = row.querySelector('input');
    const focused = document.activeElement === input;
    const shadow = getComputedStyle(row).boxShadow;
    return { focused, shadow };
  });
  console.log('[a11y] cmdk input auto-focused + row has focus box-shadow:', cmdkFocusRing);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);

  // ===== 4) main landmark + nav landmark present =====
  const landmarks = await page.evaluate(() => ({
    mainRoleCount: document.querySelectorAll('[role="main"]').length,
    navCount: document.querySelectorAll('nav').length,
    sidebarAriaLabel: document.getElementById('sidebar').getAttribute('aria-label'),
  }));
  console.log('[a11y] landmarks:', landmarks);

  // ===== 5) sanity: rest of app still works (click a sidebar nav item) =====
  const navItem = page.locator('.nav-item').first();
  await navItem.click();
  await page.waitForTimeout(200);
  const contentNotEmpty = (await page.locator('#content').innerText()).length > 0;
  console.log('[a11y] content still renders after nav click:', contentNotEmpty);

  console.log('\nJS ERRORS:', errors.length);
  errors.forEach(e => console.log(' ERR:', e));
  await browser.close();
})();
