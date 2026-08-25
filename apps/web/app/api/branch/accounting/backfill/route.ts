import { NextRequest, NextResponse } from "next/server";
import { JournalSource, PaymentStatus, UserRole } from "@prisma/client";
import { getSessionActor } from "@/lib/session";
import { effectiveTenantId, withBranchTenantContext } from "@/lib/db-context";
import { actorLabel, logActivity } from "@/lib/audit-log";
import { ACC } from "@/lib/accounting/chart";
import { ensureStudentCari, postJournal, seedChartForTenant } from "@/lib/accounting/posting";

/**
 * Muhasebeyi geçmişten oluştur (açılış). Mevcut taksit verisinden çift taraflı
 * defteri yeniden kurar: her öğrenci için toplam ücret tahakkuku (120/600) ve
 * her TAHSİL EDİLMİŞ taksit için tahsilat (102/120). Carisinde zaten hareket
 * olan öğrenci atlanır — böylece tekrar çalıştırmak güvenlidir (idempotent).
 */
const ROLES_ALLOWED: UserRole[] = [UserRole.BRANCH_ADMIN, UserRole.ACCOUNTING];

export async function POST(request: NextRequest) {
  const actor = await getSessionActor(request);
  if (!actor) return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  if (!ROLES_ALLOWED.includes(actor.role) && !(actor.role === UserRole.SUPERADMIN && actor.actingTenantId)) {
    return NextResponse.json({ message: "Bu rol Muhasebe'ye erişemez" }, { status: 403 });
  }

  const result = await withBranchTenantContext(actor, async (tx) => {
    const tenantId = effectiveTenantId(actor);
    await seedChartForTenant(tx, tenantId);

    const students = await tx.studentProfile.findMany({
      where: { installments: { some: {} } },
      include: { user: true, installments: true },
    });

    let accrued = 0;
    let collected = 0;
    let skipped = 0;

    for (const s of students) {
      const name = `${s.user.firstName} ${s.user.lastName}`;
      const cariCode = await ensureStudentCari(tx, tenantId, s.id, name);
      const cari = await tx.accountingAccount.findFirst({ where: { tenantId, code: cariCode }, select: { id: true } });
      const hasLines = cari ? (await tx.journalLine.count({ where: { accountId: cari.id } })) > 0 : false;
      if (hasLines) { skipped++; continue; }

      const total = s.installments.reduce((sum, i) => sum + Number(i.amount), 0);
      if (total <= 0) { skipped++; continue; }

      // Açılış tahakkuku — toplam ücret.
      await postJournal(tx, {
        tenantId,
        entryDate: new Date(),
        description: `Açılış — ${name} eğitim ücreti tahakkuku`,
        source: JournalSource.ACILIS,
        sourceRefId: `acilis-${s.id}`,
        createdByUserId: actor.id,
        lines: [
          { code: cariCode, debit: total, description: "Eğitim ücreti (açılış)" },
          { code: ACC.SATISLAR, credit: total, description: "Eğitim geliri (açılış)" },
        ],
      });
      accrued++;

      // Tahsil edilmiş taksitler için tahsilat kaydı.
      for (const inst of s.installments) {
        if (inst.status !== PaymentStatus.PAID) continue;
        await postJournal(tx, {
          tenantId,
          entryDate: inst.paidAt ?? new Date(),
          description: `Taksit tahsilatı — ${inst.installmentNo}. taksit (açılış)`,
          source: JournalSource.TAHSILAT,
          sourceRefId: inst.id,
          createdByUserId: actor.id,
          lines: [
            { code: ACC.BANKALAR, debit: Number(inst.amount), description: "Tahsilat" },
            { code: cariCode, credit: Number(inst.amount), description: name },
          ],
        });
        collected++;
      }
    }

    await logActivity(tx, {
      tenantId,
      actorUserId: actor.id,
      actorLabel: actorLabel(actor),
      action: "Muhasebe açılışı yapıldı",
      detail: `${accrued} öğrenci tahakkuku, ${collected} tahsilat kaydı`,
    });

    return { accrued, collected, skipped, students: students.length };
  });

  return NextResponse.json(result);
}
