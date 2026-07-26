/**
 * Basit, bellek içi sabit pencereli (fixed-window) rate limiter.
 *
 * SINIR: bu, tek bir Node.js sürecinin belleğinde tutulur — bu projenin
 * dağıtım modeliyle (`next start`, tek süreç; bkz. kök README "Yerel
 * Geliştirme") tutarlıdır. Yatay olarak ölçeklenip birden fazla süreç/edge
 * bölgesi arkasına konursa (örn. Vercel'in dağıtık Edge Middleware'i), her
 * örnek kendi sayaç kümesini tutar ve gerçek limit örnek sayısıyla çarpılmış
 * olur — o senaryoda paylaşılan bir depo (Redis/Upstash) gerekir.
 */
interface Bucket {
  count: number;
  resetAt: number;
  limit: number;
}

const buckets = new Map<string, Bucket>();
let opsSinceSweep = 0;

function sweepExpired() {
  const now = Date.now();
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

function getBucket(key: string, limit: number, windowMs: number): Bucket {
  opsSinceSweep += 1;
  if (opsSinceSweep >= 500) {
    opsSinceSweep = 0;
    sweepExpired();
  }

  const now = Date.now();
  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    const fresh: Bucket = { count: 0, resetAt: now + windowMs, limit };
    buckets.set(key, fresh);
    return fresh;
  }
  return existing;
}

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

/** Sayaç doluysa reddeder; izin verilirse sayacı bir artırır. */
export function consumeRateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const bucket = getBucket(key, limit, windowMs);
  if (bucket.count >= bucket.limit) {
    return { allowed: false, retryAfterSeconds: Math.ceil((bucket.resetAt - Date.now()) / 1000) };
  }
  bucket.count += 1;
  return { allowed: true, retryAfterSeconds: 0 };
}

/** Sayacı ARTIRMADAN yalnızca doluluk durumuna bakar (ön kontrol için). */
export function peekRateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const bucket = getBucket(key, limit, windowMs);
  if (bucket.count >= bucket.limit) {
    return { allowed: false, retryAfterSeconds: Math.ceil((bucket.resetAt - Date.now()) / 1000) };
  }
  return { allowed: true, retryAfterSeconds: 0 };
}

/** Sayacı bir artırır (örn. login route'unun başarısız denemeleri saymasında). */
export function recordAttempt(key: string, limit: number, windowMs: number): void {
  const bucket = getBucket(key, limit, windowMs);
  bucket.count += 1;
}
