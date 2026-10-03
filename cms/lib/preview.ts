/**
 * Preview-værter: ét delt hostnavn (fx Railway-adressen), hvor ALLE seks byer kan ses, mens ejeren endnu ikke har egne domæner.
 *
 * Aktiveres KUN af env PREVIEW_HOSTS (kommasepareret hostnavne, uden skema/port/sti). På en preview-vært vælges byen med
 * `?by=<nøgle>` (slagelse, naestved, holbaek, koege, roskilde, ringsted — se cityKey() i lib/network-sites.ts). Proxyen sætter da
 * cookien `lk_by` (HttpOnly, SameSite=Lax, 30 dage) og 303-omdirigerer til samme URL uden parameteren; senere forespørgsler læser cookien.
 *
 * Grænser (sikkerhed):
 *  - Kun hvidlistede værter. Rigtige by-domæner og ukendte værter opfører sig præcis som før.
 *  - Cookien rummer kun en nøgle fra hvidlisten over de seks byer, aldrig et domæne/id fra klienten.
 *  - Påvirker aldrig /redaktion (brugerens egen instansId), /api/ingest (API-nøgle -> instans) eller /api/cron.
 *  - Alt på en preview-vært er noindex/nofollow og aldrig delt-cache'bart (svaret varierer pr. cookie).
 *  - En by-domæneværdi i PREVIEW_HOSTS ignoreres (ellers kunne en rigtig by blive noindex'et — eller omvendt en preview-vært
 *    blive indekseret som den by).
 *
 * Denne fil er ren (ingen next/headers) og kan bruges fra proxy, server-komponenter og tests.
 */
import { ALL_NETWORK_SITES } from "./network-sites";
import { isValidHost } from "./trusted-host";

export const PREVIEW_COOKIE = "lk_by";
export const PREVIEW_PARAM = "by";
export const PREVIEW_COOKIE_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

/** Hostnavn uden port, små bogstaver (og uden afsluttende punktum). */
export function hostName(host: string | null | undefined): string {
  return (host ?? "").split(",")[0].trim().toLowerCase().replace(/:\d{1,5}$/, "").replace(/\.$/, "");
}

/** Er hostnavnet en af de kendte by-domæner (med eller uden www.)? */
export function isCityDomainHost(host: string | null | undefined): boolean {
  const name = hostName(host).replace(/^www\./, "");
  return ALL_NETWORK_SITES.some((s) => s.domaene === name);
}

export type PreviewHostsParse = {
  /** Gyldige hostnavne, der kan bruges som preview-værter. */
  hosts: string[];
  /** Poster der blev afvist, fordi de er rigtige by-domæner (fejlkonfiguration). */
  cityDomainConflicts: string[];
  /** Poster der ikke er gyldige hostnavne. */
  invalid: string[];
};

/** Ren parser (testbar) af PREVIEW_HOSTS. Tom/ugyldig -> ingen preview-værter. By-domæner kommer aldrig med. */
export function parsePreviewHosts(raw: string | null | undefined): PreviewHostsParse {
  const result: PreviewHostsParse = { hosts: [], cityDomainConflicts: [], invalid: [] };
  if (!raw) return result;
  for (const part of raw.split(",")) {
    const entry = part.trim().toLowerCase();
    if (!entry) continue;
    const name = hostName(entry);
    // Kun rene hostnavne: ingen skema, sti, wildcard eller port-krav (porten ignoreres ved sammenligning).
    if (!name || /[/@*\s]/.test(entry) || !isValidHost(name)) {
      result.invalid.push(entry);
      continue;
    }
    if (isCityDomainHost(name)) {
      result.cityDomainConflicts.push(entry);
      continue;
    }
    if (!result.hosts.includes(name)) result.hosts.push(name);
  }
  return result;
}

/** Preview-værterne fra env (PREVIEW_HOSTS). */
export function previewHostsFromEnv(env: NodeJS.ProcessEnv = process.env): string[] {
  return parsePreviewHosts(env.PREVIEW_HOSTS).hosts;
}

/** Er værten (evt. med port) en preview-vært? */
export function isPreviewHost(host: string | null | undefined, hosts: readonly string[] = previewHostsFromEnv()): boolean {
  if (hosts.length === 0) return false;
  const name = hostName(host);
  return Boolean(name) && hosts.includes(name);
}

/**
 * Stier hvor ?by= må sætte cookien. Aldrig /redaktion, /login, /api (ingest, cron, auth …) eller statiske ressourcer:
 * her sker der ingen by-skift, så ?by= kan hverken påvirke redaktionens tenancy eller en API-nøgles instans.
 */
export function previewParamApplies(pathname: string): boolean {
  if (pathname === "/redaktion" || pathname.startsWith("/redaktion/")) return false;
  if (pathname === "/login" || pathname.startsWith("/login/")) return false;
  if (pathname === "/api" || pathname.startsWith("/api/")) return false;
  if (pathname.startsWith("/_next/")) return false;
  return true;
}

/** Cookie-indstillinger for lk_by. `secure` kun over https (ellers afviser browseren cookien på http://localhost). */
export function previewCookieOptions(secure: boolean) {
  return {
    httpOnly: true,
    secure,
    sameSite: "lax" as const,
    path: "/",
    maxAge: PREVIEW_COOKIE_MAX_AGE_SECONDS,
  };
}
