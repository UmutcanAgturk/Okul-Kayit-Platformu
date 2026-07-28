import { NextRequest, NextResponse } from "next/server";
import { CurriculumNodeType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSessionActor } from "@/lib/session";
import { subjectFromCode } from "@/lib/curriculum";

/**
 * MEB kazanım listesi — Quiz/Pratik modülünün "Ders" ve "Kazanım" seçicilerini
 * doldurmak için. `CurriculumNode` tenant'a özgü değildir (MEB müfredatı tüm
 * kurumlar için ortaktır) — RLS taşımaz, yalnızca oturum açık olması yeterli.
 */
export async function GET(request: NextRequest) {
  const actor = await getSessionActor(request);
  if (!actor) {
    return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  }

  const achievements = await prisma.curriculumNode.findMany({
    where: { type: CurriculumNodeType.ACHIEVEMENT },
    orderBy: { code: "asc" },
  });

  return NextResponse.json({
    achievements: achievements.map((a) => ({
      id: a.id,
      code: a.code,
      label: a.label,
      subject: subjectFromCode(a.code),
    })),
  });
}
