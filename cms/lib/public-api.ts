import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { db } from "./db";

/**
 * Delt kontrakt for GET /api/articles og GET /api/articles/[slug].
 *
 * Svar: { data: PublicArticle | PublicArticle[], count?: number, site: { domaene } }
 *  - kun status "Publiceret" og KUN den aktuelle sites instans (host -> getCurrentSite)
 *  - `marking` er reduceret til de offentlige felter (aldrig oprindeligKontakt/aftaleId/godkendtAf)
 *  - `blocks[].data.content` (type paragraph) er HTML — modtagere skal selv sanitere ved rendering
 *  - ingen interne felter: aiBrug-detaljer, revisioner, honorar, kontaktdata
 */
export const PUBLIC_ARTICLE_SELECT = {
  id: true, titel: true, manchet: true, slug: true, blocks: true,
  indholdstype: true, marking: true, aiBrug: true, pinned: true, breaking: true,
  seoTitel: true, seoBeskrivelse: true, sprog: true, publiceretTid: true, opdateretTid: true,
  kategori: { select: { navn: true, slug: true } },
  coverMedia: { select: { id: true, url: true, altTekst: true, billedtekst: true, ophavsperson: true } },
  forfatter: { select: { navn: true, bio: true, profilbilledeUrl: true } },
  tags: { select: { navn: true } },
  geoTags: { select: { navn: true } },
} satisfies Prisma.ArticleSelect;

export type PublicArticleRow = Prisma.ArticleGetPayload<{ select: typeof PUBLIC_ARTICLE_SELECT }>;

const PUBLIC_MARKING_KEYS = ["sponsor", "labelTekst", "afsender", "kilder"] as const;

export function publicMarking(marking: unknown): Record<string, unknown> | null {
  if (!marking || typeof marking !== "object" || Array.isArray(marking)) return null;
  const source = marking as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const key of PUBLIC_MARKING_KEYS) if (source[key] !== undefined && source[key] !== "") out[key] = source[key];
  return Object.keys(out).length ? out : null;
}

export function toPublicArticle(row: PublicArticleRow) {
  const { marking, aiBrug, ...rest } = row;
  return {
    ...rest,
    marking: publicMarking(marking),
    // Offentlig AI-gennemsigtighed: kun om AI er brugt (ikke detaljer).
    aiBrugt: Array.isArray(aiBrug) ? aiBrug.some((v) => typeof v === "string" && v !== "Ingen") : false,
  };
}

export const PUBLIC_CACHE_HEADERS = {
  // Pr. host (Vary: Host) — ét svar pr. by. Kort s-maxage, så rettelser/tilbagetrækninger slår hurtigt igennem.
  "Cache-Control": "public, max-age=30, s-maxage=60, stale-while-revalidate=300",
  Vary: "Host",
  "X-Content-Type-Options": "nosniff",
};

export function publicJson(body: unknown, init: { status?: number; cache?: boolean } = {}) {
  return NextResponse.json(body, {
    status: init.status ?? 200,
    headers: init.cache === false ? { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } : PUBLIC_CACHE_HEADERS,
  });
}

/** Tenant-isolerede opslag (instansId kommer fra hosten via getCurrentSite — aldrig fra klienten). */
export async function findPublicArticles(siteId: string, params: { limit: number; sektion?: string; omraade?: string }) {
  const rows = await db.article.findMany({
    where: {
      instansId: siteId,
      status: "Publiceret",
      ...(params.sektion ? { kategori: { slug: params.sektion, instansId: siteId } } : {}),
      ...(params.omraade ? { geoTags: { some: { slug: params.omraade, instansId: siteId } } } : {}),
    },
    orderBy: { publiceretTid: "desc" },
    take: params.limit,
    select: PUBLIC_ARTICLE_SELECT,
  });
  return rows.map(toPublicArticle);
}

export async function findPublicArticle(siteId: string, slug: string) {
  const row = await db.article.findFirst({ where: { slug, instansId: siteId, status: "Publiceret" }, select: PUBLIC_ARTICLE_SELECT });
  return row ? toPublicArticle(row) : null;
}
