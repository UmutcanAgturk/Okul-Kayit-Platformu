import { NextRequest, NextResponse } from "next/server";
import { TenantType, UserRole } from "@prisma/client";
import { getSessionActor } from "@/lib/session";
import { withTenantContext } from "@/lib/db-context";

/**
 * "Kurum Bazlı Tahsilat Oranı" — demo'daki muhasebeSubTab==="tahsilat" >
 * isConsolidated (state.portal==="hq" && muhasebeScopeId==="ALL") panelinin
 * gerçek karşılığı. Formül, şube-özel InstallmentsPanel'in `summary.collectionRate`
 * hesabıyla BİREBİR AYNIDIR (paidAmount / (paidAmount+pendingAmount+overdueAmount)),
 * yalnızca her şube için ayrı ayrı hesaplanır.
 */
export async function GET(request: NextRequest) {
  const actor = await getSessionActor(request);
  if (!actor) {
    return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  }
  if (actor.role !== UserRole.SUPERADMIN) {
    return NextResponse.json({ message: "Yalnızca Genel Merkez kurum bazlı tahsilat oranını görüntüleyebilir" }, { status: 403 });
  }

  const result = await withTenantContext(actor, async (tx) => {
    const branches = await tx.tenant.findMany({ where: { type: TenantType.SUBE }, orderBy: { name: "asc" } });
    const branchIds = branches.map((b) => b.id);

    const installments = await tx.paymentInstallment.findMany({
      where: { tenantId: { in: branchIds } },
      select: { tenantId: true, status: true, amount: true, dueDate: true },
    });

    const now = Date.now();
    const byTenant = new Map<string, { paid: number; pending: number; overdue: number }>();
    for (const i of installments) {
      const bucket = byTenant.get(i.tenantId) ?? { paid: 0, pending: 0, overdue: 0 };
      const amount = Number(i.amount);
      if (i.status === "PAID") {
        bucket.paid += amount;
      } else if (i.status === "PENDING" || i.status === "OVERDUE") {
        if (i.status === "OVERDUE" || i.dueDate.getTime() < now) bucket.overdue += amount;
        else bucket.pending += amount;
      }
      byTenant.set(i.tenantId, bucket);
    }

    return branches
      .map((b) => {
        const bucket = byTenant.get(b.id) ?? { paid: 0, pending: 0, overdue: 0 };
        const collectibleTotal = bucket.paid + bucket.pending + bucket.overdue;
        return {
          tenantId: b.id,
          tenantName: b.name,
          city: b.city,
          collectionRate: collectibleTotal > 0 ? Math.round((bucket.paid / collectibleTotal) * 100) : null,
          paidAmount: bucket.paid,
          pendingAmount: bucket.pending,
          overdueAmount: bucket.overdue,
        };
      })
      .filter((r) => r.collectionRate !== null)
      .sort((a, b) => (a.collectionRate as number) - (b.collectionRate as number));
  });

  return NextResponse.json({ branches: result });
}
