/**
 * Simpel rate limiter + "seen"-dedupe til offentlige endpoints og server actions.
 *
 * VIGTIGT (drift): standard-store er proces-lokal hukommelse. Det er nok til
 * dev og én Node-proces, men IKKE til produktion på flere instanser/serverless:
 *   - hver instans har sin egen tæller (grænsen multipliceres med antal instanser)
 *   - tællere nulstilles ved genstart/deploy
 * I produktion skal der indsættes en delt store (Redis/Upstash eller en
 * Postgres-tabel med `INSERT … ON CONFLICT DO UPDATE`) via `setRateLimitStore()`.
 * Interfacet `RateLimitStore` er bevidst minimalt (en atomisk `hit`).
 */

export type RateLimitResult = {
  ok: boolean;
  limit: number;
  remaining: number;
  /** Sekunder til vinduet nulstilles (til Retry-After). */
  retryAfterSec: number;
};

export interface RateLimitStore {
  /** Tæl ét hit i nøglens vindue og returnér ny tæller + vinduets udløb (epoch ms). */
  hit(key: string, windowMs: number, now: number): { count: number; resetAt: number } | Promise<{ count: number; resetAt: number }>;
  /** Ryd (bruges af tests og lockout-reset). */
  reset(key: string): void | Promise<void>;
  /** Læs uden at tælle. */
  peek(key: string, now: number): { count: number; resetAt: number } | null | Promise<{ count: number; resetAt: number } | null>;
}

const MAX_KEYS = 50_000;

export class MemoryRateLimitStore implements RateLimitStore {
  private readonly buckets = new Map<string, { count: number; resetAt: number }>();
  private lastSweep = 0;

  hit(key: string, windowMs: number, now: number) {
    this.sweep(now);
    const current = this.buckets.get(key);
    if (!current || current.resetAt <= now) {
      const fresh = { count: 1, resetAt: now + windowMs };
      this.buckets.set(key, fresh);
      return { ...fresh };
    }
    current.count += 1;
    return { ...current };
  }

  reset(key: string) {
    this.buckets.delete(key);
  }

  peek(key: string, now: number) {
    const current = this.buckets.get(key);
    if (!current || current.resetAt <= now) return null;
    return { ...current };
  }

  size() {
    return this.buckets.size;
  }

  private sweep(now: number) {
    // Billig oprydning højst hvert 30. sekund, eller hvis kortet vokser for stort (forhindrer hukommelsesangreb).
    if (now - this.lastSweep < 30_000 && this.buckets.size < MAX_KEYS) return;
    this.lastSweep = now;
    for (const [key, bucket] of this.buckets) {
      if (bucket.resetAt <= now) this.buckets.delete(key);
    }
    if (this.buckets.size >= MAX_KEYS) {
      // Fail-safe: drop de ældste halvdel frem for at vokse ubegrænset.
      let toDrop = Math.floor(this.buckets.size / 2);
      for (const key of this.buckets.keys()) {
        if (toDrop-- <= 0) break;
        this.buckets.delete(key);
      }
    }
  }
}

const globalForRl = globalThis as unknown as { __rateLimitStore?: RateLimitStore };
let store: RateLimitStore = globalForRl.__rateLimitStore ?? (globalForRl.__rateLimitStore = new MemoryRateLimitStore());

export function setRateLimitStore(next: RateLimitStore) {
  store = next;
}

export function getRateLimitStore() {
  return store;
}

export type RateLimitOptions = {
  /** Logisk bucket-navn, fx "ads-track" — adskiller grænser fra hinanden. */
  bucket: string;
  /** Identitet: typisk IP, bruger-id eller visitor-hash. */
  key: string;
  limit: number;
  windowMs: number;
  /** Test-hook. */
  now?: number;
};

export async function rateLimit(options: RateLimitOptions): Promise<RateLimitResult> {
  const now = options.now ?? Date.now();
  const { count, resetAt } = await store.hit(`${options.bucket}:${options.key}`, options.windowMs, now);
  const ok = count <= options.limit;
  return {
    ok,
    limit: options.limit,
    remaining: Math.max(0, options.limit - count),
    retryAfterSec: Math.max(1, Math.ceil((resetAt - now) / 1000)),
  };
}

/**
 * Dedupe: returnerer true første gang nøglen ses i vinduet, ellers false.
 * Bruges til "tæl kun én visning pr. besøgende pr. artikel pr. 30 min".
 */
export async function firstSeen(bucket: string, key: string, windowMs: number, now = Date.now()): Promise<boolean> {
  const { count } = await store.hit(`seen:${bucket}:${key}`, windowMs, now);
  return count === 1;
}

/** Hent klient-IP fra proxy-headere. Kun pålidelig bag en betroet reverse proxy (Vercel/Cloudflare/nginx). */
export function getClientIp(headers: Pick<Headers, "get">): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first.slice(0, 64);
  }
  const real = headers.get("x-real-ip") ?? headers.get("cf-connecting-ip");
  if (real) return real.trim().slice(0, 64);
  return "unknown";
}

export function rateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    "X-RateLimit-Limit": String(result.limit),
    "X-RateLimit-Remaining": String(result.remaining),
    ...(result.ok ? {} : { "Retry-After": String(result.retryAfterSec) }),
  };
}

// ── Login-lockout (simpelt, pr. e-mail og pr. IP) ────────────────────────────

export const LOGIN_MAX_FAILURES = 5;
export const LOGIN_WINDOW_MS = 15 * 60_000;

export async function isLoginLocked(email: string, ip: string, now = Date.now()) {
  const byEmail = await store.peek(`login-fail:email:${email}`, now);
  const byIp = await store.peek(`login-fail:ip:${ip}`, now);
  // IP-grænsen er højere, så et kontor-NAT ikke låser alle ude.
  return Boolean((byEmail && byEmail.count >= LOGIN_MAX_FAILURES) || (byIp && byIp.count >= LOGIN_MAX_FAILURES * 4));
}

export async function recordLoginFailure(email: string, ip: string, now = Date.now()) {
  await store.hit(`login-fail:email:${email}`, LOGIN_WINDOW_MS, now);
  await store.hit(`login-fail:ip:${ip}`, LOGIN_WINDOW_MS, now);
}

export async function clearLoginFailures(email: string) {
  await store.reset(`login-fail:email:${email}`);
}
