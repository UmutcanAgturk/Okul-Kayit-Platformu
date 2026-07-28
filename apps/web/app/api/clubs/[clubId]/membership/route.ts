import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { getSessionActor } from "@/lib/session";
import { withTenantContext } from "@/lib/db-context";

// Öğrencinin kendi kulüp üyeliğini açar/kapatır (join/leave) — demo'daki
// "Katıl"/"Ayrıl" butonunun karşılığı.
export async function POST(request: NextRequest, { params }: { params: { clubId: string } }) {
  const actor = await getSessionActor(request);
  if (!actor) {
    return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  }
  if (actor.role !== UserRole.STUDENT) {
    return NextResponse.json({ message: "Yalnızca öğrenciler kulübe katılabilir/ayrılabilir" }, { status: 403 });
  }

  const outcome = await withTenantContext(actor, async (tx) => {
    const studentProfile = await tx.studentProfile.findUnique({ where: { userId: actor.id } });
    if (!studentProfile) return { kind: "no_profile" as const };

    const club = await tx.club.findUnique({ where: { id: params.clubId } });
    if (!club) return { kind: "not_found" as const };

    const existing = await tx.clubMembership.findUnique({
      where: { clubId_studentId: { clubId: club.id, studentId: studentProfile.id } },
    });
    if (existing) {
      await tx.clubMembership.delete({ where: { clubId_studentId: { clubId: club.id, studentId: studentProfile.id } } });
      return { kind: "removed" as const };
    }
    await tx.clubMembership.create({ data: { clubId: club.id, studentId: studentProfile.id } });
    return { kind: "added" as const };
  });

  if (outcome.kind === "no_profile" || outcome.kind === "not_found") {
    return NextResponse.json({ message: "Kulüp bulunamadı" }, { status: 404 });
  }
  return NextResponse.json({ isMember: outcome.kind === "added" });
}
