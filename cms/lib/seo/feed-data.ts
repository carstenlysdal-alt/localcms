import { db } from "@/lib/db";
import { articleImageUrl } from "./jsonld";
import { absoluteUrl, articlePath, siteBase } from "./url";
import { buildRss, labelCategory, sponsoredTitlePrefix, type FeedItem } from "./rss";
import { xmlResponse, XML_CACHE } from "./xml-response";

type SiteLike = { id: string; domaene: string; navn: string; kommune: string; tagline: string };

export async function serveFeed(
  site: SiteLike,
  opts: { categoryIds?: string[]; title?: string; linkPath?: string; selfPath: string; description?: string },
): Promise<Response> {
  const base = siteBase(site);
  const articles = await db.article.findMany({
    where: {
      instansId: site.id,
      status: "Publiceret",
      ...(opts.categoryIds ? { kategoriId: { in: opts.categoryIds } } : {}),
    },
    orderBy: { publiceretTid: "desc" },
    take: 30,
    include: { kategori: { include: { parent: true } }, forfatter: true },
  });

  const items: FeedItem[] = articles.map((art) => {
    const sektion = art.kategori?.parent ?? art.kategori;
    const sektionSlug = sektion?.slug || "nyheder";
    const url = absoluteUrl(base, articlePath(sektionSlug, art.slug));
    const label = labelCategory(art.indholdstype);
    return {
      title: `${sponsoredTitlePrefix(art.indholdstype)}${art.titel}`,
      link: url,
      guid: url,
      pubDate: art.publiceretTid ?? art.createdAt,
      description: art.seoBeskrivelse || art.manchet || "",
      creator: art.forfatter?.navn,
      categories: [sektion?.navn ?? "Nyheder", ...(art.kategori?.parent ? [art.kategori.navn] : []), ...(label ? [label] : [])],
      image: { url: articleImageUrl(base, art.slug, "og", art.opdateretTid.getTime()), width: 1200, height: 630 },
    };
  });

  const xml = buildRss({
    title: opts.title ?? `${site.navn} – alle nyheder`,
    link: absoluteUrl(base, opts.linkPath ?? "/"),
    selfUrl: absoluteUrl(base, opts.selfPath),
    description: opts.description ?? site.tagline ?? `Lokale nyheder fra ${site.kommune}`,
    lastBuildDate: articles.length ? new Date(Math.max(...articles.map((a) => a.opdateretTid.getTime()))) : undefined,
    items,
  });
  return xmlResponse(xml, XML_CACHE, "application/rss+xml; charset=utf-8");
}
