import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { getSessionActor } from "@/lib/session";
import { effectiveTenantId, withTenantContext } from "@/lib/db-context";

/**
 * Veli-Öğretmen Mesajlaşma — konuşma listesi (GET) ve yeni konuşma (POST).
 * Katılımcı: bir veli + bir öğretmen. GET yalnızca actor'ün taraf olduğu
 * konuşmaları döner (uygulama katmanı kısıtı). RLS tenant izolasyonu.
 */

export async function GET(request: NextRequest) {
  const actor = await getSessionActor(request);
  if (!actor) return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  if (actor.role !== UserRole.PARENT && actor.role !== UserRole.TEACHER) {
    return NextResponse.json({ message: "Mesajlaşma yalnızca Veli ve Öğretmen rollerine açıktır" }, { status: 403 });
  }

  const data = await withTenantContext(actor, async (tx) => {
    const convs = await tx.conversation.findMany({
      where: { OR: [{ parentUserId: actor.id }, { teacherUserId: actor.id }] },
      orderBy: { lastMessageAt: "desc" },
    });
    if (convs.length === 0) return [];

    const userIds = [...new Set(convs.flatMap((c) => [c.parentUserId, c.teacherUserId]))];
    const users = await tx.user.findMany({ where: { id: { in: userIds } }, select: { id: true, firstName: true, lastName: true } });
    const userName = new Map(users.map((u) => [u.id, `${u.firstName} ${u.lastName}`]));
    const studentIds = convs.map((c) => c.studentId).filter((x): x is string => !!x);
    const students = studentIds.length ? await tx.studentProfile.findMany({ where: { id: { in: studentIds } }, include: { user: true } }) : [];
    const studentName = new Map(students.map((s) => [s.id, `${s.user.firstName} ${s.user.lastName}`]));

    const msgs = await tx.conversationMessage.findMany({
      where: { conversationId: { in: convs.map((c) => c.id) } },
      orderBy: { createdAt: "asc" },
      select: { conversationId: true, senderUserId: true, body: true, createdAt: true },
    });
    const byConv = new Map<string, typeof msgs>();
    for (const m of msgs) { const arr = byConv.get(m.conversationId) ?? []; arr.push(m); byConv.set(m.conversationId, arr); }

    return convs.map((c) => {
      const isParent = c.parentUserId === actor.id;
      const otherId = isParent ? c.teacherUserId : c.parentUserId;
      const myLastRead = isParent ? c.parentLastReadAt : c.teacherLastReadAt;
      const list = byConv.get(c.id) ?? [];
      const last = list[list.length - 1];
      const unread = list.filter((m) => m.senderUserId !== actor.id && (!myLastRead || m.createdAt > myLastRead)).length;
      return {
        id: c.id,
        subject: c.subject,
        otherName: userName.get(otherId) ?? "—",
        otherRole: isParent ? "Öğretmen" : "Veli",
        studentName: c.studentId ? studentName.get(c.studentId) ?? null : null,
        lastMessage: last?.body ?? null,
        lastMessageAt: c.lastMessageAt.toISOString(),
        unread,
      };
    });
  });

  return NextResponse.json({ conversations: data });
}

export async function POST(request: NextRequest) {
  const actor = await getSessionActor(request);
  if (!actor) return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  if (actor.role !== UserRole.PARENT && actor.role !== UserRole.TEACHER) {
    return NextResponse.json({ message: "Mesajlaşma yalnızca Veli ve Öğretmen rollerine açıktır" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const studentId = typeof body.studentId === "string" && body.studentId ? body.studentId : null;
  const subject = typeof body.subject === "string" && body.subject.trim() ? body.subject.trim() : null;
  const firstMessage = typeof body.firstMessage === "string" && body.firstMessage.trim() ? body.firstMessage.trim() : null;
  const otherUserId = typeof body.otherUserId === "string" && body.otherUserId ? body.otherUserId : null; // parent picks teacher; teacher may pick parent
  if (!studentId || !subject || !firstMessage) {
    return NextResponse.json({ message: "studentId, subject ve firstMessage zorunludur" }, { status: 400 });
  }

  const result = await withTenantContext(actor, async (tx) => {
    const student = await tx.studentProfile.findUnique({ where: { id: studentId }, include: { guardians: { include: { parent: { include: { user: true } } } } } });
    if (!student) return { kind: "not_found" as const };

    let parentUserId: string;
    let teacherUserId: string;

    if (actor.role === UserRole.PARENT) {
      // Veli kendisi; öğretmeni seçer (otherUserId). Velinin bu öğrencinin velisi olduğunu doğrula.
      const parent = await tx.parentProfile.findUnique({ where: { userId: actor.id } });
      const g = parent ? await tx.studentGuardian.findUnique({ where: { studentId_parentId: { studentId: student.id, parentId: parent.id } } }) : null;
      if (!g) return { kind: "forbidden" as const };
      if (!otherUserId) return { kind: "missing_teacher" as const };
      const teacher = await tx.user.findFirst({ where: { id: otherUserId, role: UserRole.TEACHER } });
      if (!teacher) return { kind: "teacher_not_found" as const };
      parentUserId = actor.id;
      teacherUserId = otherUserId;
    } else {
      // Öğretmen kendisi; velisi = faturadan sorumlu veli (veya ilk veli) ya da otherUserId.
      const billing = student.guardians.find((g) => g.isBillingResponsible) ?? student.guardians[0];
      const resolvedParent = otherUserId ?? billing?.parent.user.id ?? null;
      if (!resolvedParent) return { kind: "no_parent" as const };
      parentUserId = resolvedParent;
      teacherUserId = actor.id;
    }

    const conv = await tx.conversation.create({
      data: {
        tenantId: effectiveTenantId(actor),
        parentUserId,
        teacherUserId,
        studentId,
        subject,
        lastMessageAt: new Date(),
        ...(actor.role === UserRole.PARENT ? { parentLastReadAt: new Date() } : { teacherLastReadAt: new Date() }),
        messages: { create: { senderUserId: actor.id, body: firstMessage } },
      },
    });
    return { kind: "ok" as const, id: conv.id, otherUserId: actor.role === UserRole.PARENT ? teacherUserId : parentUserId, subject };
  });

  if (result.kind === "not_found") return NextResponse.json({ message: "Öğrenci bulunamadı" }, { status: 404 });
  if (result.kind === "forbidden") return NextResponse.json({ message: "Bu öğrencinin velisi değilsiniz" }, { status: 403 });
  if (result.kind === "missing_teacher") return NextResponse.json({ message: "Öğretmen seçilmedi" }, { status: 400 });
  if (result.kind === "teacher_not_found") return NextResponse.json({ message: "Öğretmen bulunamadı" }, { status: 404 });
  if (result.kind === "no_parent") return NextResponse.json({ message: "Öğrencinin velisi bulunamadı" }, { status: 400 });

  // Karşı tarafa bildirim (best-effort)
  const { sendPushToUser } = await import("@/lib/push");
  void sendPushToUser(result.otherUserId, `Yeni mesaj: ${result.subject}`, "Size yeni bir mesaj gönderildi.", { type: "conversation", conversationId: result.id }).catch(() => {});

  return NextResponse.json({ id: result.id }, { status: 201 });
}
