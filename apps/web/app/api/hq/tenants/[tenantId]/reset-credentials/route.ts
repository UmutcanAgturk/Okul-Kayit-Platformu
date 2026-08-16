import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { getSessionActor } from "@/lib/session";
import { withTenantContext } from "@/lib/db-context";
import { hashPassword } from "@/lib/auth";
import { generateTempPassword } from "@/lib/enrollment";
import { actorLabel, logActivity } from "@/lib/audit-log";

/**
 * "Kimlik bilgisi sıfırlama" — demo'daki düz metin kullanıcı adı/şifre
 * düzenleme kutucuklarının gerçek karşılığı DEĞİLDİR: bu uygulamada
 * şifreler hash'li tutulur (bkz. app/api/hq/tenants POST'taki oluşturma
 * akışı), bu yüzden "düzenleme" yerine CreateTenantForm'daki ile aynı
 * tek-seferlik-görüntüleme deseniyle yeni bir geçici şifre üretilir.
 * Kullanıcı adı (User.email) değişikliği zaten PATCH /api/hq/tenants/
 * [tenantId] üzerinden managerFirstName/LastName ile değil, ayrı bir
 * e-posta değişikliği akışı gerektirir — bu route SADECE şifreyi sıfırlar.
 */
export async function POST(request: NextRequest, { params }: { params: { tenantId: string } }) {
  const actor = await getSessionActor(request);
  if (!actor) {
    return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  }
  if (actor.role !== UserRole.SUPERADMIN) {
    return NextResponse.json({ message: "Yalnızca Genel Merkez kimlik bilgisi sıfırlayabilir" }, { status: 403 });
  }

  const outcome = await withTenantContext(actor, async (tx) => {
    const tenant = await tx.tenant.findUnique({ where: { id: params.tenantId } });
    if (!tenant) return { kind: "not_found" as const };

    const admin = await tx.user.findFirst({ where: { tenantId: tenant.id, role: UserRole.BRANCH_ADMIN } });
    if (!admin) return { kind: "no_admin" as const };

    const tempPassword = generateTempPassword();
    const passwordHash = await hashPassword(tempPassword);
    await tx.user.update({ where: { id: admin.id }, data: { passwordHash } });

    await logActivity(tx, {
      tenantId: tenant.id,
      actorUserId: actor.id,
      actorLabel: actorLabel(actor),
      action: "Şube müdürü şifresi sıfırlandı",
      detail: tenant.name,
    });

    return { kind: "ok" as const, username: admin.email, password: tempPassword };
  });

  if (outcome.kind === "not_found") {
    return NextResponse.json({ message: "Kurum bulunamadı" }, { status: 404 });
  }
  if (outcome.kind === "no_admin") {
    return NextResponse.json({ message: "Bu kurumda atanmış bir şube müdürü yok" }, { status: 404 });
  }
  return NextResponse.json({ credentials: { username: outcome.username, password: outcome.password } });
}
