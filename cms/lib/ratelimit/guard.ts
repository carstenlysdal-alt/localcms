import { headers } from "next/headers";
import { getClientIp, rateLimit, type FailMode } from "./index";
import { turnstileTokenFrom, verifyTurnstile } from "../turnstile";

export type GuardResult = { ok: true; ip: string } | { ok: false; error: string; ip: string };

/**
 * Fælles port foran offentlige server actions: rate limit pr. IP + honeypot.
 * Returnerer en brugervenlig fejl (dansk), som actionen sender videre uændret.
 * Honeypot-hit returnerer ok:false med neutral tekst (bots belønnes ikke med detaljer).
 */
export async function guardPublicAction(options: {
  action: string;
  limit?: number;
  windowMs?: number;
  honeypot?: unknown;
  /**
   * Turnstile: giv FormData eller formularobjektet (feltet `cf-turnstile-response` læses). Kun tjekket når
   * TURNSTILE_SECRET_KEY er sat; ellers ignoreret. Udelades på token-beskyttede svar-actions (tokenet er selv adgangsbeviset).
   */
  captcha?: unknown;
  /** Standard "closed": er den delte rate-limit-store nede, afvises kaldet (skrive-endpoints). */
  failMode?: FailMode;
}): Promise<GuardResult> {
  let ip = "unknown";
  try {
    ip = getClientIp(await headers());
  } catch {
    // uden request-kontekst (test) — brug fælles bucket
  }
  if (typeof options.honeypot === "string" && options.honeypot.trim() !== "") {
    return { ok: false, ip, error: "Indsendelsen kunne ikke valideres." };
  }
  const result = await rateLimit({
    bucket: `pub:${options.action}`,
    key: ip,
    limit: options.limit ?? 10,
    windowMs: options.windowMs ?? 10 * 60_000,
    failMode: options.failMode ?? "closed",
  });
  if (!result.ok) {
    return {
      ok: false,
      ip,
      error: result.degraded
        ? "Tjenesten er midlertidigt optaget. Prøv igen om et øjeblik."
        : "Du har sendt for mange forespørgsler. Vent et par minutter og prøv igen.",
    };
  }
  // Turnstile (no-op uden TURNSTILE_SECRET_KEY). Efter rate limit, så bots ikke kan brænde Cloudflare-kald af.
  const human = await verifyTurnstile(turnstileTokenFrom(options.captcha), ip);
  if (!human.ok) {
    return { ok: false, ip, error: "Vi kunne ikke bekræfte at du er et menneske. Genindlæs siden og prøv igen." };
  }
  return { ok: true, ip };
}
