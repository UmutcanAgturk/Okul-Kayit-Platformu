import { NextRequest, NextResponse } from "next/server";
import { Prisma, TenantType, UserRole } from "@prisma/client";
import { getSessionActor } from "@/lib/session";
import { withTenantContext } from "@/lib/db-context";
import { actorLabel, logActivity } from "@/lib/audit-log";

/**
 * Kurum Düzenle — demo/seviye360-app.html'deki "kurumEditingId" formunun
 * gerçek karşılığı. Şube müdürünün adı/soyadı/telefonu Tenant'ta DEĞİL,
 * kendi BRANCH_ADMIN User kaydında tutulur (bkz. schema.prisma'daki Tenant
 * yorumu) — bu yüzden managerFirstName/managerLastName/managerPhone
 * gönderilirse ilgili User satırı güncellenir, Tenant'a yeni bir alan
 * EKLENMEZ. "Şube Müdürü Kullanıcı Adı/Şifresi" demodaki gibi düz metin
 * düzenlenebilir DEĞİLDİR — bu uygulamada şifreler hash'li tutulur; onun
 * yerine reset-credentials route'u (bkz. ./reset-credentials/route.ts) yeni
 * bir geçici şifre üretir.
 */
export async function PATCH(request: NextRequest, { params }: { params: { tenantId: string } }) {
  const actor = await getSessionActor(request);
  if (!actor) {
    return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  }
  if (actor.role !== UserRole.SUPERADMIN) {
    return NextResponse.json({ message: "Yalnızca Genel Merkez kurum düzenleyebilir" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);
  const strOrNull = (v: unknown) => (typeof v === "string" ? (v.trim() ? v.trim() : null) : undefined);

  const name = str(body.name);
  const city = str(body.city);
  const district = str(body.district);
  const address = strOrNull(body.address);
  const phone = strOrNull(body.phone);
  const email = strOrNull(body.email);
  const taxNo = strOrNull(body.taxNo);
  const kurumTuru = strOrNull(body.kurumTuru);
  const capacity = typeof body.capacity === "number" && body.capacity > 0 ? Math.round(body.capacity) : body.capacity === null ? null : undefined;
  const openingDate = body.openingDate === null ? null : typeof body.openingDate === "string" && body.openingDate.trim() ? new Date(body.openingDate) : undefined;
  const managerFirstName = str(body.managerFirstName);
  const managerLastName = str(body.managerLastName);
  const managerPhone = strOrNull(body.managerPhone);

  const outcome = await withTenantContext(actor, async (tx) => {
    const tenant = await tx.tenant.findUnique({ where: { id: params.tenantId } });
    if (!tenant) return null;

    const updated = await tx.tenant.update({
      where: { id: tenant.id },
      data: { name, city, district, address, phone, email, taxNo, kurumTuru, capacity, openingDate },
    });

    let branchAdmin: { firstName: string; lastName: string; phone: string | null } | null = null;
    if (managerFirstName !== undefined || managerLastName !== undefined || managerPhone !== undefined) {
      const admin = await tx.user.findFirst({ where: { tenantId: tenant.id, role: UserRole.BRANCH_ADMIN } });
      if (admin) {
        const savedAdmin = await tx.user.update({
          where: { id: admin.id },
          data: {
            firstName: managerFirstName ?? admin.firstName,
            lastName: managerLastName ?? admin.lastName,
            phone: managerPhone !== undefined ? managerPhone : admin.phone,
          },
        });
        branchAdmin = { firstName: savedAdmin.firstName, lastName: savedAdmin.lastName, phone: savedAdmin.phone };
      }
    }

    await logActivity(tx, {
      tenantId: tenant.id,
      actorUserId: actor.id,
      actorLabel: actorLabel(actor),
      action: "Kurum bilgileri güncellendi",
      detail: updated.name,
    });

    return { tenant: updated, branchAdmin };
  });

  if (!outcome) {
    return NextResponse.json({ message: "Kurum bulunamadı" }, { status: 404 });
  }
  return NextResponse.json({
    tenant: outcome.tenant,
    branchAdminName: outcome.branchAdmin ? `${outcome.branchAdmin.firstName} ${outcome.branchAdmin.lastName}` : undefined,
    branchAdminPhone: outcome.branchAdmin ? outcome.branchAdmin.phone : undefined,
  });
}

/**
 * Kurum Sil — demo'daki hard-delete'in aksine, gerçek bir kurumun
 * onlarca gerçek FK'lı kaydı (User/StudentProfile/Classroom/StaffProfile...)
 * olabileceğinden, StaffProfile kalıcı silme route'undaki (bkz.
 * app/api/branch/staff/[staffId]/route.ts) "önce bağımlı kayıtları say,
 * varsa 409 döndür" deseni tekrarlanır: yalnızca HİÇBİR kullanıcısı/
 * öğrencisi/sınıfı/personeli olmayan (örn. yanlışlıkla oluşturulmuş, hiç
 * kullanılmamış) bir kurum kalıcı olarak silinebilir — aksi halde "Devre
 * Dışı Bırak" (toggle-active) kullanılmalıdır.
 */
export async function DELETE(request: NextRequest, { params }: { params: { tenantId: string } }) {
  const actor = await getSessionActor(request);
  if (!actor) {
    return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  }
  if (actor.role !== UserRole.SUPERADMIN) {
    return NextResponse.json({ message: "Yalnızca Genel Merkez kurum silebilir" }, { status: 403 });
  }

  try {
    const outcome = await withTenantContext(actor, async (tx) => {
      const tenant = await tx.tenant.findUnique({ where: { id: params.tenantId } });
      if (!tenant) return { kind: "not_found" as const };
      if (tenant.type === "GENEL_MERKEZ") return { kind: "genel_merkez" as const };

      // BRANCH_ADMIN kullanıcısı sayılmaz — her kurum "Kurumu Ekle" formunda
      // OTOMATİK bir BRANCH_ADMIN hesabıyla birlikte oluşturulur (bkz. POST),
      // bu yüzden onu da "bağımlı kayıt" saymak hiçbir kurumun asla kalıcı
      // silinememesine yol açardı. Kurum silinirken bu hesap da (tenant'sız
      // kalacağından) birlikte kaldırılır — aşağıya bkz.
      const [studentCount, classroomCount, staffCount, otherUserCount] = await Promise.all([
        tx.studentProfile.count({ where: { tenantId: tenant.id } }),
        tx.classroom.count({ where: { tenantId: tenant.id } }),
        tx.staffProfile.count({ where: { tenantId: tenant.id } }),
        tx.user.count({ where: { tenantId: tenant.id, role: { not: UserRole.BRANCH_ADMIN } } }),
      ]);
      if (studentCount > 0 || classroomCount > 0 || staffCount > 0 || otherUserCount > 0) {
        return { kind: "has_dependents" as const };
      }

      const admins = await tx.user.findMany({ where: { tenantId: tenant.id }, select: { id: true } });
      const adminIds = admins.map((u) => u.id);
      if (adminIds.length > 0) {
        await tx.userSession.deleteMany({ where: { userId: { in: adminIds } } });
        await tx.user.deleteMany({ where: { id: { in: adminIds } } });
      }
      // AuditLogEntry'nin Tenant FK'si RESTRICT'tir ve her kurumun en az bir
      // "Yeni kurum eklendi" günlüğü vardır — bu yüzden kendi günlükleri de
      // tenant'la birlikte kaldırılır (bir kurum silindikten sonra o kuruma
      // ait aktivite geçmişinin ayrıca saklanmasının bir değeri yoktur).
      await tx.auditLogEntry.deleteMany({ where: { tenantId: tenant.id } });

      await tx.tenant.delete({ where: { id: tenant.id } });

      const genelMerkez = await tx.tenant.findFirst({ where: { type: TenantType.GENEL_MERKEZ } });
      if (genelMerkez) {
        await logActivity(tx, {
          tenantId: genelMerkez.id,
          actorUserId: actor.id,
          actorLabel: actorLabel(actor),
          action: "Kurum kalıcı olarak silindi",
          detail: tenant.name,
        });
      }

      return { kind: "ok" as const };
    });

    if (outcome.kind === "not_found") {
      return NextResponse.json({ message: "Kurum bulunamadı" }, { status: 404 });
    }
    if (outcome.kind === "genel_merkez") {
      return NextResponse.json({ message: "Genel Merkez silinemez" }, { status: 400 });
    }
    if (outcome.kind === "has_dependents") {
      return NextResponse.json(
        { message: "Bu kurumda kayıtlı kullanıcı/öğrenci/personel/sınıf bulunduğu için kalıcı olarak silinemez. Önce Devre Dışı Bırak." },
        { status: 409 },
      );
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    // Yukarıdaki sayım kontrolleri yalnızca en yaygın 4 ilişkiyi kapsar —
    // AuditLogEntry, Invoice, CrmLead gibi Tenant'a bağlı onlarca başka
    // tablo da olabilir (bkz. schema.prisma'daki Tenant model relation
    // listesi). Bunların hepsini tek tek saymak yerine, gerçek P2003
    // (foreign key constraint) hatasını burada yakalayıp aynı 409'a çeviriyoruz.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      return NextResponse.json(
        { message: "Bu kurumda kayıtlı geçmiş kayıtlar (işlem/log) bulunduğu için kalıcı olarak silinemez. Önce Devre Dışı Bırak." },
        { status: 409 },
      );
    }
    throw error;
  }
}
