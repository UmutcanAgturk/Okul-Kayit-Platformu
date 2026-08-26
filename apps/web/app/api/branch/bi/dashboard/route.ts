import { NextRequest, NextResponse } from "next/server";
import { PaymentStatus, UserRole } from "@prisma/client";
import { getSessionActor } from "@/lib/session";
import { withBranchTenantContext } from "@/lib/db-context";
import { subjectFromCode } from "@/lib/curriculum";

/**
 * Yönetici BI Paneli — şube/kurum KPI'ları tek çağrıda. Salt-okunur; mevcut
 * tablolardan (öğrenci, sınıf, taksit, muhasebe defteri, sınav) türetilir.
 * RLS: tenant + rol (yönetim). SUPERADMIN "şube olarak yönet" ile tek şube.
 */
const ROLES: UserRole[] = [UserRole.BRANCH_ADMIN, UserRole.ACCOUNTING];

function round2(n: number) { return Math.round((n + Number.EPSILON) * 100) / 100; }
const MONTHS = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];

export async function GET(request: NextRequest) {
  const actor = await getSessionActor(request);
  if (!actor) return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  if (!ROLES.includes(actor.role) && !(actor.role === UserRole.SUPERADMIN && actor.actingTenantId)) {
    return NextResponse.json({ message: "Bu rol yönetim panelini görüntüleyemez" }, { status: 403 });
  }

  const now = new Date();

  const data = await withBranchTenantContext(actor, async (tx) => {
    // Öğrenci + doluluk
    const students = await tx.studentProfile.findMany({ include: { user: { select: { isActive: true } } } });
    const activeStudents = students.filter((s) => s.user.isActive);
    const assigned = activeStudents.filter((s) => s.classroomId).length;
    const classrooms = await tx.classroom.findMany({ select: { capacity: true } });
    const capacity = classrooms.reduce((s, c) => s + c.capacity, 0);

    // Tahsilat
    const installments = await tx.paymentInstallment.findMany({ select: { status: true, amount: true, dueDate: true } });
    let collected = 0, outstanding = 0, overdue = 0;
    for (const i of installments) {
      const amt = Number(i.amount);
      if (i.status === PaymentStatus.PAID) collected += amt;
      else if (i.status === PaymentStatus.CANCELLED) continue;
      else { outstanding += amt; if (i.dueDate < now) overdue += amt; }
    }
    const rate = collected + outstanding > 0 ? Math.round((collected / (collected + outstanding)) * 100) : 0;

    // Muhasebe — son 6 ay gelir/gider
    const sixAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    const ledger = await tx.accountingLedgerEntry.findMany({ where: { entryDate: { gte: sixAgo } }, select: { type: true, amount: true, entryDate: true } });
    const trendMap = new Map<string, { revenue: number; expense: number }>();
    for (let k = 5; k >= 0; k--) {
      const d = new Date(now.getFullYear(), now.getMonth() - k, 1);
      trendMap.set(`${d.getFullYear()}-${d.getMonth()}`, { revenue: 0, expense: 0 });
    }
    for (const e of ledger) {
      const key = `${e.entryDate.getFullYear()}-${e.entryDate.getMonth()}`;
      const bucket = trendMap.get(key);
      if (!bucket) continue;
      if (e.type === "GELIR") bucket.revenue += Number(e.amount);
      else bucket.expense += Number(e.amount);
    }
    const trend = [...trendMap.entries()].map(([key, v]) => {
      const [, m] = key.split("-").map(Number);
      return { label: MONTHS[m], revenue: round2(v.revenue), expense: round2(v.expense), net: round2(v.revenue - v.expense) };
    });
    const thisMonthKey = `${now.getFullYear()}-${now.getMonth()}`;
    const thisMonth = trendMap.get(thisMonthKey) ?? { revenue: 0, expense: 0 };

    // Akademik
    const examResults = await tx.examResult.findMany({ select: { netScore: true } });
    const avgNet = examResults.length ? round2(examResults.reduce((s, r) => s + r.netScore, 0) / examResults.length) : null;
    const achResults = await tx.studentAchievementResult.findMany({ take: 3000, orderBy: { id: "desc" }, include: { achievement: { select: { code: true } } } });
    const subjMap = new Map<string, { sum: number; n: number }>();
    for (const a of achResults) {
      const subj = subjectFromCode(a.achievement.code);
      const cur = subjMap.get(subj) ?? { sum: 0, n: 0 };
      cur.sum += a.correctRatio; cur.n += 1; subjMap.set(subj, cur);
    }
    const subjectPerformance = [...subjMap.entries()].map(([subject, v]) => ({ subject, pct: Math.round((v.sum / v.n) * 100) })).sort((a, b) => b.pct - a.pct);

    // Personel
    const teacherCount = await tx.teacherProfile.count();
    const staffCount = await tx.staffProfile.count().catch(() => 0);

    return {
      students: { total: activeStudents.length, unassigned: activeStudents.length - assigned },
      occupancy: { capacity, enrolled: assigned, pct: capacity > 0 ? Math.round((assigned / capacity) * 100) : 0 },
      collection: { collectedAmount: round2(collected), outstandingAmount: round2(outstanding), overdueAmount: round2(overdue), rate },
      finance: { revenueThisMonth: round2(thisMonth.revenue), expenseThisMonth: round2(thisMonth.expense), netThisMonth: round2(thisMonth.revenue - thisMonth.expense), trend },
      academic: { avgNet, examResultCount: examResults.length, subjectPerformance },
      staff: { teacherCount, staffCount },
    };
  });

  return NextResponse.json(data);
}
