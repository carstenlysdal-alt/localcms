import { headers } from "next/headers";
import { getClientIp, rateLimit } from "./ratelimit";

/** Klient-IP til rate limit/revisionsspor; "unknown" uden request-kontekst (tests, scripts). */
export async function requestIp(): Promise<string> {
  try {
    return getClientIp(await headers());
  } catch {
    return "unknown";
  }
}

/**
 * Rate limit for indloggede administrative actions: pr. bruger OG pr. IP, fail-closed (er den delte store nede, afvises kaldet).
 * Returnerer en dansk fejltekst ved afvisning, ellers null.
 */
export async function guardAdminAction(options: {
  action: string;
  userId: string;
  limit?: number;
  windowMs?: number;
}): Promise<string | null> {
  const windowMs = options.windowMs ?? 10 * 60_000;
  const limit = options.limit ?? 30;
  const ip = await requestIp();
  const byUser = await rateLimit({ bucket: `admin:${options.action}:user`, key: options.userId, limit, windowMs, failMode: "closed" });
  const byIp = await rateLimit({ bucket: `admin:${options.action}:ip`, key: ip, limit: limit * 4, windowMs, failMode: "closed" });
  const blocked = [byUser, byIp].find((r) => !r.ok);
  if (!blocked) return null;
  return blocked.degraded
    ? "Tjenesten er midlertidigt optaget. Prøv igen om et øjeblik."
    : "Du har lavet for mange forsøg på kort tid. Vent et par minutter, og prøv igen.";
}
