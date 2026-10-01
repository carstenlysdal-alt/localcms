import { getCurrentSite } from "@/lib/site";
import { db } from "@/lib/db";
import { collectSiteIndex } from "@/lib/seo/sitemap-data";
import { buildLlmsTxt } from "@/lib/seo/llms";
import { resolveSeoConfig } from "@/lib/seo/config";
import { unknownHostResponse, xmlResponse, XML_CACHE } from "@/lib/seo/xml-response";

/** /llms.txt pr. by (host-baseret). */
export async function GET() {
  const site = await getCurrentSite();
  const blocked = await unknownHostResponse(site.domaene);
  if (blocked) return blocked;
  const cfg = resolveSeoConfig(site);
  const [index, areas] = await Promise.all([
    collectSiteIndex(site),
    db.geoTag.findMany({ where: { instansId: site.id }, orderBy: { navn: "asc" }, select: { navn: true } }),
  ]);
  const body = buildLlmsTxt({
    base: index.base,
    navn: site.navn,
    kommune: site.kommune,
    tagline: site.tagline,
    omMediet: cfg.description,
    email: cfg.email,
    areas: areas.map((a) => a.navn),
    sections: index.sections.filter((s) => s.count > 0).map((s) => ({ navn: s.navn, slug: s.slug })),
    latest: index.latest,
  });
  return xmlResponse(body, XML_CACHE, "text/plain; charset=utf-8");
}
