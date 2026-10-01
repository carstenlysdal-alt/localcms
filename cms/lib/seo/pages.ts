/**
 * Register over statiske sider: indeksering, sitemap og standardtitler.
 * Én kilde til sandhed for generateMetadata, sitemap og llms.txt.
 */

/** Områder/emner/forfattere/sektioner med færre artikler end dette er `noindex,follow` og ude af sitemap. */
export const MIN_ARTICLES_FOR_INDEX = {
  sektion: 1,
  undersektion: 1,
  omraade: 3,
  emne: 3,
  forfatter: 1,
} as const;

/**
 * Kalender og opslagstavle er pr. by og drevet af publicerede artikler mærket med
 * arrangement-/opslags-tags (der findes endnu ingen Event-model). Siderne er kun
 * indekserbare når byen faktisk har indhold dér (ellers tom-tilstand = tynd side).
 * Env SEO_INDEX_CALENDAR=0 / SEO_INDEX_BOARD=0 tvinger noindex.
 */
export type StaticPageGate = "always" | "calendar" | "board";

export type StaticPageDef = {
  path: string;
  /** Hvilken dato der bruges som lastmod. `none` = udelad. */
  lastmod: "instance" | "corrections" | "none";
  gate: StaticPageGate;
};

export const STATIC_PAGES: StaticPageDef[] = [
  { path: "/om-mediet", lastmod: "instance", gate: "always" },
  { path: "/om-mediet/redaktionelle-principper", lastmod: "instance", gate: "always" },
  { path: "/om-mediet/rettelser", lastmod: "corrections", gate: "always" },
  { path: "/om-mediet/kontakt", lastmod: "instance", gate: "always" },
  { path: "/omraade", lastmod: "none", gate: "always" },
  { path: "/emne", lastmod: "none", gate: "always" },
  { path: "/priser", lastmod: "none", gate: "always" },
  { path: "/bliv-stoette", lastmod: "none", gate: "always" },
  { path: "/bliv-en-del-af-journalistikken", lastmod: "none", gate: "always" },
  { path: "/sponsor", lastmod: "none", gate: "always" },
  { path: "/kalender", lastmod: "none", gate: "calendar" },
  { path: "/opslagstavle", lastmod: "none", gate: "board" },
];

export function isThinCollection(kind: keyof typeof MIN_ARTICLES_FOR_INDEX, articleCount: number): boolean {
  return articleCount < MIN_ARTICLES_FOR_INDEX[kind];
}
