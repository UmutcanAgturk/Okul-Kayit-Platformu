const { chromium } = require('playwright');

const PORTAL_SCREENS = {
  hq: ["bugun","map","analytics","kurumlar","students","crm","onkayit","normalkayit","odeme","assign","exam","olcme","attendance","schedule","karne","leaderboard","disiplin","veligorusme","kulup","servis","etut","mentor","staff","roller","ops","ogretmenperf","aktivite","raporlar","muhasebe","iletisim"],
  branch: ["bugun","crm","onkayit","normalkayit","odeme","students","assign","olcme","attendance","schedule","karne","leaderboard","disiplin","veligorusme","kulup","servis","etut","mentor","staff","roller","ops","ogretmenperf","aktivite","raporlar","muhasebe","iletisim","profilim"],
  teacher: ["xray","myclass","attendance","schedule","olcme","karne","leaderboard","disiplin","veligorusme","kulup","etut","mentor","iletisim","optic","profilim"],
  student: ["profile","payment","basari","olcme","attendance","schedule","karne","quiz","roadmap","ticket","disiplin","veligorusme","kulup","servis","etut","mentor","iletisim"],
};

const SUSPECT_PATTERNS = [/\bundefined\b/, /\bNaN\b/, /\[object Object\]/, /₺undefined/, /₺NaN/, /%undefined/, /%NaN/, /\bnull\b(?!able)/i];

function scanText(txt, label, findings) {
  SUSPECT_PATTERNS.forEach(re => {
    const m = txt.match(re);
    if (m) findings.push(`${label}: matched ${re} -> "...${txt.slice(Math.max(0, m.index - 40), m.index + 40)}..."`);
  });
}

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1200 } });
  const jsErrors = [];
  page.on('pageerror', e => jsErrors.push(e.message));
  page.on('console', msg => { if (msg.type() === 'error') jsErrors.push('[console] ' + msg.text()); });
  const findings = [];

  await page.goto('file://' + require('path').resolve(__dirname, '../seviye360-app.html'));
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForTimeout(500);

  // ===== PASS 1: EMPTY DATABASE (no seed) — hq portal sweep =====
  await page.click('#landing-cta-nav');
  await page.fill('#login-username', 'genel.merkez');
  await page.fill('#login-password', 'seviye360');
  await page.click('#login-submit');
  await page.waitForTimeout(700);
  for (const scr of PORTAL_SCREENS.hq) {
    await page.evaluate((s) => { state.portal = 'hq'; state.screen = s; renderAll(); }, scr);
    await page.waitForTimeout(90);
    const txt = await page.locator('#content').innerText().catch(() => '');
    scanText(txt, `[EMPTY/hq/${scr}]`, findings);
    if (txt.trim().length === 0) findings.push(`[EMPTY/hq/${scr}]: BLANK SCREEN (no text at all)`);
  }
  console.log('Pass 1 (empty DB, hq) done. Findings so far:', findings.length, 'JS errors:', jsErrors.length);

  // seed now
  await page.click('#db-seed-btn');
  await page.waitForTimeout(600);

  // ===== PASS 2: SEEDED DATABASE — hq portal sweep =====
  for (const scr of PORTAL_SCREENS.hq) {
    await page.evaluate((s) => { state.portal = 'hq'; state.screen = s; renderAll(); }, scr);
    await page.waitForTimeout(90);
    const txt = await page.locator('#content').innerText().catch(() => '');
    scanText(txt, `[SEEDED/hq/${scr}]`, findings);
  }
  console.log('Pass 2 (seeded, hq) done. Findings so far:', findings.length);

  // ===== PASS 3: branch portal, BRANCH_ADMIN role, seeded =====
  await page.evaluate(() => { state.portal = 'branch'; state.branchRole = 'BRANCH_ADMIN'; state.screen = 'bugun'; renderAll(); });
  await page.waitForTimeout(150);
  for (const scr of PORTAL_SCREENS.branch) {
    await page.evaluate((s) => { state.screen = s; renderAll(); }, scr);
    await page.waitForTimeout(90);
    const txt = await page.locator('#content').innerText().catch(() => '');
    scanText(txt, `[SEEDED/branch-admin/${scr}]`, findings);
  }
  console.log('Pass 3 (seeded, branch admin) done. Findings so far:', findings.length);

  // ===== PASS 4: branch portal, FRONT_DESK role — RBAC check: restricted screens must not render real content =====
  await page.evaluate(() => { state.branchRole = 'FRONT_DESK'; state.screen = 'bugun'; renderAll(); });
  await page.waitForTimeout(150);
  const restrictedIds = ["staff","roller","ogretmenperf","aktivite","raporlar","muhasebe"];
  for (const scr of restrictedIds) {
    const stillVisible = await page.evaluate((s) => {
      const list = visibleScreens(PORTALS.find(p => p.id === 'branch'));
      return list.some(x => x.id === s);
    }, scr);
    if (stillVisible) findings.push(`[RBAC/branch-frontdesk]: restricted screen "${scr}" still appears in visibleScreens() for FRONT_DESK role`);
  }
  console.log('Pass 4 (RBAC front-desk) done. Findings so far:', findings.length);

  // ===== PASS 5: teacher portal (generic ogretmen demo + real seeded teacher) =====
  await page.evaluate(() => logout());
  await page.waitForTimeout(300);
  await page.click('#landing-cta-nav').catch(() => {});
  const genericLoginVisible = await page.locator('#login-username').count();
  if (!genericLoginVisible) await page.click('#landing-cta-nav');
  await page.fill('#login-username', 'ogretmen');
  await page.fill('#login-password', 'seviye360');
  await page.click('#login-submit');
  await page.waitForTimeout(700);
  for (const scr of PORTAL_SCREENS.teacher) {
    await page.evaluate((s) => { state.portal = 'teacher'; state.screen = s; renderAll(); }, scr);
    await page.waitForTimeout(90);
    const txt = await page.locator('#content').innerText().catch(() => '');
    scanText(txt, `[SEEDED/teacher-generic/${scr}]`, findings);
  }
  console.log('Pass 5 (generic teacher) done. Findings so far:', findings.length);

  // real seeded teacher (from staff list)
  const realTeacherCreds = await page.evaluate(() => {
    const t = allStaffAcrossBranches().find(s => s.role === 'Öğretmen' && s.username);
    return t ? { u: t.username, p: t.password } : null;
  });
  console.log('real teacher creds found:', !!realTeacherCreds);
  if (realTeacherCreds) {
    await page.evaluate(() => logout());
    await page.waitForTimeout(300);
    await page.fill('#login-username', realTeacherCreds.u);
    await page.fill('#login-password', realTeacherCreds.p);
    await page.click('#login-submit');
    await page.waitForTimeout(700);
    for (const scr of PORTAL_SCREENS.teacher) {
      await page.evaluate((s) => { state.screen = s; renderAll(); }, scr);
      await page.waitForTimeout(90);
      const txt = await page.locator('#content').innerText().catch(() => '');
      scanText(txt, `[SEEDED/teacher-real/${scr}]`, findings);
    }
  }
  console.log('Pass 6 (real teacher) done. Findings so far:', findings.length);

  // ===== PASS 7: student/veli portal — both guardian and student-only login =====
  const guardianCreds = await page.evaluate(() => { const s = STUDENT_DIRECTORY.find(x => x.guardianUsername); return s ? { u: s.guardianUsername, p: s.guardianPassword } : null; });
  const studentCreds = await page.evaluate(() => { const s = STUDENT_DIRECTORY.find(x => x.username); return s ? { u: s.username, p: s.password } : null; });
  console.log('guardianCreds:', !!guardianCreds, 'studentCreds:', !!studentCreds);
  if (guardianCreds) {
    await page.evaluate(() => logout());
    await page.waitForTimeout(300);
    await page.fill('#login-username', guardianCreds.u);
    await page.fill('#login-password', guardianCreds.p);
    await page.click('#login-submit');
    await page.waitForTimeout(700);
    for (const scr of PORTAL_SCREENS.student) {
      await page.evaluate((s) => { state.screen = s; renderAll(); }, scr);
      await page.waitForTimeout(90);
      const txt = await page.locator('#content').innerText().catch(() => '');
      scanText(txt, `[SEEDED/guardian/${scr}]`, findings);
    }
  }
  console.log('Pass 7 (guardian) done. Findings so far:', findings.length);

  if (studentCreds) {
    await page.evaluate(() => logout());
    await page.waitForTimeout(300);
    await page.fill('#login-username', studentCreds.u);
    await page.fill('#login-password', studentCreds.p);
    await page.click('#login-submit');
    await page.waitForTimeout(700);
    // RBAC: guardianOnly screens (payment, veligorusme) must not be selectable for pure student login
    const guardianOnlyStillVisible = await page.evaluate(() => {
      const list = visibleScreens(PORTALS.find(p => p.id === 'student'));
      return list.filter(x => x.guardianOnly).map(x => x.id);
    });
    if (guardianOnlyStillVisible.length) findings.push(`[RBAC/student-only]: guardianOnly screens still visible for pure student login: ${guardianOnlyStillVisible.join(',')}`);
    for (const scr of PORTAL_SCREENS.student.filter(s => s !== 'payment' && s !== 'veligorusme')) {
      await page.evaluate((s) => { state.screen = s; renderAll(); }, scr);
      await page.waitForTimeout(90);
      const txt = await page.locator('#content').innerText().catch(() => '');
      scanText(txt, `[SEEDED/student-only/${scr}]`, findings);
    }
  }
  console.log('Pass 8 (student-only + RBAC) done. Findings so far:', findings.length);

  console.log('\n=== ALL FINDINGS ===');
  findings.forEach(f => console.log(f));
  console.log('\n=== JS ERRORS ===', jsErrors.length);
  jsErrors.slice(0, 30).forEach(e => console.log(' ERR:', e));

  await browser.close();
})();
