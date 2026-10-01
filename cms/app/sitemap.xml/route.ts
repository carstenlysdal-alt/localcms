import { getCurrentSite } from "@/lib/site";
import { collectSiteIndex } from "@/lib/seo/sitemap-data";
import { chunk, MAX_URLS_PER_SITEMAP, sitemapIndexXml, urlsetXml, maxDate } from "@/lib/seo/sitemap";
import { unknownHostResponse, xmlResponse } from "@/lib/seo/xml-response";

/**
 * /sitemap.xml: ét urlset når der er ≤1000 URL'er, ellers et sitemap-index
 * der peger på /sitemaps/1.xml, /sitemaps/2.xml … (1000 URL'er pr. fil).
 * News-sitemap ligger separat på /news-sitemap.xml.
 */
export async function GET() {
  const site = await getCurrentSite();
  const blocked = await unknownHostResponse(site.domaene);
  if (blocked) return blocked;

  const index = await collectSiteIndex(site);
  if (index.entries.length <= MAX_URLS_PER_SITEMAP) {
    return xmlResponse(urlsetXml(index.entries));
  }
  const parts = chunk(index.entries);
  return xmlResponse(
    sitemapIndexXml(
      parts.map((part, i) => ({
        loc: `${index.base}/sitemaps/${i + 1}.xml`,
        lastmod: maxDate(part.map((e) => e.lastmod)),
      })),
    ),
  );
}
