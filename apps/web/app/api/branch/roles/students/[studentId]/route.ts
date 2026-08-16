import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { getSessionActor } from "@/lib/session";
import { effectiveTenantId, withBranchTenantContext } from "@/lib/db-context";
import { actorLabel, logActivity } from "@/lib/audit-log";

/**
 * Öğrencinin giriş "kullanıcı adı"nı değiştirir. Demo'da ayrı bir username
 * alanı vardı; bu depoda giriş User.email ile yapılır (bkz. her test
 * script'indeki loginAs(email, password)) — bu yüzden "kullanıcı adı
 * düzenleme" burada User.email'i günceller. E-posta global @unique (phone'un
 * aksine tenant-scope EDİLMEDİ — bkz. prisma/schema.prisma User.phone
 * yorumu: e-posta zaten kullanıcının kendi seçtiği/gördüğü bir tanımlayıcı,
 * cross-tenant sızıntı riski taşımıyor).
 */
const ROLES_ALLOWED: UserRole[] = [UserRole.BRANCH_ADMIN];

export async function PATCH(request: NextRequest, { params }: { params: { studentId: string } }) {
  const actor = await getSessionActor(request);
  if (!actor) {
    return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  }
  if (!ROLES_ALLOWED.includes(actor.role) && !(actor.role === UserRole.SUPERADMIN && actor.actingTenantId)) {
    return NextResponse.json({ message: "Bu rol öğrenci kullanıcı adını değiştiremez" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const username = typeof body.username === "string" ? body.username.trim() : "";
  if (!username || !username.includes("@")) {
    return NextResponse.json({ message: "Geçerli bir kullanıcı adı (e-posta) zorunludur" }, { status: 400 });
  }

  let outcome;
  try {
    outcome = await withBranchTenantContext(actor, async (tx) => {
      const student = await tx.studentProfile.findUnique({ where: { id: params.studentId }, include: { user: true } });
      if (!student) return { kind: "not_found" as const };

      const updatedUser = await tx.user.update({ where: { id: student.userId }, data: { email: username } });
      await logActivity(tx, {
        tenantId: effectiveTenantId(actor),
        actorUserId: actor.id,
        actorLabel: actorLabel(actor),
        action: "Öğrenci kullanıcı adı değiştirildi",
        detail: `${student.user.firstName} ${student.user.lastName} → ${username}`,
      });
      return { kind: "updated" as const, username: updatedUser.email };
    });
  } catch (e) {
    if (e && typeof e === "object" && "code" in e && e.code === "P2002") {
      return NextResponse.json({ message: "Bu kullanıcı adı zaten kayıtlı" }, { status: 409 });
    }
    throw e;
  }

  if (outcome.kind === "not_found") {
    return NextResponse.json({ message: "Öğrenci bulunamadı" }, { status: 404 });
  }
  return NextResponse.json({ username: outcome.username });
}
