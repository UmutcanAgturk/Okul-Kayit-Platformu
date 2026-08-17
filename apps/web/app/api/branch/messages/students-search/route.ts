import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { getSessionActor } from "@/lib/session";
import { withBranchTenantContext } from "@/lib/db-context";

/**
 * İletişim — Kime'de tekil öğrenci seçimi (task #101). Demo'daki öğretmen
 * gönderim ekranı (renderIletisimComposeTeacher) kendi roster'ından tek tek
 * öğrenci işaretleyebiliyordu; bu depoda TEACHER'ın sınıf-öğrenci ataması
 * modeli yok (bkz. app/api/branch/messages POST'taki not — TEACHER tüm
 * tenant'a erişebilir), bu yüzden burada da tüm tenant içinde arama yapılır.
 * `/api/branch/students`ten AYRI, küçük bir uç: o rota BRANCH_ADMIN/
 * GUIDANCE_COORDINATOR'a kilitli, TEACHER'ın mesaj gönderirken öğrenci
 * arayabilmesi için (yalnızca id/isim/sınıf) ayrı ve minimal bir liste.
 */
const ROLES_ALLOWED: UserRole[] = [UserRole.BRANCH_ADMIN, UserRole.TEACHER];

export async function GET(request: NextRequest) {
  const actor = await getSessionActor(request);
  if (!actor) {
    return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  }
  if (!ROLES_ALLOWED.includes(actor.role) && !(actor.role === UserRole.SUPERADMIN && actor.actingTenantId)) {
    return NextResponse.json({ message: "Bu rol öğrenci arayamaz" }, { status: 403 });
  }

  const q = request.nextUrl.searchParams.get("q")?.trim().toLocaleLowerCase("tr-TR") ?? "";
  if (q.length < 2) {
    return NextResponse.json({ students: [] });
  }

  const students = await withBranchTenantContext(actor, (tx) =>
    tx.studentProfile.findMany({
      include: { user: true, classroom: true },
      orderBy: { user: { firstName: "asc" } },
    }),
  );

  const filtered = students
    .filter((s) => `${s.user.firstName} ${s.user.lastName}`.toLocaleLowerCase("tr-TR").includes(q) || s.studentNo.toLocaleLowerCase("tr-TR").includes(q))
    .slice(0, 20);

  return NextResponse.json({
    students: filtered.map((s) => ({
      id: s.id,
      name: `${s.user.firstName} ${s.user.lastName}`,
      studentNo: s.studentNo,
      classroomName: s.classroom?.name ?? null,
    })),
  });
}
