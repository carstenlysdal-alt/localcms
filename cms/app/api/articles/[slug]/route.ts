import { getCurrentSite } from "@/lib/site";
import { findPublicArticle, publicJson } from "@/lib/public-api";
import { getClientIp, rateLimit } from "@/lib/ratelimit";

/** GET /api/articles/{slug} — én publiceret artikel for den aktuelle sites instans. Svar: { data: PublicArticle } */
export async function GET(request: Request, context: { params: Promise<{ slug: string }> }) {
  const limited = await rateLimit({ bucket: "api-articles", key: getClientIp(request.headers), limit: 120, windowMs: 60_000 });
  if (!limited.ok) return publicJson({ error: "For mange forespørgsler." }, { status: 429, cache: false });

  const { slug } = await context.params;
  if (!/^[\p{L}\p{N}-]{1,200}$/u.test(slug)) return publicJson({ error: "Artiklen findes ikke." }, { status: 404, cache: false });
  const site = await getCurrentSite();
  const article = await findPublicArticle(site.id, slug);
  if (!article) return publicJson({ error: "Artiklen findes ikke." }, { status: 404, cache: false });
  return publicJson({ data: article, site: { domaene: site.domaene } });
}
