import { db } from "@/lib/db";
import { calculateSupportedContentQuota } from "@/lib/frontpage-governance";
import { adBreakAllowance } from "@/lib/frontpage/guardrails";
import { assignmentsByModule } from "@/lib/frontpage/compose";
import type { ModuleInstance } from "@/lib/frontpage/layout-schema";
import { getModuleDef } from "@/lib/frontpage/modules";
import { loadPublicSignals } from "@/lib/frontpage/signals";
import { isCommercialType, type SlotAssignment } from "@/lib/frontpage/types";
import { BOARD_TAG_SLUGS, CALENDAR_TAG_SLUGS, getArticlesByTagSlugs } from "@/lib/site-frontpage";
import { getActiveAds, mapArticleToSummary, type PublicArticleSummary } from "@/lib/site-queries";
import { EMPTY_EXTRAS, type FrontpageExtras, type FrontpageRenderContext, type SignalData } from "./types";

const include = { kategori: { include: { parent: true } }, forfatter: true, coverMedia: true, geoTags: true } as const;

/** Hent artikler til placeringerne i ÉT kald (tenant + Publiceret håndhæves igen her). */
export async function loadArticles(instansId: string, assignments: readonly SlotAssignment[]): Promise<Record<string, PublicArticleSummary>> {
  const ids = [...new Set(assignments.map((a) => a.articleId))];
  if (!ids.length) return {};
  const rows = await db.article.findMany({ where: { id: { in: ids }, instansId, status: "Publiceret" }, include });
  return Object.fromEntries(rows.map((r) => [r.id, mapArticleToSummary(r)]));
}

/** Data til dynamiske moduler. Kun det layoutet faktisk bruger hentes. Fejl i én kilde fjerner kun det modul. */
export async function loadExtras(instansId: string, modules: readonly ModuleInstance[]): Promise<FrontpageExtras> {
  const visible = modules.filter((m) => m.visible);
  const has = (t: string) => visible.some((m) => m.type === t);
  const safe = async <T>(p: Promise<T>, fallback: T): Promise<T> => {
    try {
      return await p;
    } catch (error) {
      console.error("[frontpage] dynamisk modul kunne ikke hentes:", error);
      return fallback;
    }
  };
  const [ads, calendar, board, categories] = await Promise.all([
    has("ad-break") ? safe(getActiveAds(instansId), []) : Promise.resolve([]),
    has("kalender-strip") ? safe(getArticlesByTagSlugs(instansId, CALENDAR_TAG_SLUGS, 8), []) : Promise.resolve([]),
    has("opslagstavle") ? safe(getArticlesByTagSlugs(instansId, BOARD_TAG_SLUGS, 6), []) : Promise.resolve([]),
    has("sektion-rail") ? safe(db.category.findMany({ where: { instansId, parentId: null }, select: { slug: true, navn: true } }), []) : Promise.resolve([]),
  ]);

  const signals: Record<string, SignalData[]> = {};
  for (const m of visible.filter((x) => getModuleDef(x.type)?.dataSource === "Signal")) {
    // Kun redaktørgodkendte, friske signaler (og kun modulets område) — se lib/frontpage/signals.ts.
    const rows = await safe(loadPublicSignals(instansId, m), []);
    signals[m.id] = rows.map((r) => ({ id: r.id, overskrift: r.overskrift, kilde: r.kilde, kildeUrl: r.kildeUrl, sourceType: r.sourceType, tidspunkt: (r.kildeTidspunkt ?? r.createdAt).toISOString() }));
  }

  return {
    ...EMPTY_EXTRAS,
    ads: ads.filter((a) => a.placeringZone !== "artikel"),
    calendar,
    board,
    signals,
    sectionNames: Object.fromEntries(categories.map((c) => [c.slug, c.navn])),
  };
}

/**
 * Kvoteloft for annoncer (T6 nr. 18): annoncekampagner i ad-break-moduler tæller som kommerciel placering. Antallet af
 * viste annoncer begrænses, så kommercielt indhold (artikler + annoncer) holder sig under instansens loft, og ingen
 * annoncer vises når 7-dages-kvoten er nået. Breaking-bar tæller ikke (den peger på artikler vist andetsteds).
 */
export async function limitAdsByQuota(
  instansId: string,
  modules: readonly ModuleInstance[],
  assignments: readonly SlotAssignment[],
  articles: Record<string, { indholdstype: string }>,
  extras: FrontpageExtras,
): Promise<FrontpageExtras> {
  if (extras.ads.length === 0) return extras;
  const adModules = modules.filter((m) => m.visible && m.type === "ad-break").length;
  if (adModules === 0) return extras;
  let quota = { kvoteloftProcent: 25, isExceeded: false };
  try {
    quota = await calculateSupportedContentQuota(instansId);
  } catch (error) {
    console.error("[frontpage] kvote kunne ikke beregnes — annoncer skjules for en sikkerheds skyld:", error);
    return { ...extras, ads: [] };
  }
  const byModule = new Map(modules.map((m) => [m.id, m]));
  const counted = assignments.filter((a) => {
    const m = byModule.get(a.moduleId);
    return m?.visible && m.type !== "breaking-bar";
  });
  const allowed = adBreakAllowance({
    filledArticleSlots: counted.length,
    commercialArticleSlots: counted.filter((a) => isCommercialType(articles[a.articleId]?.indholdstype ?? "")).length,
    adUnits: Math.min(extras.ads.length, adModules),
    kvoteloftProcent: quota.kvoteloftProcent,
    quotaExceeded: quota.isExceeded,
  });
  return allowed >= extras.ads.length ? extras : { ...extras, ads: extras.ads.slice(0, allowed) };
}

export async function buildRenderContext(
  site: { id: string; navn: string; kommune: string },
  modules: ModuleInstance[],
  assignments: SlotAssignment[],
): Promise<FrontpageRenderContext> {
  const [articles, extras] = await Promise.all([loadArticles(site.id, assignments), loadExtras(site.id, modules)]);
  const limited = await limitAdsByQuota(site.id, modules, assignments, articles, extras);
  return { site, modules, assignments: assignmentsByModule(assignments), articles, extras: limited };
}
