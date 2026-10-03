import { headers, cookies } from "next/headers";
import { notFound } from "next/navigation";
import { cache } from "react";
import { trustedHost } from "./trusted-host";
import { db } from "./db";
import type { Instance } from "@prisma/client";

export type SiteFarver = {
  accent: string;
  accentStrong: string;
  accentSoft: string;
  onAccent: string;
};

export type Site = Instance & {
  farverParsed: SiteFarver;
  colors: SiteFarver;
  tagline: string;
  kommune: string;
};

export function parseSiteColors(farver: unknown): SiteFarver {
  const defaults: SiteFarver = {
    accent: "#9E3D1B",
    accentStrong: "#7F2F13",
    accentSoft: "#F6E3D8",
    onAccent: "#FFFFFF",
  };
  if (!farver || typeof farver !== "object") return defaults;
  const f = farver as Record<string, string>;
  return {
    accent: f.accent || defaults.accent,
    accentStrong: f.accentStrong || f["accent-strong"] || defaults.accentStrong,
    accentSoft: f.accentSoft || f["accent-soft"] || defaults.accentSoft,
    onAccent: f.onAccent || f["on-accent"] || defaults.onAccent,
  };
}

import {
  ALL_NETWORK_SITES,
  DEFAULT_TAGLINES,
  domainForKey,
  siteOrigin,
  type NetworkSiteLink,
  type NetworkSiteSummary,
} from "./network-sites";
import { PREVIEW_COOKIE, isPreviewHost, previewHostsFromEnv } from "./preview";
export { ALL_NETWORK_SITES, DEFAULT_TAGLINES, type NetworkSiteLink, type NetworkSiteSummary };

const DEV_FALLBACK_DOMAIN = "slagelselokalt.dk";

export type SiteDomainResolution = {
  /** Domænet der skal slås op i Instance-tabellen, eller null hvis værten ikke kan mappes. */
  domain: string | null;
  /** Må vi falde tilbage til standardinstansen hvis opslaget fejler? Aldrig i produktion uden konfiguration. */
  allowFallback: boolean;
  fallbackDomain: string | null;
  /** Værten er en preview-vært (PREVIEW_HOSTS): byen vælges via cookien lk_by; ellers standardbyen, ellers første instans. */
  preview?: boolean;
};

/**
 * Ren funktion (testbar): oversætter en Host-header til et instans-domæne.
 *
 * - *.localhost: {by}lokalt.localhost -> {by}lokalt.dk
 * - bar localhost/127.0.0.1: DEFAULT_SITE_DOMAIN; cookie kun uden for produktion
 * - ukendt vært: i produktion 404 (eller FALLBACK_SITE_DOMAIN hvis sat), i udvikling standardinstans
 * - preview-vært (KUN hvis den står i `previewHosts`, dvs. env PREVIEW_HOSTS): byen vælges af `previewCookie` (lk_by, en by-nøgle fra
 *   hvidlisten); uden gyldig cookie bruges FALLBACK_SITE_DOMAIN, og getCurrentSite falder til sidst tilbage til første instans.
 *   Alle andre værter påvirkes ikke af previewHosts/previewCookie.
 */
export function resolveSiteDomain(
  host: string | null | undefined,
  options: {
    isProduction: boolean;
    devCookie?: string | null;
    defaultDomain?: string | null;
    fallbackDomain?: string | null;
    previewHosts?: readonly string[];
    previewCookie?: string | null;
  },
): SiteDomainResolution {
  const { isProduction } = options;
  const defaultDomain = options.defaultDomain || null;
  const fallbackDomain = options.fallbackDomain || null;
  const name = host ? host.split(":")[0].replace(/^www\./, "").toLowerCase().trim() : "";

  if (name && options.previewHosts && options.previewHosts.length > 0 && isPreviewHost(name, options.previewHosts)) {
    return {
      domain: domainForKey(options.previewCookie) ?? fallbackDomain,
      allowFallback: true,
      fallbackDomain: fallbackDomain || defaultDomain || null,
      preview: true,
    };
  }

  const bareLocal = !name || name === "localhost" || name === "127.0.0.1" || name === "[::1]";
  if (bareLocal) {
    const cookie = !isProduction ? options.devCookie?.toLowerCase().trim() : null;
    const domain = cookie || defaultDomain || (isProduction ? null : DEV_FALLBACK_DOMAIN);
    return { domain, allowFallback: false, fallbackDomain: null };
  }

  if (name.endsWith(".localhost")) {
    const sub = name.replace(/\.localhost$/, "");
    const domain = sub.endsWith("lokalt") ? `${sub}.dk` : `${sub}lokalt.dk`;
    return { domain, allowFallback: false, fallbackDomain: null };
  }

  // Rigtigt (eller ukendt) domæne
  return {
    domain: name,
    allowFallback: isProduction ? Boolean(fallbackDomain) : true,
    fallbackDomain: fallbackDomain || defaultDomain || (isProduction ? null : DEV_FALLBACK_DOMAIN),
  };
}

export const getCurrentSite = cache(async (overrideHost?: string): Promise<Site> => {
  const isProduction = process.env.NODE_ENV === "production";
  let host = overrideHost;
  let devCookieSite: string | undefined;
  let previewCookie: string | undefined;
  const previewHosts = previewHostsFromEnv();

  if (!host) {
    try {
      const h = await headers();
      // x-site er kun et udviklingsværktøj; i produktion må klienten ikke vælge tenant.
      const override = !isProduction ? h.get("x-site") : null;
      // Vært: Host (eller betroet X-Forwarded-Host, se lib/trusted-host.ts) — aldrig en klient-styrbar X-Forwarded-Host.
      host = override ?? trustedHost(h) ?? undefined;
    } catch {
      // Statisk generering eller uden for request-kontekst
      host = undefined;
    }

    if (!isProduction) {
      try {
        const cookieStore = await cookies();
        devCookieSite = cookieStore.get("site")?.value || cookieStore.get("active_site")?.value;
      } catch {
        devCookieSite = undefined;
      }
    }
  }

  // Preview-vært (PREVIEW_HOSTS): byen kommer fra cookien lk_by (sat af proxy.ts ved ?by=). Kun dér læses cookien.
  if (previewHosts.length > 0 && isPreviewHost(host, previewHosts)) {
    try {
      previewCookie = (await cookies()).get(PREVIEW_COOKIE)?.value;
    } catch {
      previewCookie = undefined;
    }
  }

  // Direkte domæne (fx test med overrideHost="naestvedlokalt.dk") bruges uændret.
  const resolution = resolveSiteDomain(host, {
    isProduction,
    devCookie: devCookieSite,
    defaultDomain: process.env.DEFAULT_SITE_DOMAIN,
    fallbackDomain: process.env.FALLBACK_SITE_DOMAIN,
    previewHosts,
    previewCookie,
  });

  let instance = resolution.domain
    ? await db.instance.findFirst({ where: { domaene: resolution.domain } })
    : null;

  if (!instance && resolution.allowFallback && resolution.fallbackDomain) {
    instance = await db.instance.findFirst({ where: { domaene: resolution.fallbackDomain } });
  }

  // Preview-vært uden cookie og uden (eksisterende) standardby: første instans, så preview altid viser noget.
  if (!instance && resolution.preview) {
    instance = await db.instance.findFirst({ orderBy: { createdAt: "asc" } });
  }

  if (!instance) {
    notFound();
  }

  const colors = parseSiteColors(instance.farver);
  const kommune = instance.navn.replace(/Lokalt$/i, "");
  const sideTekster = (instance.sideTekster as Record<string, string> | null) ?? null;
  const tagline = sideTekster?.tagline || DEFAULT_TAGLINES[instance.domaene] || `Lokaljournalistik for ${kommune}`;

  return {
    ...instance,
    farverParsed: colors,
    colors,
    tagline,
    kommune,
  };
});

/**
 * Links til alle byer i netværket, med origin beregnet ud fra den aktuelle vært
 * (https://{domæne} i produktion, http://{by}lokalt.localhost:PORT lokalt). På en preview-vært får hvert link `previewBy`.
 */
export async function getNetworkLinks(): Promise<NetworkSiteLink[]> {
  let host: string | null = null;
  let proto: string | null = null;
  try {
    const h = await headers();
    host = trustedHost(h);
    proto = h.get("x-forwarded-proto");
  } catch {
    host = null;
  }
  // På en preview-vært findes byernes domæner ikke endnu: linkene peger på samme vært med ?by=<nøgle> (se networkHref).
  const preview = isPreviewHost(host);
  return ALL_NETWORK_SITES.map((s) => ({
    ...s,
    origin: siteOrigin(s.domaene, host, proto),
    ...(preview ? { previewBy: s.key } : {}),
  }));
}

export async function getAllNetworkSites() {
  return db.instance.findMany({
    orderBy: { navn: "asc" },
  });
}
