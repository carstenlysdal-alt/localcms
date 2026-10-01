export type NetworkSiteSummary = {
  navn: string;
  domaene: string;
  by: string;
  accent: string;
};

export const ALL_NETWORK_SITES: NetworkSiteSummary[] = [
  { navn: "SlagelseLokalt", domaene: "slagelselokalt.dk", by: "Slagelse", accent: "#9E3D1B" },
  { navn: "NæstvedLokalt", domaene: "naestvedlokalt.dk", by: "Næstved", accent: "#1F5663" },
  { navn: "HolbækLokalt", domaene: "holbaeklokalt.dk", by: "Holbæk", accent: "#4F5B1E" },
  { navn: "RingstedLokalt", domaene: "ringstedlokalt.dk", by: "Ringsted", accent: "#24533A" },
  { navn: "KøgeLokalt", domaene: "koegelokalt.dk", by: "Køge", accent: "#8A5A00" },
  { navn: "RoskildeLokalt", domaene: "roskildelokalt.dk", by: "Roskilde", accent: "#6A3553" },
];

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

/** Færdigt href til en by i netværket: målbyens origin + sti hvis den findes dér, ellers forsiden. */
export function networkHref(site: { domaene: string; origin?: string }, pathname = "/", sectionPaths: string[] = []): string {
  const origin = site.origin ?? `https://${site.domaene}`;
  const path = resolveSwitchPath(pathname, sectionPaths);
  return path === "/" ? `${origin}/` : `${origin}${path}`;
}
