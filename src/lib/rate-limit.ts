// src/lib/rate-limit.ts
// Petit rate-limit token bucket en mémoire (clé = ip+route)

export interface BucketState {
  tokens: number;
  lastRefill: number;
}

export class TokenBucketLimiter {
  private buckets = new Map<string, BucketState>();

  take(
    key: string,
    capacity = 5,
    windowMs = 60_000,
    now = Date.now(),
  ): boolean {
    const b = this.buckets.get(key) ?? { tokens: capacity, lastRefill: now };
    // Refill proportionnel
    if (now > b.lastRefill) {
      const elapsed = now - b.lastRefill;
      const refill = Math.floor((elapsed / windowMs) * capacity);
      if (refill > 0) {
        b.tokens = Math.min(capacity, b.tokens + refill);
        b.lastRefill = now;
      }
    }
    if (b.tokens > 0) {
      b.tokens -= 1;
      this.buckets.set(key, b);
      return true;
    }
    this.buckets.set(key, b);
    return false;
  }

  // Utilitaire test: permet de réinitialiser un seau
  reset(key?: string) {
    if (!key) this.buckets.clear();
    else this.buckets.delete(key);
  }
}

export const globalRateLimiter = new TokenBucketLimiter();

export function getClientIp(req: Request | { headers: Headers }) {
  const hdr = "x-forwarded-for";
  const xf = req.headers.get(hdr) || "";
  const ip = xf.split(",")[0]?.trim();
  return ip || "ip";
}

export type RateLimitOptions = { capacity?: number; windowMs?: number };

export function buildKey(ip: string, routeId: string) {
  return `${ip}|${routeId}`;
}

export function rateLimitByIpRoute(
  req: Request | { headers: Headers },
  routeId: string,
  opts: RateLimitOptions = {},
): boolean {
  const ip = getClientIp(req);
  const key = buildKey(ip, routeId);
  const capacity = opts.capacity ?? 5;
  const windowMs = opts.windowMs ?? 60_000;
  return globalRateLimiter.take(key, capacity, windowMs);
}

export function ensureRateLimit(
  req: Request | { headers: Headers },
  routeId: string,
  opts: RateLimitOptions = {},
): Response | null {
  const ok = rateLimitByIpRoute(
    req as Request | { headers: Headers },
    routeId,
    opts,
  );
  if (!ok) {
    return new Response("Trop de tentatives, réessayez plus tard", {
      status: 429,
    });
  }
  return null;
}
