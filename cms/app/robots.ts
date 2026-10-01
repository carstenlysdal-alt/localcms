import type { MetadataRoute } from "next";
import { getCurrentSite } from "@/lib/site";
import { getHostStatus } from "@/lib/seo/host";
import { siteBase } from "@/lib/seo/url";
import { buildRobotsGroups } from "@/lib/seo/robots-policy";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const site = await getCurrentSite();
  const base = siteBase(site);
  const host = await getHostStatus(site.domaene);
  const aiTraining = process.env.SEO_AI_TRAINING === "block" ? "block" : undefined;
  const groups = buildRobotsGroups({ known: host.known, aiTraining });

  return {
    rules: groups.map((g) => ({
      userAgent: g.userAgent,
      ...(g.allow ? { allow: g.allow } : {}),
      ...(g.disallow ? { disallow: g.disallow } : {}),
    })),
    // Ukendt vært får ingen sitemaps.
    ...(host.known ? { sitemap: [`${base}/sitemap.xml`, `${base}/news-sitemap.xml`] } : {}),
  };
}
