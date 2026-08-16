import { NextRequest, NextResponse } from "next/server";
import { AccountingEntryType, PaymentStatus, TenantType, UserRole } from "@prisma/client";
import { getSessionActor } from "@/lib/session";
import { withTenantContext } from "@/lib/db-context";

/**
 * Şube Performans Haritası — demo/seviye360-app.html'deki SCREENS["hq:map"]'in
 * gerçek karşılığı (il/ilçe SVG çizimi hariç — bkz. apps/web/lib/turkey-provinces.ts,
 * demo'dan birebir taşınan TURKEY_PROVINCES path verisi). Yeni bir Prisma
 * modeli EKLEMEZ. Demo'daki UYDURMA `BRANCHES[i].ciro`/`capacity` sabitlerinin
 * gerçek karşılıkları:
 *  - Doluluk oranı: gerçek StudentProfile sayısı / Tenant.capacity (bkz.
 *    demo'daki branchOccupancy).
 *  - Tahsilat oranı: PaymentInstallment'ta PLANLANAN toplam tutara karşılık
 *    GERÇEKTEN ÖDENMİŞ (status=PAID) tutarın yüzdesi (bkz. demo'daki
 *    branchTahsilatOrani — sabit bir sayı DEĞİL, anlık hesaplanır).
 *  - Ciro: AccountingLedgerEntry'nin GELİR toplamı (hq/analytics'teki aynı
 *    hesap, Global Analytics'in "Şube Bazlı Gelir" tablosuyla tutarlı).
 */
export async function GET(request: NextRequest) {
  const actor = await getSessionActor(request);
  if (!actor) {
    return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  }
  if (actor.role !== UserRole.SUPERADMIN) {
    return NextResponse.json({ message: "Yalnızca Genel Merkez Şube Performans Haritası'nı görüntüleyebilir" }, { status: 403 });
  }

  const branches = await withTenantContext(actor, async (tx) => {
    const tenants = await tx.tenant.findMany({ where: { type: TenantType.SUBE }, orderBy: { name: "asc" } });
    const branchIds = tenants.map((t) => t.id);

    const [studentCounts, installments, ledgerEntries] = await Promise.all([
      tx.studentProfile.groupBy({ by: ["tenantId"], where: { tenantId: { in: branchIds } }, _count: { _all: true } }),
      tx.paymentInstallment.findMany({ where: { tenantId: { in: branchIds } }, select: { tenantId: true, amount: true, status: true } }),
      tx.accountingLedgerEntry.findMany({
        where: { tenantId: { in: branchIds }, type: AccountingEntryType.GELIR },
        select: { tenantId: true, amount: true },
      }),
    ]);

    const studentCountByTenant = new Map(studentCounts.map((s) => [s.tenantId, s._count._all]));
    const revenueByTenant = new Map<string, number>();
    for (const e of ledgerEntries) {
      revenueByTenant.set(e.tenantId, (revenueByTenant.get(e.tenantId) ?? 0) + Number(e.amount));
    }

    return tenants.map((t) => {
      const studentCount = studentCountByTenant.get(t.id) ?? 0;
      const occupancyPct = t.capacity ? Math.min(100, Math.round((studentCount / t.capacity) * 100)) : 0;

      const tenantInstallments = installments.filter((i) => i.tenantId === t.id);
      const totalPlanned = tenantInstallments.reduce((sum, i) => sum + Number(i.amount), 0);
      const totalPaid = tenantInstallments
        .filter((i) => i.status === PaymentStatus.PAID)
        .reduce((sum, i) => sum + Number(i.amount), 0);
      const collectionPct = totalPlanned > 0 ? Math.min(100, Math.round((totalPaid / totalPlanned) * 100)) : 0;

      return {
        id: t.id,
        name: t.name,
        city: t.city,
        district: t.district,
        capacity: t.capacity,
        studentCount,
        occupancyPct,
        collectionPct,
        revenue: revenueByTenant.get(t.id) ?? 0,
      };
    });
  });

  return NextResponse.json({ branches });
}
