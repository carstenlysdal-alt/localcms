/**
 * Delings-previews (Google-snippet, Facebook/LinkedIn-kort, X-kort, mobil). Drevet af de samme helper-funktioner som det
 * offentlige site (`fitTitle`, `metaDescription`, `stripHtml`, `resolveArticleSeo`), så preview og virkelighed ikke
 * kan glide fra hinanden. Ren logik; ingen Next/Prisma.
 */
import { fitTitle, metaDescription, stripHtml, truncateAtWord } from "./escape";
import { resolveArticleSeo, type ArticleSeoInput, type ResolvedArticleSeo } from "./article-seo";

export type SerpPreview = {
  title: string;
  description: string;
  displayUrl: string;
  /** true hvis den indtastede titel/beskrivelse bliver klippet af søgemaskiner. */
  titleClipped: boolean;
  descriptionClipped: boolean;
};

/** Brødkrumme-lignende visnings-URL som Google viser: `domæne › sektion › slug`. */
export function displayUrl(canonical: string): string {
  try {
    const u = new URL(canonical);
    const parts = u.pathname.split("/").filter(Boolean);
    return [u.host.replace(/^www\./, ""), ...parts].join(" › ");
  } catch {
    return canonical;
  }
}

export function serpPreview(seo: ResolvedArticleSeo, raw: { titel: string; seoTitel?: string | null; seoBeskrivelse?: string | null; manchet?: string | null }): SerpPreview {
  const fullTitle = stripHtml(raw.seoTitel?.trim() || raw.titel);
  const fullDesc = stripHtml(raw.seoBeskrivelse?.trim() || raw.manchet || "");
  return {
    title: seo.title,
    description: seo.description,
    displayUrl: displayUrl(seo.canonical),
    titleClipped: fullTitle.length > 60,
    descriptionClipped: fullDesc.length > 155,
  };
}

export type ShareCard = {
  platform: "facebook" | "linkedin" | "x";
  host: string;
  title: string;
  description: string;
  imageUrl: string;
  imageAlt: string;
  /** X: kortets udseende. */
  card?: "summary" | "summary_large_image";
};

function hostOf(url: string): string {
  try { return new URL(url).host.replace(/^www\./, ""); } catch { return ""; }
}

export function shareCards(seo: ResolvedArticleSeo): { facebook: ShareCard; linkedin: ShareCard; x: ShareCard } {
  const host = hostOf(seo.canonical);
  return {
    // Facebook viser op til ca. 88 tegn titel og 2 linjer beskrivelse; LinkedIn ca. 70 tegn titel uden beskrivelse.
    facebook: { platform: "facebook", host, title: truncateAtWord(seo.og.title, 88), description: truncateAtWord(seo.og.description, 160), imageUrl: seo.og.image.url, imageAlt: seo.og.image.alt },
    linkedin: { platform: "linkedin", host, title: truncateAtWord(seo.og.title, 70), description: "", imageUrl: seo.og.image.url, imageAlt: seo.og.image.alt },
    x: { platform: "x", host, title: truncateAtWord(seo.twitter.title, 70), description: truncateAtWord(seo.twitter.description, 125), imageUrl: seo.twitter.image.url, imageAlt: seo.twitter.image.alt, card: seo.twitter.card },
  };
}

/** Alt editoren skal bruge til sine previews, i ét kald. */
export function buildPreviews(input: ArticleSeoInput) {
  const seo = resolveArticleSeo(input);
  return {
    seo,
    serp: serpPreview(seo, input),
    cards: shareCards(seo),
    mobileTitle: fitTitle(input.seoTitel?.trim() || input.titel, 60),
    mobileDescription: metaDescription(input.seoBeskrivelse, input.manchet ?? "", 120),
  };
}
