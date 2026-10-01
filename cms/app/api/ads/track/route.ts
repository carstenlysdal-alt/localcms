import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentSite } from "@/lib/site";
import { getClientIp, rateLimit, rateLimitHeaders } from "@/lib/ratelimit";
import { isLikelyBot, recordAdEvent, visitorKey } from "@/lib/tracking";
import { isSameOrigin, parseJson } from "@/lib/http";

/**
 * POST /api/ads/track   { campaignId: string, type?: "impression" | "click" }
 * Anonym (bruges af browseren på offentlige sider), derfor: zod, tenant-binding via host,
 * same-origin-filter, bot-filter, dedupe pr. besøgende og rate limit pr. IP. Se lib/tracking.ts.
 */
const schema = z.object({
  campaignId: z.string().min(8).max(64).regex(/^[A-Za-z0-9_-]+$/),
  type: z.enum(["impression", "click"]).default("impression"),
});

export async function POST(req: Request) {
  if (!isSameOrigin(req)) return NextResponse.json({ error: "Forbudt." }, { status: 403 });

  const ip = getClientIp(req.headers);
  const limited = await rateLimit({ bucket: "ads-track", key: ip, limit: 120, windowMs: 60_000 });
  if (!limited.ok) return NextResponse.json({ error: "For mange forespørgsler." }, { status: 429, headers: rateLimitHeaders(limited) });

  const body = await parseJson(req, schema, 1024);
  if (!body.ok) return body.response;

  const userAgent = req.headers.get("user-agent") ?? "";
  if (isLikelyBot(userAgent)) return NextResponse.json({ success: true, counted: false });

  try {
    const site = await getCurrentSite();
    const result = await recordAdEvent({
      siteId: site.id,
      campaignId: body.data.campaignId,
      type: body.data.type,
      visitor: visitorKey(ip, userAgent),
    });
    if ("notFound" in result) return NextResponse.json({ error: "Kampagnen findes ikke." }, { status: 404 });
    return NextResponse.json({ success: true, counted: result.counted });
  } catch (error) {
    console.error("Fejl ved ad tracking:", error);
    return NextResponse.json({ error: "Intern fejl" }, { status: 500 });
  }
}
