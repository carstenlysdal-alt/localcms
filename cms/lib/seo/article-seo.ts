/**
 * Samler en artikels offentlige metadata med faste fallback-kæder. Ren funktion (ingen Next/Prisma), så den kan testes og
 * deles mellem det offentlige site (generateMetadata), delings-previews i editoren og AI-forslag.
 *
 * Fallback-kæder (første udfyldte vinder):
 *   <title>            seoTitel -> titel                              (≤ 60 tegn, ordgrænse)
 *   meta description   seoBeskrivelse -> manchet                      (≤ 155 tegn)
 *   canonical          meta.canonicalUrl (http/https) -> artiklens egen URL
 *   og:title           ogTitel -> seoTitel -> titel
 *   og:description     ogBeskrivelse -> seoBeskrivelse -> manchet
 *   og:image           ogMedia -> genereret kort (/og/artikel/<slug>.jpg: cover beskåret, ellers genereret kort)
 *   twitter:card       meta.twitterCard -> summary_large_image
 *   twitter:title      twitterTitel -> og:title
 *   twitter:description twitterBeskrivelse -> og:description
 *   twitter:image      twitterMedia -> og:image
 */
import { fitTitle, metaDescription, stripHtml } from "./escape";
import { absoluteUrl, articlePath } from "./url";
import { articleImageUrl, siteImageUrl } from "./jsonld";
import { ogLocale, type ArticleMetaValue } from "../article-meta";

export type SeoMedia = { url: string; altTekst?: string | null; bredde?: number | null; hoejde?: number | null };

export type ArticleSeoInput = {
  base: string;
  titel: string;
  manchet?: string | null;
  seoTitel?: string | null;
  seoBeskrivelse?: string | null;
  slug: string;
  sprog?: string | null;
  sektion: { navn: string; slug: string };
  /** Metadata; undefined = standard (ingen overrides). */
  meta?: Partial<ArticleMetaValue> | null;
  cover?: SeoMedia | null;
  ogMedia?: SeoMedia | null;
  twitterMedia?: SeoMedia | null;
  /** Cache-buster til genererede kort. */
  version?: number | string;
  /** Kladder har endnu ingen publiceret OG-rute: brug coverens URL i stedet for /og/artikel/<slug>.jpg. */
  draft?: boolean;
};

export type ResolvedImage = { url: string; alt: string; width?: number; height?: number };

export type ResolvedArticleSeo = {
  title: string;
  description: string;
  canonical: string;
  isCanonicalOverride: boolean;
  noindex: boolean;
  nofollow: boolean;
  keywords: string[];
  newsKeywords: string[];
  locale: string;
  og: { title: string; description: string; image: ResolvedImage };
  twitter: { card: "summary" | "summary_large_image"; title: string; description: string; image: ResolvedImage };
  unavailableAfter?: Date;
  standout: boolean;
  /** hreflang -> URL */
  languages: Record<string, string>;
};

function mediaImage(base: string, m: SeoMedia, fallbackAlt: string): ResolvedImage {
  return {
    url: absoluteUrl(base, m.url),
    alt: stripHtml(m.altTekst || fallbackAlt),
    ...(m.bredde && m.hoejde ? { width: m.bredde, height: m.hoejde } : {}),
  };
}

export function resolveArticleSeo(i: ArticleSeoInput): ResolvedArticleSeo {
  const meta = i.meta ?? {};
  const ownUrl = absoluteUrl(i.base, articlePath(i.sektion.slug, i.slug));
  const override = meta.canonicalUrl && /^https?:\/\//i.test(meta.canonicalUrl) && URL.canParse(meta.canonicalUrl) ? meta.canonicalUrl : null;

  const plainTitle = stripHtml(i.titel);
  const title = fitTitle(i.seoTitel?.trim() || i.titel, 60);
  const description = metaDescription(i.seoBeskrivelse, i.manchet ?? "");

  const ogTitle = stripHtml(meta.ogTitel || i.seoTitel || i.titel);
  const ogDescription = meta.ogBeskrivelse
    ? metaDescription(meta.ogBeskrivelse, "", 200)
    : metaDescription(i.seoBeskrivelse, i.manchet ?? "");

  const coverAlt = i.cover?.altTekst || plainTitle;
  // Kladder har ingen publiceret /og/artikel/<slug>.jpg: coverens URL (eller byens standardkort uden cover) bruges i previewet.
  const generated: ResolvedImage = i.draft
    ? i.cover
      ? mediaImage(i.base, i.cover, plainTitle)
      : { url: siteImageUrl(i.base), alt: plainTitle, width: 1200, height: 630 }
    : { url: articleImageUrl(i.base, i.slug, "og", i.version), alt: stripHtml(coverAlt), width: 1200, height: 630 };
  const ogImage = i.ogMedia ? mediaImage(i.base, i.ogMedia, ogTitle) : generated;
  const twitterImage = i.twitterMedia ? mediaImage(i.base, i.twitterMedia, ogTitle) : ogImage;

  const languages: Record<string, string> = {};
  for (const [lang, t] of Object.entries(meta.oversaettelser ?? {})) if (t?.url) languages[lang] = t.url;

  return {
    title,
    description,
    canonical: override ?? ownUrl,
    isCanonicalOverride: Boolean(override),
    noindex: Boolean(meta.robotsNoindex),
    nofollow: Boolean(meta.robotsNofollow),
    keywords: [...(meta.keywords ?? [])],
    newsKeywords: [...(meta.newsKeywords ?? [])],
    locale: ogLocale(i.sprog),
    og: { title: ogTitle, description: ogDescription, image: ogImage },
    twitter: {
      card: meta.twitterCard ?? "summary_large_image",
      title: stripHtml(meta.twitterTitel || ogTitle),
      description: meta.twitterBeskrivelse ? metaDescription(meta.twitterBeskrivelse, "", 200) : ogDescription,
      image: twitterImage,
    },
    unavailableAfter: meta.udloebTid ?? undefined,
    standout: Boolean(meta.standout),
    languages,
  };
}
