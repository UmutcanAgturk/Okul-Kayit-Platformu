import { NextRequest, NextResponse } from "next/server";
import { PaymentMethodType, UserRole } from "@prisma/client";
import { getSessionActor } from "@/lib/session";
import { effectiveTenantId, withBranchTenantContext } from "@/lib/db-context";
import { hashPassword } from "@/lib/auth";
import { generateParentEmail, generateStudentEmail, generateStudentNo, generateTempPassword } from "@/lib/enrollment";
import { actorLabel, logActivity } from "@/lib/audit-log";
import { formatDocumentNo } from "@/lib/documents";

const GENDER_OPTIONS = ["Kadın", "Erkek"];
const PAYMENT_METHOD_OPTIONS = [...Object.values(PaymentMethodType), "SENET"] as const;
// MessageAttachment/PaymentReceipt ile AYNI sınır (bkz. app/api/branch/messages,
// app/api/students/[studentId]/payment-receipts route'larındaki MAX_DATA_URL_LENGTH).
const MAX_PHOTO_DATA_URL_LENGTH = 3_500_000;

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
 *
 * Demo'daki nk-* form alanlarının geri kalanı (bkz. seviye360-app.html
 * "Normal Kayıt" formu) — hepsi OPSİYONEL (geriye dönük uyumluluk için;
 * mevcut çağıranlar bunları göndermeden çalışmaya devam eder):
 *   - nationalId/birthDate/gender: StudentProfile'a doğrudan yazılır.
 *   - phone: User.phone'a yazılır (velinin guardianPhone'undan AYRI —
 *     öğrencinin kendi iletişim numarası; aynı tenant içinde tekil olmalıdır
 *     — bkz. User @@unique([tenantId, phone]) — ihlalde 409).
 *   - targetClassroomId: verilirse hem Enrollment.targetClassroomId hem
 *     StudentProfile.classroomId güncellenir (seviye eşleşmesi doğrulanır);
 *     verilmezse Ön Kayıt aşamasında zaten atanmış olan targetClassroomId
 *     kullanılır. Kapasite dolulukta backend sert bir kısıt UYGULAMAZ —
 *     Sınıf Atama modülündeki aynı yumuşak-kısıt deseniyle tutarlı, dolu
 *     sınıflar yalnızca UI'da devre dışı bırakılır.
 *   - busRouteId: StudentProfile.busRouteId (Servis/Ulaşım Takibi).
 *   - contractAccepted: true ise Enrollment.contractSignedAt = şimdi.
 *   - photoDataUrl (task #113): demo'daki nk-photo alanının karşılığı —
 *     "data:image/" ile başlayan bir data URI olmalı, StudentProfile.photoDataUrl'a
 *     yazılır; StudentDetailDrawer'da (bkz. app/api/branch/students/[studentId]/detail)
 *     görüntülenir.
 *   - paymentMethodType: KREDI_KARTI/BANKA_HAVALESI/NAKIT ise tek bir
 *     PaymentMethod satırı (isDefault:true) oluşturulur; SENET ise demo'daki
 *     generateSenetsForStudent() ile birebir aynı şekilde HER taksit için bir
 *     PromissoryNote üretilir (bkz. app/api/branch/promissory-notes'daki
 *     numaralandırma deseni).
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

  // T.C. Kimlik No artık OPSİYONEL DEĞİL — giriş yalnızca TC Kimlik No +
  // şifre ile yapıldığından (bkz. app/api/auth/login) hem öğrencinin hem de
  // velinin kendi TC Kimlik No'su olmadan bir giriş hesabı anlamsız kalır.
  const nationalId = typeof body.nationalId === "string" ? body.nationalId.trim() : "";
  if (!/^\d{11}$/.test(nationalId)) {
    return NextResponse.json({ message: "Öğrencinin T.C. Kimlik No'su zorunludur (11 hane)" }, { status: 400 });
  }
  const guardianNationalId = typeof body.guardianNationalId === "string" ? body.guardianNationalId.trim() : "";
  if (!/^\d{11}$/.test(guardianNationalId)) {
    return NextResponse.json({ message: "Velinin T.C. Kimlik No'su zorunludur (11 hane)" }, { status: 400 });
  }
  const birthDate = typeof body.birthDate === "string" && body.birthDate.trim() && !isNaN(Date.parse(body.birthDate)) ? new Date(body.birthDate) : null;
  const gender = typeof body.gender === "string" && GENDER_OPTIONS.includes(body.gender) ? body.gender : null;
  const busRouteId = typeof body.busRouteId === "string" && body.busRouteId ? body.busRouteId : null;
  const phone = typeof body.phone === "string" && body.phone.trim() ? body.phone.trim() : null;
  if (phone && !/^\d{10,11}$/.test(phone.replace(/\D/g, ""))) {
    return NextResponse.json({ message: "phone 10-11 haneli olmalıdır" }, { status: 400 });
  }
  const photoDataUrl = typeof body.photoDataUrl === "string" && body.photoDataUrl.trim() ? body.photoDataUrl.trim() : null;
  if (photoDataUrl) {
    if (!photoDataUrl.startsWith("data:image/")) {
      return NextResponse.json({ message: "photoDataUrl geçerli bir görsel data URI olmalıdır" }, { status: 400 });
    }
    if (photoDataUrl.length > MAX_PHOTO_DATA_URL_LENGTH) {
      return NextResponse.json({ message: "Fotoğraf dosyası çok büyük (limit ~2,5MB)" }, { status: 400 });
    }
  }
  const targetClassroomId = typeof body.targetClassroomId === "string" && body.targetClassroomId ? body.targetClassroomId : null;
  const contractAccepted = body.contractAccepted === true;
  const paymentMethodType =
    typeof body.paymentMethodType === "string" && (PAYMENT_METHOD_OPTIONS as readonly string[]).includes(body.paymentMethodType)
      ? (body.paymentMethodType as (typeof PAYMENT_METHOD_OPTIONS)[number])
      : null;

  const outcome = await withBranchTenantContext(actor, async (tx) => {
    const enrollment = await tx.enrollment.findUnique({ where: { id: params.enrollmentId } });
    if (!enrollment || enrollment.tenantId !== effectiveTenantId(actor)) {
      return { kind: "not_found" as const };
    }
    if (enrollment.stage === "KAYIT_TAMAMLANDI" || enrollment.stage === "IPTAL_EDILDI") {
      return { kind: "already_final" as const, stage: enrollment.stage };
    }

    if (await tx.studentProfile.findUnique({ where: { nationalId } })) {
      return { kind: "national_id_taken" as const };
    }
    if (phone && (await tx.user.findUnique({ where: { tenantId_phone: { tenantId: effectiveTenantId(actor), phone } } }))) {
      return { kind: "phone_taken" as const };
    }
    if (busRouteId) {
      const route = await tx.busRoute.findUnique({ where: { id: busRouteId } });
      if (!route || route.tenantId !== effectiveTenantId(actor)) {
        return { kind: "bad_bus_route" as const };
      }
    }
    let resolvedClassroomId = enrollment.targetClassroomId;
    if (targetClassroomId) {
      const classroom = await tx.classroom.findUnique({ where: { id: targetClassroomId } });
      if (!classroom || classroom.tenantId !== effectiveTenantId(actor)) {
        return { kind: "bad_classroom" as const };
      }
      if (classroom.gradeLevel !== enrollment.candidateGradeLevel) {
        return { kind: "classroom_grade_mismatch" as const };
      }
      resolvedClassroomId = targetClassroomId;
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
      data: { tenantId: effectiveTenantId(actor), email, passwordHash, role: "STUDENT", firstName, lastName, phone },
    });
    const student = await tx.studentProfile.create({
      data: {
        tenantId: effectiveTenantId(actor),
        userId: user.id,
        gradeLevel: enrollment.candidateGradeLevel,
        classroomId: resolvedClassroomId,
        studentNo,
        nationalId,
        birthDate,
        gender,
        busRouteId,
        photoDataUrl,
      },
    });

    // Veli için self-servis portal hesabı (task #90) — demo'daki "otomatik veli
    // kullanıcı adı/şifre" akışının gerçek karşılığı. Eşleştirme artık
    // guardianNationalId (ParentProfile.nationalId, global @unique) ile
    // yapılır — TELEFON DEĞİL: bir veli tek bir gerçek kişidir, TC Kimlik No
    // bunun tek belirsizliksiz anahtarı. Aynı guardianNationalId ile (kardeş
    // kaydı gibi) daha önce bir veli hesabı oluşturulmuşsa YENİ hesap
    // AÇILMAZ — mevcut ParentProfile'a yalnızca yeni bir StudentGuardian
    // bağlantısı eklenir (bu yüzden veli tek girişle tüm çocuklarını görür).
    const guardianPhoneDigits = enrollment.guardianPhone.replace(/\D/g, "");
    const guardianPhoneNormalized = /^\d{10,11}$/.test(guardianPhoneDigits) ? guardianPhoneDigits : null;

    let parentUserId: string | null = null;
    let parentCredentials: { username: string; password: string } | null = null;
    let parentLinkedExisting = false;
    const existingParent = await tx.parentProfile.findUnique({
      where: { nationalId: guardianNationalId },
      select: { userId: true },
    });
    if (existingParent) {
      parentUserId = existingParent.userId;
      parentLinkedExisting = true;
    } else {
      let parentEmail = generateParentEmail(enrollment.guardianFullName, tenant.code);
      for (let attempt = 2; await tx.user.findUnique({ where: { email: parentEmail } }); attempt++) {
        const [local, domain] = parentEmail.split("@");
        parentEmail = `${local.replace(/\d+$/, "")}${attempt}@${domain}`;
        if (attempt > 20) throw new Error("Veli için benzersiz e-posta üretilemedi");
      }
      // Numara tenant içinde BAŞKA bir kullanıcıya (örn. öğrencinin kendi
      // phone'una) aitse çakışmayı (@@unique([tenantId, phone])) önlemek için
      // boş bırakılır — giriş zaten guardianNationalId ile yapıldığından bu
      // yalnızca iletişim amaçlı bir alandır, eşleştirme anahtarı DEĞİLDİR.
      const phoneOwner = guardianPhoneNormalized
        ? await tx.user.findUnique({
            where: { tenantId_phone: { tenantId: effectiveTenantId(actor), phone: guardianPhoneNormalized } },
            select: { id: true },
          })
        : null;
      const parentTempPassword = generateTempPassword();
      const parentPasswordHash = await hashPassword(parentTempPassword);
      const [parentFirstName, ...parentRest] = enrollment.guardianFullName.trim().split(/\s+/);
      const parentLastName = parentRest.join(" ") || parentFirstName;
      const parentUser = await tx.user.create({
        data: {
          tenantId: effectiveTenantId(actor),
          email: parentEmail,
          passwordHash: parentPasswordHash,
          role: "PARENT",
          firstName: parentFirstName,
          lastName: parentLastName,
          phone: phoneOwner ? null : guardianPhoneNormalized,
        },
      });
      parentUserId = parentUser.id;
      parentCredentials = { username: guardianNationalId, password: parentTempPassword };
    }
    const parentProfile = await tx.parentProfile.upsert({
      where: { userId: parentUserId },
      create: { userId: parentUserId, nationalId: guardianNationalId },
      update: {},
    });
    await tx.studentGuardian.create({
      data: { studentId: student.id, parentId: parentProfile.id, relation: "Veli", isBillingResponsible: true },
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
      data: {
        stage: "KAYIT_TAMAMLANDI",
        studentId: student.id,
        contractSignedAt: contractAccepted ? new Date() : null,
        ...(targetClassroomId ? { targetClassroomId } : {}),
      },
    });

    // Ödeme yöntemi: SENET seçilirse demo'daki generateSenetsForStudent() ile
    // birebir aynı şekilde HER taksit için bir PromissoryNote üretilir; diğer
    // üç yöntemde (KREDI_KARTI/BANKA_HAVALESI/NAKIT) öğrencinin varsayılan
    // kayıtlı ödeme yöntemi olarak tek bir PaymentMethod satırı oluşturulur.
    const promissoryNotes = [];
    let paymentMethod = null;
    if (paymentMethodType === "SENET") {
      const year = new Date().getFullYear();
      let seq = await tx.promissoryNote.count({ where: { tenantId: effectiveTenantId(actor) } });
      for (const installment of installments) {
        seq += 1;
        let no = formatDocumentNo("SNT", year, seq);
        for (let attempt = 1; attempt < 20; attempt++) {
          const existing = await tx.promissoryNote.findUnique({ where: { tenantId_no: { tenantId: effectiveTenantId(actor), no } } });
          if (!existing) break;
          seq += 1;
          no = formatDocumentNo("SNT", year, seq);
        }
        promissoryNotes.push(
          await tx.promissoryNote.create({
            data: {
              tenantId: effectiveTenantId(actor),
              no,
              issueDate: new Date(),
              dueDate: installment.dueDate,
              debtorName: enrollment.guardianFullName,
              amount: installment.amount,
              note: `${enrollment.candidateFullName} — Taksit #${installment.installmentNo} karşılığı`,
              studentId: student.id,
              createdByUserId: actor.id,
            },
          }),
        );
      }
    } else if (paymentMethodType) {
      paymentMethod = await tx.paymentMethod.create({
        data: { tenantId: effectiveTenantId(actor), studentId: student.id, type: paymentMethodType as PaymentMethodType, isDefault: true },
      });
    }

    await logActivity(tx, {
      tenantId: effectiveTenantId(actor),
      actorUserId: actor.id,
      actorLabel: actorLabel(actor),
      action: "Kayıt tamamlandı",
      detail: `${enrollment.candidateFullName} — Öğrenci No: ${studentNo}`,
    });

    return {
      kind: "completed" as const,
      enrollment: updatedEnrollment,
      student,
      installments,
      email,
      tempPassword,
      promissoryNotes,
      paymentMethod,
      parentCredentials,
      parentLinkedExisting,
    };
  });

  if (outcome.kind === "not_found") {
    return NextResponse.json({ message: "Kayıt adayı bulunamadı" }, { status: 404 });
  }
  if (outcome.kind === "already_final") {
    return NextResponse.json({ message: `Bu kayıt zaten "${outcome.stage}" durumunda` }, { status: 409 });
  }
  if (outcome.kind === "national_id_taken") {
    return NextResponse.json({ message: "Bu T.C. Kimlik Numarası zaten kayıtlı" }, { status: 409 });
  }
  if (outcome.kind === "phone_taken") {
    return NextResponse.json({ message: "Bu telefon numarası zaten kayıtlı" }, { status: 409 });
  }
  if (outcome.kind === "bad_bus_route") {
    return NextResponse.json({ message: "Geçersiz servis güzergahı" }, { status: 400 });
  }
  if (outcome.kind === "bad_classroom") {
    return NextResponse.json({ message: "targetClassroomId bu şubede bulunamadı" }, { status: 400 });
  }
  if (outcome.kind === "classroom_grade_mismatch") {
    return NextResponse.json({ message: "Seçilen sınıfın seviyesi adayın seviyesiyle uyuşmuyor" }, { status: 400 });
  }

  return NextResponse.json(
    {
      enrollment: outcome.enrollment,
      student: outcome.student,
      installments: outcome.installments,
      promissoryNotes: outcome.promissoryNotes,
      paymentMethod: outcome.paymentMethod,
      // username artık öğrencinin TC Kimlik No'sudur — giriş bununla yapılır
      // (bkz. app/api/auth/login); outcome.email yalnızca dahili/teknik bir
      // alandır, kullanıcıya hiç gösterilmez.
      credentials: { username: nationalId, password: outcome.tempPassword },
      // Veli hesabı YENİ oluşturulduysa giriş bilgileri döner; kardeş kaydı
      // gibi mevcut bir veli hesabına bağlanıldıysa null (yeni şifre YOKTUR —
      // veli zaten mevcut hesabıyla giriş yapabilir).
      parentCredentials: outcome.parentCredentials,
      parentLinkedExisting: outcome.parentLinkedExisting,
    },
    { status: 201 },
  );
}
