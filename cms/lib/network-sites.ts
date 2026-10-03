export type NetworkSiteSummary = {
  navn: string;
  domaene: string;
  by: string;
  accent: string;
  /** Kanonisk by-nøgle (slagelse, naestved, holbaek, koege, roskilde, ringsted) — se cityKey(). */
  key?: string;
};

/**
 * Kanonisk by-nøgle ud fra et instans-domæne: "naestvedlokalt.dk" -> "naestved".
 * Bruges til ?by=<nøgle> på preview-værter (lib/preview.ts) og i create-admin/plus-adressering.
 * Én definition: alt andet (cookie, switcher, tests) går gennem denne funktion.
 */
export function cityKey(domaene: string): string {
  return domaene
    .trim()
    .toLowerCase()
    .replace(/^www\./, "")
    .replace(/\.dk$/, "")
    .replace(/lokalt$/, "");
}

const NETWORK_BASE: Array<Omit<NetworkSiteSummary, "key">> = [
  { navn: "SlagelseLokalt", domaene: "slagelselokalt.dk", by: "Slagelse", accent: "#9E3D1B" },
  { navn: "NæstvedLokalt", domaene: "naestvedlokalt.dk", by: "Næstved", accent: "#1F5663" },
  { navn: "HolbækLokalt", domaene: "holbaeklokalt.dk", by: "Holbæk", accent: "#4F5B1E" },
  { navn: "RingstedLokalt", domaene: "ringstedlokalt.dk", by: "Ringsted", accent: "#24533A" },
  { navn: "KøgeLokalt", domaene: "koegelokalt.dk", by: "Køge", accent: "#8A5A00" },
  { navn: "RoskildeLokalt", domaene: "roskildelokalt.dk", by: "Roskilde", accent: "#6A3553" },
];

export const ALL_NETWORK_SITES: NetworkSiteSummary[] = NETWORK_BASE.map((s) => ({ ...s, key: cityKey(s.domaene) }));

/** Tilladte by-nøgler (hvidliste) — den eneste mængde ?by= og cookien lk_by kan pege på. */
export const NETWORK_KEYS: readonly string[] = ALL_NETWORK_SITES.map((s) => s.key as string);

/** Validerer en rå ?by=/cookie-værdi mod hvidlisten. Returnerer nøglen eller null (ukendt/ugyldig ignoreres). */
export function parseCityKey(raw: string | null | undefined): string | null {
  if (typeof raw !== "string" || raw.length > 32) return null;
  const key = raw.trim().toLowerCase();
  return NETWORK_KEYS.includes(key) ? key : null;
}

/** Instans-domænet for en gyldig by-nøgle ("naestved" -> "naestvedlokalt.dk"), ellers null. */
export function domainForKey(raw: string | null | undefined): string | null {
  const key = parseCityKey(raw);
  return key ? (ALL_NETWORK_SITES.find((s) => s.key === key)?.domaene ?? null) : null;
}

export const DEFAULT_TAGLINES: Record<string, string> = {
  "slagelselokalt.dk": "Lokaljournalistik, der sætter fællesskabet først",
  "naestvedlokalt.dk": "Din lokale stemme i Næstved, Karrebæksminde og omegn",
  "holbaeklokalt.dk": "Lokaljournalistik fra Isefjorden til det åbne Vestsjælland",
  "ringstedlokalt.dk": "Nyheder fra hjertet af Sjælland — lokalt og tæt på dig",
  "koegelokalt.dk": "Lokaljournalistik med blik for Køges vækst, havn og stærke fællesskaber",
  "roskildelokalt.dk": "Kultur, viden og byens puls — lokaljournalistik i Roskilde",
};

// ── Skift mellem byer: rigtige links til målbyens domæne ─────────────────────

export type NetworkSiteLink = NetworkSiteSummary & {
  /** Absolut origin for målbyen, fx https://naestvedlokalt.dk eller http://naestvedlokalt.localhost:3000 */
  origin: string;
  /**
   * Kun sat på en preview-vært (PREVIEW_HOSTS, lib/preview.ts): by-nøglen, så linket bliver "/?by=<nøgle>" på SAMME vært
   * i stedet for målbyens (endnu ikke eksisterende) domæne. Udeladt på rigtige domæner — adfærden er uændret dér.
   */
  previewBy?: string;
};

/** Er hosten en lokal udviklingsvært (localhost, *.localhost, 127.0.0.1, [::1])? */
export function isLocalHost(host: string | null | undefined): boolean {
  if (!host) return false;
  const name = host.split(":")[0].toLowerCase();
  return (
    name === "localhost" ||
    name === "127.0.0.1" ||
    name === "[::1]" ||
    name.endsWith(".localhost")
  );
}

/** "naestvedlokalt.dk" -> "naestvedlokalt" (bruges som subdomæne på *.localhost). */
export function localSubdomain(domaene: string): string {
  return domaene.replace(/\.dk$/i, "");
}

/**
 * Bygger origin for en by ud fra den vært besøgende er på nu.
 * På localhost/*.localhost bliver det http://{by}lokalt.localhost:PORT, ellers https://{domæne}.
 */
export function siteOrigin(domaene: string, currentHost?: string | null, forwardedProto?: string | null): string {
  if (isLocalHost(currentHost)) {
    const port = currentHost!.includes(":") ? currentHost!.split(":")[1] : "";
    const proto = forwardedProto === "https" ? "https" : "http";
    return `${proto}://${localSubdomain(domaene)}.localhost${port ? `:${port}` : ""}`;
  }
  return `https://${domaene}`;
}

/** Statiske ruter der findes på alle byer, og dermed sikre at bevare ved bytte. */
export const SWITCHABLE_STATIC_PATHS = [
  "/",
  "/nyheder",
  "/kalender",
  "/opslagstavle",
  "/om-mediet",
  "/om-mediet/privatliv",
  "/om-mediet/kontakt",
  "/om-mediet/redaktionelle-principper",
  "/om-mediet/rettelser",
  "/nyhedsbrev",
  "/indsend",
  "/priser",
  "/bliv-stoette",
  "/bliv-en-del-af-journalistikken",
  "/soeg",
  "/omraade",
  "/emne",
  "/sponsor",
  "/qa",
  "/interview",
  "/velkommen",
];

/**
 * Bevarer kun stien hvis den også findes hos målbyen (fælles statiske sider og sektioner/
 * undersektioner). Artikler, områder, forfattere og emner er by-specifikke -> forsiden.
 */
export function resolveSwitchPath(pathname: string, sectionPaths: string[] = []): string {
  const clean = pathname.replace(/\/+$/, "") || "/";
  if (SWITCHABLE_STATIC_PATHS.includes(clean)) return clean;
  if (sectionPaths.includes(clean)) return clean;
  return "/";
}

/** Preview-link til en by på samme vært: altid byens forside (cookien lk_by sættes af proxyen, og URL'en renses). */
export function previewHref(key: string): string {
  return `/?by=${encodeURIComponent(key)}`;
}

/**
 * Færdigt href til en by i netværket: målbyens origin + sti hvis den findes dér, ellers forsiden.
 * På en preview-vært (site.previewBy sat, eller `options.previewBy`) bliver det i stedet "/?by=<nøgle>" på samme vært.
 */
export function networkHref(
  site: { domaene: string; origin?: string; previewBy?: string },
  pathname = "/",
  sectionPaths: string[] = [],
  options: { previewBy?: string | null } = {},
): string {
  const previewKey = parseCityKey(options.previewBy ?? site.previewBy);
  if (previewKey) return previewHref(previewKey);
  const origin = site.origin ?? `https://${site.domaene}`;
  const path = resolveSwitchPath(pathname, sectionPaths);
  return path === "/" ? `${origin}/` : `${origin}${path}`;
}
