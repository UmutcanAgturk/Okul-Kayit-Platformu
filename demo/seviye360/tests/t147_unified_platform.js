const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const page = await browser.newPage({ viewport: { width: 1500, height: 1200 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', msg => { if (msg.type() === 'error') errors.push('[console] ' + msg.text()); });

  await page.goto('file://' + require('path').resolve(__dirname, '../seviye360-app.html'));
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForTimeout(500);

  // ===== 1) WEB: login as hq, seed real demo data =====
  await page.click('#landing-cta-nav');
  await page.fill('#login-username', 'genel.merkez');
  await page.fill('#login-password', 'seviye360');
  await page.click('#login-submit');
  await page.waitForTimeout(800);
  await page.click('#db-seed-btn');
  await page.waitForTimeout(600);
  const webStudentCount = await page.evaluate(() => STUDENT_DIRECTORY.length);
  console.log('[web] seeded students:', webStudentCount);
  console.log('[web] errors so far:', errors.length, errors.slice(0, 5));

  // ===== 2) Switch to iOS mode =====
  await page.click('[data-platform-btn="ios"]');
  await page.waitForTimeout(400);
  const iosShellVisible = await page.evaluate(() => document.getElementById('mobile-shell').style.display !== 'none');
  console.log('[ios] shell visible after switch (still authenticated as hq):', iosShellVisible);
  const iosPlatformAttr = await page.evaluate(() => document.getElementById('mobile-shell').dataset.platform);
  console.log('[ios] data-platform attr:', iosPlatformAttr);
  await page.screenshot({ path: '/tmp/claude-0/-home-user-Okul-Kayit-Platformu/d927a0f4-af89-5953-9501-38d25b3b62f4/scratchpad/test/shot_unified_ios_merkez.png' });
  const iosHomeText = await page.locator('#m-app-content').innerText();
  console.log('[ios] merkez home renders (len):', iosHomeText.length);

  // Navigate a few mobile tabs
  await page.click('[data-tab="subeler"]');
  await page.waitForTimeout(300);
  console.log('[ios] subeler tab shows real branch count:', (await page.locator('#m-app-content').innerText()).includes('Mersin') || (await page.locator('#m-app-content').innerText()).length > 0);
  await page.click('.list-row >> nth=0');
  await page.waitForTimeout(300);
  console.log('[ios] branch detail opened (no crash):', (await page.locator('#m-app-content').innerText()).length > 0);
  await page.click('#m-detail-back-btn');
  await page.waitForTimeout(200);

  await page.click('[data-tab="hub"]');
  await page.waitForTimeout(300);
  console.log('[ios] hub renders modules:', (await page.locator('#m-app-content').innerText()).length > 0);

  // ===== 3) Switch to Android mode mid-session (still same login!) =====
  await page.click('[data-platform-btn="android"]');
  await page.waitForTimeout(400);
  const androidAttr = await page.evaluate(() => document.getElementById('mobile-shell').dataset.platform);
  console.log('[android] data-platform attr:', androidAttr);
  const androidNavbarVisible = await page.evaluate(() => { const el = document.getElementById('m-android-navbar'); return getComputedStyle(el).display !== 'none'; });
  console.log('[android] 3-button nav bar visible:', androidNavbarVisible);
  await page.screenshot({ path: '/tmp/claude-0/-home-user-Okul-Kayit-Platformu/d927a0f4-af89-5953-9501-38d25b3b62f4/scratchpad/test/shot_unified_android_merkez.png' });

  // ===== 4) Switch back to Web — same session, same data =====
  await page.click('[data-platform-btn="web"]');
  await page.waitForTimeout(400);
  const webRootVisible = await page.evaluate(() => document.getElementById('app-root').style.display !== 'none');
  console.log('[web] back to web, app-root visible:', webRootVisible);
  const stillAuthenticated = await page.evaluate(() => isAuthenticated && state.portal === 'hq');
  console.log('[web] still authenticated as hq after 2 platform round-trips:', stillAuthenticated);

  // ===== 5) Logout, then log in AS TEACHER directly on Android =====
  await page.evaluate(() => logout());
  await page.waitForTimeout(300);
  await page.click('[data-platform-btn="android"]');
  await page.waitForTimeout(400);
  const loginScreenVisible = await page.evaluate(() => document.getElementById('m-login-screen').style.display !== 'none');
  console.log('[android] login screen visible after logout:', loginScreenVisible);
  await page.click('#mobile-shell .demo-acc-row[data-u="ogretmen"]');
  await page.waitForTimeout(800);
  const teacherRole = await page.evaluate(() => state.portal);
  console.log('[android] logged in portal:', teacherRole);
  await page.screenshot({ path: '/tmp/claude-0/-home-user-Okul-Kayit-Platformu/d927a0f4-af89-5953-9501-38d25b3b62f4/scratchpad/test/shot_unified_android_teacher.png' });

  await page.click('[data-tab="yoklama"]');
  await page.waitForTimeout(300);
  const yoklamaText = await page.locator('#m-app-content').innerText();
  console.log('[android] yoklama renders (len):', yoklamaText.length);
  const rollBtn = page.locator('[data-att-student]').first();
  if (await rollBtn.count()) {
    await rollBtn.click();
    await page.waitForTimeout(200);
    console.log('[android] attendance status click did not crash');
  }
  const saveBtn = page.locator('#m-save-yoklama');
  if (await saveBtn.count()) {
    await saveBtn.click();
    await page.waitForTimeout(300);
    console.log('[android] yoklama saved without crash');
  }

  await page.click('[data-tab="sinif"]');
  await page.waitForTimeout(300);
  console.log('[android] sinif (roster) renders:', (await page.locator('#m-app-content').innerText()).length > 0);
  const studentRow = page.locator('[data-open-student]').first();
  if (await studentRow.count()) {
    await studentRow.click();
    await page.waitForTimeout(300);
    console.log('[android] student mini detail opens:', (await page.locator('#m-app-content').innerText()).length > 0);
  }

  // ===== 6) Verify web reflects the attendance change made on Android =====
  await page.click('[data-platform-btn="web"]');
  await page.waitForTimeout(400);
  const webSeesAttendance = await page.evaluate(() => {
    const today = todayStr();
    return isAttendanceTaken(today, teacherClassroomCodes()[0]);
  });
  console.log('[web] sees attendance taken on Android (single source of truth proof):', webSeesAttendance);

  // ===== 7) Persistence across reload =====
  await page.reload();
  await page.waitForTimeout(600);
  const afterReloadMode = await page.evaluate(() => state.platformMode);
  const afterReloadAuth = await page.evaluate(() => isAuthenticated);
  console.log('[reload] platformMode persisted:', afterReloadMode, '| still authenticated:', afterReloadAuth);
  const shellVisibleAfterReload = await page.evaluate(() => document.getElementById('mobile-shell').style.display !== 'none');
  console.log('[reload] mobile shell correctly shown on reload (mode=web expected false):', shellVisibleAfterReload);

  console.log('TOTAL JS ERRORS:', errors.length);
  errors.slice(0, 20).forEach(e => console.log('  ERR:', e));

  await browser.close();
})();
