import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { getSessionActor } from "@/lib/session";
import { effectiveTenantId, withBranchTenantContext } from "@/lib/db-context";
import { ensureSupplierCari } from "@/lib/accounting/posting";

/** Tedarikçiler (cari için). GET liste / POST ekle. RLS: tenant + rol. */
const ROLES_ALLOWED: UserRole[] = [UserRole.BRANCH_ADMIN, UserRole.ACCOUNTING];

function guard(actor: { role: UserRole; actingTenantId?: string | null } | null) {
  if (!actor) return { ok: false as const, status: 401, message: "Oturum açmanız gerekiyor" };
  if (!ROLES_ALLOWED.includes(actor.role) && !(actor.role === UserRole.SUPERADMIN && actor.actingTenantId)) {
    return { ok: false as const, status: 403, message: "Bu rol Muhasebe'ye erişemez" };
  }
  return { ok: true as const };
}

export async function GET(request: NextRequest) {
  const actor = await getSessionActor(request);
  const g = guard(actor);
  if (!g.ok) return NextResponse.json({ message: g.message }, { status: g.status });

  const suppliers = await withBranchTenantContext(actor!, (tx) =>
    tx.supplier.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
  );
  return NextResponse.json({
    suppliers: suppliers.map((s) => ({ id: s.id, name: s.name, taxNo: s.taxNo, phone: s.phone, email: s.email, note: s.note })),
  });
}

export async function POST(request: NextRequest) {
  const actor = await getSessionActor(request);
  const g = guard(actor);
  if (!g.ok) return NextResponse.json({ message: g.message }, { status: g.status });

  const body = await request.json().catch(() => ({}));
  const name = typeof body.name === "string" && body.name.trim() ? body.name.trim() : null;
  if (!name) return NextResponse.json({ message: "name zorunludur" }, { status: 400 });

  const created = await withBranchTenantContext(actor!, async (tx) => {
    const supplier = await tx.supplier.create({
      data: {
        tenantId: effectiveTenantId(actor!),
        name,
        taxNo: typeof body.taxNo === "string" && body.taxNo.trim() ? body.taxNo.trim() : null,
        phone: typeof body.phone === "string" && body.phone.trim() ? body.phone.trim() : null,
        email: typeof body.email === "string" && body.email.trim() ? body.email.trim() : null,
        note: typeof body.note === "string" && body.note.trim() ? body.note.trim() : null,
      },
    });
    // 320.x cari hesabını hemen aç — Yevmiye'de veresiye gider için seçilebilsin.
    await ensureSupplierCari(tx, effectiveTenantId(actor!), supplier.id, supplier.name);
    return supplier;
  });
  return NextResponse.json({ id: created.id }, { status: 201 });
}
