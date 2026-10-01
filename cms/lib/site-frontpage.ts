import { db } from "@/lib/db";
import { mapArticleToSummary, type PublicArticleSummary } from "@/lib/site-queries";

const articleInclude = {
  kategori: { include: { parent: true } },
  forfatter: true,
  coverMedia: true,
  geoTags: true,
} as const;

/** Tags der bruges som "datakilde" til kalender og opslagstavle (der er ingen egne Event/Opslag-modeller endnu). */
export const CALENDAR_TAG_SLUGS = ["arrangement", "kalender", "det-sker"];
export const BOARD_TAG_SLUGS = ["opslagstavle", "opslag"];

/** Ekstra forsidedata, altid afgrænset til én instans (by). */
export async function getFrontpageExtras(instansId: string, excludeIds: string[] = []) {
  const base = { instansId, status: "Publiceret" } as const;

  const [senesteRaw, trafikRaw, mereRaw, partners] = await Promise.all([
    db.article.findMany({
      where: base,
      orderBy: { publiceretTid: "desc" },
      take: 6,
      include: articleInclude,
    }),
    db.article.findFirst({
      where: {
        ...base,
        kategori: { slug: "trafik" },
        publiceretTid: { gte: new Date(Date.now() - 3 * 24 * 3600 * 1000) },
      },
      orderBy: { publiceretTid: "desc" },
      include: articleInclude,
    }),
    db.article.findMany({
      where: { ...base, id: { notIn: excludeIds } },
      orderBy: { publiceretTid: "desc" },
      take: 4,
      include: articleInclude,
    }),
    getActivePartners(instansId),
  ]);

  return {
    senesteNyt: senesteRaw.map(mapArticleToSummary),
    trafik: trafikRaw ? mapArticleToSummary(trafikRaw) : null,
    mereFra: mereRaw.map(mapArticleToSummary),
    partners,
  };
}

/** Fyrtårnspartnere = aktive støtteaftaler for netop denne by. */
export async function getActivePartners(instansId: string): Promise<string[]> {
  const now = new Date();
  const rows = await db.supportAgreement.findMany({
    where: {
      instansId,
      startDato: { lte: now },
      OR: [{ slutDato: null }, { slutDato: { gte: now } }],
    },
    orderBy: { organisationNavn: "asc" },
    select: { organisationNavn: true },
  });
  return Array.from(new Set(rows.map((r) => r.organisationNavn)));
}

/** Publicerede artikler med et af de givne tag-slugs (pr. by). */
export async function getArticlesByTagSlugs(
  instansId: string,
  tagSlugs: string[],
  take = 24,
): Promise<PublicArticleSummary[]> {
  const rows = await db.article.findMany({
    where: { instansId, status: "Publiceret", tags: { some: { slug: { in: tagSlugs } } } },
    orderBy: { publiceretTid: "desc" },
    take,
    include: articleInclude,
  });
  return rows.map(mapArticleToSummary);
}

/** Seneste publicerede artikler i en sektion (inkl. undersektioner) – bruges som "i øvrigt"-spor på kalender m.m. */
export async function getLatestInSections(
  instansId: string,
  sectionSlugs: string[],
  take = 6,
): Promise<PublicArticleSummary[]> {
  const rows = await db.article.findMany({
    where: {
      instansId,
      status: "Publiceret",
      kategori: { OR: [{ slug: { in: sectionSlugs } }, { parent: { slug: { in: sectionSlugs } } }] },
    },
    orderBy: { publiceretTid: "desc" },
    take,
    include: articleInclude,
  });
  return rows.map(mapArticleToSummary);
}

/** Områder med antal publicerede artikler (pr. by). */
export async function getAreasWithCounts(instansId: string) {
  const areas = await db.geoTag.findMany({
    where: { instansId },
    orderBy: { navn: "asc" },
    include: { articles: { where: { status: "Publiceret" }, select: { id: true } } },
  });
  return areas.map((a) => ({ id: a.id, navn: a.navn, slug: a.slug, antal: a.articles.length }));
}

/** Emner: tags med publicerede artikler + undersektioner under "nyheder". */
export async function getTopicsOverview(instansId: string) {
  const [tags, nyheder] = await Promise.all([
    db.tag.findMany({
      where: { instansId, slug: { not: null } },
      orderBy: { navn: "asc" },
      include: { articles: { where: { status: "Publiceret" }, select: { id: true } } },
    }),
    db.category.findFirst({
      where: { instansId, slug: "nyheder", parentId: null },
      include: { children: { orderBy: { sortering: "asc" } } },
    }),
  ]);
  return {
    tags: tags
      .filter((t) => t.articles.length > 0 && t.slug)
      .map((t) => ({ id: t.id, navn: t.navn, slug: t.slug as string, antal: t.articles.length })),
    undersektioner: (nyheder?.children ?? []).map((c) => ({ id: c.id, navn: c.navn, slug: c.slug })),
  };
}
