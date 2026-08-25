import { NextRequest, NextResponse } from "next/server";
import { AccountType, NormalBalance, UserRole } from "@prisma/client";
import { getSessionActor } from "@/lib/session";
import { effectiveTenantId, withBranchTenantContext } from "@/lib/db-context";
import { seedChartForTenant } from "@/lib/accounting/posting";

/**
 * Hesap Planı (Tekdüzen). GET: şubenin hesap planını döner — boşsa standart
 * planı tohumlar. POST: özel (ek) hesap ekler. RLS: tenant + rol
 * (SUPERADMIN/BRANCH_ADMIN/ACCOUNTING).
 */
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

  const accounts = await withBranchTenantContext(actor!, async (tx) => {
    let rows = await tx.accountingAccount.findMany({ orderBy: { code: "asc" } });
    if (rows.length === 0) {
      await seedChartForTenant(tx, effectiveTenantId(actor!));
      rows = await tx.accountingAccount.findMany({ orderBy: { code: "asc" } });
    }
    return rows;
  });

  return NextResponse.json({
    accounts: accounts.map((a) => ({
      id: a.id,
      code: a.code,
      name: a.name,
      type: a.type,
      normalBalance: a.normalBalance,
      parentCode: a.parentCode,
      isActive: a.isActive,
      studentId: a.studentId,
      supplierId: a.supplierId,
    })),
  });
}

export async function POST(request: NextRequest) {
  const actor = await getSessionActor(request);
  const g = guard(actor);
  if (!g.ok) return NextResponse.json({ message: g.message }, { status: g.status });

  const body = await request.json().catch(() => ({}));
  const code = typeof body.code === "string" && body.code.trim() ? body.code.trim() : null;
  const name = typeof body.name === "string" && body.name.trim() ? body.name.trim() : null;
  const type = typeof body.type === "string" && (Object.values(AccountType) as string[]).includes(body.type) ? (body.type as AccountType) : null;
  const normalBalance = typeof body.normalBalance === "string" && (Object.values(NormalBalance) as string[]).includes(body.normalBalance) ? (body.normalBalance as NormalBalance) : null;
  const parentCode = typeof body.parentCode === "string" && body.parentCode.trim() ? body.parentCode.trim() : null;
  if (!code || !name || !type || !normalBalance) {
    return NextResponse.json({ message: "code, name, type ve normalBalance zorunludur" }, { status: 400 });
  }

  const outcome = await withBranchTenantContext(actor!, async (tx) => {
    const exists = await tx.accountingAccount.findFirst({ where: { code } });
    if (exists) return { kind: "duplicate" as const };
    const created = await tx.accountingAccount.create({
      data: { tenantId: effectiveTenantId(actor!), code, name, type, normalBalance, parentCode },
    });
    return { kind: "ok" as const, id: created.id };
  });

  if (outcome.kind === "duplicate") {
    return NextResponse.json({ message: "Bu hesap kodu zaten var" }, { status: 409 });
  }
  return NextResponse.json({ id: outcome.id }, { status: 201 });
}
