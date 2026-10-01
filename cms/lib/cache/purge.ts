import { withTimeout } from "../resilience";

/**
 * Cloudflare cache-purge. No-op (returnerer { skipped: true }) medmindre CF_API_TOKEN og CF_ZONE_ID er sat, så lokal
 * udvikling og tests aldrig kalder nettet. Fejl kaster ALDRIG ind i redaktionelle actions: de logges og returneres.
 *
 * Bemærk: CF_ZONE_ID peger på ÉN zone. Har hvert by-domæne sin egen zone, så brug CF_ZONE_IDS som JSON
 * ({"naestvedlokalt.dk":"<zone-id>", ...}); ellers bruges CF_ZONE_ID til alle.
 * Purge pr. tag (`host:<domæne>`) kræver at planen understøtter Cache-Tag-purge; ellers bruges URL-purge
 * (forside, feeds, sitemaps + eksplicitte stier), som virker på alle planer. CF_PURGE_BY_TAG=1 slår tag-purge til.
 */

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export type PurgeResult = { ok: boolean; skipped?: boolean; purged?: number; error?: string };

type PurgeConfig = { token?: string; zoneId?: string; zoneIds?: Record<string, string>; fetchImpl?: FetchLike; timeoutMs?: number };

function zoneFor(domain: string | undefined, cfg: PurgeConfig): string | undefined {
  if (cfg.zoneIds && domain && cfg.zoneIds[domain]) return cfg.zoneIds[domain];
  if (cfg.zoneIds && !domain) return undefined;
  return cfg.zoneId;
}

function loadConfig(override: PurgeConfig = {}): PurgeConfig {
  let zoneIds = override.zoneIds;
  if (!zoneIds && process.env.CF_ZONE_IDS) {
    try {
      zoneIds = JSON.parse(process.env.CF_ZONE_IDS) as Record<string, string>;
    } catch {
      zoneIds = undefined;
    }
  }
  return {
    token: override.token ?? process.env.CF_API_TOKEN,
    zoneId: override.zoneId ?? process.env.CF_ZONE_ID,
    zoneIds,
    fetchImpl: override.fetchImpl,
    timeoutMs: override.timeoutMs ?? 3000,
  };
}

async function callPurge(zone: string, body: Record<string, unknown>, cfg: PurgeConfig): Promise<PurgeResult> {
  const doFetch: FetchLike = cfg.fetchImpl ?? ((u, i) => fetch(u, i));
  try {
    const res = await withTimeout(
      (signal) =>
        doFetch(`https://api.cloudflare.com/client/v4/zones/${encodeURIComponent(zone)}/purge_cache`, {
          method: "POST",
          signal,
          headers: { Authorization: `Bearer ${cfg.token}`, "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }),
      cfg.timeoutMs ?? 3000,
      "Cloudflare purge",
    );
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "ukendt fejl" };
  }
}

/** Cloudflare accepterer højst 30 URL'er/tags pr. kald. */
function chunk<T>(items: T[], size = 30): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

function hostOf(url: string): string | undefined {
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch {
    return undefined;
  }
}

export async function purgeUrls(urls: string[], override: PurgeConfig = {}): Promise<PurgeResult> {
  const cfg = loadConfig(override);
  if (!cfg.token || (!cfg.zoneId && !cfg.zoneIds)) return { ok: true, skipped: true };
  const unique = [...new Set(urls.filter((u) => /^https?:\/\//i.test(u)))];
  if (unique.length === 0) return { ok: true, purged: 0 };
  // Gruppér pr. zone
  const byZone = new Map<string, string[]>();
  for (const u of unique) {
    const zone = zoneFor(hostOf(u), cfg);
    if (!zone) continue;
    byZone.set(zone, [...(byZone.get(zone) ?? []), u]);
  }
  let purged = 0;
  for (const [zone, list] of byZone) {
    for (const part of chunk(list)) {
      const r = await callPurge(zone, { files: part }, cfg);
      if (!r.ok) {
        console.error(`[purge] URL-purge fejlede: ${r.error}`);
        return { ...r, purged };
      }
      purged += part.length;
    }
  }
  return { ok: true, purged };
}

export async function purgeTags(tags: string[], override: PurgeConfig & { domain?: string } = {}): Promise<PurgeResult> {
  const cfg = loadConfig(override);
  if (!cfg.token || (!cfg.zoneId && !cfg.zoneIds)) return { ok: true, skipped: true };
  const zone = zoneFor(override.domain, cfg);
  const unique = [...new Set(tags.filter(Boolean))];
  if (!zone || unique.length === 0) return { ok: true, purged: 0 };
  let purged = 0;
  for (const part of chunk(unique)) {
    const r = await callPurge(zone, { tags: part }, cfg);
    if (!r.ok) {
      console.error(`[purge] tag-purge fejlede: ${r.error}`);
      return { ...r, purged };
    }
    purged += part.length;
  }
  return { ok: true, purged };
}

/** Standard-URL'er der skal fornyes når en by publicerer noget. */
export function sitePurgeUrls(domain: string, extraPaths: string[] = []): string[] {
  const base = `https://${domain}`;
  const paths = ["/", "/feed.xml", "/rss.xml", "/sitemap.xml", "/news-sitemap.xml", ...extraPaths];
  return paths.map((p) => `${base}${p.startsWith("/") ? p : `/${p}`}`);
}

/**
 * Ryd en bys cache efter publicering/afpublicering/forsidegodkendelse. Kaldes fire-and-forget fra server actions:
 * `void purgeSite(domain)`. Aldrig exceptions.
 */
export async function purgeSite(domain: string | null | undefined, extraPaths: string[] = [], override: PurgeConfig = {}): Promise<PurgeResult> {
  if (!domain) return { ok: true, skipped: true };
  try {
    const byTag = process.env.CF_PURGE_BY_TAG === "1";
    if (byTag) return await purgeTags([`host:${domain}`], { ...override, domain });
    return await purgeUrls(sitePurgeUrls(domain, extraPaths), override);
  } catch (error) {
    console.error("[purge] uventet fejl:", error instanceof Error ? error.message : error);
    return { ok: false, error: "uventet fejl" };
  }
}

/** Som purgeSite, men slår domænet op fra instans-id (lazy import af db, så modulet er let at teste). */
export async function purgeInstance(instansId: string, extraPaths: string[] = []): Promise<PurgeResult> {
  if (!process.env.CF_API_TOKEN) return { ok: true, skipped: true };
  try {
    const { db } = await import("../db");
    const inst = await db.instance.findUnique({ where: { id: instansId }, select: { domaene: true } });
    return await purgeSite(inst?.domaene, extraPaths);
  } catch (error) {
    console.error("[purge] kunne ikke slå instans op:", error instanceof Error ? error.message : error);
    return { ok: false, error: "opslag fejlede" };
  }
}
