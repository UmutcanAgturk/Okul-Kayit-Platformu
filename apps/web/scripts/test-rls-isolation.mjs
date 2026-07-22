// Row-Level Security'nin (bkz. prisma/rls/README.md ve
// prisma/migrations/20260721154601_add_rls_policies) yalnızca bir tasarım
// dokümanı değil, GERÇEKTEN çalıştığını kanıtlar. Prisma Client kullanmıyor
// çünkü asıl nokta budur: farklı DB ROLLERİYLE (app_role / superadmin_role —
// tabloların SAHİBİ olan "seviye360" migration rolüyle DEĞİL) bağlanıp,
// Postgres'in politikaları gerçekten uyguladığını kanıtlamak.
//
// Önkoşul: `npx prisma migrate dev` (RLS migration'ı dahil) ve
// `npm run seed` (kök package.json) uygulanmış, iki farklı tenant'a ait
// veri (Mezitli / Mersin ve Çankaya / Ankara) oluşturulmuş olmalı.
import pg from "pg";

const { Client } = pg;
const results = [];
const check = (label, ok, detail) => {
  results.push({ label, ok });
  console.log(`[${ok ? "OK" : "FAIL"}] ${label}${detail !== undefined ? " — " + detail : ""}`);
};

async function connectAs(role, password) {
  const client = new Client({
    host: "localhost",
    port: 5432,
    user: role,
    password,
    database: "seviye360",
  });
  await client.connect();
  return client;
}

async function main() {
  // Tenant id'lerini tablo SAHİBİ bağlantısıyla (RLS'den muaf) çekiyoruz —
  // testin kendisi bu id'leri "biliyor" olmalı, RLS'i bypass etmiyor.
  const owner = await connectAs("seviye360", "seviye360dev");
  const mezitli = (await owner.query(`SELECT id FROM "Tenant" WHERE code = 'MEZITLI-01'`)).rows[0];
  const cankaya = (await owner.query(`SELECT id FROM "Tenant" WHERE code = 'CANKAYA-01'`)).rows[0];
  if (!mezitli || !cankaya) throw new Error("İki tenant'lı seed verisi bulunamadı — önce `npm run seed` çalıştırın.");
  await owner.end();

  // ===== 1) app_role + tenant_id=Mezitli -> yalnızca Mezitli'nin öğrencilerini görmeli =====
  const asMezitli = await connectAs("app_role", "app_role_dev_only");
  await asMezitli.query(`SELECT set_config('app.tenant_id', $1, false)`, [mezitli.id]);
  const mezitliStudents = await asMezitli.query(`SELECT "studentNo" FROM "StudentProfile"`);
  check(
    "app_role + tenant_id=Mezitli: yalnızca Mezitli öğrencilerini görüyor (Çankaya'yı DEĞİL)",
    mezitliStudents.rows.length > 0 && mezitliStudents.rows.every((r) => r.studentNo !== "201002"),
    JSON.stringify(mezitliStudents.rows),
  );

  // ===== 2) Aynı bağlantıda tenant_id'yi Çankaya'ya çevir -> artık yalnızca Çankaya'yı görmeli =====
  await asMezitli.query(`SELECT set_config('app.tenant_id', $1, false)`, [cankaya.id]);
  const cankayaStudents = await asMezitli.query(`SELECT "studentNo" FROM "StudentProfile"`);
  check(
    "app_role + tenant_id=Çankaya: yalnızca Çankaya öğrencisini görüyor (Mezitli'yi DEĞİL)",
    cankayaStudents.rows.length === 1 && cankayaStudents.rows[0].studentNo === "201002",
    JSON.stringify(cankayaStudents.rows),
  );

  // ===== 3) tenant_id hiç set edilmemişse -> hiçbir tenant'ın verisini görmemeli =====
  const asNoTenant = await connectAs("app_role", "app_role_dev_only");
  const noTenantStudents = await asNoTenant.query(`SELECT "studentNo" FROM "StudentProfile"`);
  check("app_role + tenant_id set edilmemiş: hiçbir öğrenci görünmüyor", noTenantStudents.rows.length === 0, noTenantStudents.rows.length);

  // ===== 4) INSERT de aynı şekilde engellenir: yanlış tenant'a satır yazmaya çalış =====
  await asNoTenant.query(`SELECT set_config('app.tenant_id', $1, false)`, [mezitli.id]);
  let insertBlocked = false;
  try {
    await asNoTenant.query(
      `INSERT INTO "PaymentInstallment" (id, "tenantId", "studentId", "installmentNo", amount, "dueDate", status, "createdAt", "updatedAt")
       VALUES ('rls-test-bad-row', $1, (SELECT id FROM "StudentProfile" WHERE "studentNo" = '201002'), 99, 1, now(), 'PENDING', now(), now())`,
      [cankaya.id],
    );
  } catch (e) {
    insertBlocked = /row-level security/i.test(e.message);
  }
  check("app_role: başka tenant'a ait bir satır INSERT edilemiyor (RLS WITH CHECK)", insertBlocked);

  // ===== 5) Muhasebe: tenant doğru ama rol TEACHER ise hâlâ göremez =====
  const asTeacher = await connectAs("app_role", "app_role_dev_only");
  await asTeacher.query(`SELECT set_config('app.tenant_id', $1, false)`, [mezitli.id]);
  await asTeacher.query(`SELECT set_config('app.role', 'TEACHER', false)`);
  const teacherLedger = await asTeacher.query(`SELECT * FROM "AccountingLedgerEntry"`);
  check("Muhasebe: TEACHER rolü, doğru tenant'ta bile HİÇBİR ledger kaydı göremiyor", teacherLedger.rows.length === 0, teacherLedger.rows.length);

  // ===== 6) Aynı bağlantıda rolü BRANCH_ADMIN yap -> artık görmeli =====
  await asTeacher.query(`SELECT set_config('app.role', 'BRANCH_ADMIN', false)`);
  const adminLedger = await asTeacher.query(`SELECT * FROM "AccountingLedgerEntry"`);
  check("Muhasebe: BRANCH_ADMIN rolü doğru tenant'ın ledger kayıtlarını görüyor", adminLedger.rows.length > 0, adminLedger.rows.length);

  // ===== 7) superadmin_role (BYPASSRLS): tenant_id set edilmese bile HER ŞEYİ görür =====
  const asSuperadmin = await connectAs("superadmin_role", "superadmin_dev_only");
  const allStudents = await asSuperadmin.query(`SELECT "studentNo" FROM "StudentProfile" ORDER BY "studentNo"`);
  check(
    "superadmin_role: tenant_id set edilmeden TÜM tenant'ların öğrencilerini görüyor",
    allStudents.rows.length > 0 && allStudents.rows.some((r) => r.studentNo === "201001") && allStudents.rows.some((r) => r.studentNo === "201002"),
    JSON.stringify(allStudents.rows),
  );
  const allLedger = await asSuperadmin.query(`SELECT * FROM "AccountingLedgerEntry"`);
  check("superadmin_role: rol set edilmeden TÜM ledger kayıtlarını görüyor", allLedger.rows.length >= 2, allLedger.rows.length);

  await asMezitli.end();
  await asNoTenant.end();
  await asTeacher.end();
  await asSuperadmin.end();

  console.log("\n=== ÖZET ===");
  const fails = results.filter((r) => !r.ok);
  console.log(`Toplam: ${results.length} | Başarılı: ${results.length - fails.length} | Başarısız: ${fails.length}`);
  process.exit(fails.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
