/**
 * Fælles metadata-bygger. Next.js merger `openGraph`/`twitter`/`alternates`/`robots`
 * overfladisk (barnet erstatter forælderen), så hver side bygger det FULDE sæt her.
 */
import type { Metadata } from "next";
import { fitTitle, metaDescription, stripHtml } from "./escape";
import { absoluteUrl, pageUrl, siteBase } from "./url";
import { resolveSeoConfig, type SeoSiteInput } from "./config";
import { getHostStatus } from "./host";
import { siteImageUrl } from "./jsonld";
import { isoWithOffset } from "./time";

export type MetaSite = SeoSiteInput;

/** Query-parametre der giver filtrerede dubletter -> noindex,follow + canonical til ren URL. */
export const FILTER_QUERY_KEYS = ["omraade", "emne", "filter", "kategori", "spor", "q", "sort"] as const;

export type QueryInfo = { page: number; hasFilter: boolean };

export function analyzeQuery(
  query: Record<string, string | string[] | undefined> | undefined,
  filterKeys: readonly string[] = FILTER_QUERY_KEYS,
): QueryInfo {
  const q = query ?? {};
  const rawSide = Array.isArray(q.side) ? q.side[0] : q.side;
  const parsed = rawSide ? parseInt(rawSide, 10) : 1;
  const page = Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
  const hasFilter = filterKeys.some((k) => {
    const v = q[k];
    return Array.isArray(v) ? v.some(Boolean) : Boolean(v);
  });
  return { page, hasFilter };
}

export function robotsMeta(index: boolean, follow = true): NonNullable<Metadata["robots"]> {
  if (!index) {
    return { index: false, follow, googleBot: { index: false, follow } };
  }
  return {
    index: true,
    follow,
    "max-image-preview": "large",
    "max-snippet": -1,
    "max-video-preview": -1,
    googleBot: {
      index: true,
      follow,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  };
}

export type PageMetaOptions = {
  site: MetaSite;
  /** Sti uden query, fx `/nyheder/politik`. */
  path: string;
  /** Sidetitel UDEN brand-suffix (layoutets template tilføjer ` | Navn`). */
  title: string;
  /** Brug titlen uændret (forsiden). */
  titleAbsolute?: boolean;
  description?: string | null;
  fallbackDescription?: string;
  type?: "website" | "article" | "profile";
  noindex?: boolean;
  nofollow?: boolean;
  page?: number;
  totalPages?: number;
  hasFilter?: boolean;
  image?: { url: string; alt?: string; width?: number; height?: number };
  article?: {
    publishedTime?: Date | null;
    modifiedTime?: Date | null;
    expirationTime?: Date | null;
    authorUrls?: string[];
    section?: string;
    tags?: string[];
  };
  profile?: { firstName?: string; lastName?: string };
  /** Ekstra RSS-feeds til autodiscovery (ud over `/feed.xml`). */
  feeds?: Array<{ path: string; title: string }>;
  ogTitle?: string;
  /** Artikel-overrides (additive; ubrugt af øvrige sider). */
  canonicalUrl?: string;
  ogDescription?: string;
  locale?: string;
  keywords?: string[];
  newsKeywords?: string[];
  /** Twitter/X-kort: type, tekster og billede (ellers samme som Open Graph). */
  twitter?: { card?: "summary" | "summary_large_image"; title?: string; description?: string; image?: { url: string; alt?: string } };
  /** Google: `unavailable_after` (ISO). */
  unavailableAfter?: Date | null;
  /** Google News standout-tag (peger på canonical). */
  standout?: boolean;
  /** hreflang-alternater: sprogkode -> absolut URL. */
  languages?: Record<string, string>;
};

export async function buildPageMetadata(opts: PageMetaOptions): Promise<Metadata> {
  const { site } = opts;
  const base = siteBase(site);
  const cfg = resolveSeoConfig(site);
  const host = await getHostStatus(site.domaene);

  const page = opts.page ?? 1;
  const filtered = Boolean(opts.hasFilter);
  const outOfRange = Boolean(opts.totalPages && opts.totalPages > 0 && page > opts.totalPages);

  const canonicalPath = filtered ? opts.path : pageUrl(opts.path, page);
  const canonical = opts.canonicalUrl && /^https?:\/\//i.test(opts.canonicalUrl) ? opts.canonicalUrl : absoluteUrl(base, canonicalPath);

  const indexable = !opts.noindex && !filtered && !outOfRange && host.known;
  const follow = host.known ? !opts.nofollow : false;

  const title = opts.titleAbsolute ? opts.title : fitTitle(opts.title);
  const pageSuffix = page > 1 && !filtered ? ` – side ${page}` : "";
  const titleWithPage = `${title}${pageSuffix}`;
  const description = metaDescription(opts.description, opts.fallbackDescription ?? site.tagline);
  const ogDescription = opts.ogDescription ?? description;
  const ogTitle = stripHtml(opts.ogTitle ?? titleWithPage);

  const image = opts.image ?? {
    url: siteImageUrl(base),
    alt: site.navn,
    width: 1200,
    height: 630,
  };
  const ogImages = [
    {
      url: image.url,
      width: image.width ?? 1200,
      height: image.height ?? 630,
      ...(image.alt ? { alt: image.alt } : {}),
    },
  ];

  const openGraphBase = {
    siteName: site.navn,
    locale: opts.locale ?? "da_DK",
    url: canonical,
    title: ogTitle,
    description: ogDescription,
    images: ogImages,
  };

  const openGraph: Metadata["openGraph"] =
    opts.type === "article"
      ? {
          ...openGraphBase,
          type: "article",
          publishedTime: isoWithOffset(opts.article?.publishedTime ?? null),
          modifiedTime: isoWithOffset(opts.article?.modifiedTime ?? null),
          expirationTime: isoWithOffset(opts.article?.expirationTime ?? null),
          authors: opts.article?.authorUrls?.length ? opts.article.authorUrls : undefined,
          section: opts.article?.section,
          tags: opts.article?.tags?.length ? opts.article.tags : undefined,
        }
      : opts.type === "profile"
        ? { ...openGraphBase, type: "profile", firstName: opts.profile?.firstName, lastName: opts.profile?.lastName }
        : { ...openGraphBase, type: "website" };

  const metadata: Metadata = {
    title: opts.titleAbsolute ? { absolute: titleWithPage } : titleWithPage,
    description,
    ...(opts.keywords?.length ? { keywords: opts.keywords } : {}),
    alternates: {
      canonical,
      ...(opts.languages && Object.keys(opts.languages).length ? { languages: opts.languages } : {}),
      types: {
        "application/rss+xml": [
          { url: `${base}/feed.xml`, title: `${site.navn} – alle nyheder` },
          ...(opts.feeds ?? []).map((f) => ({ url: absoluteUrl(base, f.path), title: f.title })),
        ],
      },
    },
    robots: robotsMeta(indexable, follow),
    openGraph,
    twitter: {
      card: opts.twitter?.card ?? "summary_large_image",
      title: opts.twitter?.title ?? ogTitle,
      description: opts.twitter?.description ?? ogDescription,
      images: [{ url: (opts.twitter?.image ?? image).url, ...((opts.twitter?.image?.alt ?? image.alt) ? { alt: opts.twitter?.image?.alt ?? image.alt } : {}) }],
      ...(cfg.twitterSite ? { site: cfg.twitterSite } : {}),
    },
  };

  if (opts.unavailableAfter && indexable) {
    const iso = isoWithOffset(opts.unavailableAfter);
    const robots = metadata.robots as Record<string, unknown>;
    if (iso && robots) {
      robots.unavailable_after = iso;
      const gb = robots.googleBot as Record<string, unknown> | undefined;
      if (gb) gb.unavailable_after = iso;
    }
  }
  const other: Record<string, string> = {};
  if (opts.newsKeywords?.length) other.news_keywords = opts.newsKeywords.join(", ");
  if (opts.standout) other.standout = canonical;
  if (Object.keys(other).length) metadata.other = other;

  // Paginering (rel=prev/next) – kun på rene sider uden filter.
  if (!filtered && opts.totalPages && opts.totalPages > 1) {
    const previous = page > 1 ? absoluteUrl(base, pageUrl(opts.path, page - 1)) : undefined;
    const next = page < opts.totalPages ? absoluteUrl(base, pageUrl(opts.path, page + 1)) : undefined;
    if (previous || next) metadata.pagination = { ...(previous ? { previous } : {}), ...(next ? { next } : {}) };
  }

  return metadata;
}

/** Metadata til sider der aldrig må indekseres (private/token/søg). Canonical til sig selv. */
export async function buildNoindexMetadata(
  site: MetaSite,
  path: string,
  title: string,
  description?: string,
  follow = true,
): Promise<Metadata> {
  const m = await buildPageMetadata({ site, path, title, description, noindex: true, nofollow: !follow });
  return m;
}

/** Layout-metadata (standardværdier for alle sider). */
export async function buildSiteMetadata(site: MetaSite): Promise<Metadata> {
  const base = siteBase(site);
  const cfg = resolveSeoConfig(site);
  const host = await getHostStatus(site.domaene);
  const description = metaDescription(site.tagline, `Uafhængigt lokalt nyhedsmedie for ${site.kommune}.`);
  return {
    metadataBase: new URL(base),
    title: {
      default: `${site.navn} – lokale nyheder fra ${site.kommune}`,
      template: `%s | ${site.navn}`,
    },
    description,
    applicationName: site.navn,
    robots: robotsMeta(host.known, host.known),
    alternates: {
      types: { "application/rss+xml": [{ url: `${base}/feed.xml`, title: `${site.navn} – alle nyheder` }] },
    },
    openGraph: {
      type: "website",
      siteName: site.navn,
      locale: "da_DK",
      images: [{ url: siteImageUrl(base), width: 1200, height: 630, alt: site.navn }],
    },
    twitter: { card: "summary_large_image", ...(cfg.twitterSite ? { site: cfg.twitterSite } : {}) },
    verification: {
      ...(cfg.googleVerification ? { google: cfg.googleVerification } : {}),
      ...(cfg.fbDomainVerification ? { other: { "facebook-domain-verification": [cfg.fbDomainVerification] } } : {}),
    },
    ...(cfg.fbAppId ? { facebook: { appId: cfg.fbAppId } } : {}),
  };
}
