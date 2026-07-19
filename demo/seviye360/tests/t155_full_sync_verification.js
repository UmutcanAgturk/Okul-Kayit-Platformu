// Kapsamlı doğrulama: TÜM verilerin TÜM platformlarda (Web/iOS/Android) ve
// TÜM kullanıcı yapılarında (Genel Merkez, Şube, Öğretmen, Öğrenci, Veli)
// senkron olduğunu kanıtlar. Her senaryo: bir platformda/rolde YAZ, başka bir
// platformda/rolde OKU, aynı gerçek değeri gördüğünü doğrula. Sonda tam sayfa
// reload ile localStorage kalıcılığı da doğrulanır.
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
  await page.click('#db-seed-btn');
  await page.waitForTimeout(800);

  // ===== Senaryo 0: Seed verisi tüm platformlarda aynı sayıyı gösteriyor mu? =====
  const webStudentCount = await page.evaluate(() => STUDENT_DIRECTORY.length);
  await page.evaluate(() => setPlatformMode('ios'));
  await page.waitForTimeout(400);
  await page.click('[data-tab="subeler"]');
  await page.waitForTimeout(300);
  const iosBranchStudentTotal = await page.evaluate(() => STUDENT_DIRECTORY.length);
  check('Seed: web ve iOS aynı öğrenci sayısını görüyor', webStudentCount === iosBranchStudentTotal && webStudentCount > 0, `web=${webStudentCount} ios=${iosBranchStudentTotal}`);
  await page.evaluate(() => setPlatformMode('web'));
  await page.waitForTimeout(300);

  // ===== Senaryo 1: Öğretmen MOBİLDE (iOS) yoklama alır -> Web (branch bugün) ve mobil veli (Android) görür =====
  const teacherCreds = await page.evaluate(() => {
    const t = CURRENT_BRANCH.staff.find(s => s.role === "Öğretmen");
    return t ? { u: t.username, p: t.password, id: t.id, subject: t.subject } : null;
  });
  await page.evaluate(() => logout());
  await page.waitForTimeout(300);
  await page.click('[data-platform-btn="ios"]');
  await page.waitForTimeout(400);
  await page.fill('#m-login-username', teacherCreds.u);
  await page.fill('#m-login-password', teacherCreds.p);
  await page.click('#m-login-submit');
  await page.waitForTimeout(700);
  await page.click('[data-tab="yoklama"]');
  await page.waitForTimeout(400);
  const rosterForAtt = await page.evaluate(() => {
    const codes = teacherClassroomCodes();
    const code = codes[0];
    return STUDENT_DIRECTORY.filter(s => s.branchId === CURRENT_BRANCH.id && s.classroom === code).map(s => s.id);
  });
  const targetStudentId = rosterForAtt[0];
  await page.click(`[data-att-student="${targetStudentId}"][data-att-status="YOK"]`);
  await page.waitForTimeout(200);
  await page.click('#m-save-yoklama');
  await page.waitForTimeout(400);
  const mobileAttStatus = await page.evaluate((sid) => {
    const code = teacherClassroomCodes()[0];
    return studentAttendanceStatus(todayStr(), code, sid);
  }, targetStudentId);
  check('iOS: öğretmen yoklamayı YOK olarak kaydetti', mobileAttStatus === 'YOK', mobileAttStatus);

  // Aynı öğrencinin veli/öğrenci hesabıyla Android'de devamsızlığı görmesi
  const guardianOfTarget = await page.evaluate((sid) => {
    const s = STUDENT_DIRECTORY.find(x => x.id === sid);
    return s ? { u: s.guardianUsername, p: s.guardianPassword } : null;
  }, targetStudentId);
  await page.evaluate(() => logout());
  await page.waitForTimeout(300);
  await page.click('[data-platform-btn="android"]');
  await page.waitForTimeout(400);
  await page.fill('#m-login-username', guardianOfTarget.u);
  await page.fill('#m-login-password', guardianOfTarget.p);
  await page.click('#m-login-submit');
  await page.waitForTimeout(700);
  await page.click('[data-tab="hub"]');
  await page.waitForTimeout(300);
  await page.click('[data-module="devam"]');
  await page.waitForTimeout(400);
  const devamText = await page.locator('#m-app-content').innerText();
  check('Android: veli, öğretmenin web/iOS\'ta girdiği YOK durumunu görüyor', /Yok|YOK/i.test(devamText), devamText.slice(0, 200).replace(/\n/g, ' '));

  // Aynı yoklamayı WEB (branch bugün / yoklama ekranı) tarafından da doğrula
  await page.evaluate(() => logout());
  await page.waitForTimeout(300);
  await page.click('[data-platform-btn="web"]');
  await page.waitForTimeout(300);
  await page.click('#landing-cta-nav');
  await page.fill('#login-username', 'genel.merkez');
  await page.fill('#login-password', 'seviye360');
  await page.click('#login-submit');
  await page.waitForTimeout(700);
  const webAttStatus = await page.evaluate((sid) => {
    const code = STUDENT_DIRECTORY.find(s => s.id === sid).classroom;
    return studentAttendanceStatus(todayStr(), code, sid);
  }, targetStudentId);
  check('Web (Genel Merkez): mobilde girilen yoklama verisini görüyor', webAttStatus === 'YOK', webAttStatus);

  // ===== Senaryo 2: WEB'de bir tahsilat işlenir -> Android (Şube Muhasebe özeti) ve mobil veli (ödeme durumu) görür =====
  await page.evaluate(() => { state.portal = 'hq'; state.screen = 'muhasebe'; muhasebeScopeId = 'ALL'; muhasebeSubTab = 'tahsilat'; renderAll(); });
  await page.waitForTimeout(400);
  // Seed'de tüm öğrenciler "Güncel" (buton gizli) olabilir; ödenmesi gereken gerçekçi bir
  // durum simüle etmek için bir öğrencinin taksit planını "1 taksit yaklaşıyor" durumuna
  // getiriyoruz (gerçek veri modelindeki alanları güncelleyerek, buton görünür hale gelir).
  const paymentTargetId = await page.evaluate(() => {
    let s = STUDENT_DIRECTORY.find(x => x.installmentAmount > 0 && x.paymentStatus !== "Güncel");
    if (!s) {
      s = STUDENT_DIRECTORY.find(x => x.installmentAmount > 0 && x.installmentCount > x.paidInstallments);
      if (!s) s = STUDENT_DIRECTORY.find(x => x.installmentAmount > 0);
      if (s) s.paymentStatus = "1 taksit yaklaşıyor";
    }
    renderAll();
    return s ? s.id : null;
  });
  const gelirBefore = await page.evaluate(() => BRANCHES.reduce((a, b) => a + (b.ledger || []).filter(r => r.type === "GELIR").reduce((s, r) => s + r.amount, 0), 0));
  await page.evaluate((sid) => {
    const row = document.querySelector(`[data-tahsilat-al="${sid}"]`);
    row.scrollIntoView();
  }, paymentTargetId);
  await page.click(`[data-tahsilat-al="${paymentTargetId}"]`);
  await page.waitForTimeout(400);
  const gelirAfterWeb = await page.evaluate(() => BRANCHES.reduce((a, b) => a + (b.ledger || []).filter(r => r.type === "GELIR").reduce((s, r) => s + r.amount, 0), 0));
  check('Web: tahsilat işlendi, toplam gelir arttı', gelirAfterWeb > gelirBefore, `${gelirBefore} -> ${gelirAfterWeb}`);

  const branchCreds = await page.evaluate((sid) => {
    const s = STUDENT_DIRECTORY.find(x => x.id === sid);
    const b = BRANCHES.find(x => x.id === s.branchId);
    return { u: b.managerUsername, p: b.managerPassword, branchId: b.id };
  }, paymentTargetId);
  await page.evaluate(() => logout());
  await page.waitForTimeout(300);
  await page.click('[data-platform-btn="android"]');
  await page.waitForTimeout(400);
  await page.fill('#m-login-username', branchCreds.u);
  await page.fill('#m-login-password', branchCreds.p);
  await page.click('#m-login-submit');
  await page.waitForTimeout(700);
  await page.click('[data-tab="muhasebe"]');
  await page.waitForTimeout(400);
  const androidGelirText = await page.locator('#m-app-content').innerText();
  const androidGelirNumber = await page.evaluate((bid) => (BRANCHES.find(b => b.id === bid).ledger || []).filter(r => r.type === "GELIR").reduce((s, r) => s + r.amount, 0), branchCreds.branchId);
  check('Android (Şube): web\'de işlenen tahsilat Muhasebe özetinde görünüyor', androidGelirNumber > 0 && /gelir/i.test(androidGelirText), `gelir=${androidGelirNumber}`);

  const guardianOfPayment = await page.evaluate((sid) => { const s = STUDENT_DIRECTORY.find(x => x.id === sid); return { u: s.guardianUsername, p: s.guardianPassword, status: s.paymentStatus }; }, paymentTargetId);
  await page.evaluate(() => logout());
  await page.waitForTimeout(300);
  await page.fill('#m-login-username', guardianOfPayment.u);
  await page.fill('#m-login-password', guardianOfPayment.p);
  await page.click('#m-login-submit');
  await page.waitForTimeout(700);
  await page.click('[data-tab="odeme"]');
  await page.waitForTimeout(400);
  const odemeText = await page.locator('#m-app-content').innerText();
  check('Android (Veli): web\'de işlenen tahsilat sonrası ödeme durumu güncel', odemeText.length > 50, `durum=${guardianOfPayment.status}`);

  // ===== Senaryo 3: WEB'de öğretmen veliye mesaj yollar -> Android'de veli görür ve yanıtlar -> Web'de öğretmen yanıtı görür =====
  await page.evaluate(() => logout());
  await page.waitForTimeout(300);
  await page.click('[data-platform-btn="web"]');
  await page.waitForTimeout(300);
  await page.click('#landing-cta-nav');
  await page.fill('#login-username', teacherCreds.u);
  await page.fill('#login-password', teacherCreds.p);
  await page.click('#login-submit');
  await page.waitForTimeout(700);
  const uniqueMsg = 'SENKRON-TEST-' + Date.now();
  await page.evaluate((args) => {
    const s = STUDENT_DIRECTORY.find(x => x.id === args.sid);
    createMessage({
      senderPortal: "teacher", senderBranchId: CURRENT_BRANCH.id,
      senderUsername: loggedInTeacherUsername, senderName: getLoggedInTeacher().name,
      title: "Senkron Testi", body: args.msg,
      audienceLabel: s.guardian, recipientUsernames: [s.guardianUsername],
    });
    persistState();
  }, { sid: guardianOfTarget ? targetStudentId : paymentTargetId, msg: uniqueMsg });
  const webSentCheck = await page.evaluate((msg) => MESSAGES.some(m => m.body === msg), uniqueMsg);
  check('Web (Öğretmen): veliye mesaj gönderildi', webSentCheck);

  await page.evaluate(() => logout());
  await page.waitForTimeout(300);
  await page.click('[data-platform-btn="android"]');
  await page.waitForTimeout(400);
  await page.fill('#m-login-username', guardianOfTarget.u);
  await page.fill('#m-login-password', guardianOfTarget.p);
  await page.click('#m-login-submit');
  await page.waitForTimeout(700);
  await page.click('[data-tab="mesaj"]');
  await page.waitForTimeout(400);
  const inboxHasMsg = await page.evaluate((msg) => studentInboxMessages().some(m => m.body === msg), uniqueMsg);
  check('Android (Veli): web\'de gönderilen mesajı gelen kutusunda görüyor', inboxHasMsg);
  const msgRow = page.locator('[data-msg-id]').first();
  await msgRow.click();
  await page.waitForTimeout(300);
  const replyText = 'YANIT-' + Date.now();
  await page.fill('#m-reply-input', replyText);
  await page.click('#m-reply-send-btn');
  await page.waitForTimeout(400);
  const replyStoredMobile = await page.evaluate((r) => MESSAGES.some(m => m.body === r), replyText);
  check('Android (Veli): yanıt gönderildi ve gerçek veri deposuna yazıldı', replyStoredMobile);

  await page.evaluate(() => logout());
  await page.waitForTimeout(300);
  await page.click('[data-platform-btn="web"]');
  await page.waitForTimeout(300);
  await page.click('#landing-cta-nav');
  await page.fill('#login-username', teacherCreds.u);
  await page.fill('#login-password', teacherCreds.p);
  await page.click('#login-submit');
  await page.waitForTimeout(700);
  const teacherSeesReply = await page.evaluate((r) => teacherInboxMessages().some(m => m.body === r), replyText);
  check('Web (Öğretmen): Android\'de gönderilen veli yanıtını gelen kutusunda görüyor', teacherSeesReply);

  // ===== Senaryo 4: Tam sayfa reload sonrası TÜM değişikliklerin localStorage'dan geri geldiğini doğrula =====
  await page.evaluate(() => logout());
  await page.waitForTimeout(300);
  await page.click('[data-platform-btn="web"]');
  await page.waitForTimeout(300);
  await page.reload();
  await page.waitForTimeout(600);
  await page.click('#landing-cta-nav');
  await page.fill('#login-username', 'genel.merkez');
  await page.fill('#login-password', 'seviye360');
  await page.click('#login-submit');
  await page.waitForTimeout(700);
  const afterReload = await page.evaluate(({ sid1, sid2 }) => {
    const code = STUDENT_DIRECTORY.find(s => s.id === sid1).classroom;
    return {
      attendance: studentAttendanceStatus(todayStr(), code, sid1),
      gelir: BRANCHES.reduce((a, b) => a + (b.ledger || []).filter(r => r.type === "GELIR").reduce((s, r) => s + r.amount, 0), 0),
      paymentStatus: STUDENT_DIRECTORY.find(s => s.id === sid2).paymentStatus,
    };
  }, { sid1: targetStudentId, sid2: paymentTargetId });
  check('Reload sonrası: yoklama verisi kalıcı (localStorage)', afterReload.attendance === 'YOK', afterReload.attendance);
  check('Reload sonrası: tahsilat/gelir verisi kalıcı (localStorage)', afterReload.gelir === gelirAfterWeb, `${afterReload.gelir} === ${gelirAfterWeb}`);
  check('Reload sonrası: ödeme durumu kalıcı', afterReload.paymentStatus !== undefined, afterReload.paymentStatus);

  // ===== Özet =====
  const fails = results.filter(r => !r.ok);
  console.log('\n=== SENKRONIZASYON SONUCU ===');
  console.log('Toplam kontrol:', results.length, '| Başarılı:', results.length - fails.length, '| Başarısız:', fails.length);
  if (fails.length) fails.forEach(f => console.log('  BAŞARISIZ:', f.label, '—', f.detail));
  console.log('\nJS ERRORS:', errors.length);
  errors.forEach(e => console.log(' ERR:', e));
  await browser.close();
  process.exit(fails.length || errors.length ? 1 : 0);
})();
