import { getClientIp, rateLimit } from "@/lib/ratelimit";

/**
 * POST /api/csp-report — modtager CSP-overtrædelsesrapporter (report-uri) fra browsere.
 * Altid 204 (lækker intet). Rate limit pr. IP, body ≤ 8 KB, kun ét kompakt logfelt pr. rapport (ingen fuld URL med query).
 */
const MAX_BYTES = 8 * 1024;

export async function POST(req: Request) {
  const ip = getClientIp(req.headers);
  const limited = await rateLimit({ bucket: "csp-report", key: ip, limit: 30, windowMs: 60_000 });
  if (!limited.ok) return new Response(null, { status: 204 });

  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > MAX_BYTES) return new Response(null, { status: 204 });
  try {
    const text = await req.text();
    if (text.length > MAX_BYTES) return new Response(null, { status: 204 });
    const json = JSON.parse(text) as Record<string, unknown>;
    const body = (Array.isArray(json) ? (json[0] as Record<string, unknown>)?.body : (json["csp-report"] ?? json)) as Record<string, unknown> | undefined;
    if (body && typeof body === "object") {
      const pick = (k: string) => String(body[k] ?? body[k.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase())] ?? "").slice(0, 200);
      const strip = (u: string) => u.split("?")[0].split("#")[0];
      console.warn(
        `[csp] directive=${pick("violated-directive") || pick("effective-directive")} blocked=${strip(pick("blocked-uri") || pick("blockedURL"))} doc=${strip(pick("document-uri") || pick("documentURL"))} sample=${JSON.stringify(pick("script-sample") || pick("sample")).slice(0, 80)}`,
      );
    }
  } catch {
    /* ugyldig rapport: ignorer */
  }
  return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
}

export async function GET() {
  return new Response(null, { status: 405, headers: { Allow: "POST" } });
}
