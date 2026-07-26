import { NextRequest, NextResponse } from "next/server";
import { consumeRateLimit } from "@/lib/rate-limit";

/**
 * Tüm `/api/*` route'ları için IP bazlı genel rate limit — RLS README'de
 * "kalan gerçekçi adım" olarak işaretlenmiş boşluğu kapatır. `/api/auth/login`
 * için daha sıkı bir IP limiti uygulanır (brute-force'a karşı ilk savunma
 * hattı); hesap bazlı (e-posta) kilitlenme ise `/api/auth/login/route.ts`'te
 * — burada request body'sini okumak, downstream route handler'ın aynı body'yi
 * tekrar okuyamaması riskini taşırdı.
 */
function clientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}

export function middleware(request: NextRequest) {
  const ip = clientIp(request);
  const isLogin = request.nextUrl.pathname === "/api/auth/login";

  const result = isLogin
    ? consumeRateLimit(`login:ip:${ip}`, 20, 5 * 60 * 1000)
    : consumeRateLimit(`api:ip:${ip}`, 120, 60 * 1000);

  if (!result.allowed) {
    return NextResponse.json(
      { message: "Çok fazla istek gönderildi. Lütfen bir süre sonra tekrar deneyin." },
      { status: 429, headers: { "Retry-After": String(result.retryAfterSeconds) } },
    );
  }
  return NextResponse.next();
}

export const config = {
  matcher: "/api/:path*",
};
