import type { Metadata } from "next";
import { getCurrentSite, type Site } from "@/lib/site";
import { buildPageMetadata, type PageMetaOptions } from "./meta";

type Resolved = Pick<PageMetaOptions, "title" | "description"> & Partial<PageMetaOptions>;

/**
 * Genvej til statiske sider: `export const generateMetadata = () => pageMeta("/priser", (site) => ({ title, description }))`.
 * Giver canonical, OG/Twitter, robots, RSS-autodiscovery og host-regler via buildPageMetadata.
 * `noindex` kan være en bool eller en funktion (fx afhængig af env-flag).
 */
export async function pageMeta(
  path: string,
  resolve: (site: Site) => Resolved,
  extra: { noindex?: boolean | ((site: Site) => boolean | Promise<boolean>); nofollow?: boolean } = {},
): Promise<Metadata> {
  const site = await getCurrentSite();
  const r = resolve(site);
  const noindex = typeof extra.noindex === "function" ? await extra.noindex(site) : extra.noindex;
  return buildPageMetadata({ site, path, noindex, nofollow: extra.nofollow, ...r });
}
