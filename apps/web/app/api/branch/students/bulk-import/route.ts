import { NextRequest, NextResponse } from "next/server";
import { GradeLevel, UserRole } from "@prisma/client";
import { getSessionActor } from "@/lib/session";
import { effectiveTenantId, withBranchTenantContext } from "@/lib/db-context";
import { hashPassword } from "@/lib/auth";
import { generateStudentEmail, generateStudentNo, generateTempPassword } from "@/lib/enrollment";
import { actorLabel, logActivity } from "@/lib/audit-log";

/**
 * Normal Kayıt — Toplu Yükleme — demo/seviye360-app.html'deki
 * "branch:normalkayit" ekranının Toplu Yükleme modunun gerçek karşılığı:
 * "Excel'den birden çok öğrenciyi tek seferde içe aktarın — ön kayıt
 * gerektirmez, doğrudan tam kayıt oluşturur."
 *
 * İKİ BİLİNÇLİ SAPMA:
 *  1. Demo .xlsx bekliyordu; burada CSV kullanılır. npm'deki `xlsx` (SheetJS)
 *     paketinin düzeltmesi olmayan bilinen güvenlik açıkları var (Prototype
 *     Pollution + ReDoS — bkz. GHSA-4r6h-8v6p-xvw6/GHSA-5pgg-2g8v-p4x9);
 *     dosya ayrıştırma zaten tamamen tarayıcıda yapıldığından (demo'daki
 *     "Dosya tamamen tarayıcınızda işlenir" ilkesiyle aynı), aynı değeri
 *     sağlayan ama riskli bir ikili format ayrıştırıcısı gerektirmeyen CSV
 *     tercih edildi.
 *  2. Her satır, /api/branch/enrollments/[id]/complete ile AYNI mantığı
 *     (User+StudentProfile+PaymentInstallment[] + otomatik kimlik üretimi)
 *     izler, EK OLARAK doğrudan KAYIT_TAMAMLANDI durumunda bir Enrollment
 *     satırı da oluşturur (veli adı/telefonu için "complete" akışıyla aynı
 *     saklama yeri — ayrı bir alan eklemez) — tekli akıştaki "önce ön kayıt,
 *     sonra tamamla" iki adımını tek adıma indirger, ön kayıt gerektirmez.
 *
 * Her satır AYRI bir transaction'da işlenir — bir satırdaki hata diğerlerini
 * geri almaz (100 satırlık bir dosyada 1 hatalı satır yüzünden 99 başarılı
 * kaydın kaybolması istenmez).
 */
const ROLES_ALLOWED: UserRole[] = [UserRole.BRANCH_ADMIN, UserRole.GUIDANCE_COORDINATOR];
const MAX_ROWS = 200;

interface BulkRow {
  candidateFullName: string;
  candidateGradeLevel: GradeLevel;
  nationalId: string;
  guardianFullName: string;
  guardianPhone: string;
  classroomId?: string;
  installmentCount: number;
  installmentAmount: number;
  firstDueDate: string;
}

function validateRow(raw: unknown): BulkRow | string {
  if (typeof raw !== "object" || raw === null) return "Geçersiz satır";
  const r = raw as Record<string, unknown>;
  const candidateFullName = typeof r.candidateFullName === "string" ? r.candidateFullName.trim() : "";
  const candidateGradeLevel = typeof r.candidateGradeLevel === "string" && r.candidateGradeLevel in GradeLevel ? (r.candidateGradeLevel as GradeLevel) : null;
  // T.C. Kimlik No artık zorunlu — giriş yalnızca bununla yapılır (bkz.
  // app/api/auth/login), demo'daki CSV içe aktarmanın tcKimlik sütunuyla aynı.
  const nationalId = typeof r.nationalId === "string" ? r.nationalId.replace(/\D/g, "") : "";
  const guardianFullName = typeof r.guardianFullName === "string" ? r.guardianFullName.trim() : "";
  const guardianPhone = typeof r.guardianPhone === "string" ? r.guardianPhone.trim() : "";
  const classroomId = typeof r.classroomId === "string" && r.classroomId ? r.classroomId : undefined;
  const installmentCount = Number.isInteger(r.installmentCount) && (r.installmentCount as number) >= 1 && (r.installmentCount as number) <= 36 ? (r.installmentCount as number) : null;
  const installmentAmount = typeof r.installmentAmount === "number" && r.installmentAmount > 0 ? r.installmentAmount : null;
  const firstDueDate = typeof r.firstDueDate === "string" && !isNaN(Date.parse(r.firstDueDate)) ? r.firstDueDate : null;

  if (!candidateFullName) return "Ad Soyad zorunludur";
  if (!candidateGradeLevel) return "Geçersiz/eksik Sınıf Düzeyi";
  if (!/^\d{11}$/.test(nationalId)) return "T.C. Kimlik No 11 haneli olmalıdır";
  if (!guardianFullName) return "Veli Adı Soyadı zorunludur";
  if (!guardianPhone) return "Veli Telefonu zorunludur";
  if (!installmentCount || !installmentAmount || !firstDueDate) return "Taksit Sayısı, Taksit Tutarı ve İlk Vade zorunludur";

  return { candidateFullName, candidateGradeLevel, nationalId, guardianFullName, guardianPhone, classroomId, installmentCount, installmentAmount, firstDueDate };
}

export async function POST(request: NextRequest) {
  const actor = await getSessionActor(request);
  if (!actor) {
    return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  }
  if (!ROLES_ALLOWED.includes(actor.role) && !(actor.role === UserRole.SUPERADMIN && actor.actingTenantId)) {
    return NextResponse.json({ message: "Bu rol toplu kayıt yapamaz" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const rawRows = Array.isArray(body.rows) ? body.rows : null;
  if (!rawRows || rawRows.length === 0) {
    return NextResponse.json({ message: "rows (en az 1 satır) zorunludur" }, { status: 400 });
  }
  if (rawRows.length > MAX_ROWS) {
    return NextResponse.json({ message: `Tek seferde en fazla ${MAX_ROWS} satır işlenebilir` }, { status: 400 });
  }

  const results: Array<
    | { rowIndex: number; kind: "ok"; candidateFullName: string; studentNo: string; username: string; password: string }
    | { rowIndex: number; kind: "error"; message: string }
  > = [];

  for (let rowIndex = 0; rowIndex < rawRows.length; rowIndex++) {
    const validated = validateRow(rawRows[rowIndex]);
    if (typeof validated === "string") {
      results.push({ rowIndex, kind: "error", message: validated });
      continue;
    }
    const row = validated;

    try {
      const outcome = await withBranchTenantContext(actor, async (tx) => {
        if (row.classroomId) {
          const classroom = await tx.classroom.findUnique({ where: { id: row.classroomId } });
          if (!classroom) return { kind: "bad_classroom" as const };
          if (classroom.gradeLevel !== row.candidateGradeLevel) return { kind: "grade_mismatch" as const };
        }
        if (await tx.studentProfile.findUnique({ where: { nationalId: row.nationalId } })) {
          return { kind: "national_id_taken" as const };
        }

        const tenant = await tx.tenant.findUniqueOrThrow({ where: { id: effectiveTenantId(actor) } });

        let email = generateStudentEmail(row.candidateFullName, tenant.code);
        for (let attempt = 2; await tx.user.findUnique({ where: { email } }); attempt++) {
          const [local, domain] = email.split("@");
          email = `${local.replace(/\d+$/, "")}${attempt}@${domain}`;
          if (attempt > 20) throw new Error("Benzersiz e-posta üretilemedi");
        }

        let studentNo = generateStudentNo();
        for (let attempt = 0; await tx.studentProfile.findUnique({ where: { studentNo } }); attempt++) {
          studentNo = generateStudentNo();
          if (attempt > 20) throw new Error("Benzersiz öğrenci numarası üretilemedi");
        }

        const tempPassword = generateTempPassword();
        const passwordHash = await hashPassword(tempPassword);
        const [firstName, ...rest] = row.candidateFullName.split(/\s+/);
        const lastName = rest.join(" ") || firstName;

        const user = await tx.user.create({
          data: { tenantId: effectiveTenantId(actor), email, passwordHash, role: "STUDENT", firstName, lastName },
        });
        const student = await tx.studentProfile.create({
          data: {
            tenantId: effectiveTenantId(actor),
            userId: user.id,
            gradeLevel: row.candidateGradeLevel,
            classroomId: row.classroomId ?? null,
            studentNo,
            nationalId: row.nationalId,
          },
        });

        const firstDueDate = new Date(row.firstDueDate);
        for (let i = 0; i < row.installmentCount; i++) {
          const dueDate = new Date(firstDueDate);
          dueDate.setUTCMonth(dueDate.getUTCMonth() + i);
          await tx.paymentInstallment.create({
            data: { tenantId: effectiveTenantId(actor), studentId: student.id, installmentNo: i + 1, amount: row.installmentAmount, dueDate },
          });
        }

        await tx.enrollment.create({
          data: {
            tenantId: effectiveTenantId(actor),
            type: "NORMAL_KAYIT",
            stage: "KAYIT_TAMAMLANDI",
            candidateFullName: row.candidateFullName,
            candidateGradeLevel: row.candidateGradeLevel,
            guardianFullName: row.guardianFullName,
            guardianPhone: row.guardianPhone,
            targetClassroomId: row.classroomId ?? null,
            studentId: student.id,
          },
        });

        await logActivity(tx, {
          tenantId: effectiveTenantId(actor),
          actorUserId: actor.id,
          actorLabel: actorLabel(actor),
          action: "Toplu kayıt: öğrenci eklendi",
          detail: `${row.candidateFullName} — Öğrenci No: ${studentNo}`,
        });

        return { kind: "ok" as const, studentNo, tempPassword };
      });

      if (outcome.kind === "bad_classroom") {
        results.push({ rowIndex, kind: "error", message: "classroomId bu şubede bulunamadı" });
      } else if (outcome.kind === "grade_mismatch") {
        results.push({ rowIndex, kind: "error", message: "Sınıf seviyesi, seçilen şubeyle uyuşmuyor" });
      } else if (outcome.kind === "national_id_taken") {
        results.push({ rowIndex, kind: "error", message: "Bu T.C. Kimlik Numarası zaten kayıtlı" });
      } else {
        results.push({
          rowIndex,
          kind: "ok",
          candidateFullName: row.candidateFullName,
          studentNo: outcome.studentNo,
          // username artık öğrencinin TC Kimlik No'su — giriş bununla yapılır.
          username: row.nationalId,
          password: outcome.tempPassword,
        });
      }
    } catch (err) {
      results.push({ rowIndex, kind: "error", message: err instanceof Error ? err.message : "Bilinmeyen hata" });
    }
  }

  const successCount = results.filter((r) => r.kind === "ok").length;
  return NextResponse.json({ results, successCount, errorCount: results.length - successCount }, { status: 201 });
}
