import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { getSessionActor } from "@/lib/session";
import { withBranchTenantContext } from "@/lib/db-context";
import { subjectFromCode } from "@/lib/curriculum";

/**
 * Sınav Karnesi verisi — bir sınavın TÜM sonuçları için ders bazlı D/Y/B/net
 * kırılımı + şube ve sınıf sıralaması. Öğrenci başına veya toplu karne PDF'i
 * bu tek çağrıdan üretilir (sıralama tüm sonuçlar üzerinden hesaplanır).
 */
const VIEW_ROLES: UserRole[] = [UserRole.BRANCH_ADMIN, UserRole.GUIDANCE_COORDINATOR, UserRole.TEACHER];

function round2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

// Standart yarışma sıralaması (1,2,2,4). netScore azalan; eşitler aynı sırayı paylaşır.
function assignRanks<T extends { netScore: number }>(rows: T[]): Map<T, number> {
  const sorted = [...rows].sort((a, b) => b.netScore - a.netScore);
  const rank = new Map<T, number>();
  sorted.forEach((r, i) => {
    if (i > 0 && r.netScore === sorted[i - 1].netScore) rank.set(r, rank.get(sorted[i - 1])!);
    else rank.set(r, i + 1);
  });
  return rank;
}

export async function GET(request: NextRequest, { params }: { params: { examId: string } }) {
  const actor = await getSessionActor(request);
  if (!actor) return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  if (!VIEW_ROLES.includes(actor.role) && !(actor.role === UserRole.SUPERADMIN && actor.actingTenantId)) {
    return NextResponse.json({ message: "Bu rol karneleri görüntüleyemez" }, { status: 403 });
  }

  const data = await withBranchTenantContext(actor, async (tx) => {
    const exam = await tx.exam.findUnique({
      where: { id: params.examId },
      include: { questions: { include: { achievement: true } } },
    });
    if (!exam) return null;

    const questionSubject = new Map<string, string>();
    for (const q of exam.questions) questionSubject.set(q.id, subjectFromCode(q.achievement.code));
    const allSubjects = Array.from(new Set([...questionSubject.values()])).sort((a, b) => a.localeCompare(b, "tr"));

    const results = await tx.examResult.findMany({
      where: { examId: exam.id },
      include: {
        student: { include: { user: true, classroom: true } },
        answers: true,
      },
    });

    type Row = {
      studentId: string; studentNo: string; name: string;
      classroomId: string | null; classroomName: string | null; gradeLevel: string;
      correctCount: number; wrongCount: number; emptyCount: number; netScore: number;
      subjects: { subject: string; correct: number; wrong: number; empty: number; net: number; total: number }[];
    };

    const rows: Row[] = results.map((r) => {
      const bySubject = new Map<string, { correct: number; wrong: number; empty: number; total: number }>();
      for (const s of allSubjects) bySubject.set(s, { correct: 0, wrong: 0, empty: 0, total: 0 });
      for (const a of r.answers) {
        const subj = questionSubject.get(a.questionId);
        if (!subj) continue;
        const bucket = bySubject.get(subj)!;
        bucket.total++;
        if (a.isCorrect === true) bucket.correct++;
        else if (a.isCorrect === false) bucket.wrong++;
        else bucket.empty++;
      }
      return {
        studentId: r.studentId,
        studentNo: r.student.studentNo,
        name: `${r.student.user.firstName} ${r.student.user.lastName}`,
        classroomId: r.student.classroomId,
        classroomName: r.student.classroom?.name ?? null,
        gradeLevel: r.student.gradeLevel,
        correctCount: r.correctCount,
        wrongCount: r.wrongCount,
        emptyCount: r.emptyCount,
        netScore: round2(r.netScore),
        subjects: allSubjects
          .map((s) => {
            const b = bySubject.get(s)!;
            return { subject: s, correct: b.correct, wrong: b.wrong, empty: b.empty, total: b.total, net: round2(b.correct - b.wrong / 4) };
          })
          .filter((s) => s.total > 0),
      };
    });

    // Sıralamalar: şube geneli + sınıf içi.
    const branchRank = assignRanks(rows);
    const byClass = new Map<string, Row[]>();
    for (const r of rows) {
      const key = r.classroomId ?? "__none__";
      (byClass.get(key) ?? byClass.set(key, []).get(key)!).push(r);
    }
    const classRankMaps = new Map<string, Map<Row, number>>();
    const classAvg = new Map<string, number>();
    for (const [key, list] of byClass) {
      classRankMaps.set(key, assignRanks(list));
      classAvg.set(key, list.length ? round2(list.reduce((s, r) => s + r.netScore, 0) / list.length) : 0);
    }
    const branchAvgNet = rows.length ? round2(rows.reduce((s, r) => s + r.netScore, 0) / rows.length) : 0;

    const cards = rows.map((r) => {
      const key = r.classroomId ?? "__none__";
      return {
        ...r,
        branchRank: branchRank.get(r)!,
        branchSize: rows.length,
        classRank: classRankMaps.get(key)!.get(r)!,
        classSize: byClass.get(key)!.length,
        classAvgNet: classAvg.get(key)!,
      };
    });
    // Şube sırasına göre sırala (sıralama tablosu için hazır).
    cards.sort((a, b) => a.branchRank - b.branchRank);

    return {
      exam: { id: exam.id, name: exam.name, type: exam.type, examDate: exam.examDate.toISOString(), totalQuestions: exam.questions.length },
      branchAvgNet,
      branchCount: rows.length,
      subjects: allSubjects,
      cards,
    };
  });

  if (!data) return NextResponse.json({ message: "Sınav bulunamadı" }, { status: 404 });
  return NextResponse.json(data);
}
