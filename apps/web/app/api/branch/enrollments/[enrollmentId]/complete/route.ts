import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { getSessionActor } from "@/lib/session";
import { effectiveTenantId, withBranchTenantContext } from "@/lib/db-context";
import { hashPassword } from "@/lib/auth";
import { generateStudentEmail, generateStudentNo, generateTempPassword } from "@/lib/enrollment";
import { actorLabel, logActivity } from "@/lib/audit-log";

/**
 * Bir kayıt adayını (ON_KAYIT ile ön kaydı alınmış ya da doğrudan NORMAL_KAYIT
 * olarak girilmiş fark etmez — demo'daki "Normal Kayıt: Tekli Dönüştürme"
 * ekranı tam olarak bunu yapar) tamamlar: gerçek bir User (STUDENT) +
 * StudentProfile + taksit planı (PaymentInstallment[]) oluşturur, otomatik
 * kullanıcı adı/şifre üretir (bkz. lib/enrollment.ts — demo/seviye360-app.html'deki
 * "otomatik kullanıcı adı/şifre" akışının gerçek karşılığı) ve Enrollment'ı
 * KAYIT_TAMAMLANDI'ya taşıyıp studentId'yi bağlar. `type` alanı değişmez —
 * yalnızca adayın hangi yoldan geldiğini (kapora ile ön kayıt mı, doğrudan mı)
 * kaydeder, tamamlanabilirliğini etkilemez.
 *
 * Kayıt geliri burada ledger'a YAZILMAZ — mevcut
 * /api/branch/payment-installments/[id]/collect, her taksit fiilen tahsil
 * edildiğinde zaten bir GELIR kaydı oluşturuyor; burada ikinci kez (ve henüz
 * tahsil edilmemiş bir tutar için) yazmak çifte sayıma yol açardı.
 *
 * Şifre yalnızca bu yanıtta düz metin olarak döner — hiçbir yerde saklanmaz,
 * yalnızca bcrypt hash'i User.passwordHash'e yazılır. Bu yüzden çağıran
 * taraf (şube yöneticisi/rehberlik) bunu HEMEN veliye iletmelidir.
 */
const ROLES_ALLOWED: UserRole[] = [UserRole.BRANCH_ADMIN, UserRole.GUIDANCE_COORDINATOR];

export async function POST(request: NextRequest, { params }: { params: { enrollmentId: string } }) {
  const actor = await getSessionActor(request);
  if (!actor) {
    return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  }
  if (!ROLES_ALLOWED.includes(actor.role) && !(actor.role === UserRole.SUPERADMIN && actor.actingTenantId)) {
    return NextResponse.json({ message: "Bu rol kaydı tamamlayamaz" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const installmentCount = Number.isInteger(body.installmentCount) && body.installmentCount >= 1 && body.installmentCount <= 36 ? body.installmentCount : null;
  const installmentAmount = typeof body.installmentAmount === "number" && body.installmentAmount > 0 ? body.installmentAmount : null;
  const firstDueDate = typeof body.firstDueDate === "string" && !isNaN(Date.parse(body.firstDueDate)) ? new Date(body.firstDueDate) : null;

  if (!installmentCount || !installmentAmount || !firstDueDate) {
    return NextResponse.json(
      { message: "installmentCount (1-36), installmentAmount (>0) ve firstDueDate zorunludur" },
      { status: 400 },
    );
  }

  const outcome = await withBranchTenantContext(actor, async (tx) => {
    const enrollment = await tx.enrollment.findUnique({ where: { id: params.enrollmentId } });
    if (!enrollment || enrollment.tenantId !== effectiveTenantId(actor)) {
      return { kind: "not_found" as const };
    }
    if (enrollment.stage === "KAYIT_TAMAMLANDI" || enrollment.stage === "IPTAL_EDILDI") {
      return { kind: "already_final" as const, stage: enrollment.stage };
    }

    const tenant = await tx.tenant.findUniqueOrThrow({ where: { id: effectiveTenantId(actor) } });

    // Aday adına göre e-posta üretilir; çakışma olursa (aynı isimde ikinci
    // bir aday) sayısal bir sonek eklenerek benzersizleştirilir.
    let email = generateStudentEmail(enrollment.candidateFullName, tenant.code);
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
    const [firstName, ...rest] = enrollment.candidateFullName.trim().split(/\s+/);
    const lastName = rest.join(" ") || firstName;

    const user = await tx.user.create({
      data: { tenantId: effectiveTenantId(actor), email, passwordHash, role: "STUDENT", firstName, lastName },
    });
    const student = await tx.studentProfile.create({
      data: {
        tenantId: effectiveTenantId(actor),
        userId: user.id,
        gradeLevel: enrollment.candidateGradeLevel,
        classroomId: enrollment.targetClassroomId,
        studentNo,
      },
    });

    const installments = [];
    for (let i = 0; i < installmentCount; i++) {
      const dueDate = new Date(firstDueDate);
      dueDate.setUTCMonth(dueDate.getUTCMonth() + i);
      installments.push(
        await tx.paymentInstallment.create({
          data: {
            tenantId: effectiveTenantId(actor),
            studentId: student.id,
            installmentNo: i + 1,
            amount: installmentAmount,
            dueDate,
          },
        }),
      );
    }

    const updatedEnrollment = await tx.enrollment.update({
      where: { id: enrollment.id },
      data: { stage: "KAYIT_TAMAMLANDI", studentId: student.id },
    });

    await logActivity(tx, {
      tenantId: effectiveTenantId(actor),
      actorUserId: actor.id,
      actorLabel: actorLabel(actor),
      action: "Kayıt tamamlandı",
      detail: `${enrollment.candidateFullName} — Öğrenci No: ${studentNo}`,
    });

    return { kind: "completed" as const, enrollment: updatedEnrollment, student, installments, email, tempPassword };
  });

  if (outcome.kind === "not_found") {
    return NextResponse.json({ message: "Kayıt adayı bulunamadı" }, { status: 404 });
  }
  if (outcome.kind === "already_final") {
    return NextResponse.json({ message: `Bu kayıt zaten "${outcome.stage}" durumunda` }, { status: 409 });
  }

  return NextResponse.json(
    {
      enrollment: outcome.enrollment,
      student: outcome.student,
      installments: outcome.installments,
      credentials: { username: outcome.email, password: outcome.tempPassword },
    },
    { status: 201 },
  );
}
