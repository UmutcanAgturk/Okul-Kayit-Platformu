import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/auth";

// Yalnızca BU cihazın/bu çerezin temsil ettiği tek oturumu iptal eder — diğer
// cihazlarda açık olan oturumlar etkilenmez. Tüm cihazlardan çıkış için bkz.
// /api/auth/logout-all.
export async function POST(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const verified = token ? verifySessionToken(token) : null;
  if (verified) {
    await prisma.userSession.updateMany({
      where: { id: verified.sessionId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE_NAME, "", { httpOnly: true, sameSite: "lax", maxAge: 0, path: "/" });
  return response;
}
