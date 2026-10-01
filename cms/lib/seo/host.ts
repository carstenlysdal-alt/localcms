/**
 * Host-kanonisering. Kun apex-domænet (`site.domaene`) må indekseres.
 * www.* redirectes i next.config.ts; ukendte værter får noindex (og robots Disallow: /).
 */

export type HostClassification = {
  host: string;
  /** Hosten er sidens eget domæne (med eller uden www) eller en lokal dev-vært. */
  known: boolean;
  isWww: boolean;
  isLocal: boolean;
};

export function isLocalDevHost(name: string): boolean {
  return name === "localhost" || name === "127.0.0.1" || name === "[::1]" || name.endsWith(".localhost");
}

/** Ren funktion (testbar). */
export function classifyHost(rawHost: string | null | undefined, siteDomain: string): HostClassification {
  const host = (rawHost ?? "").split(",")[0].trim().split(":")[0].toLowerCase();
  const isLocal = isLocalDevHost(host);
  const isWww = host.startsWith("www.");
  const apex = host.replace(/^www\./, "");
  const domain = siteDomain.replace(/^www\./, "").toLowerCase();
  return { host, isWww, isLocal, known: !host || isLocal || apex === domain };
}

/** Læser den faktiske request-host (ikke det klient-styrbare x-site). */
export async function getHostStatus(siteDomain: string): Promise<HostClassification> {
  try {
    const { headers } = await import("next/headers");
    const h = await headers();
    return classifyHost(h.get("x-forwarded-host") ?? h.get("host"), siteDomain);
  } catch {
    return classifyHost(null, siteDomain);
  }
}
