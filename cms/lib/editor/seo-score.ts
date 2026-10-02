/**
 * Deterministisk SEO-/metadata-score (0-100) og "metadata komplet"-tjekliste. Samme input giver altid samme output —
 * ingen AI, ingen tilfældighed. Bruges i editoren (live) og som ADVARSEL (ikke blokering) før publicering.
 * AI-kommentaren (lib/ai/editorial.ts) lægges ovenpå denne score og ændrer den aldrig.
 */
import { fitTitle, metaDescription, stripHtml } from "../seo/escape";
import { SOCIAL_PLATFORMS, type ArticleMetaValue } from "../article-meta";

export type ScoreStatus = "ok" | "warn" | "fail";

export type ScoreItem = {
  id: string;
  label: string;
  status: ScoreStatus;
  points: number;
  weight: number;
  /** Kort, handlingsorienteret forklaring (dansk). */
  hint: string;
};

export type SeoScoreInput = {
  titel: string;
  seoTitel?: string | null;
  manchet?: string | null;
  seoBeskrivelse?: string | null;
  slug: string;
  kategoriId?: string | null;
  forfatterId?: string | null;
  cover?: { altTekst?: string | null } | null;
  tagCount: number;
  geoCount: number;
  wordCount: number;
  meta?: Partial<ArticleMetaValue> | null;
  /** Findes der et billede til deling (OG-billede eller cover)? */
  shareImageAvailable?: boolean;
};

export type SeoScore = { score: number; complete: boolean; items: ScoreItem[]; warnings: string[] };

function item(id: string, label: string, weight: number, status: ScoreStatus, hint: string): ScoreItem {
  return { id, label, weight, status, points: status === "ok" ? weight : status === "warn" ? Math.round(weight / 2) : 0, hint };
}

export function computeSeoScore(i: SeoScoreInput): SeoScore {
  const meta = i.meta ?? {};
  const titleSource = (i.seoTitel?.trim() || i.titel).trim();
  const titleLen = stripHtml(titleSource).length;
  const descSource = stripHtml(i.seoBeskrivelse?.trim() || i.manchet || "");
  const descLen = descSource.length;
  const socialCount = SOCIAL_PLATFORMS.filter((p) => (meta.social?.[p]?.tekst ?? "").trim().length > 0).length;
  const altLen = (i.cover?.altTekst ?? "").trim().length;

  const items: ScoreItem[] = [
    item(
      "titel", "Titel (SEO)", 12,
      titleLen >= 30 && titleLen <= 60 ? "ok" : (titleLen >= 15 && titleLen < 30) || (titleLen > 60 && titleLen <= 70) ? "warn" : "fail",
      `${titleLen} tegn. Søgemaskiner viser ca. 30-60 tegn.${titleLen > 60 ? ` Titlen klippes til: "${fitTitle(titleSource)}".` : ""}`,
    ),
    item(
      "beskrivelse", "Metabeskrivelse", 12,
      descLen >= 70 && descLen <= 155 ? "ok" : (descLen >= 40 && descLen < 70) || (descLen > 155 && descLen <= 200) ? "warn" : "fail",
      descLen === 0 ? "Mangler. Skriv 70-155 tegn (bruges ellers ikke af søgemaskiner)." : `${descLen} tegn. Ideelt 70-155.${descLen > 155 ? ` Klippes til: "${metaDescription(descSource)}".` : ""}`,
    ),
    item(
      "slug", "Slug (URL)", 6,
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(i.slug) && i.slug.length >= 3 && i.slug.length <= 70 ? "ok" : /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(i.slug) ? "warn" : "fail",
      "Små bogstaver, tal og bindestreger, 3-70 tegn.",
    ),
    item("cover", "Featurebillede", 6, i.cover ? "ok" : "fail", i.cover ? "Billedet er valgt." : "Vælg et featurebillede (bruges på forsiden og ved deling)."),
    item("alt", "Alt-tekst på billedet", 6, !i.cover ? "fail" : altLen >= 8 ? "ok" : altLen > 0 ? "warn" : "fail", !i.cover ? "Vælg først et billede." : altLen >= 8 ? "Alt-tekst findes." : "Beskriv billedet i en kort sætning (tilgængelighed og billedsøgning)."),
    item("tags", "Emner (tags)", 8, i.tagCount >= 2 ? "ok" : i.tagCount === 1 ? "warn" : "fail", `${i.tagCount} valgt. Vælg mindst 2.`),
    item("geo", "Område / by", 8, i.geoCount >= 1 ? "ok" : "fail", i.geoCount >= 1 ? "Område valgt." : "Vælg mindst ét område (bruges til lokal visning og schema.org)."),
    item("sektion", "Sektion", 6, i.kategoriId ? "ok" : "fail", i.kategoriId ? "Sektion valgt." : "Vælg en sektion (afgør artiklens URL)."),
    item("forfatter", "Forfatter", 4, i.forfatterId ? "ok" : "fail", i.forfatterId ? "Forfatter valgt." : "Vælg en forfatter (byline og E-E-A-T)."),
    item("manchet", "Underrubrik / manchet", 6, (i.manchet ?? "").trim().length >= 20 ? "ok" : (i.manchet ?? "").trim() ? "warn" : "fail", "Brug 20-220 tegn der opsummerer historien."),
    item("broedtekst", "Brødtekst", 6, i.wordCount >= 150 ? "ok" : i.wordCount >= 60 ? "warn" : "fail", `${i.wordCount} ord. Mindst ca. 150 ord giver en egentlig nyhedsartikel.`),
    item("deling", "Delingsbillede (Open Graph)", 6, i.shareImageAvailable ?? Boolean(i.cover) ? "ok" : "fail", "Et cover eller et særligt OG-billede bruges ved deling på Facebook, LinkedIn og X."),
    item(
      "sociale", "Opslagstekster (SoMe)", 8,
      socialCount >= 3 ? "ok" : socialCount >= 1 ? "warn" : "fail",
      `${socialCount} af ${SOCIAL_PLATFORMS.length} platforme har tekst. Skriv mindst tre.`,
    ),
    item("indeks", "Kan indekseres", 6, meta.robotsNoindex ? "warn" : "ok", meta.robotsNoindex ? "Artiklen er sat til noindex og vises ikke i søgemaskiner." : "Ingen indeksspærring."),
  ];

  const total = items.reduce((n, x) => n + x.weight, 0);
  const got = items.reduce((n, x) => n + x.points, 0);
  const score = Math.round((got / total) * 100);
  const warnings = items.filter((x) => x.status !== "ok").map((x) => `${x.label}: ${x.hint}`);
  return { score, complete: items.every((x) => x.status === "ok"), items, warnings };
}
