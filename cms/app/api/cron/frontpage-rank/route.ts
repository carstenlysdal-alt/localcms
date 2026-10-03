import { isAiConfigured } from "@/lib/ai/provider";
import { db } from "@/lib/db";
import { createProposal } from "@/lib/frontpage/service";
import { getClientIp, rateLimit, rateLimitHeaders } from "@/lib/ratelimit";
import { safeEqual } from "@/lib/validation/tokens";

/**
 * GET|POST /api/cron/frontpage-rank[?instans=<id>][&ai=0]
 * Planlagt job (Vercel Cron / ekstern cron): opretter FORSLAG til forsiden (T11) for én eller alle instanser.
 *
 *  - Auth: `Authorization: Bearer ${CRON_SECRET}` (konstant-tids sammenligning). Uden CRON_SECRET (min. 16 tegn) afviser
 *    ruten alt med 503 — den er aldrig åben.
 *  - Publicerer ALDRIG: forslag (FrontpageSnapshot.status = "forslag") skal godkendes af en redaktør.
 *  - AI bruges kun hvis en AI-udbyder er konfigureret (DEEPSEEK_API_KEY eller ANTHROPIC_API_KEY, jf. lib/ai/provider) (og ikke ai=0); ellers deterministisk forslag. AI-fejl => deterministisk.
 *  - Rate limits: 20 mislykkede auth-forsøg/min pr. IP; 6 kørsler/min i alt.
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
    const limited = await rateLimit({ bucket: "cron-frontpage-authfail", key: ip, limit: 20, windowMs: 60_000 });
    if (!limited.ok) return json({ error: "For mange mislykkede forsøg." }, 429, rateLimitHeaders(limited));
    return json({ error: "Uautoriseret." }, 401, { "WWW-Authenticate": 'Bearer realm="cron"' });
  }

  const run = await rateLimit({ bucket: "cron-frontpage", key: "global", limit: 6, windowMs: 60_000 });
  if (!run.ok) return json({ error: "For mange kørsler." }, 429, rateLimitHeaders(run));

  const url = new URL(req.url);
  const only = url.searchParams.get("instans");
  const useAi = url.searchParams.get("ai") !== "0" && isAiConfigured("frontpage");

  const instances = only
    ? await db.instance.findMany({ where: { id: only }, select: { id: true } })
    : await db.instance.findMany({ select: { id: true } });
  if (only && instances.length === 0) return json({ error: "Instansen findes ikke." }, 404);

  const results: Array<Record<string, unknown>> = [];
  for (const { id } of instances) {
    const res = await createProposal(id, { actor: { kind: "cron" }, useAi });
    results.push(
      res.ok
        ? { instansId: id, ok: true, snapshotId: res.snapshotId, reused: res.reused, generatedBy: res.generatedBy, assignments: res.assignmentCount, aiFailure: res.aiFailure?.reason ?? null }
        : { instansId: id, ok: false, code: res.code },
    );
  }
  return json({ ok: true, published: false, results }, 200);
}

export const GET = handle;
export const POST = handle;
