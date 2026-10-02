import { randomBytes } from "node:crypto";
import { Prisma } from "@prisma/client";
import { db } from "../db";
import { blocksSchema } from "../blocks/schema";
import { loadCategoryTree } from "../category-tree";
import { isAiRestrictedCategoryTree } from "../marking";
import { resolveGeoIds } from "./geo";
import { slugify } from "../slug";
import { ARTICLE_STATUSES } from "../workflow";
import { textToParagraphHtml } from "../validation/text";
import { AI_RESTRICTED_SOURCE_TYPES, type IngestItemResult, articleInputSchema } from "./schema";
import type { z } from "zod";

type ParsedArticle = z.output<typeof articleInputSchema>;

/**
 * Agent-artikler oprettes ALTID i workflowets første tilstand ("Idé"), aldrig publiceret.
 * Der findes bevidst ingen kodesti fra indtaget til "Publiceret": overgange kræver en indlogget
 * redaktør med ARTICLE_PUBLISH via canTransition() i lib/workflow.ts.
 */
export const INGEST_DRAFT_STATUS = ARTICLE_STATUSES[0];
export const INGEST_CONTENT_TYPE = "AI-assisteret" as const;

export class IngestRejection extends Error {
  constructor(message: string, readonly httpStatus: 400 | 403 | 409 | 422 = 422) {
    super(message);
  }
}

/** Afvis forsøg på at sætte status/publicering — det er ikke en agent-beføjelse. */
export function assertNoStatusOverride(raw: unknown) {
  if (raw && typeof raw === "object") {
    const o = raw as Record<string, unknown>;
    for (const key of ["status", "publiceretTid", "publishedAt", "pinned", "breaking", "forfatterId", "instansId", "marking"]) {
      if (key in o) throw new IngestRejection(`Feltet '${key}' kan ikke sættes via indtags-API'et. Artikler oprettes altid som kladde (${INGEST_DRAFT_STATUS}) og godkendes af en redaktør.`, 422);
    }
  }
}

function slugBase(titel: string) {
  return slugify(titel, 60) || "agent-udkast";
}

export function buildBlocks(input: Pick<ParsedArticle, "tekst" | "blocks">) {
  const blocks: Array<{ id: string; type: string; data: Record<string, unknown> }> = [];
  let n = 0;
  const id = () => `ingest-${++n}`;
  for (const b of input.blocks ?? []) {
    switch (b.type) {
      case "paragraph": blocks.push({ id: id(), type: "paragraph", data: { content: textToParagraphHtml(b.text) } }); break; // escaped HTML
      case "heading": blocks.push({ id: id(), type: "heading", data: { text: b.text, level: b.level } }); break;
      case "subheading": blocks.push({ id: id(), type: "subheading", data: { text: b.text } }); break;
      case "quote": blocks.push({ id: id(), type: "quote", data: { quote: b.quote, attribution: b.attribution, kildeUrl: b.kildeUrl, dato: b.dato } }); break;
      case "factbox": blocks.push({ id: id(), type: "factbox", data: { title: b.title, content: b.content } }); break;
    }
  }
  if (input.tekst) blocks.push({ id: id(), type: "paragraph", data: { content: textToParagraphHtml(input.tekst) } });
  return blocksSchema.parse(blocks);
}

export async function createIngestDraft(opts: { instansId: string; ingestKeyId: string; keyPrefix: string; input: ParsedArticle }): Promise<IngestItemResult> {
  const { instansId, input } = opts;

  // Idempotens: samme externalId giver aldrig en ny artikel og overskriver aldrig redaktørens arbejde.
  const existing = await db.article.findUnique({ where: { instansId_externalId: { instansId, externalId: input.externalId } }, select: { id: true } });
  if (existing) return { status: "duplicate", id: existing.id, externalId: input.externalId, duplicateOf: "externalId" };

  // Krimi/Sundhed-spærring: via kategori OG via kildetype (politi/112).
  const restrictedSources = input.sources.filter((s) => s.sourceType && AI_RESTRICTED_SOURCE_TYPES.includes(s.sourceType));
  if (restrictedSources.length > 0) {
    throw new IngestRejection("AI-udkast baseret på politi-/112-kilder (Krimi) kan ikke leveres via API'et; de kræver journalistisk gennemskrivning. Lever i stedet et signal (POST /api/ingest/signals).", 403);
  }

  // Sektionen er påkrævet og skal kunne afgøres: uden den kan Krimi/Sundhed-spærringen ikke håndhæves (T7 §7).
  if (!input.sektion) throw new IngestRejection("`sektion` er påkrævet: angiv kategori-sluggen for den sektion kladden hører til.", 422);
  const category = await db.category.findFirst({ where: { instansId, slug: input.sektion }, select: { id: true } });
  if (!category) throw new IngestRejection(`Ukendt sektion '${input.sektion}' i denne instans.`, 422);
  // Hele forældrekæden tjekkes (id-baseret): et barn af Krimi/Sundhed er også spærret.
  if (isAiRestrictedCategoryTree(await loadCategoryTree(instansId, category.id))) {
    throw new IngestRejection("AI-assisterede artikler er ikke tilladt i Krimi og retsvæsen eller Sundhed uden journalistisk gennemskrivning.", 403);
  }
  const kategoriId = category.id;

  const geoIds = input.omraader?.length ? await resolveGeoIds(instansId, input.omraader) : [];

  const blocks = buildBlocks(input);
  const kilder = input.sources.map((s) => ({ url: s.url, dato: s.dato, ...(s.titel ? { titel: s.titel } : {}), ...(s.udgiver ? { udgiver: s.udgiver } : {}), ...(s.sourceType ? { sourceType: s.sourceType } : {}) }));
  const baseSlug = slugBase(input.titel);

  for (let attempt = 0; attempt < 4; attempt++) {
    const slug = `${baseSlug}-${randomBytes(3).toString("hex")}`;
    try {
      const article = await db.article.create({
        data: {
          titel: input.titel,
          manchet: input.manchet ?? null,
          slug,
          blocks: blocks as unknown as Prisma.InputJsonValue,
          status: INGEST_DRAFT_STATUS,
          indholdstype: INGEST_CONTENT_TYPE,
          aiBrug: input.aiBrug as unknown as Prisma.InputJsonValue,
          // godkendtAf udfyldes af en redaktør senere; uden den kan artiklen ikke publiceres (aiMarkingSchema).
          marking: { godkendtAf: "", kilder: kilder.map((k) => k.url), maskinleveret: true } as Prisma.InputJsonValue,
          provenance: {
            ingestKeyPrefix: opts.keyPrefix,
            receivedAt: new Date().toISOString(),
            agent: input.agent ?? null,
            kilder,
            signalIds: input.signalIds ?? [],
            meta: input.meta ?? null,
          } as unknown as Prisma.InputJsonValue,
          externalId: input.externalId,
          kategoriId,
          instansId,
          geoTags: geoIds.length ? { connect: geoIds.map((id) => ({ id })) } : undefined,
        },
        select: { id: true },
      });
      return { status: "created", id: article.id, externalId: input.externalId };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const target = String((error.meta as { target?: unknown } | undefined)?.target ?? "");
        if (target.includes("externalId")) {
          const dup = await db.article.findUnique({ where: { instansId_externalId: { instansId, externalId: input.externalId } }, select: { id: true } });
          return { status: "duplicate", id: dup?.id, externalId: input.externalId, duplicateOf: "externalId" };
        }
        continue; // slug-kollision: prøv igen med nyt suffix
      }
      throw error;
    }
  }
  throw new IngestRejection("Kunne ikke generere en unik slug.", 409);
}
