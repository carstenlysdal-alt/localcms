import { withTimeout } from "./resilience";

/**
 * Cloudflare Turnstile (valgfri captcha). Server-side verifikation mod siteverify.
 *
 *  - TURNSTILE_SECRET_KEY ikke sat  -> no-op (`ok: true, skipped: true`): udvikling og miljøer uden Turnstile virker som før.
 *  - Sat -> tokenet fra formularfeltet `cf-turnstile-response` SKAL være gyldigt. Timeout 2 s; ved netværksfejl/timeout
 *    fejler vi LUKKET (afviser), fordi en bot ellers bare kan få Cloudflare til at "timeout'e". Sæt TURNSTILE_FAIL_OPEN=1
 *    for at fejle åbent (fx hvis Cloudflares API har driftsforstyrrelser).
 *  - Test-nøgler (Cloudflares offentlige dummy-nøgler) virker uændret.
 */
export const TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
export const TURNSTILE_FIELD = "cf-turnstile-response";
const TIMEOUT_MS = 2000;
const MAX_TOKEN = 2048;

export type TurnstileResult =
  | { ok: true; skipped?: boolean }
  | { ok: false; reason: "missing-token" | "invalid" | "unavailable"; errors?: string[] };

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export function isTurnstileEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(env.TURNSTILE_SECRET_KEY);
}

export async function verifyTurnstile(
  token: unknown,
  ip?: string | null,
  options: { fetchImpl?: FetchLike; secret?: string; failOpen?: boolean; timeoutMs?: number } = {},
): Promise<TurnstileResult> {
  const secret = options.secret ?? process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return { ok: true, skipped: true };
  if (typeof token !== "string" || token.length === 0 || token.length > MAX_TOKEN) return { ok: false, reason: "missing-token" };

  const body = new URLSearchParams({ secret, response: token });
  if (ip && ip !== "unknown" && !ip.endsWith("/64")) body.set("remoteip", ip);
  const doFetch: FetchLike = options.fetchImpl ?? ((url, init) => fetch(url, init));
  const failOpen = options.failOpen ?? process.env.TURNSTILE_FAIL_OPEN === "1";

  try {
    const res = await withTimeout(
      (signal) => doFetch(TURNSTILE_VERIFY_URL, { method: "POST", body, signal, headers: { "content-type": "application/x-www-form-urlencoded" } }),
      options.timeoutMs ?? TIMEOUT_MS,
      "Turnstile",
    );
    if (!res.ok) return failOpen ? { ok: true, skipped: true } : { ok: false, reason: "unavailable" };
    const data = (await res.json()) as { success?: boolean; "error-codes"?: string[] };
    if (data.success === true) return { ok: true };
    return { ok: false, reason: "invalid", errors: Array.isArray(data["error-codes"]) ? data["error-codes"].slice(0, 5) : undefined };
  } catch {
    return failOpen ? { ok: true, skipped: true } : { ok: false, reason: "unavailable" };
  }
}

/** Hent tokenet fra FormData eller et almindeligt objekt (server actions bruger begge dele). */
export function turnstileTokenFrom(source: unknown): unknown {
  if (!source) return undefined;
  if (typeof FormData !== "undefined" && source instanceof FormData) return source.get(TURNSTILE_FIELD) ?? undefined;
  if (typeof source === "object") return (source as Record<string, unknown>)[TURNSTILE_FIELD];
  return undefined;
}
