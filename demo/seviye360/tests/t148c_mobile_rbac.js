const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const page = await browser.newPage({ viewport: { width: 1400, height: 1100 } });
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
  await page.click('#db-seed-btn');
  await page.waitForTimeout(600);
  const studentCreds = await page.evaluate(() => { const s = STUDENT_DIRECTORY.find(x => x.username); return s ? { u: s.username, p: s.password } : null; });
  const guardianCreds = await page.evaluate(() => { const s = STUDENT_DIRECTORY.find(x => x.guardianUsername); return s ? { u: s.guardianUsername, p: s.guardianPassword } : null; });
  await page.evaluate(() => logout());
  await page.waitForTimeout(300);

  await page.click('[data-platform-btn="ios"]');
  await page.waitForTimeout(400);

  // ===== Pure student (non-guardian) login: odeme tab and veligorusme hub module must be HIDDEN =====
  await page.fill('#m-login-username', studentCreds.u);
  await page.fill('#m-login-password', studentCreds.p);
  await page.click('#m-login-submit');
  await page.waitForTimeout(700);
  const tabIds = await page.evaluate(() => Array.from(document.querySelectorAll('.tab-btn')).map(b => b.dataset.tab));
  console.log('[student-only] tabs shown:', tabIds, '| odeme hidden:', !tabIds.includes('odeme'));
  await page.click('[data-tab="hub"]');
  await page.waitForTimeout(300);
  const modIds = await page.evaluate(() => Array.from(document.querySelectorAll('[data-module]')).map(b => b.dataset.module));
  console.log('[student-only] hub modules shown:', modIds, '| veligorusme hidden:', !modIds.includes('veligorusme'));

  await page.evaluate(() => logout());
  await page.waitForTimeout(300);

  // ===== Guardian login: odeme tab and veligorusme hub module must be VISIBLE and functional =====
  await page.fill('#m-login-username', guardianCreds.u);
  await page.fill('#m-login-password', guardianCreds.p);
  await page.click('#m-login-submit');
  await page.waitForTimeout(700);
  const tabIds2 = await page.evaluate(() => Array.from(document.querySelectorAll('.tab-btn')).map(b => b.dataset.tab));
  console.log('[guardian] tabs shown:', tabIds2, '| odeme visible:', tabIds2.includes('odeme'));
  await page.click('[data-tab="odeme"]');
  await page.waitForTimeout(300);
  const odemeTxt = await page.locator('#m-app-content').innerText();
  console.log('[guardian] odeme screen renders real content (len):', odemeTxt.length, odemeTxt.includes('Bu bölüm yalnızca') ? 'STILL BLOCKED (bug)' : 'OK real content');
  await page.click('[data-tab="hub"]');
  await page.waitForTimeout(300);
  const modIds2 = await page.evaluate(() => Array.from(document.querySelectorAll('[data-module]')).map(b => b.dataset.module));
  console.log('[guardian] hub modules shown:', modIds2, '| veligorusme visible:', modIds2.includes('veligorusme'));

  console.log('\nJS ERRORS:', errors.length);
  errors.forEach(e => console.log(' ERR:', e));
  await browser.close();
})();
