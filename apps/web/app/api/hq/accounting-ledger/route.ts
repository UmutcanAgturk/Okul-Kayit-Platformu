import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { getSessionActor } from "@/lib/session";
import { withTenantContext } from "@/lib/db-context";

/**
 * Genel Merkez'in konsolide muhasebe görünümü — `/api/branch/accounting-ledger`
 * SUPERADMIN'i kasıtlı olarak dışarıda bırakıyordu ("hangi şubenin defteri"
 * sorusu tek-tenant route'u için belirsiz kalırdı, bkz. o route'daki not).
 * Bu route tam tersini yapar: SADECE SUPERADMIN'e açıktır ve `withTenantContext`
 * SUPERADMIN için otomatik olarak `superadmin_role` (BYPASSRLS) bağlantısına
 * geçtiğinden (bkz. lib/db-context.ts), tüm tenant'ların kayıtlarını görebilir.
 *
 * - `?tenantId=` verilmezse: her kurum için gelir/gider/net özeti + genel toplam
 *   (tüm kayıtları tek seferde döndürmek yerine, demo/seviye360-app.html'deki
 *   "kurum bazlı + genel toplu dinamik görünüm" desenini izler).
 * - `?tenantId=` verilirse: o kurumun tek tek kayıtları + kendi özeti (drill-down),
 *   `/api/branch/accounting-ledger`'ın GET yanıtıyla aynı şekilde.
 */
export async function GET(request: NextRequest) {
  const actor = await getSessionActor(request);
  if (!actor) {
    return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  }
  if (actor.role !== UserRole.SUPERADMIN) {
    return NextResponse.json({ message: "Yalnızca Genel Merkez bu konsolide görünümü görüntüleyebilir" }, { status: 403 });
  }

  const tenantId = request.nextUrl.searchParams.get("tenantId");

  if (tenantId) {
    const result = await withTenantContext(actor, async (tx) => {
      const tenant = await tx.tenant.findUnique({ where: { id: tenantId } });
      if (!tenant) return null;
      const entries = await tx.accountingLedgerEntry.findMany({
        where: { tenantId },
        orderBy: { entryDate: "desc" },
      });
      const totalGelir = entries.filter((e) => e.type === "GELIR").reduce((sum, e) => sum + Number(e.amount), 0);
      const totalGider = entries.filter((e) => e.type === "GIDER").reduce((sum, e) => sum + Number(e.amount), 0);
      return {
        tenant: { id: tenant.id, name: tenant.name, code: tenant.code },
        entries,
        summary: { totalGelir, totalGider, net: totalGelir - totalGider },
      };
    });

    if (!result) {
      return NextResponse.json({ message: "Kurum bulunamadı" }, { status: 404 });
    }
    return NextResponse.json(result);
  }

  const perTenant = await withTenantContext(actor, async (tx) => {
    const tenants = await tx.tenant.findMany({ orderBy: { name: "asc" } });
    const entries = await tx.accountingLedgerEntry.findMany({ select: { tenantId: true, type: true, amount: true } });

    return tenants.map((tenant) => {
      const tenantEntries = entries.filter((e) => e.tenantId === tenant.id);
      const totalGelir = tenantEntries.filter((e) => e.type === "GELIR").reduce((sum, e) => sum + Number(e.amount), 0);
      const totalGider = tenantEntries.filter((e) => e.type === "GIDER").reduce((sum, e) => sum + Number(e.amount), 0);
      return {
        tenantId: tenant.id,
        tenantName: tenant.name,
        tenantCode: tenant.code,
        entryCount: tenantEntries.length,
        totalGelir,
        totalGider,
        net: totalGelir - totalGider,
      };
    });
  });

  const grandTotal = perTenant.reduce(
    (acc, t) => ({
      totalGelir: acc.totalGelir + t.totalGelir,
      totalGider: acc.totalGider + t.totalGider,
      net: acc.net + t.net,
    }),
    { totalGelir: 0, totalGider: 0, net: 0 },
  );

  return NextResponse.json({ tenants: perTenant, grandTotal });
}
