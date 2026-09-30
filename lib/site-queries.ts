import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { calculateArticleScore, ArticleDistributionInput } from "@/lib/distribution-engine";

export type PublicArticleSummary = {
  id: string;
  titel: string;
  manchet: string;
  slug: string;
  href: string;
  publiceretTid: Date;
  indholdstype: "Uafhængig" | "Partner" | "Sponsoreret" | "Brugerindsendt" | "AI-assisteret" | "PR";
  marking: Record<string, unknown> | null;
  breaking: boolean;
  pinned: boolean;
  sektion: {
    navn: string;
    slug: string;
  };
  undersektion?: {
    navn: string;
    slug: string;
  } | null;
  omraade?: {
    navn: string;
    slug: string;
  } | null;
  forfatter?: {
    navn: string;
    slug: string;
    bio?: string | null;
    profilbilledeUrl?: string | null;
  } | null;
  coverMedia?: {
    id: string;
    url: string;
    altTekst: string | null;
    billedtekst: string | null;
    ophavsperson: string | null;
  } | null;
};

export function formatRelativeTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHours = Math.floor(diffMin / 60);

  if (diffMin < 1) return "Lige nu";
  if (diffMin < 60) return `${diffMin} min.`;
  // Tjek om datoen var i går
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    d.getDate() === yesterday.getDate() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getFullYear() === yesterday.getFullYear();

  const timeStr = d.toLocaleTimeString("da-DK", { hour: "2-digit", minute: "2-digit" });
  if (isYesterday) return `I går ${timeStr}`;

  if (diffHours < 24) return `${diffHours} t.`;

  // Ældre: f.eks. "28. sep." eller "28. sep. 2025" hvis forskelligt år
  const sameYear = d.getFullYear() === now.getFullYear();
  const dateStr = d.toLocaleDateString("da-DK", {
    day: "numeric",
    month: "short",
    ...(sameYear ? {} : { year: "numeric" }),
  });
  return `${dateStr} ${timeStr}`;
}

export function formatFullDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("da-DK", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDateDivider(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const now = new Date();

  const isToday =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();

  if (isToday) return "I dag";

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    d.getDate() === yesterday.getDate() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getFullYear() === yesterday.getFullYear();

  if (isYesterday) return "I går";

  return d.toLocaleDateString("da-DK", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function mapArticleToSummary(article: {
  id: string;
  titel: string;
  manchet: string | null;
  slug: string;
  publiceretTid: Date | null;
  indholdstype: string;
  marking: unknown;
  breaking: boolean;
  pinned: boolean;
  kategori: {
    navn: string;
    slug: string;
    parent?: { navn: string; slug: string } | null;
  } | null;
  forfatter: {
    navn: string;
    slug: string | null;
    bio: string | null;
    profilbilledeUrl: string | null;
  } | null;
  coverMedia: {
    id: string;
    url: string;
    altTekst: string | null;
    billedtekst: string | null;
    ophavsperson: string | null;
  } | null;
  geoTags?: Array<{ navn: string; slug: string | null }>;
}): PublicArticleSummary {
  let sektion = { navn: "Nyheder", slug: "nyheder" };
  let undersektion: { navn: string; slug: string } | null = null;

  if (article.kategori) {
    if (article.kategori.parent) {
      sektion = {
        navn: article.kategori.parent.navn,
        slug: article.kategori.parent.slug,
      };
      undersektion = {
        navn: article.kategori.navn,
        slug: article.kategori.slug,
      };
    } else {
      sektion = {
        navn: article.kategori.navn,
        slug: article.kategori.slug,
      };
    }
  }

  const primaryGeo = article.geoTags && article.geoTags.length > 0 ? article.geoTags[0] : null;

  return {
    id: article.id,
    titel: article.titel,
    manchet: article.manchet ?? "",
    slug: article.slug,
    href: `/${sektion.slug}/${article.slug}`,
    publiceretTid: article.publiceretTid ?? new Date(),
    indholdstype: article.indholdstype as PublicArticleSummary["indholdstype"],
    marking: article.marking && typeof article.marking === "object" ? (article.marking as Record<string, unknown>) : null,
    breaking: article.breaking,
    pinned: article.pinned,
    sektion,
    undersektion,
    omraade: primaryGeo ? { navn: primaryGeo.navn, slug: primaryGeo.slug ?? "" } : null,
    forfatter: article.forfatter
      ? {
          navn: article.forfatter.navn,
          slug: article.forfatter.slug ?? "",
          bio: article.forfatter.bio,
          profilbilledeUrl: article.forfatter.profilbilledeUrl,
        }
      : null,
    coverMedia: article.coverMedia,
  };
}

export async function getSiteNavigation(instansId: string) {
  const [categories, areas] = await Promise.all([
    db.category.findMany({
      where: { instansId, parentId: null, iNavigation: true },
      orderBy: { sortering: "asc" },
      include: {
        children: {
          orderBy: { sortering: "asc" },
        },
      },
    }),
    db.geoTag.findMany({
      where: { instansId },
      orderBy: { navn: "asc" },
    }),
  ]);

  return { categories, areas };
}

export async function getFrontpageData(instansId: string, areaFilterSlug?: string) {
  const baseWhere: Prisma.ArticleWhereInput = {
    instansId,
    status: "Publiceret",
  };

  // 1. Seneste nyt (1 nyhed)
  const seneste = await db.article.findFirst({
    where: baseWhere,
    orderBy: { publiceretTid: "desc" },
    include: {
      kategori: { include: { parent: true } },
      forfatter: true,
      coverMedia: true,
      geoTags: true,
    },
  });

  // Hent aktive fastgjorte forsideplaceringer (A-03, Del 4 §4)
  const activePlacements = await db.frontpagePlacement.findMany({
    where: {
      instansId,
      OR: [{ udloebTid: null }, { udloebTid: { gt: new Date() } }],
    },
    include: {
      article: {
        include: {
          metric: true,
          kategori: { include: { parent: true } },
          forfatter: true,
          coverMedia: true,
          geoTags: true,
        },
      },
    },
    orderBy: [{ zone: "asc" }, { position: "asc" }, { createdAt: "desc" }],
  });

  const pinnedHoved = activePlacements.find((p) => p.zone === "top-hoved" && p.article.status === "Publiceret");
  const pinnedSekundaere = activePlacements
    .filter((p) => p.zone === "top-sekundaer" && p.article.status === "Publiceret")
    .map((p) => p.article);

  // 2. Tophistorier: Algoritmisk scoring med redaktionelt veto, decay, velocity og daypart
  const candidateArticles = await db.article.findMany({
    where: baseWhere,
    orderBy: { publiceretTid: "desc" },
    take: 20,
    include: {
      metric: true,
      kategori: { include: { parent: true } },
      forfatter: true,
      coverMedia: true,
      geoTags: true,
    },
  });

  const scoredCandidates = candidateArticles.map((art) => {
    const sektionSlug = art.kategori?.parent?.slug || art.kategori?.slug || "nyheder";
    const omraadeSlug = art.geoTags?.[0]?.slug || null;
    const scoreResult = calculateArticleScore({
      id: art.id,
      titel: art.titel,
      publiceretTid: art.publiceretTid ?? art.createdAt,
      indholdstype: art.indholdstype as ArticleDistributionInput["indholdstype"],
      breaking: art.breaking,
      pinned: art.pinned,
      sektionSlug,
      omraadeSlug,
      visninger: art.metric?.visninger ?? 0,
      laesninger: art.metric?.laesninger ?? 0,
      totalLaesetidSek: art.metric?.totalLaesetidSek ?? 0,
    });
    return { article: art, score: scoreResult.totalScore };
  });

  scoredCandidates.sort((a, b) => b.score - a.score);
  const topCandidates = scoredCandidates.slice(0, 5).map((s) => s.article);

  const excludedIds = new Set<string>();
  if (seneste) excludedIds.add(seneste.id);
  topCandidates.forEach((a) => excludedIds.add(a.id));

  // 4. Kort nyt (tekst-liste, 6-8 artikler, f.eks. AI-assisteret eller korte meldinger)
  const kortNyt = await db.article.findMany({
    where: {
      ...baseWhere,
      id: { notIn: Array.from(excludedIds) },
      OR: [
        { indholdstype: "AI-assisteret" },
        { tags: { some: { navn: { in: ["Kort nyt", "Ritzau", "Telegram"] } } } },
      ],
    },
    orderBy: { publiceretTid: "desc" },
    take: 8,
    include: {
      kategori: { include: { parent: true } },
      forfatter: true,
      coverMedia: true,
      geoTags: true,
    },
  });
  kortNyt.forEach((a) => excludedIds.add(a.id));

  // 3. Fra dit område (3 artikler fra valgt område eller med vilkårligt geotag)
  const areaWhere: Prisma.ArticleWhereInput = {
    ...baseWhere,
    id: { notIn: Array.from(excludedIds) },
    ...(areaFilterSlug
      ? { geoTags: { some: { slug: areaFilterSlug } } }
      : { geoTags: { some: {} } }),
  };

  const omraadeArtikler = await db.article.findMany({
    where: areaWhere,
    orderBy: { publiceretTid: "desc" },
    take: 3,
    include: {
      kategori: { include: { parent: true } },
      forfatter: true,
      coverMedia: true,
      geoTags: true,
    },
  });
  omraadeArtikler.forEach((a) => excludedIds.add(a.id));

  // 7. Sektionsblokke i DESIGN.md §6a.4 rækkefølge:
  // Nyheder, Sport, Erhverv, Kultur, Foreningsliv, Debat
  const sectionSlugs = ["nyheder", "sport", "erhverv", "kultur", "foreningsliv", "debat"];
  const sektionsBlokke: Array<{
    sektion: { navn: string; slug: string };
    artikler: PublicArticleSummary[];
  }> = [];

  for (const slug of sectionSlugs) {
    const cat = await db.category.findFirst({
      where: { instansId, slug, parentId: null },
      include: { children: true },
    });
    if (!cat) continue;

    const catIds = [cat.id, ...cat.children.map((c) => c.id)];
    const articles = await db.article.findMany({
      where: {
        ...baseWhere,
        kategoriId: { in: catIds },
      },
      orderBy: { publiceretTid: "desc" },
      take: 4,
      include: {
        kategori: { include: { parent: true } },
        forfatter: true,
        coverMedia: true,
        geoTags: true,
      },
    });

    if (articles.length > 0) {
      sektionsBlokke.push({
        sektion: { navn: cat.navn, slug: cat.slug },
        artikler: articles.map(mapArticleToSummary),
      });
    }
  }

  // 5. Fra borgerne (Brugerindsendt, spor A)
  const borgerArtikler = await db.article.findMany({
    where: {
      ...baseWhere,
      indholdstype: "Brugerindsendt",
    },
    orderBy: { publiceretTid: "desc" },
    take: 3,
    include: {
      kategori: { include: { parent: true } },
      forfatter: true,
      coverMedia: true,
      geoTags: true,
    },
  });

  const mainArticle = pinnedHoved ? pinnedHoved.article : topCandidates[0] ?? null;
  const secondaryCandidates: Array<typeof topCandidates[0]> = [];

  // Tilføj først fastgjorte sekundære artikler
  for (const art of pinnedSekundaere) {
    if (mainArticle && art.id === mainArticle.id) continue;
    if (!secondaryCandidates.some((c) => c.id === art.id)) {
      secondaryCandidates.push(art);
    }
  }

  // Fyld op fra topCandidates hvis der mangler sekundære artikler
  for (const art of topCandidates) {
    if (secondaryCandidates.length >= 2) break;
    if (mainArticle && art.id === mainArticle.id) continue;
    if (!secondaryCandidates.some((c) => c.id === art.id)) {
      secondaryCandidates.push(art);
    }
  }

  return {
    seneste: seneste ? mapArticleToSummary(seneste) : null,
    tophistorie: mainArticle ? mapArticleToSummary(mainArticle) : null,
    topSekundaere: secondaryCandidates.slice(0, 2).map(mapArticleToSummary),
    kortNyt: kortNyt.map(mapArticleToSummary),
    omraadeArtikler: omraadeArtikler.map(mapArticleToSummary),
    sektionsBlokke,
    borgerArtikler: borgerArtikler.map(mapArticleToSummary),
  };
}

export async function getSectionData(
  instansId: string,
  sectionSlug: string,
  options: {
    subcategorySlug?: string;
    areaSlug?: string;
    page?: number;
    take?: number;
  } = {}
) {
  const { subcategorySlug, areaSlug, page = 1, take = 20 } = options;

  const section = await db.category.findFirst({
    where: { instansId, slug: sectionSlug, parentId: null },
    include: {
      children: {
        orderBy: { sortering: "asc" },
      },
    },
  });

  if (!section) return null;

  let activeSubcategory = null;
  let categoryIds = [section.id, ...section.children.map((c) => c.id)];

  if (subcategorySlug) {
    activeSubcategory = section.children.find((c) => c.slug === subcategorySlug) ?? null;
    if (!activeSubcategory) return null;
    categoryIds = [activeSubcategory.id];
  }

  const where: Prisma.ArticleWhereInput = {
    instansId,
    status: "Publiceret",
    kategoriId: { in: categoryIds },
    ...(areaSlug ? { geoTags: { some: { slug: areaSlug } } } : {}),
  };

  const [totalCount, articles] = await Promise.all([
    db.article.count({ where }),
    db.article.findMany({
      where,
      orderBy: [{ pinned: "desc" }, { publiceretTid: "desc" }],
      skip: (page - 1) * take,
      take,
      include: {
        kategori: { include: { parent: true } },
        forfatter: true,
        coverMedia: true,
        geoTags: true,
      },
    }),
  ]);

  const summaries = articles.map(mapArticleToSummary);

  const subcategoryBlocks: Array<{
    subcategory: { navn: string; slug: string };
    artikler: PublicArticleSummary[];
  }> = [];

  if (!subcategorySlug && page === 1 && !areaSlug) {
    for (const child of section.children) {
      const childArticles = await db.article.findMany({
        where: {
          instansId,
          status: "Publiceret",
          kategoriId: child.id,
        },
        orderBy: { publiceretTid: "desc" },
        take: 3,
        include: {
          kategori: { include: { parent: true } },
          forfatter: true,
          coverMedia: true,
          geoTags: true,
        },
      });

      if (childArticles.length > 0) {
        subcategoryBlocks.push({
          subcategory: { navn: child.navn, slug: child.slug },
          artikler: childArticles.map(mapArticleToSummary),
        });
      }
    }
  }

  const mestLaeste = await db.article.findMany({
    where: {
      instansId,
      status: "Publiceret",
      kategoriId: { in: [section.id, ...section.children.map((c) => c.id)] },
    },
    orderBy: { publiceretTid: "desc" },
    take: 5,
    include: {
      kategori: { include: { parent: true } },
      forfatter: true,
      coverMedia: true,
      geoTags: true,
    },
  });

  return {
    section,
    activeSubcategory,
    totalCount,
    hovedhistorie: summaries[0] ?? null,
    sekundaereTop: summaries.slice(1, 3),
    oevrige: summaries.slice(3),
    alleArtikler: summaries,
    subcategoryBlocks,
    mestLaeste: mestLaeste.map(mapArticleToSummary),
    page,
    totalPages: Math.ceil(totalCount / take),
  };
}

export async function getArticleBySlug(instansId: string, sectionSlug: string, slug: string) {
  const article = await db.article.findFirst({
    where: {
      instansId,
      slug,
      status: "Publiceret",
    },
    include: {
      kategori: { include: { parent: true } },
      forfatter: true,
      coverMedia: true,
      tags: true,
      geoTags: true,
      corrections: {
        orderBy: { dato: "desc" },
      },
    },
  });

  if (!article) return null;

  const relaterede = await db.article.findMany({
    where: {
      instansId,
      status: "Publiceret",
      id: { not: article.id },
      ...(article.geoTags.length > 0
        ? { geoTags: { some: { id: { in: article.geoTags.map((g) => g.id) } } } }
        : article.kategoriId
        ? { kategoriId: article.kategoriId }
        : {}),
    },
    orderBy: { publiceretTid: "desc" },
    take: 3,
    include: {
      kategori: { include: { parent: true } },
      forfatter: true,
      coverMedia: true,
      geoTags: true,
    },
  });

  return {
    article,
    summary: mapArticleToSummary(article),
    relaterede: relaterede.map(mapArticleToSummary),
  };
}

export async function getAreaArticles(
  instansId: string,
  areaSlug: string,
  options: { page?: number; take?: number } = {}
) {
  const { page = 1, take = 20 } = options;

  const area = await db.geoTag.findFirst({
    where: { instansId, slug: areaSlug },
  });

  if (!area) return null;

  const where: Prisma.ArticleWhereInput = {
    instansId,
    status: "Publiceret",
    geoTags: { some: { id: area.id } },
  };

  const [totalCount, articles] = await Promise.all([
    db.article.count({ where }),
    db.article.findMany({
      where,
      orderBy: { publiceretTid: "desc" },
      skip: (page - 1) * take,
      take,
      include: {
        kategori: { include: { parent: true } },
        forfatter: true,
        coverMedia: true,
        geoTags: true,
      },
    }),
  ]);

  return {
    area,
    totalCount,
    artikler: articles.map(mapArticleToSummary),
    page,
    totalPages: Math.ceil(totalCount / take),
  };
}

export async function getTopicArticles(
  instansId: string,
  topicSlug: string,
  options: { page?: number; take?: number } = {}
) {
  const { page = 1, take = 20 } = options;

  const tag = await db.tag.findFirst({
    where: { instansId, slug: topicSlug },
  });

  if (!tag) return null;

  const where: Prisma.ArticleWhereInput = {
    instansId,
    status: "Publiceret",
    tags: { some: { id: tag.id } },
  };

  const [totalCount, articles] = await Promise.all([
    db.article.count({ where }),
    db.article.findMany({
      where,
      orderBy: { publiceretTid: "desc" },
      skip: (page - 1) * take,
      take,
      include: {
        kategori: { include: { parent: true } },
        forfatter: true,
        coverMedia: true,
        geoTags: true,
      },
    }),
  ]);

  return {
    tag,
    totalCount,
    artikler: articles.map(mapArticleToSummary),
    page,
    totalPages: Math.ceil(totalCount / take),
  };
}

export async function getAuthorArticles(
  instansId: string,
  authorSlug: string,
  options: { page?: number; take?: number } = {}
) {
  const { page = 1, take = 20 } = options;

  const author = await db.author.findFirst({
    where: { instansId, slug: authorSlug },
  });

  if (!author) return null;

  const where: Prisma.ArticleWhereInput = {
    instansId,
    status: "Publiceret",
    forfatterId: author.id,
  };

  const [totalCount, articles] = await Promise.all([
    db.article.count({ where }),
    db.article.findMany({
      where,
      orderBy: { publiceretTid: "desc" },
      skip: (page - 1) * take,
      take,
      include: {
        kategori: { include: { parent: true } },
        forfatter: true,
        coverMedia: true,
        geoTags: true,
      },
    }),
  ]);

  return {
    author,
    totalCount,
    artikler: articles.map(mapArticleToSummary),
    page,
    totalPages: Math.ceil(totalCount / take),
  };
}

export async function searchSiteArticles(
  instansId: string,
  query: string,
  options: {
    sectionSlug?: string;
    areaSlug?: string;
    page?: number;
    take?: number;
  } = {}
) {
  const { sectionSlug, areaSlug, page = 1, take = 20 } = options;
  const q = query.trim();

  const where: Prisma.ArticleWhereInput = {
    instansId,
    status: "Publiceret",
    ...(q
      ? {
          OR: [
            { titel: { contains: q } },
            { manchet: { contains: q } },
          ],
        }
      : {}),
    ...(sectionSlug
      ? {
          kategori: {
            OR: [
              { slug: sectionSlug },
              { parent: { slug: sectionSlug } },
            ],
          },
        }
      : {}),
    ...(areaSlug
      ? {
          geoTags: { some: { slug: areaSlug } },
        }
      : {}),
  };

  const [totalCount, articles] = await Promise.all([
    db.article.count({ where }),
    db.article.findMany({
      where,
      orderBy: { publiceretTid: "desc" },
      skip: (page - 1) * take,
      take,
      include: {
        kategori: { include: { parent: true } },
        forfatter: true,
        coverMedia: true,
        geoTags: true,
      },
    }),
  ]);

  return {
    totalCount,
    artikler: articles.map(mapArticleToSummary),
    page,
    totalPages: Math.ceil(totalCount / take),
  };
}

export async function getActiveAds(instansId: string, zone?: string) {
  const now = new Date();
  const campaigns = await db.adCampaign.findMany({
    where: {
      instansId,
      status: "Aktiv",
      startDato: { lte: now },
      slutDato: { gte: now },
      ...(zone ? { placeringZone: zone } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 3,
  });

  return campaigns.map((c) => ({
    id: c.id,
    titel: c.titel,
    annoncoer: c.annoncoer,
    format: c.format,
    placeringZone: c.placeringZone,
    kreativData: (c.kreativData && typeof c.kreativData === "object" ? c.kreativData : {}) as {
      overskrift?: string;
      manchet?: string;
      ctaTekst?: string;
      linkUrl?: string;
      badgeTekst?: string;
      farve?: string;
      billedeUrl?: string;
    },
  }));
}
