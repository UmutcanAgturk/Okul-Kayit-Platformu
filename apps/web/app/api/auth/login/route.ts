import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { prismaSuperadmin } from "@/lib/prisma-superadmin";
import { createMfaToken, createSessionToken, verifyPassword, SESSION_COOKIE_NAME, SESSION_TTL_SECONDS } from "@/lib/auth";
import { peekRateLimit, recordAttempt } from "@/lib/rate-limit";

// Hesap bazlı kilitlenme: middleware.ts'teki IP bazlı limitten BAĞIMSIZ bir
// ikinci savunma hattı — dağıtık (çok-IP'li) bir credential-stuffing saldırısı
// tek bir hesaba karşı IP limitini es geçebilir. Yalnızca BAŞARISIZ denemeler
// sayılır; başarılı bir giriş sayaca dokunmaz (bkz. aşağıdaki recordAttempt çağrısı).
const LOGIN_EMAIL_LIMIT = 5;
const LOGIN_EMAIL_WINDOW_MS = 15 * 60 * 1000;

const NATIONAL_ID_RE = /^\d{11}$/;

/**
 * Gerçek kimlik doğrulama — bu depodaki ilk giriş endpoint'i.
 *
 * Öğrenci/Veli girişi artık T.C. Kimlik No + şifre iledir (User.email o iki
 * rol için yalnızca dahili/teknik bir alan, hiçbir zaman kullanıcıya
 * gösterilmez — bkz. lib/enrollment.ts ve enrollments/[id]/complete route'u).
 * Diğer roller (SUPERADMIN/BRANCH_ADMIN/ACCOUNTING/GUIDANCE_COORDINATOR/
 * TEACHER) hâlâ e-posta/kullanıcı adı ile girer. Tek bir "identifier" alanı
 * ile ikisi de kabul edilir:
 *   - 11 haneli TAMAMEN sayısal ise T.C. Kimlik No sayılır: önce
 *     StudentProfile.nationalId, bulunamazsa ParentProfile.nationalId
 *     üzerinden kullanıcı bulunur.
 *   - Aksi halde User.email ile bulunur — AMA bulunan kullanıcı STUDENT/
 *     PARENT ise reddedilir (e-postalarını bilseler bile bu yoldan
 *     giremezler — "yalnızca TC kimlik ve şifresiyle" kuralı burada uygulanır).
 * Kullanıcı bulunamasa/rol uygun olmasa bile aynı süre/mesajla yanıt
 * verilir — hangi TC/e-postanın sistemde kayıtlı olduğunu dışarıdan ayırt
 * edilemez kılmak için gerçek bir hash'e karşı (sabit, geçersiz bir hash)
 * doğrulama yapılır.
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const identifierRaw = typeof body.identifier === "string" ? body.identifier : typeof body.email === "string" ? body.email : null;
  const identifier = identifierRaw?.trim() ?? null;
  const password = typeof body.password === "string" ? body.password : null;

  if (!identifier || !password) {
    return NextResponse.json({ message: "Kullanıcı adı/T.C. Kimlik No ve şifre zorunludur" }, { status: 400 });
  }

  const rateLimitKey = `login:id:${identifier.toLowerCase()}`;
  const lockout = peekRateLimit(rateLimitKey, LOGIN_EMAIL_LIMIT, LOGIN_EMAIL_WINDOW_MS);
  if (!lockout.allowed) {
    return NextResponse.json(
      { message: "Çok fazla başarısız deneme. Lütfen bir süre sonra tekrar deneyin." },
      { status: 429, headers: { "Retry-After": String(lockout.retryAfterSeconds) } },
    );
  }

  let user: { id: string; email: string; passwordHash: string; role: UserRole; firstName: string; lastName: string; isActive: boolean; totpEnabled: boolean } | null = null;

  if (NATIONAL_ID_RE.test(identifier)) {
    // StudentProfile RLS ile korunur (tenant_isolation) — hangi tenant'a ait
    // olduğu henüz BİLİNMEDEN (kimlik doğrulanmadan) bir öğrenci/veli aramak
    // SUPERADMIN'in tüm tenant'ları görebildiği prismaSuperadmin (BYPASSRLS)
    // bağlantısını gerektirir; app_role bağlantısı app.tenant_id set edilmemiş
    // hiçbir isteği eşleştiremez (bkz. lib/db-context.ts'teki aynı gerekçe).
    const student = await prismaSuperadmin.studentProfile.findUnique({ where: { nationalId: identifier }, include: { user: true } });
    if (student) {
      user = student.user;
    } else {
      const parent = await prismaSuperadmin.parentProfile.findUnique({ where: { nationalId: identifier }, include: { user: true } });
      if (parent) user = parent.user;
    }
  } else {
    const byEmail = await prisma.user.findUnique({ where: { email: identifier } });
    // STUDENT/PARENT yalnızca T.C. Kimlik No ile girebilir — e-postalarını
    // bilseler bile bu yoldan asla oturum açamazlar.
    if (byEmail && byEmail.role !== UserRole.STUDENT && byEmail.role !== UserRole.PARENT) {
      user = byEmail;
    }
  }

  const passwordHash = user?.passwordHash ?? "$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinva";
  const isValid = await verifyPassword(password, passwordHash);

  if (!user || !user.isActive || !isValid) {
    recordAttempt(rateLimitKey, LOGIN_EMAIL_LIMIT, LOGIN_EMAIL_WINDOW_MS);
    return NextResponse.json({ message: "Kullanıcı adı/T.C. Kimlik No veya şifre hatalı" }, { status: 401 });
  }

  // Şifre doğru. Kullanıcının iki faktörlü doğrulaması açıksa, oturumu HENÜZ
  // açma — kısa ömürlü bir MFA token'ı dönüp TOTP kodunu iste (ikinci adım:
  // /api/auth/login/verify). Başarılı şifre girişi sayaca dokunmaz.
  if (user.totpEnabled) {
    return NextResponse.json({ mfaRequired: true, mfaToken: createMfaToken(user.id) });
  }

  const session = await prisma.userSession.create({
    data: { userId: user.id, expiresAt: new Date(Date.now() + SESSION_TTL_SECONDS * 1000) },
  });
  const token = createSessionToken(user.id, session.id);
  const response = NextResponse.json({
    user: { id: user.id, email: user.email, role: user.role, firstName: user.firstName, lastName: user.lastName },
  });
  response.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_TTL_SECONDS,
    path: "/",
  });
  return response;
}
