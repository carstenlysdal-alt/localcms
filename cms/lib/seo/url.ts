/**
 * Absolutte URL'er og stier. Alle URL'er i schema.org, OG, sitemap og feeds
 * skal være absolutte på sidens kanoniske (apex, https) domæne.
 */

export type HasDomain = { domaene: string };

/** `https://<apex-domæne>` uden trailing slash. */
export function siteBase(site: HasDomain): string {
  const domain = site.domaene.replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/+$/, "").toLowerCase();
  return `https://${domain}`;
}

/** Gør en sti (eller allerede-absolut URL) absolut. Forside bliver `BASE/`. */
export function absoluteUrl(base: string, path: string): string {
  if (!path) return `${base}/`;
  if (/^https?:\/\//i.test(path)) return path;
  if (path.startsWith("//")) return `https:${path}`;
  return new URL(path.startsWith("/") ? path : `/${path}`, `${base}/`).toString();
}

export function siteUrl(site: HasDomain, path = "/"): string {
  return absoluteUrl(siteBase(site), path);
}

/** Percent-koder et slug-segment (fx æ/ø/å i ældre slugs). */
export function encodeSegment(segment: string): string {
  return encodeURIComponent(segment);
}

/** Sti til en artikel: `/<sektion>/<slug>`. */
export function articlePath(sektionSlug: string, slug: string): string {
  return `/${encodeSegment(sektionSlug)}/${encodeSegment(slug)}`;
}

/** Sti til en kategori/undersektion. */
export function sectionPath(sektionSlug: string, undersektionSlug?: string | null): string {
  return undersektionSlug
    ? `/${encodeSegment(sektionSlug)}/${encodeSegment(undersektionSlug)}`
    : `/${encodeSegment(sektionSlug)}`;
}

/** Kandidater til opslag af et slug fra en URL-param (rå, afkodet, NFC, NFD). */
export function slugCandidates(param: string): string[] {
  const out = new Set<string>();
  const add = (v: string) => {
    if (v) {
      out.add(v);
      out.add(v.normalize("NFC"));
      out.add(v.normalize("NFD"));
    }
  };
  add(param);
  try {
    add(decodeURIComponent(param));
  } catch {
    // ugyldig percent-kodning – brug kun den rå værdi
  }
  return [...out];
}

/** `?side=N` – side 1 har ingen query. */
export function pageUrl(basePath: string, page: number): string {
  return page > 1 ? `${basePath}?side=${page}` : basePath;
}
