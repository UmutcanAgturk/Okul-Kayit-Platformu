import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSessionActor } from "@/lib/session";
import { subjectFromCode } from "@/lib/curriculum";

/**
 * Tekil kazanım güncelleme/silme — bkz. ../route.ts üzerindeki
 * MANAGE_ROLES/yetki notu. `CurriculumNode`, ExamQuestion/
 * StudentAchievementResult/StudySession/QuizAttempt tarafından referans
 * verilebiliyor (onDelete belirtilmemiş, varsayılan RESTRICT) — kullanımda
 * olan bir kazanımın silinmesi Prisma'da P2003 üretir; bunu 409'a çeviriyoruz.
 *
 * PATCH yalnızca gradeLevel'i günceller (demo'daki Toplu Yönetim > "Sınıf
 * Düzeyini Değiştir" akışının karşılığı). `subject` her zaman code'un
 * önekinden türetildiği için (bkz. lib/curriculum.ts) ayrıca saklanan bir
 * alan değildir — demo'nun "Dersi Değiştir" toplu eylemi bu yüzden
 * taşınmadı: code'un öneki bir kazanımın "ders"ini zaten tanımlar ve onu
 * değiştirmek code'un kendisini (kimliğini) değiştirmek anlamına gelir.
 */
const MANAGE_ROLES: UserRole[] = [UserRole.SUPERADMIN, UserRole.BRANCH_ADMIN];

export async function PATCH(request: NextRequest, { params }: { params: { achievementId: string } }) {
  const actor = await getSessionActor(request);
  if (!actor) {
    return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  }
  if (!MANAGE_ROLES.includes(actor.role)) {
    return NextResponse.json({ message: "Bu rol kazanım düzenleyemez" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const gradeLevel = Number.isInteger(body.gradeLevel) && body.gradeLevel >= 1 && body.gradeLevel <= 12 ? body.gradeLevel : null;
  if (!gradeLevel) {
    return NextResponse.json({ message: "gradeLevel (1-12) zorunludur" }, { status: 400 });
  }

  try {
    const achievement = await prisma.curriculumNode.update({
      where: { id: params.achievementId },
      data: { gradeLevel },
    });
    return NextResponse.json({
      achievement: {
        id: achievement.id,
        code: achievement.code,
        label: achievement.label,
        gradeLevel: achievement.gradeLevel,
        subject: subjectFromCode(achievement.code),
      },
    });
  } catch (e) {
    if (e && typeof e === "object" && "code" in e && e.code === "P2025") {
      return NextResponse.json({ message: "Kazanım bulunamadı" }, { status: 404 });
    }
    throw e;
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { achievementId: string } }) {
  const actor = await getSessionActor(request);
  if (!actor) {
    return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  }
  if (!MANAGE_ROLES.includes(actor.role)) {
    return NextResponse.json({ message: "Bu rol kazanım silemez" }, { status: 403 });
  }

  try {
    await prisma.curriculumNode.delete({ where: { id: params.achievementId } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e && typeof e === "object" && "code" in e) {
      if (e.code === "P2025") {
        return NextResponse.json({ message: "Kazanım bulunamadı" }, { status: 404 });
      }
      if (e.code === "P2003") {
        return NextResponse.json(
          { message: "Bu kazanım kullanımda (sınav sorusu/sonuç/etüt/quiz'de referans veriliyor), silinemez." },
          { status: 409 },
        );
      }
    }
    throw e;
  }
}
