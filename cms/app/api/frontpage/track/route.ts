import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentSite } from "@/lib/site";
import { getClientIp, rateLimit, rateLimitHeaders, firstSeen } from "@/lib/ratelimit";
import { isLikelyBot, visitorKey } from "@/lib/tracking";
import { isSameOrigin, parseJson } from "@/lib/http";
import { recordSlotEvent } from "@/lib/frontpage/service";

/**
 * POST /api/frontpage/track  { moduleId, slotKey, articleId, type?: "impression" | "click" }
 * Anonym måling af impressions/klik pr. forsideslot (FrontpageSlotMetric). Samme forsvar som /api/ads/track:
 * same-origin, bot-filter, rate limit pr. IP, dedupe pr. besøgende, tenant-binding via host (artiklen skal tilhøre sitet).
 */
const schema = z.object({
  moduleId: z.string().regex(/^[a-z0-9][a-z0-9-]{1,39}$/),
  slotKey: z.string().regex(/^\d{1,2}$/),
  articleId: z.string().min(8).max(64).regex(/^[A-Za-z0-9_-]+$/),
  type: z.enum(["impression", "click"]).default("impression"),
});

export async function POST(req: Request) {
  if (!isSameOrigin(req)) return NextResponse.json({ error: "Forbudt." }, { status: 403 });
  const ip = getClientIp(req.headers);
  const limited = await rateLimit({ bucket: "frontpage-track", key: ip, limit: 240, windowMs: 60_000 });
  if (!limited.ok) return NextResponse.json({ error: "For mange forespørgsler." }, { status: 429, headers: rateLimitHeaders(limited) });

  const body = await parseJson(req, schema, 1024);
  if (!body.ok) return body.response;

  const userAgent = req.headers.get("user-agent") ?? "";
  if (isLikelyBot(userAgent)) return NextResponse.json({ success: true, counted: false });

  try {
    const site = await getCurrentSite();
    const { moduleId, slotKey, articleId, type } = body.data;
    const windowMs = type === "impression" ? 30 * 60_000 : 10 * 60_000;
    if (!(await firstSeen(`fp-${type}:${moduleId}:${slotKey}:${articleId}`, visitorKey(ip, userAgent), windowMs))) {
      return NextResponse.json({ success: true, counted: false });
    }
    const res = await recordSlotEvent({ instansId: site.id, moduleId, slotKey, articleId, type });
    if (!res.ok) return NextResponse.json({ error: "Ikke fundet." }, { status: res.reason === "invalid" ? 400 : 404 });
    return NextResponse.json({ success: true, counted: true });
  } catch (error) {
    console.error("Fejl ved slot-måling:", error);
    return NextResponse.json({ error: "Intern fejl" }, { status: 500 });
  }
}
