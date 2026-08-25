import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { getSessionActor } from "@/lib/session";
import { withBranchTenantContext } from "@/lib/db-context";

/**
 * Cari hesaplar — öğrenci (120.x) ve tedarikçi (320.x) alt hesaplarının
 * bakiyeleri. Bakiye JournalLine'lardan türer: öğrenci carisi (borç normal)
 * pozitif = tahsil edilecek; tedarikçi carisi (alacak normal) pozitif =
 * ödenecek. RLS: tenant + rol.
 */
const ROLES_ALLOWED: UserRole[] = [UserRole.BRANCH_ADMIN, UserRole.ACCOUNTING];

function round2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export async function GET(request: NextRequest) {
  const actor = await getSessionActor(request);
  if (!actor) return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  if (!ROLES_ALLOWED.includes(actor.role) && !(actor.role === UserRole.SUPERADMIN && actor.actingTenantId)) {
    return NextResponse.json({ message: "Bu rol Muhasebe'ye erişemez" }, { status: 403 });
  }

  const data = await withBranchTenantContext(actor, async (tx) => {
    const cariAccounts = await tx.accountingAccount.findMany({
      where: { OR: [{ code: { startsWith: "120." } }, { code: { startsWith: "320." } }] },
      orderBy: { code: "asc" },
    });
    if (cariAccounts.length === 0) return { students: [], suppliers: [] };

    const ids = cariAccounts.map((a) => a.id);
    const lines = await tx.journalLine.findMany({ where: { accountId: { in: ids } }, select: { accountId: true, debit: true, credit: true } });
    const bal = new Map<string, number>();
    for (const l of lines) {
      bal.set(l.accountId, (bal.get(l.accountId) ?? 0) + Number(l.debit) - Number(l.credit));
    }

    const students = cariAccounts
      .filter((a) => a.code.startsWith("120."))
      .map((a) => ({ accountId: a.id, code: a.code, name: a.name, studentId: a.studentId, balance: round2(bal.get(a.id) ?? 0) }));
    const suppliers = cariAccounts
      .filter((a) => a.code.startsWith("320."))
      .map((a) => ({ accountId: a.id, code: a.code, name: a.name, supplierId: a.supplierId, balance: round2(-(bal.get(a.id) ?? 0)) })); // alacak normal → ters işaret
    return { students, suppliers };
  });

  return NextResponse.json(data);
}
