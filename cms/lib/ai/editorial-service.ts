/**
 * Rettigheds- og governance-lag omkring AI-forslagene (lib/ai/editorial.ts). Én indgang for editorens route
 * (/api/redaktion/ai) og for AI-operatørens værktøjsregister — så ingen kan omgå rettigheder, spærring eller ratelimit.
 *
 *  - kræver `article.ai.use` (PERMISSIONS.ARTICLE_AI_USE) og — hvis articleId angives — ret til at redigere artiklen
 *  - tekstgenererende opgaver (overskrift, underrubrik, resumé, omskrivning) er SPÆRRET i Krimi og retsvæsen/Sundhed
 *    (isAiRestrictedCategoryTree på den valgte kategori OG artiklens gemte kategori)
 *  - rate limit pr. bruger, størrelsesloft (zod), dansk fejltekst uden API-nøgle
 *  - logger handlingen i AuditLog UDEN indhold (kun opgave, promptversion, udfald)
 *  - gemmer/mærker/publicerer aldrig: returnerer forslag. Accept (og aiBrug-registrering) sker i editoren/ved eksplicit gem.
 */
import type { AuthorizedUser } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { loadCategoryTree } from "@/lib/category-tree";
import { isAiRestrictedCategoryTree } from "@/lib/marking";
import { can, canEditArticle, PERMISSIONS } from "@/lib/permissions";
import { rateLimit } from "@/lib/ratelimit";
import { countWords } from "@/lib/blocks/text";
import type { AiCallResult, AiFailureReason, AiTextClient } from "@/lib/frontpage/ai-client";
import {
  commentOnSeo,
  EDITORIAL_PROMPT_VERSION,
  factCheck,
  improveText,
  suggestAltText,
  suggestHeadlines,
  suggestOgTexts,
  suggestPublishTime,
  suggestSeo,
  suggestSlug,
  suggestSocialPosts,
  suggestSubheading,
  suggestTagsAndGeo,
  summarize,
  type EditorialInput,
} from "./editorial";
import {
  aiUseForTask,
  applyAcceptedAiUse,
  editorialRequestSchema,
  isTextGeneratingTask,
  TASK_INFO,
  type EditorialRequest,
  type EditorialResponse,
  type EditorialTask,
  type TaskResult,
} from "./editorial-schemas";
import { SOCIAL_PLATFORMS } from "../article-meta";

const NO_KEY = "AI er ikke sat op endnu: der mangler en API-nøgle (ANTHROPIC_API_KEY). Kontakt administratoren.";

const FAILURE_TEXT: Record<AiFailureReason, string> = {
  "ingen-noegle": NO_KEY,
  timeout: "AI svarede ikke i tide. Prøv igen om lidt.",
  "ugyldig-json": "AI gav et uforståeligt svar. Prøv igen.",
  schema: "AI's forslag overholdt ikke længde- og formatkravene. Prøv igen.",
  "api-fejl": "AI-tjenesten er midlertidigt utilgængelig. Prøv igen om lidt.",
  "tomt-svar": "AI gav intet svar. Prøv igen.",
};

export type EditorialServiceDeps = {
  /** Test/overstyring: falsk klient. `null` = ingen nøgle. Udeladt = rigtig klient. */
  client?: AiTextClient | null;
  /** Slå rate limit fra (kun tests der kalder mange gange). */
  skipRateLimit?: boolean;
  timeoutMs?: number;
  retries?: number;
  sleep?: (ms: number) => Promise<void>;
};

function fail(code: Extract<EditorialResponse, { ok: false }>["code"], error: string): EditorialResponse {
  return { ok: false, code, error };
}

/** Kan AI-forslag af denne type gives for en artikel i denne kategori? (rent, testbart) */
export function taskAllowedInCategory(task: EditorialTask, restricted: boolean): boolean {
  return !(restricted && isTextGeneratingTask(task));
}

async function audit(user: AuthorizedUser, task: EditorialTask, articleId: string | null | undefined, outcome: string) {
  try {
    await writeAudit(db, {
      instansId: user.instansId,
      actorId: user.id,
      actorLabel: user.name,
      action: "article.ai.suggest",
      targetId: articleId ?? null,
      targetLabel: TASK_INFO[task].label,
      detail: { task, promptVersion: EDITORIAL_PROMPT_VERSION, udfald: outcome },
    });
  } catch (error) {
    console.error("[article-ai] auditlog fejlede", error instanceof Error ? error.message : "ukendt");
  }
}

/**
 * Kør én AI-opgave for den indloggede bruger. `request` er ikke-tillid (parses med zod). Returnerer aldrig en exception
 * ved forventede fejl.
 */
export async function runEditorialTask(user: AuthorizedUser, request: EditorialRequest, deps: EditorialServiceDeps = {}): Promise<EditorialResponse> {
  if (!can(user, PERMISSIONS.ARTICLE_AI_USE)) return fail("forbudt", "Du har ikke adgang til AI i artikelarbejdet.");
  const parsed = editorialRequestSchema.safeParse(request);
  if (!parsed.success) {
    const tooBig = parsed.error.issues.some((i) => i.code === "too_big");
    return tooBig ? fail("for-stor", "Teksten er for lang til AI-forslag. Marker et mindre afsnit.") : fail("ugyldig", "Ugyldig AI-forespørgsel.");
  }
  const { task, articleId, context, params } = parsed.data;

  if (!deps.skipRateLimit) {
    const limited = await rateLimit({ bucket: "article-ai", key: user.id, limit: 40, windowMs: 10 * 60_000 });
    if (!limited.ok) return fail("rate", `For mange AI-forespørgsler. Vent ${limited.retryAfterSec} sekunder og prøv igen.`);
  }

  // Artikel (hvis angivet): tenant + redigeringsret.
  let storedCategoryId: string | null = null;
  if (articleId) {
    const article = await db.article.findFirst({ where: { id: articleId, instansId: user.instansId }, select: { forfatterId: true, kategoriId: true } });
    if (!article) return fail("ugyldig", "Artiklen findes ikke.");
    if (!canEditArticle(user, article)) return fail("forbudt", "Du kan kun bruge AI på dine egne artikler.");
    storedCategoryId = article.kategoriId;
  }

  // Governance: tekstgenererende forslag er spærret i Krimi/Sundhed — på den valgte OG den gemte kategori.
  if (isTextGeneratingTask(task)) {
    for (const categoryId of new Set([context.kategoriId, storedCategoryId].filter((v): v is string => Boolean(v)))) {
      const tree = await loadCategoryTree(user.instansId, categoryId);
      if (tree && isAiRestrictedCategoryTree(tree)) {
        await audit(user, task, articleId, "spaerret-kategori");
        return fail("forbudt", "AI-forslag til tekst (overskrift, underrubrik, resumé, omskrivning) er ikke tilladt i Krimi og retsvæsen samt Sundhed.");
      }
    }
  }

  const bodyWords = countWords(context.brodtekst) + countWords(params.text ?? "");
  if (TASK_INFO[task].needsBody && bodyWords < 15 && !(task === "improve" && countWords(params.text ?? "") >= 3)) {
    return fail("ingen-tekst", "Skriv først lidt brødtekst — AI har brug for artiklens indhold for at give gode forslag.");
  }
  if (task === "improve" && !(params.text?.trim() || context.brodtekst.trim())) return fail("ingen-tekst", "Marker en tekst, der skal bearbejdes.");

  // Navne ud fra id'er (tenant-afgrænset) + lister til tags/geo-forslag.
  const [category, geoRows, tagRows, allTags, allGeo] = await Promise.all([
    context.kategoriId ? db.category.findFirst({ where: { id: context.kategoriId, instansId: user.instansId }, include: { parent: true } }) : Promise.resolve(null),
    context.geoTagIds.length ? db.geoTag.findMany({ where: { id: { in: context.geoTagIds }, instansId: user.instansId }, select: { navn: true } }) : Promise.resolve([]),
    context.tagIds.length ? db.tag.findMany({ where: { id: { in: context.tagIds }, instansId: user.instansId }, select: { navn: true } }) : Promise.resolve([]),
    task === "tagsGeo" ? db.tag.findMany({ where: { instansId: user.instansId }, select: { navn: true }, orderBy: { navn: "asc" }, take: 300 }) : Promise.resolve([]),
    task === "tagsGeo" ? db.geoTag.findMany({ where: { instansId: user.instansId }, select: { navn: true }, orderBy: { navn: "asc" }, take: 100 }) : Promise.resolve([]),
  ]);
  const input: EditorialInput = {
    titel: context.titel,
    manchet: context.manchet,
    brodtekst: context.brodtekst,
    sprog: context.sprog,
    sektion: category ? (category.parent ? `${category.parent.navn} › ${category.navn}` : category.navn) : null,
    geo: geoRows.map((g) => g.navn),
    tags: tagRows.map((t) => t.navn),
    kilder: context.kilder,
    availableTags: allTags.map((t) => t.navn),
    availableGeo: allGeo.map((g) => g.navn),
  };

  const ai = { client: deps.client, timeoutMs: deps.timeoutMs, retries: deps.retries, sleep: deps.sleep };
  let result: AiCallResult<unknown>;
  switch (task) {
    case "headlines": result = await suggestHeadlines(input, ai); break;
    case "subheading": result = await suggestSubheading(input, ai); break;
    case "slug": result = await suggestSlug(input, ai); break;
    case "seo": result = await suggestSeo(input, ai); break;
    case "og": result = await suggestOgTexts(input, ai); break;
    case "social": result = await suggestSocialPosts(input, params.platforms?.length ? params.platforms : SOCIAL_PLATFORMS, ai); break;
    case "tagsGeo": result = await suggestTagsAndGeo(input, ai); break;
    case "altText": result = await suggestAltText(input, params.image ?? {}, ai); break;
    case "summary": result = await summarize(input, ai); break;
    case "improve": result = await improveText(input, params.mode ?? "forbedr", params.text, ai); break;
    case "factcheck": result = await factCheck(input, ai); break;
    case "seoComment": result = await commentOnSeo(input, params.score ?? { score: 0, items: [] }, ai); break;
    case "publishTime": result = await suggestPublishTime(input, { weekday: params.weekday }, ai); break;
  }

  if (!result.ok) {
    await audit(user, task, articleId, `fejl:${result.reason}`);
    return fail(result.reason === "ingen-noegle" ? "ingen-noegle" : "ai-fejl", FAILURE_TEXT[result.reason]);
  }
  await audit(user, task, articleId, "ok");
  return {
    ok: true,
    task,
    suggestion: result.value as TaskResult[typeof task],
    promptVersion: EDITORIAL_PROMPT_VERSION,
    modelId: result.modelId,
    aiUse: aiUseForTask(task),
  } as EditorialResponse;
}

export { applyAcceptedAiUse };
