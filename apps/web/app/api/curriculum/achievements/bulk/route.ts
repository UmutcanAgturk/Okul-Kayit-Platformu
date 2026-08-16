import { NextRequest, NextResponse } from "next/server";
import { CurriculumNodeType, UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSessionActor } from "@/lib/session";
import { subjectFromCode } from "@/lib/curriculum";

/**
 * Toplu kazanım yükleme — demo'nun CSV yapıştırma akışının gerçek karşılığı.
 * Her satır bağımsız kendi try/catch'inde işlenir (bkz.
 * app/api/branch/students/bulk-import/route.ts ile aynı desen); tek bir
 * hatalı satır tüm partiyi düşürmez.
 */
const MANAGE_ROLES: UserRole[] = [UserRole.SUPERADMIN, UserRole.BRANCH_ADMIN];
const MAX_ROWS = 200;

interface RowResult {
  row: number;
  ok: boolean;
  message?: string;
  achievement?: { id: string; code: string; label: string; gradeLevel: number; subject: string };
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
  const rows = Array.isArray(body.rows) ? body.rows : null;
  if (!rows || rows.length === 0) {
    return NextResponse.json({ message: "rows (dizi) zorunludur" }, { status: 400 });
  }
  if (rows.length > MAX_ROWS) {
    return NextResponse.json({ message: `Tek seferde en fazla ${MAX_ROWS} satır yüklenebilir` }, { status: 400 });
  }

  const results: RowResult[] = [];
  for (let i = 0; i < rows.length; i++) {
    const rowNum = i + 1;
    const raw = rows[i] ?? {};
    const code = typeof raw.code === "string" ? raw.code.trim().toUpperCase() : "";
    const label = typeof raw.label === "string" ? raw.label.trim() : "";
    const gradeLevelNum = Number(raw.gradeLevel);
    const gradeLevel = Number.isInteger(gradeLevelNum) && gradeLevelNum >= 1 && gradeLevelNum <= 12 ? gradeLevelNum : null;

    if (!code || !label || !gradeLevel) {
      results.push({ row: rowNum, ok: false, message: "code, label ve gradeLevel (1-12) zorunludur" });
      continue;
    }

    try {
      const achievement = await prisma.curriculumNode.create({
        data: { type: CurriculumNodeType.ACHIEVEMENT, code, label, gradeLevel },
      });
      results.push({
        row: rowNum,
        ok: true,
        achievement: {
          id: achievement.id,
          code: achievement.code,
          label: achievement.label,
          gradeLevel: achievement.gradeLevel,
          subject: subjectFromCode(achievement.code),
        },
      });
    } catch (e) {
      if (e && typeof e === "object" && "code" in e && e.code === "P2002") {
        results.push({ row: rowNum, ok: false, message: `"${code}" zaten kayıtlı` });
      } else {
        results.push({ row: rowNum, ok: false, message: "Kayıt oluşturulamadı" });
      }
    }
  }

  const successCount = results.filter((r) => r.ok).length;
  const errorCount = results.length - successCount;
  return NextResponse.json({ results, successCount, errorCount });
}
