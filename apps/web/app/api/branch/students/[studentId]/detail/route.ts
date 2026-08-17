import { NextRequest, NextResponse } from "next/server";
import { PaymentStatus, UserRole } from "@prisma/client";
import { getSessionActor } from "@/lib/session";
import { withTenantContext } from "@/lib/db-context";
import { ratioToMastery } from "@/lib/curriculum";

/**
 * Öğrenci Hızlı Görüntüle/Düzenle Çekmecesi (task #91) — demo'daki
 * openStudentDetail()'in gösterdiği zengin alan setinin gerçek karşılığı:
 * kimlik bilgileri, iletişim, ödeme durumu rozeti, son sınav istatistiği,
 * ve kazanım etiketleri (güçlü/geliştirilmeli/kritik) + basit bir "AI profil"
 * özeti (net trend + öncelikli kazanımlar — demo'daki buildStudentAiProfile
 * ile aynı fikir, kural tabanlı).
 *
 * `withTenantContext` (withBranchTenantContext DEĞİL) kasıtlı: HQ Öğrenciler
 * panelinden (bkz. app/api/hq/students — SUPERADMIN, actingTenantId'siz,
 * TÜM şubeler) açılan çekmece de bu rotayı kullanır; SUPERADMIN için RLS
 * bypass edilir, BRANCH_ADMIN/GUIDANCE_COORDINATOR için ise normal RLS
 * (yalnızca kendi tenant'ı) uygulanır — aynı rota her iki çağıranı da
 * doğru şekilde kapsar.
 */
const ROLES_ALLOWED: UserRole[] = [UserRole.BRANCH_ADMIN, UserRole.GUIDANCE_COORDINATOR];

export async function GET(request: NextRequest, { params }: { params: { studentId: string } }) {
  const actor = await getSessionActor(request);
  if (!actor) {
    return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  }
  if (!ROLES_ALLOWED.includes(actor.role) && actor.role !== UserRole.SUPERADMIN) {
    return NextResponse.json({ message: "Bu rol öğrenci detayını görüntüleyemez" }, { status: 403 });
  }

  const today = new Date();
  const result = await withTenantContext(actor, async (tx) => {
    const student = await tx.studentProfile.findUnique({
      where: { id: params.studentId },
      include: {
        user: true,
        installments: true,
        examResults: {
          orderBy: { createdAt: "desc" },
          take: 2,
          include: { achievementResults: { include: { achievement: true } } },
        },
      },
    });
    if (!student) return null;

    const hasOverdue = student.installments.some((i) => i.status === PaymentStatus.PENDING && i.dueDate < today);
    const hasPending = student.installments.some((i) => i.status === PaymentStatus.PENDING);
    const paymentStatus =
      student.installments.length === 0 ? "TAKSIT_YOK" : hasOverdue ? "GECIKMIS" : hasPending ? "PLANLI" : "GUNCEL";

    const [last, prev] = student.examResults;
    const lastExamStats = last
      ? {
          correct: last.correctCount,
          wrong: last.wrongCount,
          empty: last.emptyCount,
          netScore: last.netScore,
          correctRatio: last.correctCount + last.wrongCount + last.emptyCount > 0 ? last.correctCount / (last.correctCount + last.wrongCount + last.emptyCount) : null,
        }
      : null;
    const netTrend = last && prev ? Number((last.netScore - prev.netScore).toFixed(2)) : null;

    const tags: { code: string; label: string; ratio: number }[] = (last?.achievementResults ?? []).map((r) => ({
      code: r.achievement.code,
      label: r.achievement.label,
      ratio: r.correctRatio,
    }));
    const strong = tags.filter((t) => ratioToMastery(t.ratio) === "STRONG");
    const weak = tags.filter((t) => ratioToMastery(t.ratio) === "WEAK");
    const critical = tags.filter((t) => ratioToMastery(t.ratio) === "CRITICAL");
    const priorityAchievements = [...weak, ...critical].sort((a, b) => a.ratio - b.ratio).slice(0, 3);

    return {
      id: student.id,
      studentNo: student.studentNo,
      nationalId: student.nationalId,
      birthDate: student.birthDate?.toISOString() ?? null,
      gender: student.gender,
      targetGoal: student.targetGoal,
      email: student.user.email,
      phone: student.user.phone,
      paymentStatus,
      lastExamStats,
      aiProfile: last ? { netTrend, priorityAchievements } : null,
      achievementTags: { strong, weak, critical },
    };
  });

  if (!result) {
    return NextResponse.json({ message: "Öğrenci bulunamadı" }, { status: 404 });
  }
  return NextResponse.json({ student: result });
}
