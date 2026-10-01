import { db } from "@/lib/db";
import { CALENDAR_TAG_SLUGS, BOARD_TAG_SLUGS } from "@/lib/site-frontpage";
import type { StaticPageGate } from "./pages";

async function hasTaggedArticles(instansId: string, slugs: string[]): Promise<boolean> {
  const n = await db.article.count({
    where: { instansId, status: "Publiceret", tags: { some: { slug: { in: slugs } } } },
  });
  return n > 0;
}

/** Må siden indekseres / i sitemap? Tom kalender/opslagstavle er tynde sider -> noindex. */
export async function isGateOpen(gate: StaticPageGate, instansId: string, env: NodeJS.ProcessEnv = process.env): Promise<boolean> {
  if (gate === "always") return true;
  if (gate === "calendar") return env.SEO_INDEX_CALENDAR === "0" ? false : hasTaggedArticles(instansId, CALENDAR_TAG_SLUGS);
  return env.SEO_INDEX_BOARD === "0" ? false : hasTaggedArticles(instansId, BOARD_TAG_SLUGS);
}
