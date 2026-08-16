-- TimetableSlot (Ders Programı) — Devamsızlık/Disiplin/Classroom ile aynı
-- desen: yalnızca `tenant_isolation`, rol bazlı kısıtlama YOK — TEACHER/
-- BRANCH_ADMIN/GUIDANCE_COORDINATOR programı görebilir/düzenleyebilir,
-- STUDENT/PARENT yalnızca okuyabilir (bu satır bazlı filtre veritabanında
-- değil uygulama katmanında yapılır — bkz. app/api/branch/timetable).
ALTER TABLE "TimetableSlot" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TimetableSlot" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "TimetableSlot"
  USING ("tenantId" = current_setting('app.tenant_id', true));
