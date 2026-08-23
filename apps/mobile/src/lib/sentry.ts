/**
 * Sentry hata izleme — EXPO_PUBLIC_SENTRY_DSN tanımlıysa etkinleşir, yoksa
 * hiçbir şey yapmaz (dev/test'te sessiz). DSN'i sentry.io'da bir React Native
 * projesi açıp alın; apps/mobile/.env'e ekleyin:
 *   EXPO_PUBLIC_SENTRY_DSN=https://xxxx@oxxxx.ingest.sentry.io/xxxx
 */
import * as Sentry from '@sentry/react-native';

const DSN = process.env.EXPO_PUBLIC_SENTRY_DSN;

export function initSentry() {
  if (!DSN) return;
  Sentry.init({
    dsn: DSN,
    // Üretimde performans örneklemesini düşük tut; hata izleme her zaman %100.
    tracesSampleRate: 0.2,
    // PII göndermemek için varsayılan kapalı (KVKK).
    sendDefaultPii: false,
  });
}

/** Oturum açan kullanıcının rolünü etiketler (kimlik/PII değil). */
export function setSentryUser(role?: string, id?: string) {
  if (!DSN) return;
  Sentry.setUser(id ? { id } : null);
  if (role) Sentry.setTag('role', role);
}

export const wrapWithSentry = DSN ? Sentry.wrap : <T,>(c: T) => c;
