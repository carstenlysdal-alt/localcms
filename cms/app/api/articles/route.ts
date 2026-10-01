import { z } from "zod";
import { getCurrentSite } from "@/lib/site";
import { findPublicArticles, publicJson } from "@/lib/public-api";
import { getClientIp, rateLimit, rateLimitHeaders } from "@/lib/ratelimit";

/**
 * GET /api/articles?limit=20&sektion=<kategori-slug>&omraade=<geo-slug>
 * Offentlig, cachebar liste over PUBLICEREDE artikler for den aktuelle sites instans (host-baseret).
 * Svar: { data: PublicArticle[], count, site: { domaene } } — se lib/public-api.ts for felterne.
 */
const query = z.object({
  limit: z.coerce.number().int().min(1).max(100).catch(20),
  sektion: z.string().regex(/^[\p{L}\p{N}-]{1,80}$/u).optional().catch(undefined),
  omraade: z.string().regex(/^[\p{L}\p{N}-]{1,80}$/u).optional().catch(undefined),
});

export async function GET(request: Request) {
  const limited = await rateLimit({ bucket: "api-articles", key: getClientIp(request.headers), limit: 120, windowMs: 60_000 });
  if (!limited.ok) return publicJson({ error: "For mange forespørgsler." }, { status: 429, cache: false });

  const { searchParams } = new URL(request.url);
  const params = query.parse({
    limit: searchParams.get("limit") ?? undefined,
    sektion: searchParams.get("sektion") ?? undefined,
    omraade: searchParams.get("omraade") ?? undefined,
  });

  const site = await getCurrentSite();
  const articles = await findPublicArticles(site.id, params);
  const response = publicJson({ data: articles, count: articles.length, site: { domaene: site.domaene } });
  for (const [k, v] of Object.entries(rateLimitHeaders(limited))) response.headers.set(k, v);
  return response;
}
