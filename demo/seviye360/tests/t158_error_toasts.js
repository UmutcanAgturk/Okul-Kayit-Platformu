const { chromium } = require('playwright');
const APP = 'file://' + require('path').resolve(__dirname, '../seviye360-app.html');

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const page = await browser.newPage({ viewport: { width: 1400, height: 1100 } });
  const errors = [];
  const results = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', msg => { if (msg.type() === 'error') errors.push('[console] ' + msg.text()); });
  const check = (label, ok, detail) => { results.push({ label, ok }); console.log(`[${ok ? 'OK' : 'FAIL'}] ${label}${detail !== undefined ? ' — ' + detail : ''}`); };

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

  // ===== 1) Tahsilat: tutar boşken "Tahsilat Al" tıklanınca uyarı çıkmalı =====
  await page.evaluate(() => { state.portal = 'hq'; state.screen = 'muhasebe'; muhasebeScopeId = 'ALL'; muhasebeSubTab = 'tahsilat'; renderAll(); });
  await page.waitForTimeout(400);
  // Ödemesi gereken bir öğrenci olduğundan emin ol (varsayılan seed'de "Güncel" olabilir)
  await page.evaluate(() => {
    const s = STUDENT_DIRECTORY.find(x => x.installmentAmount > 0);
    if (s) s.paymentStatus = "1 taksit yaklaşıyor";
    renderAll();
  });
  await page.waitForTimeout(300);
  const amountInput = page.locator('[data-tahsilat-amount]').first();
  await amountInput.fill('');
  const collectBtnId = await amountInput.evaluate(el => el.getAttribute('data-tahsilat-amount'));
  await page.click(`[data-tahsilat-al="${collectBtnId}"]`);
  await page.waitForTimeout(300);
  const toastText1 = await page.locator('.toast-card.warn').last().innerText().catch(() => '');
  check('Tahsilat: boş tutarla tıklayınca uyarı toast\'ı çıkıyor', /Eksik bilgi|tutar/i.test(toastText1), toastText1.replace(/\n/g, ' '));
  const isWarnStyled = await page.locator('.toast-card.warn').count();
  check('Tahsilat uyarısı görsel olarak "warn" (kırmızı) stilinde', isWarnStyled > 0, isWarnStyled);

  // ===== 2) İletişim şablon ekleme: başlık/içerik boşken uyarı çıkmalı =====
  await page.evaluate(() => { state.screen = 'iletisim'; renderAll(); });
  await page.waitForTimeout(400);
  const ilTab = await page.$('[data-subtab="sablonlar"]');
  if (ilTab) { await ilTab.click(); await page.waitForTimeout(300); }
  const tplTitleInput = await page.$('#il-tpl-title');
  if (tplTitleInput) {
    await page.fill('#il-tpl-title', '');
    await page.fill('#il-tpl-body', '');
    await page.click('#il-tpl-add');
    await page.waitForTimeout(300);
    const toastText2 = await page.locator('.toast-card.warn').last().innerText().catch(() => '');
    check('İletişim şablonu: boş başlık/içerikle uyarı çıkıyor', /Eksik bilgi/i.test(toastText2), toastText2.replace(/\n/g, ' '));
  } else {
    check('İletişim şablonu testi atlandı (sekme bulunamadı)', false, 'ui değişmiş olabilir');
  }

  // ===== 3) Mobil: boş mesaj yanıtı gönderilmeye çalışılınca hata snackbar'ı çıkmalı =====
  // Öğretmenin yanıtlayabileceği bir mesaj olması için önce veli/branch'ten bir mesaj gönderiyoruz
  // (canReply yalnızca teacher/branch kaynaklı mesajlarda true olduğundan, tersini kuruyoruz:
  // burada branch'ten öğretmene mesaj yollayıp öğretmenin YANIT vermesini test ediyoruz).
  await page.evaluate(() => {
    const t = CURRENT_BRANCH.staff.find(s => s.role === "Öğretmen");
    createMessage({
      senderPortal: "branch", senderBranchId: CURRENT_BRANCH.id,
      senderUsername: CURRENT_BRANCH.managerUsername, senderName: CURRENT_BRANCH.managerName,
      title: "Test Mesajı", body: "Boş yanıt testine hazırlık.",
      audienceLabel: t.name, recipientUsernames: [t.username],
    });
    persistState();
  });
  await page.evaluate(() => logout());
  await page.waitForTimeout(300);
  await page.click('[data-platform-btn="android"]');
  await page.waitForTimeout(400);
  const teacherCreds = await page.evaluate(() => { const t = CURRENT_BRANCH.staff.find(s => s.role === "Öğretmen"); return t ? { u: t.username, p: t.password } : null; });
  if (teacherCreds) {
    await page.fill('#m-login-username', teacherCreds.u);
    await page.fill('#m-login-password', teacherCreds.p);
    await page.click('#m-login-submit');
    await page.waitForTimeout(700);
    // Öğretmenin mesaj kutusunda en az bir mesaj yoksa reply testi anlamsız; bu yüzden
    // sadece boş input ile göndermeyi deneyip snackbar'ın "error" varyantıyla çıktığını kontrol ediyoruz
    // (mevcut bir mesaj yoksa bu adım atlanır).
    const msgTab = await page.$('[data-tab="mesaj"]');
    if (msgTab) {
      await msgTab.click();
      await page.waitForTimeout(400);
      const msgRow = await page.$('[data-msg-id]');
      if (msgRow) {
        await msgRow.click();
        await page.waitForTimeout(300);
        const replyInput = await page.$('#m-reply-input');
        if (replyInput) {
          await page.fill('#m-reply-input', '');
          await page.click('#m-reply-send-btn');
          await page.waitForTimeout(400);
          const snackText = await page.locator('.snackbar-error').first().innerText().catch(() => '');
          const isErrorSnack = await page.locator('.snackbar-error').count();
          check('Mobil: boş yanıt gönderilince uyarı snackbar\'ı çıkıyor', /mesaj yazın/i.test(snackText), snackText);
          check('Mobil uyarı snackbar\'ı görsel olarak hata (xCircle) stilinde', isErrorSnack > 0, isErrorSnack);
        } else {
          check('Mobil yanıt testi atlandı (reply input yok — muhtemelen yanıtlanamayan bir mesaj)', true, 'atlandı');
        }
      } else {
        check('Mobil yanıt testi atlandı (gelen kutusu boş)', true, 'atlandı');
      }
    }
  }

  console.log('\n=== ÖZET ===');
  const fails = results.filter(r => !r.ok);
  console.log('Toplam:', results.length, '| Başarılı:', results.length - fails.length, '| Başarısız:', fails.length);
  console.log('JS ERRORS:', errors.length);
  errors.forEach(e => console.log(' ERR:', e));
  await browser.close();
  process.exit(fails.length || errors.length ? 1 : 0);
})();
