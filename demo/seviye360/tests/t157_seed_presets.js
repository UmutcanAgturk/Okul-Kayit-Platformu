const { chromium } = require('playwright');
const APP = 'file://' + require('path').resolve(__dirname, '../seviye360-app.html');

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const page = await browser.newPage({ viewport: { width: 1400, height: 1100 } });
  const errors = [];
  const results = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', msg => { if (msg.type() === 'error') errors.push('[console] ' + msg.text()); });
  const check = (label, cond, detail) => { results.push({ label, ok: !!cond, detail }); console.log(`[${cond ? 'OK' : 'FAIL'}] ${label}${detail !== undefined ? ' — ' + detail : ''}`); };

  await page.goto(APP);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForTimeout(500);
  await page.click('#landing-cta-nav');
  await page.fill('#login-username', 'genel.merkez');
  await page.fill('#login-password', 'seviye360');
  await page.click('#login-submit');
  await page.waitForTimeout(700);

  // ===== Küçük Kurum preset (tek şube) =====
  await page.click('#db-seed-btn');
  await page.waitForTimeout(800);
  const smallStats = await page.evaluate(() => ({
    seededBranches: BRANCHES.filter(b => b.demoSeeded).length,
    totalStudents: STUDENT_DIRECTORY.length,
  }));
  check('Küçük Kurum: yalnızca 1 şube dolduruldu', smallStats.seededBranches === 1, JSON.stringify(smallStats));
  check('Küçük Kurum: 12 öğrenci oluşturuldu', smallStats.totalStudents === 12, smallStats.totalStudents);

  // Reset ve büyük zincir preset'ini dene
  await page.click('#db-reset-btn');
  await page.waitForTimeout(600);
  await page.click('#landing-cta-nav');
  await page.fill('#login-username', 'genel.merkez');
  await page.fill('#login-password', 'seviye360');
  await page.click('#login-submit');
  await page.waitForTimeout(700);

  await page.click('#db-seed-chain-btn');
  await page.waitForTimeout(2500);
  const chainStats = await page.evaluate(() => ({
    seededBranches: BRANCHES.filter(b => b.demoSeeded).length,
    totalBranches: BRANCHES.length,
    totalStudents: STUDENT_DIRECTORY.length,
    uniqueUsernames: new Set(STUDENT_DIRECTORY.map(s => s.guardianUsername)).size,
    // Yalnızca giriş yapabilen roller (Öğretmen/Mentör Öğretmen) username alır;
    // Şube Müdürü/Rehber/Ön Büro/Muhasebe gibi roller kasıtlı olarak username'siz
    // kalır (bkz. staffNeedsLogin) — bu yüzden yalnızca dolu olanları say.
    staffUsernames: BRANCHES.flatMap(b => b.staff.map(s => s.username)).filter(Boolean),
  }));
  chainStats.uniqueStaffUsernames = new Set(chainStats.staffUsernames).size;
  chainStats.totalNamedStaff = chainStats.staffUsernames.length;
  check('Büyük Zincir: tüm şubeler dolduruldu', chainStats.seededBranches === chainStats.totalBranches, JSON.stringify(chainStats));
  check('Büyük Zincir: öğrenci sayısı 6 şube x 12 = 72', chainStats.totalStudents === 72, chainStats.totalStudents);
  check('Büyük Zincir: veli kullanıcı adları global benzersiz', chainStats.uniqueUsernames === chainStats.totalStudents, `${chainStats.uniqueUsernames}/${chainStats.totalStudents}`);
  check('Büyük Zincir: personel kullanıcı adları (giriş yapabilenler) global benzersiz', chainStats.uniqueStaffUsernames === chainStats.totalNamedStaff, `${chainStats.uniqueStaffUsernames}/${chainStats.totalNamedStaff}`);

  // Farklı bir şubeye geçip verinin gerçekten dolu olduğunu doğrula (Ankara şubesi = BRANCHES[1])
  await page.evaluate(() => { CURRENT_BRANCH = BRANCHES[1]; state.portal = 'branch'; state.screen = 'bugun'; persistState(); renderAll(); });
  await page.waitForTimeout(400);
  const ankaraCheck = await page.evaluate(() => ({
    name: CURRENT_BRANCH.name,
    students: STUDENT_DIRECTORY.filter(s => s.branchId === CURRENT_BRANCH.id).length,
    ledgerEntries: CURRENT_BRANCH.ledger.length,
  }));
  check('Büyük Zincir: 2. kurum (Ankara) da gerçekten dolu', ankaraCheck.students === 12 && ankaraCheck.ledgerEntries > 0, JSON.stringify(ankaraCheck));

  // İkinci kez tıklayınca "zaten yüklü" uyarısı gelmeli, veri ikiye katlanmamalı
  await page.evaluate(() => { state.portal = 'hq'; renderAll(); });
  await page.waitForTimeout(200);
  const beforeSecondClick = await page.evaluate(() => STUDENT_DIRECTORY.length);
  await page.click('#db-seed-chain-btn');
  await page.waitForTimeout(500);
  const afterSecondClick = await page.evaluate(() => STUDENT_DIRECTORY.length);
  check('Büyük Zincir: ikinci tıklama veriyi çoğaltmıyor (idempotent)', beforeSecondClick === afterSecondClick, `${beforeSecondClick} -> ${afterSecondClick}`);

  console.log('\n=== ÖZET ===');
  const fails = results.filter(r => !r.ok);
  console.log('Toplam:', results.length, '| Başarılı:', results.length - fails.length, '| Başarısız:', fails.length);
  console.log('JS ERRORS:', errors.length);
  errors.forEach(e => console.log(' ERR:', e));
  await browser.close();
  process.exit(fails.length || errors.length ? 1 : 0);
})();
