import { NextRequest, NextResponse } from "next/server";
import { TenantType, UserRole } from "@prisma/client";
import { ACTING_TENANT_COOKIE, getSessionActor } from "@/lib/session";
import { withTenantContext } from "@/lib/db-context";

/**
 * SUPERADMIN'in Kurumlar sayfasından "Bu Şube Olarak Yönet" ile bir şube
 * seçmesi/çıkması — bkz. lib/db-context.ts withBranchTenantContext ve
 * lib/session.ts ACTING_TENANT_COOKIE. Bu, demo'daki HQ portalının
 * "branch:" ekranlarına (CRM, Ön Kayıt, Muhasebe, Personel, vb.) düşen
 * fallback davranışının gerçek karşılığıdır — apps/web'de SUPERADMIN'in
 * `tenantId`'si olmadığından bu ekranlar hangi şubeyi hedefleyeceğini
 * bilemez; bu endpoint SUPERADMIN'e o bağlamı EXPLICIT olarak seçtirir.
 */
export async function POST(request: NextRequest) {
  const actor = await getSessionActor(request);
  if (!actor) {
    return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  }
  if (actor.role !== UserRole.SUPERADMIN) {
    return NextResponse.json({ message: "Yalnızca Genel Merkez bir şube olarak yönetebilir" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const tenantId = typeof body.tenantId === "string" && body.tenantId ? body.tenantId : null;
  if (!tenantId) {
    return NextResponse.json({ message: "tenantId zorunludur" }, { status: 400 });
  }

  const tenant = await withTenantContext(actor, (tx) => tx.tenant.findUnique({ where: { id: tenantId } }));
  if (!tenant || tenant.type !== TenantType.SUBE) {
    return NextResponse.json({ message: "Geçersiz şube" }, { status: 400 });
  }
  if (!tenant.isActive) {
    return NextResponse.json({ message: "Pasif bir şube yönetim bağlamı olarak seçilemez" }, { status: 400 });
  }

  const response = NextResponse.json({ tenantId: tenant.id, tenantName: tenant.name });
  response.cookies.set(ACTING_TENANT_COOKIE, tenant.id, {
    httpOnly: false,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 12, // 12 saat — oturumun kendisinden bağımsız, makul bir üst sınır
  });
  return response;
}

export async function DELETE(request: NextRequest) {
  const actor = await getSessionActor(request);
  if (!actor) {
    return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  }
  const response = NextResponse.json({ ok: true });
  response.cookies.delete(ACTING_TENANT_COOKIE);
  return response;
}
