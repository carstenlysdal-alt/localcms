import { headers } from "next/headers";
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

export const getCurrentSite = cache(async (overrideHost?: string): Promise<Site> => {
  let host = overrideHost;
  if (!host) {
    try {
      const h = await headers();
      host = h.get("host") ?? undefined;
    } catch {
      // In static generation or non-request context
      host = undefined;
    }
  }

  let domain = host ? host.split(":")[0].replace(/^www\./, "").toLowerCase() : "";

  // Lokalt og fallback til standard instans
  if (!domain || domain === "localhost" || domain === "127.0.0.1") {
    domain = process.env.DEFAULT_SITE_DOMAIN || "slagelselokalt.dk";
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

  return {
    ...instance,
    farverParsed: colors,
    colors,
    tagline: "Uafhængig lokaljournalistik, der sætter fællesskabet først",
    kommune,
  };
});
