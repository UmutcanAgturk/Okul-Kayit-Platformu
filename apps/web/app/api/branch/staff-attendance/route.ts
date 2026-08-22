import { NextRequest, NextResponse } from "next/server";
import { StaffAttendanceStatus, UserRole } from "@prisma/client";
import { getSessionActor } from "@/lib/session";
import { effectiveTenantId, withBranchTenantContext, tenantScopeFilter } from "@/lib/db-context";
import { actorLabel, logActivity } from "@/lib/audit-log";

/**
 * Personel Devam Durumu — demo/seviye360-app.html'deki "Günlük Operasyon
 * Paneli"nin (SCREENS["branch:ops"]) "Personel Devam Durumu" kartının gerçek
 * karşılığı (bkz. app/api/branch/daily-ops/route.ts'teki "BİLİNÇLİ OLARAK
 * dışarıda bırakıldı" notu — bu rota o boşluğu kapatır). "Personel", Raporlar >
 * Personel Listesi'ndeki AYNI birleşik roster'dır (StaffProfile + TeacherProfile,
 * bkz. app/api/branch/reports/staff/route.ts). Demo ile BİREBİR aynı
 * "yalnızca istisna" deseni: GELDI hiç satır olarak saklanmaz — kayıt yoksa
 * "Geldi" varsayılır, GELDI işaretlenince mevcut satır silinir.
 */
const ROLES_ALLOWED: UserRole[] = [UserRole.BRANCH_ADMIN, UserRole.ACCOUNTING];
type ClientStatus = "GELDI" | "GELMEDI" | "IZINLI";
const CLIENT_STATUSES: ClientStatus[] = ["GELDI", "GELMEDI", "IZINLI"];
const STATUS_LABEL: Record<ClientStatus, string> = { GELDI: "Geldi", GELMEDI: "Gelmedi", IZINLI: "İzinli" };

function todayRange() {
  const today = new Date().toISOString().slice(0, 10);
  return { today, date: new Date(`${today}T00:00:00.000Z`) };
}

export async function GET(request: NextRequest) {
  const actor = await getSessionActor(request);
  if (!actor) {
    return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  }
  if (!ROLES_ALLOWED.includes(actor.role) && !(actor.role === UserRole.SUPERADMIN && actor.actingTenantId)) {
    return NextResponse.json({ message: "Bu rol personel devam durumunu görüntüleyemez" }, { status: 403 });
  }

  const { today, date } = todayRange();

  const roster = await withBranchTenantContext(actor, async (tx) => {
    const [staffProfiles, teacherProfiles, records] = await Promise.all([
      tx.staffProfile.findMany({ include: { user: true } }),
      tx.teacherProfile.findMany({ where: { user: { ...tenantScopeFilter(actor), role: UserRole.TEACHER } }, include: { user: true } }),
      tx.staffAttendanceRecord.findMany({ where: { date } }),
    ]);

    const statusByUserId = new Map<string, StaffAttendanceStatus>(records.map((r) => [r.userId, r.status]));

    return [
      ...staffProfiles.map((s) => ({ userId: s.userId, name: `${s.user.firstName} ${s.user.lastName}`, title: s.title })),
      ...teacherProfiles.map((t) => ({ userId: t.userId, name: `${t.user.firstName} ${t.user.lastName}`, title: "Öğretmen" })),
    ]
      .sort((a, b) => a.name.localeCompare(b.name, "tr"))
      .map((r) => ({ ...r, status: (statusByUserId.get(r.userId) as ClientStatus) ?? "GELDI" }));
  });

  const presentCount = roster.filter((r) => r.status === "GELDI").length;

  return NextResponse.json({ date: today, staff: roster, presentCount, totalCount: roster.length });
}

export async function POST(request: NextRequest) {
  const actor = await getSessionActor(request);
  if (!actor) {
    return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  }
  if (!ROLES_ALLOWED.includes(actor.role) && !(actor.role === UserRole.SUPERADMIN && actor.actingTenantId)) {
    return NextResponse.json({ message: "Bu rol personel devam durumunu değiştiremez" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const userId = typeof body?.userId === "string" && body.userId ? body.userId : "";
  const status = body?.status as ClientStatus;
  if (!userId || !CLIENT_STATUSES.includes(status)) {
    return NextResponse.json({ message: "userId ve geçerli bir status (GELDI/GELMEDI/IZINLI) zorunludur" }, { status: 400 });
  }

  const { today, date } = todayRange();

  const result = await withBranchTenantContext(actor, async (tx) => {
    const staffProfile = await tx.staffProfile.findFirst({ where: { userId }, include: { user: true } });
    const teacherProfile = staffProfile
      ? null
      : await tx.teacherProfile.findFirst({
          where: { userId, user: { tenantId: effectiveTenantId(actor), role: UserRole.TEACHER } },
          include: { user: true },
        });
    const person = staffProfile ?? teacherProfile;
    if (!person) return { error: "Personel bulunamadı" as const };

    if (status === "GELDI") {
      await tx.staffAttendanceRecord.deleteMany({ where: { userId, date } });
    } else {
      await tx.staffAttendanceRecord.upsert({
        where: { userId_date: { userId, date } },
        create: { tenantId: effectiveTenantId(actor), userId, date, status: status as StaffAttendanceStatus, recordedByUserId: actor.id },
        update: { status: status as StaffAttendanceStatus, recordedByUserId: actor.id },
      });
    }

    await logActivity(tx, {
      tenantId: effectiveTenantId(actor),
      actorUserId: actor.id,
      actorLabel: actorLabel(actor),
      action: "Personel devam durumu güncellendi",
      detail: `${person.user.firstName} ${person.user.lastName} — ${STATUS_LABEL[status]}`,
    });

    return { name: `${person.user.firstName} ${person.user.lastName}` };
  });

  if ("error" in result) {
    return NextResponse.json({ message: result.error }, { status: 404 });
  }

  return NextResponse.json({ userId, status, date: today });
}
