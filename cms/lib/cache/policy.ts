/**
 * Cache-politik for anonym HTML (hovedværnet mod DDoS: kanten/CDN'en serverer siden, ikke Node).
 *
 * Next.js renderer alle offentlige sider dynamisk (getCurrentSite() læser Host-headeren), så sidernes egne svar har
 * `Cache-Control: private, no-store`. proxy.ts overskriver det med en delt-cache-venlig header for præcis de
 * forespørgsler der er sikre at cache'e — og kun dem. CDN'en (Cloudflare) nøgler på fuld URL inkl. vært, og vi sender
 * `Vary: Host` (og `X-Forwarded-Host`, hvis TRUST_FORWARDED_HOST er slået til — se lib/trusted-host.ts), så tenant-data aldrig
 * blandes på tværs af byer.
 *
 * ALDRIG cache'bart:
 *  - andet end GET/HEAD
 *  - /redaktion, /login, /api (hver rute sætter selv sin header), /_next (egne regler), /uploads, token-sider
 *    (/qa /interview /meddeler /partner), /gemte /profil /velkommen /soeg-uden-q
 *  - forespørgsler med session-cookie (authjs.* / next-auth.*) eller Authorization-header
 *  - svar der sætter cookies (kontrolleres i proxy ved svartid)
 */

export type CacheClass = "home" | "page" | "search" | "never";

export type CacheDecision = {
  cacheable: boolean;
  cls: CacheClass;
  cacheControl?: string;
  reason: string;
};

export type CacheEnvConfig = {
  enabled: boolean;
  sMaxAge: number;
  staleWhileRevalidate: number;
  searchSMaxAge: number;
};

/** Standard: aktiv i produktion, fra i udvikling. CACHE_PUBLIC_HTML=1/0 overstyrer. */
export function resolveCacheConfig(env: NodeJS.ProcessEnv = process.env): CacheEnvConfig {
  const flag = env.CACHE_PUBLIC_HTML;
  const enabled = flag === "1" || flag?.toLowerCase() === "true" ? true : flag === "0" || flag?.toLowerCase() === "false" ? false : env.NODE_ENV === "production";
  const num = (v: string | undefined, d: number, max: number) => {
    const n = Number.parseInt(v ?? "", 10);
    return Number.isFinite(n) && n >= 0 ? Math.min(n, max) : d;
  };
  return {
    enabled,
    sMaxAge: num(env.CACHE_HTML_S_MAXAGE, 60, 3600),
    staleWhileRevalidate: num(env.CACHE_HTML_SWR, 300, 86_400),
    searchSMaxAge: num(env.CACHE_SEARCH_S_MAXAGE, 30, 600),
  };
}

const NEVER_PREFIXES = [
  "/redaktion",
  "/login",
  "/api",
  "/_next",
  "/uploads",
  "/media",
  "/avatars",
  "/qa/",
  "/interview/",
  "/meddeler",
  "/partner/",
  "/gemte",
  "/profil",
  "/velkommen",
  "/og/",
  "/icons/",
] as const;

const SESSION_COOKIE = /(?:^|;\s*)(?:__Secure-|__Host-)?(?:authjs|next-auth)\./i;

export function hasSessionCookie(cookieHeader: string | null | undefined): boolean {
  return Boolean(cookieHeader && SESSION_COOKIE.test(cookieHeader));
}

export function classifyPath(pathname: string): CacheClass {
  if (pathname === "/") return "home";
  if (pathname === "/soeg") return "search";
  for (const p of NEVER_PREFIXES) {
    if (p.endsWith("/") ? pathname.startsWith(p) : pathname === p || pathname.startsWith(`${p}/`)) return "never";
  }
  // Filer med endelse (feeds, sitemaps, ikoner) styres af deres egne ruters Cache-Control.
  if (/\.[a-z0-9]{2,5}$/i.test(pathname)) return "never";
  return "page";
}

export function decideCachePolicy(input: {
  method: string;
  pathname: string;
  cookieHeader?: string | null;
  hasAuthorization?: boolean;
  search?: string;
  config?: CacheEnvConfig;
}): CacheDecision {
  const config = input.config ?? resolveCacheConfig();
  if (!config.enabled) return { cacheable: false, cls: "never", reason: "disabled" };
  const method = input.method.toUpperCase();
  if (method !== "GET" && method !== "HEAD") return { cacheable: false, cls: "never", reason: "method" };
  if (hasSessionCookie(input.cookieHeader)) return { cacheable: false, cls: "never", reason: "session-cookie" };
  if (input.hasAuthorization) return { cacheable: false, cls: "never", reason: "authorization" };

  const cls = classifyPath(input.pathname);
  if (cls === "never") return { cacheable: false, cls, reason: "path" };
  if (cls === "search") {
    // Tom søgeside er billig; kun søgninger med q caches kort (pr. fuld URL).
    const hasQuery = Boolean(input.search && /[?&]q=/.test(input.search));
    if (!hasQuery) return { cacheable: true, cls, cacheControl: cacheHeader(config.searchSMaxAge, config.searchSMaxAge * 2), reason: "search-empty" };
    return { cacheable: true, cls, cacheControl: cacheHeader(config.searchSMaxAge, config.searchSMaxAge * 2), reason: "search" };
  }
  return { cacheable: true, cls, cacheControl: cacheHeader(config.sMaxAge, config.staleWhileRevalidate), reason: cls };
}

/** Browseren revaliderer altid (max-age=0); kun delte caches holder siden. */
export function cacheHeader(sMaxAge: number, swr: number): string {
  return `public, max-age=0, s-maxage=${sMaxAge}, stale-while-revalidate=${swr}`;
}

/** Cache-Tag til målrettet CDN-purge pr. by (se purge.ts). */
export function cacheTagForHost(host: string): string {
  return `host:${host.toLowerCase().replace(/^www\./, "").split(":")[0]}`;
}
