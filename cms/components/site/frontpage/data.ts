import { db } from "@/lib/db";
import { assignmentsByModule } from "@/lib/frontpage/compose";
import type { ModuleInstance } from "@/lib/frontpage/layout-schema";
import { getModuleDef } from "@/lib/frontpage/modules";
import type { SlotAssignment } from "@/lib/frontpage/types";
import { BOARD_TAG_SLUGS, CALENDAR_TAG_SLUGS, getArticlesByTagSlugs } from "@/lib/site-frontpage";
import { getActiveAds, mapArticleToSummary, type PublicArticleSummary } from "@/lib/site-queries";
import { EMPTY_EXTRAS, type FrontpageExtras, type FrontpageRenderContext, type SignalData } from "./types";

const DEFAULT_SOURCES: Record<string, string[]> = {
  "fra-kommunen": ["kommune_dagsorden", "kommune_pressemeddelelse"],
  "fra-politiet": ["politi", "beredskab_112"],
};

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
    const types = m.config.sourceTypes?.length ? m.config.sourceTypes : (DEFAULT_SOURCES[m.type] ?? []);
    const rows = await safe(
      db.signal.findMany({
        where: { instansId, maskinindsamlet: true, sourceType: { in: types } },
        orderBy: [{ kildeTidspunkt: "desc" }, { createdAt: "desc" }],
        take: m.slots,
      }),
      [],
    );
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

export async function buildRenderContext(
  site: { id: string; navn: string; kommune: string },
  modules: ModuleInstance[],
  assignments: SlotAssignment[],
): Promise<FrontpageRenderContext> {
  const [articles, extras] = await Promise.all([loadArticles(site.id, assignments), loadExtras(site.id, modules)]);
  return { site, modules, assignments: assignmentsByModule(assignments), articles, extras };
}
