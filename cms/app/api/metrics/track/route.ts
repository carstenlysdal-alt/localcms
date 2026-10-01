import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentSite } from "@/lib/site";
import { getClientIp, rateLimit, rateLimitHeaders } from "@/lib/ratelimit";
import { isLikelyBot, recordMetricEvent, visitorKey } from "@/lib/tracking";
import { isSameOrigin, parseJson } from "@/lib/http";

/**
 * POST /api/metrics/track  { articleId, isNewView?, secondsSpent?, reached75? }
 * Anonym first-party-måling. sendBeacon sender body som text/plain eller application/json — begge accepteres.
 * Tenant-binding: artiklen skal være Publiceret og tilhøre den aktuelle sites instans.
 * Tælling er dedupet pr. besøgende og kappet (se lib/tracking.ts); atomiske increments i databasen.
 */
const schema = z.object({
  articleId: z.string().min(8).max(64).regex(/^[A-Za-z0-9_-]+$/),
  isNewView: z.boolean().optional().default(false),
  secondsSpent: z.number().finite().min(0).max(3600).optional().default(0),
  reached75: z.boolean().optional().default(false),
});

export async function POST(req: Request) {
  if (!isSameOrigin(req)) return NextResponse.json({ error: "Forbudt." }, { status: 403 });

  const ip = getClientIp(req.headers);
  const limited = await rateLimit({ bucket: "metrics-track", key: ip, limit: 180, windowMs: 60_000 });
  if (!limited.ok) return NextResponse.json({ error: "For mange forespørgsler." }, { status: 429, headers: rateLimitHeaders(limited) });

  const body = await parseJson(req, schema, 1024);
  if (!body.ok) return body.response;

  const userAgent = req.headers.get("user-agent") ?? "";
  if (isLikelyBot(userAgent)) return NextResponse.json({ success: true, counted: false });

  try {
    const site = await getCurrentSite();
    const result = await recordMetricEvent({
      siteId: site.id,
      articleId: body.data.articleId,
      isNewView: body.data.isNewView,
      secondsSpent: body.data.secondsSpent,
      reached75: body.data.reached75,
      visitor: visitorKey(ip, userAgent),
    });
    if ("notFound" in result) return NextResponse.json({ error: "Artikel ikke fundet" }, { status: 404 });
    return NextResponse.json({ success: true, counted: result.counted, score: result.score, visninger: result.visninger });
  } catch (error) {
    console.error("Fejl ved metrik-opdatering:", error);
    return NextResponse.json({ error: "Intern fejl" }, { status: 500 });
  }
}
