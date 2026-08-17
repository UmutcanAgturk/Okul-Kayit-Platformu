import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { getSessionActor } from "@/lib/session";
import { effectiveTenantId, withBranchTenantContext, withTenantContext } from "@/lib/db-context";

/**
 * Komut Paleti — gruplu arama (task #93). demo/seviye360-app.html'deki
 * renderCommandPaletteResults()'un modül adı dışındaki üç grubunun (öğrenci
 * adı/no, personel adı, HQ'da kurum adı) gerçek karşılığı. `CommandPalette.tsx`
 * modül listesini zaten istemci tarafında filtreliyor — bu rota yalnızca
 * DB'ye bakması gereken üç grubu döner, 2 karakterden kısa sorguları
 * (gereksiz sorgu trafiğini önlemek için) reddetmez ama boş sonuç döner.
 *
 * Yetki, ilgili listeleme rotalarıyla BİREBİR aynı: öğrenci araması
 * app/api/branch/students, personel araması app/api/branch/staff,
 * kurum araması yalnızca gerçek (actingTenantId'siz) SUPERADMIN — bu üç
 * grup birbirinden bağımsız olarak, aktörün rolüne göre boş dönebilir.
 */
const STUDENT_SEARCH_ROLES: UserRole[] = [UserRole.BRANCH_ADMIN, UserRole.GUIDANCE_COORDINATOR];
const STAFF_SEARCH_ROLES: UserRole[] = [UserRole.BRANCH_ADMIN, UserRole.ACCOUNTING];
const MAX_RESULTS = 5;

export async function GET(request: NextRequest) {
  const actor = await getSessionActor(request);
  if (!actor) {
    return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  }

  const q = (request.nextUrl.searchParams.get("q") ?? "").trim();
  if (q.length < 2) {
    return NextResponse.json({ students: [], staff: [], institutions: [] });
  }

  const isBareSuperadmin = actor.role === UserRole.SUPERADMIN && !actor.actingTenantId;
  const canSearchStudents = STUDENT_SEARCH_ROLES.includes(actor.role) || (actor.role === UserRole.SUPERADMIN && !!actor.actingTenantId);
  const canSearchStaff = STAFF_SEARCH_ROLES.includes(actor.role) || (actor.role === UserRole.SUPERADMIN && !!actor.actingTenantId);

  const [students, staff, institutions] = await Promise.all([
    canSearchStudents
      ? withBranchTenantContext(actor, (tx) =>
          tx.studentProfile.findMany({
            where: { user: { OR: [{ firstName: { contains: q, mode: "insensitive" } }, { lastName: { contains: q, mode: "insensitive" } }] } },
            include: { user: true },
            take: MAX_RESULTS,
          }),
        ).then((rows) =>
          // studentNo ayrı bir alan olduğu için (Prisma'da OR içinde ayrı bir tabloya
          // ait olmayan basit bir alan) tek sorguda birleştirmek yerine burada da aranır.
          rows.length > 0 ? rows : withBranchTenantContext(actor, (tx) => tx.studentProfile.findMany({ where: { studentNo: { contains: q } }, include: { user: true }, take: MAX_RESULTS })),
        )
      : Promise.resolve([]),
    canSearchStaff
      ? withBranchTenantContext(actor, (tx) =>
          tx.staffProfile.findMany({
            where: { user: { OR: [{ firstName: { contains: q, mode: "insensitive" } }, { lastName: { contains: q, mode: "insensitive" } }] } },
            include: { user: true },
            take: MAX_RESULTS,
          }),
        )
      : Promise.resolve([]),
    isBareSuperadmin
      ? withTenantContext(actor, (tx) =>
          tx.tenant.findMany({
            where: { OR: [{ name: { contains: q, mode: "insensitive" } }, { city: { contains: q, mode: "insensitive" } }] },
            take: MAX_RESULTS,
          }),
        )
      : Promise.resolve([]),
  ]);

  return NextResponse.json({
    students: students.map((s) => ({ id: s.id, name: `${s.user.firstName} ${s.user.lastName}`, studentNo: s.studentNo })),
    staff: staff.map((s) => ({ id: s.id, name: `${s.user.firstName} ${s.user.lastName}`, title: s.title })),
    institutions: institutions.map((t) => ({ id: t.id, name: t.name, city: t.city })),
  });
}
