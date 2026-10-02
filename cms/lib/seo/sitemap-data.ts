/**
 * Henter indekserbare URL'er for én by (DB). Bruges af sitemap, news-sitemap og llms.txt.
 */
import { db } from "@/lib/db";
import { absoluteUrl, articlePath, encodeSegment, sectionPath, siteBase } from "./url";
import { articleImageUrl, isNewsSitemapEligible } from "./jsonld";
import { MIN_ARTICLES_FOR_INDEX, STATIC_PAGES } from "./pages";
import { isGateOpen } from "./page-state";
import { isWithinNewsWindow, maxDate, NEWS_MAX_URLS, type NewsEntry, type SitemapEntry } from "./sitemap";
import { stripHtml } from "./escape";

type SiteLike = { id: string; domaene: string; navn: string; updatedAt?: Date };

export type IndexedSection = { navn: string; slug: string; count: number; lastmod: Date | null; children: IndexedSection[] };

export type SiteIndex = {
  base: string;
  entries: SitemapEntry[];
  sections: IndexedSection[];
  news: NewsEntry[];
  /** De 10 seneste artikler (til llms.txt). */
  latest: Array<{ title: string; loc: string; section: string }>;
  latestArticleAt: Date | null;
};

export async function collectSiteIndex(site: SiteLike, now: Date = new Date()): Promise<SiteIndex> {
  const base = siteBase(site);

  const [categories, areas, tags, authors, articles, latestCorrection] = await Promise.all([
    db.category.findMany({ where: { instansId: site.id }, include: { parent: true }, orderBy: { sortering: "asc" } }),
    db.geoTag.findMany({ where: { instansId: site.id } }),
    db.tag.findMany({ where: { instansId: site.id, slug: { not: null } } }),
    db.author.findMany({ where: { instansId: site.id, slug: { not: null } } }),
    db.article.findMany({
      where: { instansId: site.id, status: "Publiceret" },
      select: {
        slug: true,
        titel: true,
        indholdstype: true,
        publiceretTid: true,
        opdateretTid: true,
        kategoriId: true,
        forfatterId: true,
        kategori: { select: { slug: true, parent: { select: { slug: true } } } },
        coverMedia: { select: { altTekst: true } },
        geoTags: { select: { id: true } },
        tags: { select: { id: true } },
      },
      orderBy: { publiceretTid: "desc" },
    }),
    db.correction.findFirst({ where: { instansId: site.id, fjernetTid: null }, orderBy: { createdAt: "desc" }, select: { createdAt: true } }),
  ]);

  const modOf = (a: { opdateretTid: Date; publiceretTid: Date | null }) => a.opdateretTid ?? a.publiceretTid;
  const latestArticleAt = maxDate(articles.map(modOf));

  // Aggregér pr. kategori / område / emne / forfatter
  const catStats = new Map<string, { count: number; last: Date | null }>();
  const areaStats = new Map<string, { count: number; last: Date | null }>();
  const tagStats = new Map<string, { count: number; last: Date | null }>();
  const authorStats = new Map<string, { count: number; last: Date | null }>();
  const bump = (m: Map<string, { count: number; last: Date | null }>, key: string, d: Date | null) => {
    const cur = m.get(key) ?? { count: 0, last: null };
    cur.count += 1;
    cur.last = maxDate([cur.last, d]);
    m.set(key, cur);
  };
  for (const a of articles) {
    const d = modOf(a);
    if (a.kategoriId) bump(catStats, a.kategoriId, d);
    for (const g of a.geoTags) bump(areaStats, g.id, d);
    for (const t of a.tags) bump(tagStats, t.id, d);
    if (a.forfatterId) bump(authorStats, a.forfatterId, d);
  }

  const entries: SitemapEntry[] = [];

  // 1. Forside
  entries.push({ loc: `${base}/`, lastmod: latestArticleAt });

  // 2. Statiske sider
  for (const p of STATIC_PAGES) {
    if (!(await isGateOpen(p.gate, site.id))) continue;
    const lastmod =
      p.lastmod === "instance" ? site.updatedAt ?? null : p.lastmod === "corrections" ? latestCorrection?.createdAt ?? null : null;
    entries.push({ loc: absoluteUrl(base, p.path), lastmod });
  }

  // 3. Sektioner og undersektioner (kun med artikler)
  const tops = categories.filter((c) => !c.parentId);
  const sections: IndexedSection[] = [];
  for (const top of tops) {
    const kids = categories.filter((c) => c.parentId === top.id);
    const kidSections: IndexedSection[] = kids.map((k) => ({
      navn: k.navn,
      slug: k.slug,
      count: catStats.get(k.id)?.count ?? 0,
      lastmod: catStats.get(k.id)?.last ?? null,
      children: [],
    }));
    const ownCount = catStats.get(top.id)?.count ?? 0;
    const count = ownCount + kidSections.reduce((n, k) => n + k.count, 0);
    const lastmod = maxDate([catStats.get(top.id)?.last, ...kidSections.map((k) => k.lastmod)]);
    sections.push({ navn: top.navn, slug: top.slug, count, lastmod, children: kidSections });
    if (count >= MIN_ARTICLES_FOR_INDEX.sektion) entries.push({ loc: absoluteUrl(base, sectionPath(top.slug)), lastmod });
    for (const k of kidSections) {
      if (k.count >= MIN_ARTICLES_FOR_INDEX.undersektion) {
        entries.push({ loc: absoluteUrl(base, sectionPath(top.slug, k.slug)), lastmod: k.lastmod });
      }
    }
  }

  // 4. Områder, emner, forfattere
  for (const a of areas) {
    const s = areaStats.get(a.id);
    if (s && s.count >= MIN_ARTICLES_FOR_INDEX.omraade) {
      entries.push({ loc: absoluteUrl(base, `/omraade/${encodeSegment(a.slug)}`), lastmod: s.last });
    }
  }
  for (const t of tags) {
    const s = tagStats.get(t.id);
    if (t.slug && s && s.count >= MIN_ARTICLES_FOR_INDEX.emne) {
      entries.push({ loc: absoluteUrl(base, `/emne/${encodeSegment(t.slug)}`), lastmod: s.last });
    }
  }
  for (const au of authors) {
    const s = authorStats.get(au.id);
    if (au.slug && s && s.count >= MIN_ARTICLES_FOR_INDEX.forfatter) {
      entries.push({ loc: absoluteUrl(base, `/forfatter/${encodeSegment(au.slug)}`), lastmod: s.last });
    }
  }

  // 5. Artikler (ægte lastmod = opdateretTid, billede = raster-OG-kort)
  const news: NewsEntry[] = [];
  const latest: SiteIndex["latest"] = [];
  for (const a of articles) {
    const sektion = a.kategori?.parent?.slug || a.kategori?.slug || "nyheder";
    const loc = absoluteUrl(base, articlePath(sektion, a.slug));
    if (latest.length < 10) latest.push({ title: stripHtml(a.titel), loc, section: a.kategori?.parent?.slug || a.kategori?.slug || "nyheder" });
    entries.push({
      loc,
      lastmod: modOf(a),
      images: [{ loc: articleImageUrl(base, a.slug, "og"), title: stripHtml(a.titel), caption: a.coverMedia?.altTekst ?? undefined }],
    });
    if (
      a.publiceretTid &&
      isNewsSitemapEligible(a.indholdstype) &&
      isWithinNewsWindow(a.publiceretTid, now) &&
      news.length < NEWS_MAX_URLS
    ) {
      news.push({ loc, title: stripHtml(a.titel), publishedAt: a.publiceretTid });
    }
  }

  return { base, entries, sections, news, latest, latestArticleAt };
}
