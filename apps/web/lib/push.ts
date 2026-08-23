/**
 * Expo Push bildirim gönderimi. Bir kullanıcının kayıtlı tüm cihaz
 * token'larına (PushToken) Expo Push API üzerinden bildirim yollar.
 *
 * Token işlemleri RLS-bypass'lı prismaSuperadmin ile yapılır (PushToken
 * tablosu app_role'e kapalı — bkz. migration) çünkü tetikleyici, bildirimi
 * ALICI kullanıcıya (ör. veli) gönderirken onun token'larını okumak zorunda;
 * bu her zaman açık bir userId filtresiyle, sunucu-kontrollü yapılır.
 *
 * Yapılandırma gerektirmez — Expo Push API herkese açıktır; token yoksa
 * sessizce hiçbir şey yapmaz (best-effort, çağıran route'u asla düşürmez).
 */
import { prismaSuperadmin } from "@/lib/prisma-superadmin";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

export async function sendPushToUser(
  userId: string,
  title: string,
  body: string,
  data?: Record<string, unknown>,
): Promise<{ ok: boolean; sent: number }> {
  try {
    const tokens = await prismaSuperadmin.pushToken.findMany({ where: { userId }, select: { token: true } });
    if (tokens.length === 0) return { ok: false, sent: 0 };

    const messages = tokens.map((t) => ({
      to: t.token,
      title,
      body,
      sound: "default",
      ...(data ? { data } : {}),
    }));

    const res = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(messages),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return { ok: false, sent: 0 };

    // Expo, geçersiz token'lar için DeviceNotRegistered döndürür → temizle.
    const json = (await res.json().catch(() => null)) as { data?: { status: string; details?: { error?: string } }[] } | null;
    if (json?.data) {
      const dead: string[] = [];
      json.data.forEach((r, i) => {
        if (r.status === "error" && r.details?.error === "DeviceNotRegistered") dead.push(tokens[i].token);
      });
      if (dead.length) await prismaSuperadmin.pushToken.deleteMany({ where: { token: { in: dead } } });
    }
    return { ok: true, sent: tokens.length };
  } catch {
    return { ok: false, sent: 0 };
  }
}
