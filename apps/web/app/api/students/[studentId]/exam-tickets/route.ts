import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { getSessionActor } from "@/lib/session";
import { withTenantContext } from "@/lib/db-context";

const STAFF_ROLES: UserRole[] = [UserRole.BRANCH_ADMIN, UserRole.GUIDANCE_COORDINATOR, UserRole.TEACHER];

/**
 * QR Sınav Belgesi — demo/seviye360-app.html'deki "student:ticket" ekranının
 * gerçek karşılığı. Yeni bir Prisma modeli EKLEMEZ; öğrencinin girdiği
 * (ExamResult kaydı olan) sınavları listeler. DÜRÜST NOT: salon/koltuk/
 * kitapçık ataması (seatingRoomId/seatNo/bookletType) şu an hiçbir route/seed
 * tarafından doldurulmuyor (bkz. Exam modelindeki alanlar) — bu alanlar
 * null geldiğinde arayüz bunu olduğu gibi gösterir, uydurmaz. QR kod, kimlik
 * doğrulama için studentNo+examId+seat bilgisini kodlayan bir doğrulama
 * dizesidir; istemci tarafında (bkz. lib/qrcode) üretilir.
 */
export async function GET(request: NextRequest, { params }: { params: { studentId: string } }) {
  const actor = await getSessionActor(request);
  if (!actor) {
    return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  }

  const result = await withTenantContext(actor, async (tx) => {
    const student = await tx.studentProfile.findUnique({ where: { id: params.studentId }, include: { user: true } });
    if (!student) return { kind: "not_found" as const };

    if (actor.role === UserRole.STUDENT) {
      const ownProfile = await tx.studentProfile.findUnique({ where: { userId: actor.id } });
      if (ownProfile?.id !== student.id) return { kind: "forbidden" as const };
    } else if (actor.role === UserRole.PARENT) {
      const parentProfile = await tx.parentProfile.findUnique({ where: { userId: actor.id } });
      const guardianRow = parentProfile
        ? await tx.studentGuardian.findUnique({
            where: { studentId_parentId: { studentId: student.id, parentId: parentProfile.id } },
          })
        : null;
      if (!guardianRow) return { kind: "forbidden" as const };
    } else if (!STAFF_ROLES.includes(actor.role) && actor.role !== UserRole.SUPERADMIN) {
      return { kind: "forbidden" as const };
    }

    const examResults = await tx.examResult.findMany({
      where: { studentId: student.id },
      include: { exam: true },
      orderBy: { exam: { examDate: "desc" } },
    });

    return {
      kind: "ok" as const,
      tickets: examResults.map((r) => ({
        examId: r.exam.id,
        examName: r.exam.name,
        examType: r.exam.type,
        examDate: r.exam.examDate,
        bookletType: r.bookletType,
        seatingRoomId: r.seatingRoomId,
        seatNo: r.seatNo,
        studentNo: student.studentNo,
        studentName: `${student.user.firstName} ${student.user.lastName}`,
      })),
    };
  });

  if (result.kind === "not_found") {
    return NextResponse.json({ message: "Öğrenci bulunamadı" }, { status: 404 });
  }
  if (result.kind === "forbidden") {
    return NextResponse.json({ message: "Bu öğrencinin sınav belgelerini görüntüleyemezsiniz" }, { status: 403 });
  }
  return NextResponse.json({ tickets: result.tickets });
}
