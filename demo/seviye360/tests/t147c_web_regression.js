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
  await page.click('#landing-cta-nav');
  await page.fill('#login-username', 'genel.merkez');
  await page.fill('#login-password', 'seviye360');
  await page.click('#login-submit');
  await page.waitForTimeout(800);

  const hqScreens = ["map","kurumlar","students","exam","analytics","crm","onkayit","normalkayit","odeme","assign","staff","roller","ops","olcme","etut","mentor","muhasebe","iletisim"];
  for (const s of hqScreens) {
    await page.evaluate((scr) => { state.portal='hq'; state.screen=scr; CURRENT_BRANCH = BRANCHES[0]; renderAll(); }, s);
    await page.waitForTimeout(100);
  }
  console.log('HQ sweep (with mentor) errors:', errors.length);

  const setup = await page.evaluate(() => {
    const b = BRANCHES[0];
    CURRENT_BRANCH = b;
    let teacher = b.staff.find(s => s.role === "Öğretmen" && s.username);
    if (!teacher) {
      teacher = { id: b.staffSeq++, name: "Final Sweep Ogretmen", role: "Öğretmen", subject: "Matematik", phone: "0", email: "x@x.com", startDate: "2024-01-01", salary: 30000, status: "Aktif", username: "finalsweep.ogretmen", password: "seviye360" };
      b.staff.push(teacher);
    }
    let mentor = b.staff.find(s => s.role === "Mentör Öğretmen");
    if (!mentor) {
      mentor = { id: b.staffSeq++, name: "Final Sweep Mentor", role: "Mentör Öğretmen", subject: null, phone: "0", email: "m@x.com", startDate: "2024-01-01", salary: 25000, status: "Aktif" };
      mentor.username = uniqueStaffUsername(mentor.name);
      mentor.password = "seviye360";
      b.staff.push(mentor);
    }
    persistState();
    return { teacherUsername: teacher.username, mentorUsername: mentor.username, managerUsername: b.managerUsername, managerPassword: b.managerPassword };
  });

  async function loginAs(u, p) {
    await page.evaluate(() => logout());
    await page.waitForTimeout(250);
    await page.fill('#login-username', u);
    await page.fill('#login-password', p);
    await page.click('#login-submit');
    await page.waitForTimeout(700);
  }

  await loginAs(setup.managerUsername, setup.managerPassword);
  const branchScreens = ["crm","onkayit","normalkayit","odeme","students","assign","staff","roller","ops","olcme","etut","mentor","muhasebe","iletisim","profilim"];
  for (const s of branchScreens) {
    await page.evaluate((scr) => { state.screen=scr; renderAll(); }, s);
    await page.waitForTimeout(100);
  }
  console.log('branch sweep (with mentor) errors:', errors.length);

  await loginAs(setup.teacherUsername, 'seviye360');
  for (const s of ["xray","myclass","olcme","etut","mentor","iletisim","optic","profilim"]) {
    await page.evaluate((scr) => { state.screen=scr; renderAll(); }, s);
    await page.waitForTimeout(100);
  }
  console.log('teacher sweep (with mentor, non-mentor role) errors:', errors.length);

  await loginAs(setup.mentorUsername, 'seviye360');
  await page.evaluate(() => { state.screen='mentor'; renderAll(); });
  await page.waitForTimeout(200);
  const mentorScreenOk = await page.locator('#content').innerText();
  console.log('mentor teacher screen has Mentilerim:', mentorScreenOk.includes('Mentilerim'));
  console.log('mentor sweep errors:', errors.length);

  console.log('TOTAL ERRORS:', errors.length);
  console.log(errors.slice(0, 20));
  await browser.close();
})();
