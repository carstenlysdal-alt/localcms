/**
 * Simpel rate limiter + "seen"-dedupe til offentlige endpoints og server actions.
 *
 * Standard-store er proces-lokal hukommelse (dev/én proces). Er REDIS_URL sat, oprettes automatisk en
 * delt Redis-store (lib/ratelimit/redis-store.ts) ved første brug; den falder tilbage til hukommelse
 * i 30 s efter gentagne Redis-fejl (circuit breaker). `setRateLimitStore()` overstyrer alt (tests, andre stores).
 *
 * Fejltilstand pr. kald (`failMode`):
 *   - "open" (standard, offentlige læsninger): Redis nede -> proces-lokal tæller, trafikken går igennem.
 *   - "closed" (login, indtag, token-actions): Redis nede -> afvis (retry-after 30 s). RATELIMIT_FAIL_CLOSED=0
 *     nedgraderer til proces-lokal håndhævelse.
 * Interfacet `RateLimitStore` er bevidst minimalt (atomisk `hit`, `peek`, `reset` + valgfri `firstSeen`).
 */

import { getClientIp as trustedGetClientIp } from "../client-ip";

export type RateLimitResult = {
  ok: boolean;
  limit: number;
  remaining: number;
  /** Sekunder til vinduet nulstilles (til Retry-After). */
  retryAfterSec: number;
  /** True hvis afvisningen skyldes at den delte store var nede (fail-closed), ikke at grænsen er nået. */
  degraded?: boolean;
};

/** Hvor længe en fail-closed-afvisning beder klienten vente. */
export const FAIL_CLOSED_RETRY_SEC = 30;

export type StoreHit = {
  count: number;
  resetAt: number;
  /** Sat af stores med fallback: tælleren kom fra reserve-hukommelsen fordi den delte store ikke svarede. */
  degraded?: boolean;
};

export type FailMode = "open" | "closed";

export interface RateLimitStore {
  /** Tæl ét hit i nøglens vindue og returnér ny tæller + vinduets udløb (epoch ms). */
  hit(key: string, windowMs: number, now: number): StoreHit | Promise<StoreHit>;
  /** Ryd (bruges af tests og lockout-reset). */
  reset(key: string): void | Promise<void>;
  /** Læs uden at tælle. */
  peek(key: string, now: number): { count: number; resetAt: number } | null | Promise<{ count: number; resetAt: number } | null>;
  /** Valgfri atomisk dedupe (Redis: SET NX PX). Returnerer true første gang nøglen ses i vinduet. */
  firstSeen?(key: string, windowMs: number, now: number): boolean | Promise<boolean>;
  /** Valgfri: true mens storen kører på fallback (circuit breaker åben). */
  isDegraded?(): boolean;
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

// Tilstanden ligger på globalThis, så proxy.ts, route handlers og server actions (separate bundles) deler den.
const globalForRl = globalThis as unknown as {
  __rateLimitStore?: RateLimitStore;
  __rateLimitStoreExplicit?: boolean;
  __rateLimitStoreInit?: Promise<void>;
};
globalForRl.__rateLimitStore ??= new MemoryRateLimitStore();

export function setRateLimitStore(next: RateLimitStore) {
  globalForRl.__rateLimitStore = next;
  globalForRl.__rateLimitStoreExplicit = true;
}

export function getRateLimitStore(): RateLimitStore {
  return globalForRl.__rateLimitStore as RateLimitStore;
}

/**
 * Sikrer at den rigtige store er valgt: har nogen kaldt setRateLimitStore() bruges den; ellers oprettes en
 * Redis-store én gang når REDIS_URL er sat (og RATELIMIT_STORE ikke er "memory"). Aldrig fejl: ved problemer bliver
 * hukommelses-storen stående.
 */
export async function resolveRateLimitStore(): Promise<RateLimitStore> {
  if (!globalForRl.__rateLimitStoreExplicit) {
    globalForRl.__rateLimitStoreInit ??= (async () => {
      const url = process.env.REDIS_URL;
      if (!url || process.env.RATELIMIT_STORE === "memory") return;
      try {
        const { createRedisStoreFromEnv } = await import("./redis-init");
        const redisStore = await createRedisStoreFromEnv(url);
        if (redisStore && !globalForRl.__rateLimitStoreExplicit) globalForRl.__rateLimitStore = redisStore;
      } catch (error) {
        console.error("[ratelimit] Redis kunne ikke initialiseres – bruger hukommelse:", error instanceof Error ? error.message : error);
      }
    })();
    await globalForRl.__rateLimitStoreInit;
  }
  return getRateLimitStore();
}

function failClosedEnabled(): boolean {
  return process.env.RATELIMIT_FAIL_CLOSED !== "0";
}

/** Kaldes af tests: glem lazy-init-tilstand og vælg hukommelse igen. */
export function resetRateLimitStoreForTests() {
  globalForRl.__rateLimitStore = new MemoryRateLimitStore();
  globalForRl.__rateLimitStoreExplicit = false;
  globalForRl.__rateLimitStoreInit = undefined;
}

export type RateLimitOptions = {
  /** Logisk bucket-navn, fx "ads-track" — adskiller grænser fra hinanden. */
  bucket: string;
  /** Identitet: typisk IP, bruger-id eller visitor-hash. */
  key: string;
  limit: number;
  windowMs: number;
  /** "open" (standard): tæl lokalt når den delte store er nede. "closed": afvis (login/indtag/token-actions). */
  failMode?: FailMode;
  /** Test-hook. */
  now?: number;
};

export async function rateLimit(options: RateLimitOptions): Promise<RateLimitResult> {
  const now = options.now ?? Date.now();
  const store = await resolveRateLimitStore();
  let hit: StoreHit;
  try {
    hit = await store.hit(`${options.bucket}:${options.key}`, options.windowMs, now);
  } catch {
    // En custom store må ikke vælte kaldet: behandl som nedbrud.
    hit = { count: 1, resetAt: now + options.windowMs, degraded: true };
  }
  if (hit.degraded && options.failMode === "closed" && failClosedEnabled()) {
    return { ok: false, limit: options.limit, remaining: 0, retryAfterSec: FAIL_CLOSED_RETRY_SEC, degraded: true };
  }
  const ok = hit.count <= options.limit;
  return {
    ok,
    limit: options.limit,
    remaining: Math.max(0, options.limit - hit.count),
    retryAfterSec: Math.max(1, Math.ceil((hit.resetAt - now) / 1000)),
  };
}

/**
 * Dedupe: returnerer true første gang nøglen ses i vinduet, ellers false.
 * Bruges til "tæl kun én visning pr. besøgende pr. artikel pr. 30 min".
 * Fejler åbent: hvis storen er nede tælles pr. instans.
 */
export async function firstSeen(bucket: string, key: string, windowMs: number, now = Date.now()): Promise<boolean> {
  const store = await resolveRateLimitStore();
  const full = `seen:${bucket}:${key}`;
  try {
    if (store.firstSeen) return await store.firstSeen(full, windowMs, now);
    const { count } = await store.hit(full, windowMs, now);
    return count === 1;
  } catch {
    return true;
  }
}

/**
 * Klient-IP fra betroede kilder (se lib/client-ip.ts: TRUST_CLOUDFLARE / TRUSTED_PROXY_HOPS). IPv6 reduceres til /64.
 * Re-eksporteret her, så alle eksisterende kaldere automatisk får den sikre udledning.
 */
export const getClientIp = trustedGetClientIp;

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
  const store = await resolveRateLimitStore();
  // Fail-closed: kan vi ikke tælle forsøg pålideligt (delt store nede), nægter vi loginforsøg frem for at åbne for brute force.
  if (store.isDegraded?.() && failClosedEnabled()) return true;
  const byEmail = await store.peek(`login-fail:email:${email}`, now);
  const byIp = await store.peek(`login-fail:ip:${ip}`, now);
  // IP-grænsen er højere, så et kontor-NAT ikke låser alle ude.
  return Boolean((byEmail && byEmail.count >= LOGIN_MAX_FAILURES) || (byIp && byIp.count >= LOGIN_MAX_FAILURES * 4));
}

export async function recordLoginFailure(email: string, ip: string, now = Date.now()) {
  const store = await resolveRateLimitStore();
  await store.hit(`login-fail:email:${email}`, LOGIN_WINDOW_MS, now);
  await store.hit(`login-fail:ip:${ip}`, LOGIN_WINDOW_MS, now);
}

export async function clearLoginFailures(email: string) {
  const store = await resolveRateLimitStore();
  await store.reset(`login-fail:email:${email}`);
}
