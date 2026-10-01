import { headers } from "next/headers";
import { getClientIp, rateLimit } from "./index";

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
  });
  if (!result.ok) {
    return { ok: false, ip, error: "Du har sendt for mange forespørgsler. Vent et par minutter og prøv igen." };
  }
  return { ok: true, ip };
}
