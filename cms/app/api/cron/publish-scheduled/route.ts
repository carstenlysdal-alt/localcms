import { publishDueArticles, DEFAULT_BATCH } from "@/lib/scheduled-publish";
import { getClientIp, rateLimit, rateLimitHeaders } from "@/lib/ratelimit";
import { safeEqual } from "@/lib/validation/tokens";

/**
 * GET|POST /api/cron/publish-scheduled[?instans=<id>][&batch=<n>]
 * Planlagt job (Railway cron / ekstern cron, hvert 1.-5. minut): publicerer artikler i status "Planlagt" hvis
 * `planlagtTid` er passeret. Rører ALDRIG andre statusser. Idempotent og i små batches (se lib/scheduled-publish.ts).
 *
 *  - Auth: `Authorization: Bearer ${CRON_SECRET}` (konstant-tids sammenligning). Uden CRON_SECRET (min. 16 tegn) afviser
 *    ruten alt med 503 — den er aldrig åben (som /api/cron/frontpage-rank).
 *  - Rate limits: 20 mislykkede auth-forsøg/min pr. IP; 30 kørsler/min i alt.
 */
export const dynamic = "force-dynamic";

function json(body: unknown, status: number, extra: Record<string, string> = {}) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store", ...extra } });
}

async function handle(req: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 16) return json({ error: "Cron er ikke konfigureret." }, 503);

  const ip = getClientIp(req.headers);
  const match = /^Bearer\s+(\S+)$/i.exec((req.headers.get("authorization") ?? "").trim());
  if (!match || !safeEqual(match[1], secret)) {
    const limited = await rateLimit({ bucket: "cron-publish-authfail", key: ip, limit: 20, windowMs: 60_000 });
    if (!limited.ok) return json({ error: "For mange mislykkede forsøg." }, 429, rateLimitHeaders(limited));
    return json({ error: "Uautoriseret." }, 401, { "WWW-Authenticate": 'Bearer realm="cron"' });
  }

  const run = await rateLimit({ bucket: "cron-publish", key: "global", limit: 30, windowMs: 60_000 });
  if (!run.ok) return json({ error: "For mange kørsler." }, 429, rateLimitHeaders(run));

  const url = new URL(req.url);
  const instansId = url.searchParams.get("instans") || undefined;
  const batch = Number.parseInt(url.searchParams.get("batch") ?? "", 10);
  const result = await publishDueArticles({ instansId, batchSize: Number.isFinite(batch) && batch > 0 ? batch : DEFAULT_BATCH });
  return json({ ok: true, checked: result.checked, published: result.published, skipped: result.skipped }, 200);
}

export const GET = handle;
export const POST = handle;
