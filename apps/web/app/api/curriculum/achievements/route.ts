import { NextRequest, NextResponse } from "next/server";
import { CurriculumNodeType, UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSessionActor } from "@/lib/session";
import { subjectFromCode } from "@/lib/curriculum";

/**
 * MEB kazanım listesi — Quiz/Pratik modülünün "Ders" ve "Kazanım" seçicilerini
 * doldurmak için. `CurriculumNode` tenant'a özgü değildir (MEB müfredatı tüm
 * kurumlar için ortaktır) — RLS taşımaz, yalnızca oturum açık olması yeterli.
 *
 * Yazma (POST/PATCH/DELETE) demo'daki kazanimYuklemeAllowed() ile aynı yetki
 * kuralını izler: yalnızca Genel Merkez (SUPERADMIN) veya Şube Yöneticisi
 * (BRANCH_ADMIN) — Öğretmen/Öğrenci kazanımları yalnızca TÜKETİR (Kazanım
 * Analizi/Quiz'de), taksonomiyi düzenleyemez. Global veri olduğu için
 * BRANCH_ADMIN'in düzenlediği bir kazanım TÜM kurumlarda görünür — demo'nun
 * kendisi de aynı paylaşılan ACHIEVEMENTS dizisini kullanır.
 */
const MANAGE_ROLES: UserRole[] = [UserRole.SUPERADMIN, UserRole.BRANCH_ADMIN];

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
      gradeLevel: a.gradeLevel,
      subject: subjectFromCode(a.code),
    })),
  });
}

export async function POST(request: NextRequest) {
  const actor = await getSessionActor(request);
  if (!actor) {
    return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  }
  if (!MANAGE_ROLES.includes(actor.role)) {
    return NextResponse.json({ message: "Bu rol kazanım ekleyemez" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const code = typeof body.code === "string" ? body.code.trim().toUpperCase() : "";
  const label = typeof body.label === "string" ? body.label.trim() : "";
  const gradeLevel = Number.isInteger(body.gradeLevel) && body.gradeLevel >= 1 && body.gradeLevel <= 12 ? body.gradeLevel : null;

  if (!code || !label || !gradeLevel) {
    return NextResponse.json({ message: "code, label ve gradeLevel (1-12) zorunludur" }, { status: 400 });
  }

  try {
    const achievement = await prisma.curriculumNode.create({
      data: { type: CurriculumNodeType.ACHIEVEMENT, code, label, gradeLevel },
    });
    return NextResponse.json(
      {
        achievement: {
          id: achievement.id,
          code: achievement.code,
          label: achievement.label,
          gradeLevel: achievement.gradeLevel,
          subject: subjectFromCode(achievement.code),
        },
      },
      { status: 201 },
    );
  } catch (e) {
    if (e && typeof e === "object" && "code" in e && e.code === "P2002") {
      return NextResponse.json({ message: "Bu kazanım kodu zaten kayıtlı" }, { status: 409 });
    }
    throw e;
  }
}
