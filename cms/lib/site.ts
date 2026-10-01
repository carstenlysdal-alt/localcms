import { headers, cookies } from "next/headers";
import { notFound } from "next/navigation";
import { cache } from "react";
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

import { ALL_NETWORK_SITES, DEFAULT_TAGLINES, type NetworkSiteSummary } from "./network-sites";
export { ALL_NETWORK_SITES, DEFAULT_TAGLINES, type NetworkSiteSummary };

export const getCurrentSite = cache(async (overrideHost?: string): Promise<Site> => {
  let host = overrideHost;
  let devCookieSite: string | undefined;

  if (!host) {
    try {
      const h = await headers();
      host = h.get("x-site") ?? h.get("x-forwarded-host") ?? h.get("host") ?? undefined;
    } catch {
      // In static generation or non-request context
      host = undefined;
    }

    try {
      const cookieStore = await cookies();
      devCookieSite = cookieStore.get("site")?.value || cookieStore.get("active_site")?.value;
    } catch {
      devCookieSite = undefined;
    }
  }

  let domain = host ? host.split(":")[0].replace(/^www\./, "").toLowerCase() : "";

  // Lokalt og fallback til standard instans el. cookie
  if (!domain || domain === "localhost" || domain === "127.0.0.1") {
    if (devCookieSite) {
      domain = devCookieSite.toLowerCase().trim();
    } else {
      domain = process.env.DEFAULT_SITE_DOMAIN || "slagelselokalt.dk";
    }
  } else if (domain.endsWith(".localhost")) {
    const sub = domain.replace(/\.localhost$/, "");
    domain = sub.endsWith("lokalt") ? `${sub}.dk` : `${sub}lokalt.dk`;
  }

  let instance = await db.instance.findFirst({
    where: { domaene: domain },
  });

  if (!instance) {
    const fallbackDomain = process.env.DEFAULT_SITE_DOMAIN || "slagelselokalt.dk";
    instance = await db.instance.findFirst({
      where: { domaene: fallbackDomain },
    });
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

export async function getAllNetworkSites() {
  return db.instance.findMany({
    orderBy: { navn: "asc" },
  });
}
