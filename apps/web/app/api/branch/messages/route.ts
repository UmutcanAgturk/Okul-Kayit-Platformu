import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { getSessionActor } from "@/lib/session";
import { effectiveTenantId, withBranchTenantContext } from "@/lib/db-context";
import { actorLabel, logActivity } from "@/lib/audit-log";

// task #58 — demo'daki MESSAGE_ATTACHMENT_MAX_CHARS ile aynı depolama sınırı
// ve PaymentReceipt'teki (bkz. app/api/students/[studentId]/payment-receipts)
// ile aynı allowlist deseni, demo'nun "PDF, Görsel, Ses" kapsamına genişletildi.
const ACCEPTED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
  "audio/mpeg",
  "audio/wav",
  "audio/ogg",
  "audio/webm",
];
const MAX_DATA_URL_LENGTH = 3_500_000;
const MAX_ATTACHMENTS_PER_MESSAGE = 5;

/**
 * İletişim — demo'daki `createMessage()`'ın gönderme tarafı. Demo'nun
 * SMS/e-posta kanalları ve dosya ekleri yalnızca SİMÜLASYONDUR (gerçek bir
 * sağlayıcı yok) — bu ilk sürüm bu yüzden yalnızca uygulama-içi mesajlaşmayı
 * gerçek veriye bağlar. Discipline/Devamsızlık ile aynı yetki deseni:
 * `TEACHER` tüm tenant'a erişebilir (öğretmen-sınıf ataması modeli bu
 * depoda hiç yok — bkz. README'deki "Öğretmen Performans Paneli" notu),
 * bu yüzden demo'daki "yalnızca kendinize atanmış öğrenci/veli" kısıtı
 * burada uygulanamaz; TEACHER, ALL_STUDENTS/ALL_GUARDIANS hedefleyebilir
 * ama ALL_TEACHERS/ALL_STAFF hedefleyemez (yalnızca BRANCH_ADMIN).
 */
const ROLES_ALLOWED: UserRole[] = [UserRole.BRANCH_ADMIN, UserRole.TEACHER];
type Audience = "ALL_STUDENTS" | "ALL_GUARDIANS" | "ALL_TEACHERS" | "ALL_STAFF";
const AUDIENCE_VALUES: Audience[] = ["ALL_STUDENTS", "ALL_GUARDIANS", "ALL_TEACHERS", "ALL_STAFF"];
const AUDIENCE_LABEL: Record<Audience, string> = {
  ALL_STUDENTS: "Öğrenciler",
  ALL_GUARDIANS: "Veliler",
  ALL_TEACHERS: "Öğretmenler",
  ALL_STAFF: "Personel",
};

export async function GET(request: NextRequest) {
  const actor = await getSessionActor(request);
  if (!actor) {
    return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  }
  if (!ROLES_ALLOWED.includes(actor.role) && !(actor.role === UserRole.SUPERADMIN && actor.actingTenantId)) {
    return NextResponse.json({ message: "Bu rol gönderilen mesajları göremez" }, { status: 403 });
  }

  const messages = await withBranchTenantContext(actor, (tx) =>
    tx.message.findMany({
      where: { senderUserId: actor.id },
      include: { _count: { select: { recipients: true } }, attachments: true },
      orderBy: { createdAt: "desc" },
    }),
  );

  return NextResponse.json({
    messages: messages.map((m) => ({
      id: m.id,
      title: m.title,
      body: m.body,
      audienceLabel: m.audienceLabel,
      recipientCount: m._count.recipients,
      createdAt: m.createdAt.toISOString(),
      attachments: m.attachments.map((a) => ({ id: a.id, fileName: a.fileName, mimeType: a.mimeType, dataUrl: a.dataUrl })),
    })),
  });
}

export async function POST(request: NextRequest) {
  const actor = await getSessionActor(request);
  if (!actor) {
    return NextResponse.json({ message: "Oturum açmanız gerekiyor" }, { status: 401 });
  }
  if (!ROLES_ALLOWED.includes(actor.role) && !(actor.role === UserRole.SUPERADMIN && actor.actingTenantId)) {
    return NextResponse.json({ message: "Bu rol mesaj gönderemez" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  const messageBody = typeof body?.body === "string" ? body.body.trim() : "";
  const audience = body?.audience as Audience;
  const classroomId = typeof body?.classroomId === "string" && body.classroomId ? body.classroomId : null;
  const rawAttachments = Array.isArray(body?.attachments) ? body.attachments : [];

  if (!title || !messageBody || !AUDIENCE_VALUES.includes(audience)) {
    return NextResponse.json({ message: "Başlık, mesaj ve geçerli bir hedef kitle zorunludur" }, { status: 400 });
  }
  if (rawAttachments.length > MAX_ATTACHMENTS_PER_MESSAGE) {
    return NextResponse.json({ message: `En fazla ${MAX_ATTACHMENTS_PER_MESSAGE} dosya eklenebilir` }, { status: 400 });
  }
  const attachments: { fileName: string; mimeType: string; dataUrl: string }[] = [];
  for (const a of rawAttachments) {
    const fileName = typeof a?.fileName === "string" && a.fileName.trim() ? a.fileName.trim() : null;
    const mimeType = typeof a?.mimeType === "string" ? a.mimeType : null;
    const dataUrl = typeof a?.dataUrl === "string" ? a.dataUrl : null;
    if (!fileName || !mimeType || !dataUrl) {
      return NextResponse.json({ message: "Her ek için fileName, mimeType ve dataUrl zorunludur" }, { status: 400 });
    }
    if (!ACCEPTED_MIME_TYPES.includes(mimeType)) {
      return NextResponse.json({ message: `Desteklenmeyen dosya türü: ${mimeType}` }, { status: 400 });
    }
    if (dataUrl.length > MAX_DATA_URL_LENGTH) {
      return NextResponse.json({ message: `"${fileName}" dosyası çok büyük (limit ~2,5MB)` }, { status: 400 });
    }
    attachments.push({ fileName, mimeType, dataUrl });
  }
  if (actor.role === UserRole.TEACHER && (audience === "ALL_TEACHERS" || audience === "ALL_STAFF")) {
    return NextResponse.json({ message: "Öğretmenler yalnızca öğrenci/veli hedefleyebilir" }, { status: 403 });
  }

  const result = await withBranchTenantContext(actor, async (tx) => {
    if (classroomId) {
      const classroom = await tx.classroom.findUnique({ where: { id: classroomId } });
      if (!classroom) return { error: "Sınıf bulunamadı" as const };
    }

    let recipientUserIds: string[] = [];
    let audienceLabel = AUDIENCE_LABEL[audience];

    if (audience === "ALL_STUDENTS" || audience === "ALL_GUARDIANS") {
      const students = await tx.studentProfile.findMany({
        where: classroomId ? { classroomId } : {},
        include: { guardians: { include: { parent: true } } },
      });
      if (classroomId) {
        const classroom = await tx.classroom.findUnique({ where: { id: classroomId } });
        audienceLabel = `${classroom!.name} Sınıfı ${audienceLabel}`;
      }
      if (audience === "ALL_STUDENTS") {
        recipientUserIds = students.map((s) => s.userId);
      } else {
        const ids = new Set<string>();
        for (const s of students) {
          for (const g of s.guardians) ids.add(g.parent.userId);
        }
        recipientUserIds = Array.from(ids);
      }
    } else if (audience === "ALL_TEACHERS") {
      const teachers = await tx.teacherProfile.findMany({ where: { user: { role: UserRole.TEACHER } }, select: { userId: true } });
      recipientUserIds = teachers.map((t) => t.userId);
    } else {
      const staff = await tx.staffProfile.findMany({ select: { userId: true } });
      recipientUserIds = staff.map((s) => s.userId);
    }

    recipientUserIds = recipientUserIds.filter((id) => id !== actor.id);

    const message = await tx.message.create({
      data: {
        tenantId: effectiveTenantId(actor),
        senderUserId: actor.id,
        senderLabel: actorLabel(actor),
        title,
        body: messageBody,
        audienceLabel,
        recipients: { createMany: { data: recipientUserIds.map((userId) => ({ userId })) } },
        attachments: { createMany: { data: attachments } },
      },
      include: { attachments: true },
    });

    await logActivity(tx, {
      tenantId: effectiveTenantId(actor),
      actorUserId: actor.id,
      actorLabel: actorLabel(actor),
      action: "Mesaj gönderildi",
      detail: `${title} — ${audienceLabel} (${recipientUserIds.length} kişi)`,
    });

    return { message, recipientCount: recipientUserIds.length };
  });

  if ("error" in result) {
    return NextResponse.json({ message: result.error }, { status: 404 });
  }

  return NextResponse.json(
    {
      message: {
        id: result.message.id,
        title: result.message.title,
        body: result.message.body,
        audienceLabel: result.message.audienceLabel,
        recipientCount: result.recipientCount,
        createdAt: result.message.createdAt.toISOString(),
        attachments: result.message.attachments.map((a) => ({ id: a.id, fileName: a.fileName, mimeType: a.mimeType, dataUrl: a.dataUrl })),
      },
    },
    { status: 201 },
  );
}
