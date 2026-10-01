/**
 * Origin-lås: når ORIGIN_SECRET er sat (produktion), afviser proxy.ts alt der ikke bærer headeren
 * `x-origin-secret: <hemmeligheden>`. Cloudflare tilføjer headeren via en Transform Rule (Modify Request Header),
 * så kun trafik der er gået gennem Cloudflare når Node. Det er det der gør det sikkert at stole på CF-Connecting-IP.
 * Undtagelser: /api/health, /api/ready (platformens healthcheck kommer ikke fra Cloudflare) og /api/cron/* (egen CRON_SECRET).
 *
 * Alternativ/supplement: Cloudflare Authenticated Origin Pulls (mTLS) kræver en origin der terminerer TLS selv, hvilket
 * Railway ikke gør — derfor headeren.
 */

export const ORIGIN_SECRET_HEADER = "x-origin-secret";

const EXEMPT_EXACT = new Set(["/api/health", "/api/ready"]);
const EXEMPT_PREFIX = ["/api/cron/"];

export function isOriginLockExempt(pathname: string): boolean {
  if (EXEMPT_EXACT.has(pathname.replace(/\/$/, ""))) return true;
  return EXEMPT_PREFIX.some((p) => pathname.startsWith(p));
}

/** Konstant-tids strengsammenligning (ingen early exit; længdeforskel indgår også i resultatet). */
export function safeEqualStrings(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const x = enc.encode(a);
  const y = enc.encode(b);
  const len = Math.max(x.length, y.length);
  let diff = x.length ^ y.length;
  for (let i = 0; i < len; i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

export type OriginLockInput = {
  secret: string | undefined;
  isProduction: boolean;
  pathname: string;
  headerValue: string | null | undefined;
};

/** true = forespørgslen må passere. Låsen er kun aktiv i produktion med en sat hemmelighed. */
export function originLockAllows(i: OriginLockInput): boolean {
  if (!i.isProduction || !i.secret) return true;
  if (isOriginLockExempt(i.pathname)) return true;
  if (!i.headerValue) return false;
  return safeEqualStrings(i.headerValue, i.secret);
}
