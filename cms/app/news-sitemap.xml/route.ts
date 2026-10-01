import { getCurrentSite } from "@/lib/site";
import { collectSiteIndex } from "@/lib/seo/sitemap-data";
import { newsSitemapXml } from "@/lib/seo/sitemap";
import { NEWS_CACHE, unknownHostResponse, xmlResponse } from "@/lib/seo/xml-response";

/**
 * Google News-sitemap: kun Uafhængig + AI-assisteret (jf. T4 §7.3), publiceret
 * inden for de seneste 48 timer. Partner/Sponsoreret/PR/Brugerindsendt udelades.
 */
export async function GET() {
  const site = await getCurrentSite();
  const blocked = await unknownHostResponse(site.domaene);
  if (blocked) return blocked;
  const index = await collectSiteIndex(site);
  return xmlResponse(newsSitemapXml(site.navn, index.news, "da"), NEWS_CACHE);
}
