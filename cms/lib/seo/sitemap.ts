/**
 * Rene sitemap-hjælpere (XML-generering, opdeling, news-vindue). Ingen DB/Next.
 */
import { escapeXml } from "./escape";
import { isoWithOffset } from "./time";

/** Google tillader 50.000, men vi deler ved 1000 så hver fil er hurtig og index-formen testes tidligt. */
export const MAX_URLS_PER_SITEMAP = 1000;
/** Google News: kun artikler fra de seneste 48 timer. */
export const NEWS_WINDOW_HOURS = 48;
export const NEWS_MAX_URLS = 1000;

export type SitemapImage = { loc: string; title?: string; caption?: string };

export type SitemapEntry = {
  loc: string;
  /** Kun ægte ændringstidspunkter. Udelad hvis ukendt (hellere intet end en løgn). */
  lastmod?: Date | null;
  images?: SitemapImage[];
};

export function chunk<T>(items: T[], size = MAX_URLS_PER_SITEMAP): T[][] {
  if (items.length === 0) return [[]];
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

function lastmodTag(d: Date | null | undefined): string {
  const iso = isoWithOffset(d ?? null);
  return iso ? `<lastmod>${iso}</lastmod>` : "";
}

export function urlsetXml(entries: SitemapEntry[]): string {
  const hasImages = entries.some((e) => e.images && e.images.length > 0);
  const ns = `xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"${
    hasImages ? ' xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"' : ""
  }`;
  const body = entries
    .map((e) => {
      const images = (e.images ?? [])
        .map(
          (img) =>
            `<image:image><image:loc>${escapeXml(img.loc)}</image:loc>${
              img.title ? `<image:title>${escapeXml(img.title)}</image:title>` : ""
            }${img.caption ? `<image:caption>${escapeXml(img.caption)}</image:caption>` : ""}</image:image>`,
        )
        .join("");
      return `  <url><loc>${escapeXml(e.loc)}</loc>${lastmodTag(e.lastmod)}${images}</url>`;
    })
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset ${ns}>\n${body}\n</urlset>\n`;
}

export function sitemapIndexXml(items: Array<{ loc: string; lastmod?: Date | null }>): string {
  const body = items
    .map((i) => `  <sitemap><loc>${escapeXml(i.loc)}</loc>${lastmodTag(i.lastmod)}</sitemap>`)
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</sitemapindex>\n`;
}

export type NewsEntry = {
  loc: string;
  title: string;
  publishedAt: Date;
  /** Google News `news:keywords` (kommasepareret, højst 10). */
  keywords?: string[];
};

export function newsSitemapXml(publicationName: string, entries: NewsEntry[], language = "da"): string {
  const body = entries
    .map(
      (e) =>
        `  <url>
    <loc>${escapeXml(e.loc)}</loc>
    <news:news>
      <news:publication><news:name>${escapeXml(publicationName)}</news:name><news:language>${escapeXml(language)}</news:language></news:publication>
      <news:publication_date>${isoWithOffset(e.publishedAt)}</news:publication_date>
      <news:title>${escapeXml(e.title)}</news:title>${e.keywords && e.keywords.length ? `\n      <news:keywords>${escapeXml(e.keywords.slice(0, 10).join(", "))}</news:keywords>` : ""}
    </news:news>
  </url>`,
    )
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">\n${body}\n</urlset>\n`;
}

/** Er artiklen inden for news-vinduet (default 48 timer) – og ikke i fremtiden? */
export function isWithinNewsWindow(publishedAt: Date, now: Date = new Date(), hours = NEWS_WINDOW_HOURS): boolean {
  const age = now.getTime() - publishedAt.getTime();
  return age >= -5 * 60 * 1000 && age <= hours * 3600 * 1000;
}

export function maxDate(dates: Array<Date | null | undefined>): Date | null {
  let best: Date | null = null;
  for (const d of dates) {
    if (d && (!best || d.getTime() > best.getTime())) best = d;
  }
  return best;
}
