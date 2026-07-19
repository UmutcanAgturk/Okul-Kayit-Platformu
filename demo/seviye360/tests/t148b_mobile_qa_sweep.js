const { chromium } = require('playwright');

const SUSPECT_PATTERNS = [/\bundefined\b/, /\bNaN\b/, /\[object Object\]/, /₺undefined/, /₺NaN/, /%undefined/, /%NaN/, /\bnull\b(?!able)/i];
function scanText(txt, label, findings) {
  SUSPECT_PATTERNS.forEach(re => {
    const m = txt.match(re);
    if (m) findings.push(`${label}: matched ${re} -> "...${txt.slice(Math.max(0, m.index - 40), m.index + 40)}..."`);
  });
  if (txt.trim().length === 0) findings.push(`${label}: BLANK CONTENT`);
}

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const page = await browser.newPage({ viewport: { width: 1400, height: 1100 } });
  const jsErrors = [];
  page.on('pageerror', e => jsErrors.push(e.message));
  page.on('console', msg => { if (msg.type() === 'error') jsErrors.push('[console] ' + msg.text()); });
  const findings = [];

  await page.goto('file://' + require('path').resolve(__dirname, '../seviye360-app.html'));
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForTimeout(500);

  // ===== EMPTY DB — merkez role on iOS, sweep every tab + every hub module =====
  await page.click('#landing-cta-nav');
  await page.fill('#login-username', 'genel.merkez');
  await page.fill('#login-password', 'seviye360');
  await page.click('#login-submit');
  await page.waitForTimeout(700);
  await page.click('[data-platform-btn="ios"]');
  await page.waitForTimeout(400);

  async function sweepCurrentRole(label) {
    const tabs = await page.locator('.tab-btn').all();
    const tabIds = [];
    for (const t of tabs) tabIds.push(await t.getAttribute('data-tab'));
    for (const tabId of tabIds) {
      await page.click(`[data-tab="${tabId}"]`);
      await page.waitForTimeout(150);
      const txt = await page.locator('#m-app-content').innerText().catch(() => '');
      scanText(txt, `[${label}/tab:${tabId}]`, findings);
      if (tabId === 'hub') {
        const modBtns = await page.locator('[data-module]').all();
        const modIds = [];
        for (const b of modBtns) modIds.push(await b.getAttribute('data-module'));
        for (const modId of modIds) {
          await page.click(`[data-module="${modId}"]`);
          await page.waitForTimeout(150);
          const mtxt = await page.locator('#m-app-content').innerText().catch(() => '');
          scanText(mtxt, `[${label}/hub:${modId}]`, findings);
          await page.click('#m-detail-back-btn');
          await page.waitForTimeout(100);
        }
      }
    }
  }

  await sweepCurrentRole('EMPTY/ios/merkez');
  console.log('empty ios merkez sweep done, findings:', findings.length);

  // seed
  await page.click('[data-platform-btn="web"]');
  await page.waitForTimeout(300);
  await page.click('#db-seed-btn');
  await page.waitForTimeout(600);
  await page.click('[data-platform-btn="ios"]');
  await page.waitForTimeout(400);
  await sweepCurrentRole('SEEDED/ios/merkez');
  console.log('seeded ios merkez sweep done, findings:', findings.length);

  // ===== teacher (real) on Android =====
  const realTeacherCreds = await page.evaluate(() => {
    const t = allStaffAcrossBranches().find(s => s.role === 'Öğretmen' && s.username);
    return t ? { u: t.username, p: t.password } : null;
  });
  await page.evaluate(() => logout());
  await page.waitForTimeout(300);
  await page.click('[data-platform-btn="android"]');
  await page.waitForTimeout(400);
  if (realTeacherCreds) {
    await page.fill('#m-login-username', realTeacherCreds.u);
    await page.fill('#m-login-password', realTeacherCreds.p);
    await page.click('#m-login-submit');
    await page.waitForTimeout(700);
    await sweepCurrentRole('SEEDED/android/teacher-real');
    console.log('android teacher sweep done, findings:', findings.length);
  }

  // ===== veli (guardian, real) on Android =====
  const guardianCreds = await page.evaluate(() => { const s = STUDENT_DIRECTORY.find(x => x.guardianUsername); return s ? { u: s.guardianUsername, p: s.guardianPassword } : null; });
  await page.evaluate(() => logout());
  await page.waitForTimeout(300);
  if (guardianCreds) {
    await page.fill('#m-login-username', guardianCreds.u);
    await page.fill('#m-login-password', guardianCreds.p);
    await page.click('#m-login-submit');
    await page.waitForTimeout(700);
    await sweepCurrentRole('SEEDED/android/veli');
    console.log('android veli sweep done, findings:', findings.length);
  }

  // ===== sube (branch manager, real) on Android =====
  const branchCreds = await page.evaluate(() => { const b = BRANCHES.find(x => x.managerUsername); return b ? { u: b.managerUsername, p: b.managerPassword } : null; });
  await page.evaluate(() => logout());
  await page.waitForTimeout(300);
  if (branchCreds) {
    await page.fill('#m-login-username', branchCreds.u);
    await page.fill('#m-login-password', branchCreds.p);
    await page.click('#m-login-submit');
    await page.waitForTimeout(700);
    await sweepCurrentRole('SEEDED/android/sube');
    console.log('android sube sweep done, findings:', findings.length);
  }

  console.log('\n=== ALL FINDINGS ===');
  findings.forEach(f => console.log(f));
  console.log('\n=== JS ERRORS ===', jsErrors.length);
  jsErrors.slice(0, 30).forEach(e => console.log(' ERR:', e));

  await browser.close();
})();
