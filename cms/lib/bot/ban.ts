import { MemoryRateLimitStore, resolveRateLimitStore } from "../ratelimit";

/**
 * Eskalerende midlertidige bans + en grov lokal sidegrænse til proxy.ts.
 *
 *  - recordStrike(ip): tæller "strikes" (ondsindede stier, fejlslagne forsøg) i 24 timer og lægger en ban på ved
 *    4 / 8 / 16 strikes (10 min / 1 time / 24 timer). Strikes og bans ligger i rate-limit-storen (Redis i produktion,
 *    så de gælder alle replicas), med en lille lokal cache så en normal sidevisning ikke koster et Redis-opslag.
 *  - Aldrig ban "unknown" (ukendt IP): ellers ville én scanner låse alle ude.
 *  - localPageLimit(): grov, proces-lokal tæller pr. IP (hukommelse, ingen netværk). Cloudflare er det rigtige sted for
 *    præcise grænser; denne er et sikkerhedsnet hvis nogen omgår kanten.
 */

export const STRIKE_WINDOW_MS = 24 * 3_600_000;
export const BAN_STEPS: ReadonlyArray<{ strikes: number; ms: number }> = [
  { strikes: 4, ms: 10 * 60_000 },
  { strikes: 8, ms: 60 * 60_000 },
  { strikes: 16, ms: 24 * 3_600_000 },
];

type CacheState = { bannedUntil: Map<string, number>; clearUntil: Map<string, number>; local: MemoryRateLimitStore };
const g = globalThis as unknown as { __banCache?: CacheState };
function cache(): CacheState {
  return (g.__banCache ??= { bannedUntil: new Map(), clearUntil: new Map(), local: new MemoryRateLimitStore() });
}

const NEGATIVE_CACHE_MS = 5_000;
const MAX_CACHE = 20_000;

function trim(map: Map<string, number>, now: number) {
  if (map.size < MAX_CACHE) return;
  for (const [k, v] of map) if (v <= now) map.delete(k);
  if (map.size >= MAX_CACHE) map.clear();
}

export function banDurationForStrikes(strikes: number): number {
  let ms = 0;
  for (const step of BAN_STEPS) if (strikes >= step.strikes) ms = step.ms;
  return ms;
}

export async function isBanned(ip: string, now = Date.now()): Promise<boolean> {
  if (!ip || ip === "unknown") return false;
  const c = cache();
  const until = c.bannedUntil.get(ip);
  if (until && until > now) return true;
  const clear = c.clearUntil.get(ip);
  if (clear && clear > now) return false;
  try {
    const store = await resolveRateLimitStore();
    const hit = await store.peek(`ban:${ip}`, now);
    if (hit && hit.resetAt > now) {
      c.bannedUntil.set(ip, hit.resetAt);
      trim(c.bannedUntil, now);
      return true;
    }
  } catch {
    /* fejl åbent */
  }
  c.clearUntil.set(ip, now + NEGATIVE_CACHE_MS);
  trim(c.clearUntil, now);
  return false;
}

export async function recordStrike(ip: string, now = Date.now()): Promise<{ strikes: number; banMs: number }> {
  if (!ip || ip === "unknown") return { strikes: 0, banMs: 0 };
  try {
    const store = await resolveRateLimitStore();
    const { count } = await store.hit(`strike:${ip}`, STRIKE_WINDOW_MS, now);
    const banMs = banDurationForStrikes(count);
    if (banMs > 0) {
      const existing = await store.peek(`ban:${ip}`, now);
      if (!existing || existing.resetAt <= now) {
        await store.hit(`ban:${ip}`, banMs, now);
        const c = cache();
        c.bannedUntil.set(ip, now + banMs);
        c.clearUntil.delete(ip);
      }
    }
    return { strikes: count, banMs };
  } catch {
    return { strikes: 0, banMs: 0 };
  }
}

/** Proces-lokal sidegrænse pr. IP og minut. Returnerer true hvis forespørgslen er inden for grænsen. */
export function localPageLimit(ip: string, limit: number, now = Date.now()): { ok: boolean; retryAfterSec: number } {
  if (!ip || ip === "unknown") return { ok: true, retryAfterSec: 0 };
  const { count, resetAt } = cache().local.hit(`page:${ip}`, 60_000, now) as { count: number; resetAt: number };
  return { ok: count <= limit, retryAfterSec: Math.max(1, Math.ceil((resetAt - now) / 1000)) };
}

export function resetBanStateForTests() {
  g.__banCache = undefined;
}
