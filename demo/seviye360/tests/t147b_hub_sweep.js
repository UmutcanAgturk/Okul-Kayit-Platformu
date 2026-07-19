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
  await page.waitForTimeout(800);
  await page.click('#db-seed-btn');
  await page.waitForTimeout(600);
  await page.evaluate(() => logout());
  await page.waitForTimeout(300);

  const logins = [
    { u: 'genel.merkez', p: 'seviye360', role: 'merkez' },
    { u: 'ogretmen', p: 'seviye360', role: 'ogretmen' },
  ];

  for (const platform of ['ios', 'android']) {
    await page.click(`[data-platform-btn="${platform}"]`);
    await page.waitForTimeout(300);
    for (const login of logins) {
      const loginVisible = await page.evaluate(() => document.getElementById('m-login-screen').style.display !== 'none');
      if (!loginVisible) { await page.evaluate(() => logout()); await page.waitForTimeout(300); }
      await page.fill('#m-login-username', login.u);
      await page.fill('#m-login-password', login.p);
      await page.click('#m-login-submit');
      await page.waitForTimeout(700);
      const role = await page.evaluate(() => (window.__mobileRoleDebug ? window.__mobileRoleDebug() : null));
      await page.click('[data-tab="hub"]');
      await page.waitForTimeout(300);
      const moduleBtns = await page.locator('[data-module]').all();
      const moduleIds = [];
      for (const b of moduleBtns) moduleIds.push(await b.getAttribute('data-module'));
      console.log(`[${platform}/${login.role}] hub modules found:`, moduleIds.length, moduleIds.join(','));
      for (const id of moduleIds) {
        try {
          const preInfo = await page.evaluate((moduleId) => {
            const el = document.getElementById('m-bottom-sheet');
            const r = el.getBoundingClientRect();
            const btn = document.querySelector(`[data-module="${moduleId}"]`);
            let btnRect = null;
            if (btn) { const br = btn.getBoundingClientRect(); btnRect = [br.top, br.bottom, br.left, br.right]; }
            const body = document.getElementById('m-sheet-body');
            const bodyRect = body.getBoundingClientRect();
            const scrim = document.getElementById('m-sheet-scrim');
            const scrimRect = scrim.getBoundingClientRect();
            const scrimStyle = getComputedStyle(scrim);
            const elAtPoint = btn ? (() => { const c = { x: (btnRect[2]+btnRect[3])/2, y: (btnRect[0]+btnRect[1])/2 }; const e2 = document.elementFromPoint(c.x, c.y); return e2 ? (e2.id || e2.className) : null; })() : null;
            return { sheetClass: el.className, sheetRect: [r.top, r.bottom, r.left, r.right], btnFound: !!btn, btnRect, bodyRect: [bodyRect.top, bodyRect.bottom, bodyRect.left, bodyRect.right], scrimRect: [scrimRect.top, scrimRect.bottom], scrimClass: scrim.className, scrimPE: scrimStyle.pointerEvents, elAtPoint };
          }, id);
          console.log(`  [${id}] pre-click=`, JSON.stringify(preInfo));
          await page.click(`[data-module="${id}"]`, { timeout: 5000 });
          await page.waitForTimeout(200);
          const txt = await page.locator('#m-app-content').innerText().catch(() => '');
          if (!txt || txt.length === 0) console.log(`  [${id}] EMPTY CONTENT`);
          const sheetOpen = await page.evaluate(() => document.getElementById('m-bottom-sheet').classList.contains('open'));
          if (sheetOpen) { console.log(`  [${id}] SHEET OPEN AFTER RENDER, title=`, await page.evaluate(() => document.getElementById('m-sheet-title').textContent)); await page.evaluate(() => { document.getElementById('m-sheet-scrim').classList.remove('open'); document.getElementById('m-bottom-sheet').classList.remove('open'); }); await page.waitForTimeout(150); }
          await page.click('#m-detail-back-btn', { timeout: 5000 });
          await page.waitForTimeout(120);
          const sheetOpenAfterBack = await page.evaluate(() => document.getElementById('m-bottom-sheet').classList.contains('open'));
          if (sheetOpenAfterBack) console.log(`  [${id}] SHEET STILL OPEN AFTER BACK`);
        } catch (e) {
          console.log(`  [${id}] FAILED:`, e.message.split(String.fromCharCode(10))[0]);
          await page.evaluate(() => { document.getElementById('m-sheet-scrim').classList.remove('open'); document.getElementById('m-bottom-sheet').classList.remove('open'); });
          await page.evaluate(() => { if (window.__mobileHooks) { } });
        }
      }
      // also sweep other tabs
      const tabs = await page.locator('.tab-btn').all();
      for (const t of tabs) {
        const tabId = await t.getAttribute('data-tab');
        await t.click();
        await page.waitForTimeout(150);
      }
      await page.evaluate(() => logout());
      await page.waitForTimeout(300);
    }
  }

  // veli/sube quick pass on web-seeded students/branch manager
  const guardianCreds = await page.evaluate(() => { const s = STUDENT_DIRECTORY.find(x => x.guardianUsername); return s ? { u: s.guardianUsername, p: s.guardianPassword } : null; });
  const branchCreds = await page.evaluate(() => { const b = BRANCHES.find(x => x.managerUsername); return b ? { u: b.managerUsername, p: b.managerPassword } : null; });
  console.log('guardianCreds found:', !!guardianCreds, 'branchCreds found:', !!branchCreds);

  for (const platform of ['ios', 'android']) {
    await page.click(`[data-platform-btn="${platform}"]`);
    await page.waitForTimeout(300);
    for (const login of [guardianCreds && { ...guardianCreds, role: 'veli' }, branchCreds && { ...branchCreds, role: 'sube' }].filter(Boolean)) {
      const loginVisible = await page.evaluate(() => document.getElementById('m-login-screen').style.display !== 'none');
      if (!loginVisible) { await page.evaluate(() => logout()); await page.waitForTimeout(300); }
      await page.fill('#m-login-username', login.u);
      await page.fill('#m-login-password', login.p);
      await page.click('#m-login-submit');
      await page.waitForTimeout(700);
      await page.click('[data-tab="hub"]');
      await page.waitForTimeout(300);
      const moduleBtns = await page.locator('[data-module]').all();
      const moduleIds = [];
      for (const b of moduleBtns) moduleIds.push(await b.getAttribute('data-module'));
      console.log(`[${platform}/${login.role}] hub modules found:`, moduleIds.length, moduleIds.join(','));
      for (const id of moduleIds) {
        try {
          await page.click(`[data-module="${id}"]`, { timeout: 5000 });
          await page.waitForTimeout(200);
          await page.click('#m-detail-back-btn', { timeout: 5000 });
          await page.waitForTimeout(120);
        } catch (e) {
          console.log(`  [${id}] FAILED:`, e.message.split(String.fromCharCode(10))[0]);
          await page.evaluate(() => { document.getElementById('m-sheet-scrim').classList.remove('open'); document.getElementById('m-bottom-sheet').classList.remove('open'); });
        }
      }
      const tabs = await page.locator('.tab-btn').all();
      for (const t of tabs) { await t.click(); await page.waitForTimeout(150); }
      await page.evaluate(() => logout());
      await page.waitForTimeout(300);
    }
  }

  console.log('TOTAL JS ERRORS:', errors.length);
  errors.slice(0, 40).forEach(e => console.log('  ERR:', e));
  await browser.close();
})();
