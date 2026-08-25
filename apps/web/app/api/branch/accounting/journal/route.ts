import { NextRequest, NextResponse } from "next/server";
import { JournalSource, UserRole } from "@prisma/client";
import { getSessionActor } from "@/lib/session";
import { effectiveTenantId, withBranchTenantContext } from "@/lib/db-context";
import { actorLabel, logActivity } from "@/lib/audit-log";
import { JournalUnbalancedError, postJournal } from "@/lib/accounting/posting";

/**
 * Yevmiye Defteri. GET: fiş listesi (satırlarıyla). POST: elle DENGELİ fiş
 * girişi (Σborç = Σalacak zorunlu). RLS: tenant + rol.
 */
const ROLES_ALLOWED: UserRole[] = [UserRole.BRANCH_ADMIN, UserRole.ACCOUNTING];

function guard(actor: { role: UserRole; actingTenantId?: string | null } | null) {
  if (!actor) return { ok: false as const, status: 401, message: "Oturum açmanız gerekiyor" };
  if (!ROLES_ALLOWED.includes(actor.role) && !(actor.role === UserRole.SUPERADMIN && actor.actingTenantId)) {
    return { ok: false as const, status: 403, message: "Bu rol Muhasebe'ye erişemez" };
  }
  return { ok: true as const };
}

export async function GET(request: NextRequest) {
  const actor = await getSessionActor(request);
  const g = guard(actor);
  if (!g.ok) return NextResponse.json({ message: g.message }, { status: g.status });

  const from = request.nextUrl.searchParams.get("from");
  const to = request.nextUrl.searchParams.get("to");
  const entryDate =
    from || to
      ? { gte: from ? new Date(from) : undefined, lte: to ? new Date(`${to}T23:59:59`) : undefined }
      : undefined;

  const entries = await withBranchTenantContext(actor!, (tx) =>
    tx.journalEntry.findMany({
      where: { entryDate },
      orderBy: [{ entryDate: "desc" }, { no: "desc" }],
      take: 500,
      include: { lines: { include: { account: { select: { code: true, name: true } } } } },
    }),
  );

  return NextResponse.json({
    entries: entries.map((e) => ({
      id: e.id,
      no: e.no,
      entryDate: e.entryDate.toISOString(),
      description: e.description,
      source: e.source,
      lines: e.lines.map((l) => ({
        accountCode: l.account.code,
        accountName: l.account.name,
        debit: Number(l.debit),
        credit: Number(l.credit),
        description: l.description,
      })),
      totalDebit: e.lines.reduce((s, l) => s + Number(l.debit), 0),
    })),
  });
}

export async function POST(request: NextRequest) {
  const actor = await getSessionActor(request);
  const g = guard(actor);
  if (!g.ok) return NextResponse.json({ message: g.message }, { status: g.status });

  const body = await request.json().catch(() => ({}));
  const description = typeof body.description === "string" && body.description.trim() ? body.description.trim() : null;
  const entryDate = typeof body.entryDate === "string" && body.entryDate.trim() ? new Date(body.entryDate) : null;
  const rawLines: unknown[] = Array.isArray(body.lines) ? body.lines : [];
  const lines = rawLines
    .map((l) => l as { code?: unknown; debit?: unknown; credit?: unknown; description?: unknown })
    .filter((l) => typeof l.code === "string")
    .map((l) => ({
      code: (l.code as string).trim(),
      debit: Number(l.debit) || 0,
      credit: Number(l.credit) || 0,
      description: typeof l.description === "string" ? l.description : undefined,
    }));

  if (!description || !entryDate || Number.isNaN(entryDate.getTime())) {
    return NextResponse.json({ message: "description ve entryDate zorunludur" }, { status: 400 });
  }
  if (lines.length < 2) {
    return NextResponse.json({ message: "En az iki satır (borç ve alacak) gerekir" }, { status: 400 });
  }

  try {
    const outcome = await withBranchTenantContext(actor!, async (tx) => {
      const id = await postJournal(tx, {
        tenantId: effectiveTenantId(actor!),
        entryDate,
        description,
        source: JournalSource.MANUEL,
        createdByUserId: actor!.id,
        lines,
      });
      await logActivity(tx, {
        tenantId: effectiveTenantId(actor!),
        actorUserId: actor!.id,
        actorLabel: actorLabel(actor!),
        action: "Yevmiye fişi girildi",
        detail: description,
      });
      return { id };
    });
    return NextResponse.json({ id: outcome.id }, { status: 201 });
  } catch (e) {
    if (e instanceof JournalUnbalancedError) {
      return NextResponse.json({ message: e.message }, { status: 400 });
    }
    if (e instanceof Error && /Hesap bulunamadı/.test(e.message)) {
      return NextResponse.json({ message: e.message }, { status: 400 });
    }
    return NextResponse.json({ message: "Fiş kaydedilemedi" }, { status: 500 });
  }
}
