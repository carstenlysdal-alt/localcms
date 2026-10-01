import { getCurrentSite } from "@/lib/site";
import { collectSiteIndex } from "@/lib/seo/sitemap-data";
import { chunk, urlsetXml } from "@/lib/seo/sitemap";
import { unknownHostResponse, xmlResponse } from "@/lib/seo/xml-response";

/** /sitemaps/<n>.xml – del n (1-baseret) af sitemap-indekset. */
export async function GET(_req: Request, context: { params: Promise<{ n: string }> }) {
  const { n } = await context.params;
  const match = /^(\d{1,4})\.xml$/.exec(n);
  if (!match) return new Response("Not found", { status: 404 });
  const site = await getCurrentSite();
  const blocked = await unknownHostResponse(site.domaene);
  if (blocked) return blocked;

  const index = await collectSiteIndex(site);
  const parts = chunk(index.entries);
  const part = parts[Number(match[1]) - 1];
  if (!part) return new Response("Not found", { status: 404 });
  return xmlResponse(urlsetXml(part));
}
