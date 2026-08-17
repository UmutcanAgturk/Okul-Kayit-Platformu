import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { getSessionActor } from "@/lib/session";
import { withTenantContext } from "@/lib/db-context";

/**
 * Roller — Tüm Şubeler (task #100) — demo denetimindeki bulgu: Roller ekranı
 * yalnızca BRANCH_ADMIN'e (veya "Bu Şube Olarak Yönet" ile tek bir şubeye
 * geçmiş SUPERADMIN'e) açıktı, Genel Merkez'in şubeler arası çapraz bir
 * görünümü yoktu. `app/api/hq/students`teki AYNI desen: `withTenantContext`
 * SUPERADMIN için RLS bypass'ına geçtiğinden tüm tenant'lar tek sorguda
 * görülebilir. Salt-okunur — rol/kullanıcı adı değişikliği hâlâ yalnızca
 * "Bu Şube Olarak Yönet" ile tek bir şubeye geçilerek (mevcut branch-scoped
 * /api/branch/staff PATCH) yapılabilir; burada YENİ bir çapraz-tenant PATCH
 * eklenmedi — kasıtlı: yanlış şubede rol değiştirme riskini azaltır.
 */
export async function GET(request: NextRequest) {
  const actor = await getSessionActor(request);
  if (!actor) {
    return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  }
  if (actor.role !== UserRole.SUPERADMIN) {
    return NextResponse.json({ message: "Yalnızca Genel Merkez tüm şubelerdeki personeli görüntüleyebilir" }, { status: 403 });
  }

  // Not: `isActive` burada FİLTRELENMEZ — /api/branch/staff'la AYNI desen
  // (Pasif personel de dahil döner, frontend HqPersonelTab kendi filtreler),
  // Roller'ın branch-scoped Personel sekmesiyle tutarlı davranış için.
  const staff = await withTenantContext(actor, (tx) =>
    tx.staffProfile.findMany({
      include: { user: true, tenant: true },
      orderBy: [{ tenant: { name: "asc" } }, { user: { firstName: "asc" } }],
    }),
  );

  return NextResponse.json({
    staff: staff.map((s) => ({
      id: s.id,
      name: `${s.user.firstName} ${s.user.lastName}`,
      email: s.user.email,
      role: s.user.role,
      title: s.title,
      isActive: s.user.isActive,
      tenantId: s.tenantId,
      tenantName: s.tenant.name,
    })),
  });
}
