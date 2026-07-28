export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * Tüm `/api/...` route'ları aynı origin'de olduğu için tarayıcı, oturum
 * çerezini (`seviye360_session`, bkz. lib/auth.ts) her istekte otomatik
 * gönderir — ayrıca bir Authorization header'ı taşımaya gerek yoktur.
 * 401/403 dahil her hata gövdesindeki `message` alanı kullanıcıya
 * gösterilebilir Türkçe bir metindir (bkz. ilgili route.ts dosyaları).
 */
export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(res.status, typeof body.message === "string" ? body.message : `İstek başarısız oldu (HTTP ${res.status})`);
  }
  return body as T;
}
