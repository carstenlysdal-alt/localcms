/**
 * Service-lag for artikelarbejde: rene funktioner (ikke UI-knapper) der tager den AUTORISEREDE bruger og går gennem
 * samme validering som editoren (lib/article-save.ts: mærkning, AI-brug, Krimi/Sundhed-spærring, workflow, tenant).
 * Beregnet til AI-operatørens værktøjsregister (lib/operator/registry.ts, `registerTool`) og andre server-kaldere, så
 * metadata, opslagstekster, slug og planlægning kan udfyldes uden at omgå validering eller rettigheder.
 *
 * Alle funktioner returnerer `{ ok: true, value }` eller `{ ok: false, error }` — de kaster ikke ved forventede fejl.
 * Intet her publicerer: `scheduleArticle` sætter status Planlagt (kræver ARTICLE_PUBLISH + gyldig workflow-overgang);
 * selve publiceringen sker af redaktøren eller cron-ruten /api/cron/publish-scheduled.
 */
import type { AuthorizedUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { can, canEditArticle, PERMISSIONS } from "@/lib/permissions";
import {
  articleMetaSchema,
  mergeMeta,
  checkPost,
  defaultUtm,
  metaFromRow,
  serializeMeta,
  SOCIAL_PLATFORMS,
  type ArticleMetaForm,
  type ArticleMetaInput,
  type ArticleMetaValue,
  type PostCheck,
  type SocialPlatform,
  type SocialPost,
} from "@/lib/article-meta";
import { ensureUniqueSlug, inputFromArticle, loadArticleForSave, persistArticleSave, prepareArticleSave, type ArticleSaveInput, type SaveMode } from "@/lib/article-save";
import { computeSeoScore, type SeoScore } from "@/lib/editor/seo-score";
import { blocksPlainText, countWords } from "@/lib/blocks/text";
import { parseBlocks } from "@/lib/blocks/schema";
import { slugify } from "@/lib/slug";

export type ServiceResult<T> = { ok: true; value: T } | { ok: false; error: string; fieldErrors?: Record<string, string[]>; conflict?: boolean };
const fail = (error: string): { ok: false; error: string } => ({ ok: false, error });

export type SavedArticle = { id: string; slug: string; status: string; version: number; created: boolean };

/** Fælles kerne: forbered + skriv. `mode: "draft"` ændrer aldrig status og afviser live artikler. */
export async function runArticleSave(
  user: AuthorizedUser,
  articleId: string | null,
  input: ArticleSaveInput,
  opts: { mode: SaveMode; targetStatus?: string | null; baseVersion?: number | null },
): Promise<ServiceResult<SavedArticle>> {
  const prepared = await prepareArticleSave(user, articleId, input, opts);
  if (!prepared.ok) return { ok: false, error: prepared.error, fieldErrors: prepared.fieldErrors, conflict: prepared.conflict };
  const saved = await persistArticleSave(prepared);
  if (!saved.ok) return { ok: false, error: saved.error };
  return { ok: true, value: { id: saved.article.id, slug: saved.article.slug, status: saved.article.status, version: saved.article.opdateretTid.getTime(), created: saved.created } };
}

const NEW_ARTICLE_DEFAULTS = (user: AuthorizedUser): ArticleSaveInput => ({
  titel: "",
  manchet: "",
  slug: "",
  indholdstype: "Uafhængig",
  kategoriId: "",
  forfatterId: user.authorId ?? "",
  coverMediaId: "",
  seoTitel: "",
  seoBeskrivelse: "",
  sprog: "da",
  blocks: [{ id: "initial-paragraph", type: "paragraph", data: { content: "" } }],
  aiBrug: [],
  marking: {},
  pinned: false,
  breaking: false,
  tagIds: [],
  geoTagIds: [],
});

async function loadEditable(user: AuthorizedUser, articleId: string) {
  const row = await loadArticleForSave(user.instansId, articleId);
  if (!row) return { ok: false as const, error: "Artiklen findes ikke." };
  if (!canEditArticle(user, row)) return { ok: false as const, error: "Du kan kun redigere dine egne artikler." };
  return { ok: true as const, row };
}

/**
 * Gem kladdefelter (delvis): kun de angivne felter ændres. Ændrer aldrig status, publicerer ikke, laver ingen revision og
 * afviser publicerede artikler (brug `updateArticleFields` til dem). `articleId = null` opretter en ny kladde (status Idé).
 */
export async function saveArticleDraft(
  user: AuthorizedUser,
  articleId: string | null,
  patch: Partial<ArticleSaveInput>,
  opts: { baseVersion?: number | null } = {},
): Promise<ServiceResult<SavedArticle>> {
  let base: ArticleSaveInput;
  if (articleId) {
    const found = await loadEditable(user, articleId);
    if (!found.ok) return fail(found.error);
    base = inputFromArticle(found.row);
  } else {
    base = NEW_ARTICLE_DEFAULTS(user);
  }
  return runArticleSave(user, articleId, { ...base, ...patch }, { mode: "draft", baseVersion: opts.baseVersion });
}

/**
 * Opdatér felter på en artikel uden statusskift — svarer til knappen "Opdater artikel" i editoren. På en publiceret artikel
 * gælder derfor publiceringsreglerne (kræver ARTICLE_PUBLISH, gyldig mærkning, AI-brug registreret).
 */
export async function updateArticleFields(user: AuthorizedUser, articleId: string, patch: Partial<ArticleSaveInput>, opts: { baseVersion?: number | null } = {}): Promise<ServiceResult<SavedArticle>> {
  const found = await loadEditable(user, articleId);
  if (!found.ok) return fail(found.error);
  return runArticleSave(user, articleId, { ...inputFromArticle(found.row), ...patch }, { mode: "full", baseVersion: opts.baseVersion });
}

// ── Metadata ────────────────────────────────────────────────────────────────

export async function getArticleMeta(user: AuthorizedUser, articleId: string): Promise<ServiceResult<ArticleMetaForm>> {
  const found = await loadEditable(user, articleId);
  if (!found.ok) return fail(found.error);
  return { ok: true, value: serializeMeta(metaFromRow(found.row.meta as unknown as Record<string, unknown> | null)) };
}

/**
 * Opdatér udvalgte metadatafelter (canonical, robots, nøgleord, OG/Twitter, schema-type, paywall, dateline, medforfattere,
 * kilder, udløb …). `mode: "draft"` (standard) afviser publicerede artikler; `"full"` svarer til Opdater artikel.
 */
export async function updateArticleMeta(user: AuthorizedUser, articleId: string, patch: Partial<ArticleMetaInput>, opts: { mode?: SaveMode; baseVersion?: number | null } = {}): Promise<ServiceResult<SavedArticle>> {
  const found = await loadEditable(user, articleId);
  if (!found.ok) return fail(found.error);
  const merged = mergeMeta(metaFromRow(found.row.meta as unknown as Record<string, unknown> | null), patch);
  if (!merged.ok) return fail(merged.error);
  return runArticleSave(user, articleId, { ...inputFromArticle(found.row), meta: merged.value }, { mode: opts.mode ?? "draft", baseVersion: opts.baseVersion });
}

/** Sæt opslagstekst for én platform (tegngrænser + hashtag-regler valideres). `utm: true` udfylder standard-UTM fra slug. */
export async function setSocialPost(
  user: AuthorizedUser,
  articleId: string,
  platform: SocialPlatform,
  post: { tekst: string; hashtags?: string[]; link?: string; utm?: { source: string; medium: string; campaign: string } | true },
  opts: { mode?: SaveMode } = {},
): Promise<ServiceResult<{ saved: SavedArticle; check: PostCheck }>> {
  if (!SOCIAL_PLATFORMS.includes(platform)) return fail("Ukendt platform.");
  const found = await loadEditable(user, articleId);
  if (!found.ok) return fail(found.error);
  const value: SocialPost = {
    tekst: post.tekst,
    hashtags: post.hashtags ?? [],
    ...(post.link ? { link: post.link } : {}),
    ...(post.utm ? { utm: post.utm === true ? defaultUtm(platform, found.row.slug) : post.utm } : {}),
  };
  const result = await updateArticleMeta(user, articleId, { social: { [platform]: value } }, { mode: opts.mode });
  if (!result.ok) return result;
  return { ok: true, value: { saved: result.value, check: checkPost(platform, value) } };
}

/**
 * Samlet, delvis kladde-rettelse af felter + metadata i ÉT gem (bruges af AI-operatørens værktøjer). Afviser publicerede
 * artikler (draft-mode). Returnerer værdierne FØR ændringen, så kalderen kan lave en Fortryd-recept.
 * `replaceMeta: true` erstatter hele metadata-objektet (bruges til at føre tilbage); ellers flettes patchen ind.
 */
export async function patchArticleDraft(
  user: AuthorizedUser,
  articleId: string,
  patch: { fields?: Partial<ArticleSaveInput>; meta?: Partial<ArticleMetaInput> },
  opts: { replaceMeta?: boolean; baseVersion?: number | null } = {},
): Promise<ServiceResult<{ saved: SavedArticle; before: { fields: Partial<ArticleSaveInput>; meta: ArticleMetaForm } }>> {
  const found = await loadEditable(user, articleId);
  if (!found.ok) return fail(found.error);
  const row = found.row;
  const base = inputFromArticle(row);
  const currentMeta = metaFromRow(row.meta as unknown as Record<string, unknown> | null);
  const beforeFields: Partial<ArticleSaveInput> = {};
  for (const key of Object.keys(patch.fields ?? {}) as Array<keyof ArticleSaveInput>) (beforeFields as Record<string, unknown>)[key] = base[key];
  const before = { fields: beforeFields, meta: serializeMeta(currentMeta) };
  let meta: ArticleMetaValue | undefined;
  if (patch.meta) {
    if (opts.replaceMeta) {
      const parsed = articleMetaSchema.safeParse(patch.meta);
      if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Ugyldig metadata.");
      meta = parsed.data;
    } else {
      const merged = mergeMeta(currentMeta, patch.meta);
      if (!merged.ok) return fail(merged.error);
      meta = merged.value;
    }
  }
  const saved = await runArticleSave(user, articleId, { ...base, ...(patch.fields ?? {}), ...(meta ? { meta } : {}) }, { mode: "draft", baseVersion: opts.baseVersion });
  if (!saved.ok) return saved;
  return { ok: true, value: { saved: saved.value, before } };
}

// ── Slug ────────────────────────────────────────────────────────────────────

/** Foreslå en unik slug ud fra en titel (rører ikke databasen ud over opslag). */
export async function suggestSlug(user: AuthorizedUser, titel: string, articleId?: string | null): Promise<ServiceResult<{ slug: string }>> {
  if (!can(user, PERMISSIONS.ARTICLE_CREATE)) return fail("Du har ikke adgang til artikler.");
  if (!slugify(titel)) return fail("Titlen giver ingen brugbar slug.");
  return { ok: true, value: { slug: await ensureUniqueSlug(titel, articleId) } };
}

/** Er sluggen ledig (eller artiklens egen)? */
export async function isSlugAvailable(user: AuthorizedUser, slug: string, articleId?: string | null): Promise<boolean> {
  if (!can(user, PERMISSIONS.ARTICLE_CREATE)) return false;
  const hit = await db.article.findFirst({ where: { slug, ...(articleId ? { id: { not: articleId } } : {}) }, select: { id: true } });
  return !hit;
}

/**
 * Skift slug. På en publiceret artikel oprettes en permanent omdirigering fra den gamle URL (lib/slug-redirect.ts), og
 * ændringen kræver publiceringsret (som alle ændringer af live indhold).
 */
export async function setArticleSlug(user: AuthorizedUser, articleId: string, slug: string): Promise<ServiceResult<SavedArticle>> {
  const found = await loadEditable(user, articleId);
  if (!found.ok) return fail(found.error);
  const live = found.row.status === "Publiceret";
  return runArticleSave(user, articleId, { ...inputFromArticle(found.row), slug }, { mode: live ? "full" : "draft" });
}

// ── Planlægning ─────────────────────────────────────────────────────────────

/**
 * Planlæg udgivelse: sætter `planlagtTid` og status Planlagt. Kræver ARTICLE_PUBLISH og en gyldig workflow-overgang
 * (typisk fra Godkendelse). Publicerer ikke — cron-ruten flytter forfaldne artikler fra Planlagt til Publiceret.
 */
export async function scheduleArticle(user: AuthorizedUser, articleId: string, when: Date): Promise<ServiceResult<SavedArticle>> {
  if (!can(user, PERMISSIONS.ARTICLE_PUBLISH)) return fail("Kun en redaktør med publiceringsret kan planlægge udgivelse.");
  if (Number.isNaN(when.getTime())) return fail("Udgivelsestidspunktet er ugyldigt.");
  const found = await loadEditable(user, articleId);
  if (!found.ok) return fail(found.error);
  const row = found.row;
  const input = { ...inputFromArticle(row), planlagtTid: when };
  return runArticleSave(user, articleId, input, { mode: "full", targetStatus: row.status === "Planlagt" ? null : "Planlagt" });
}

/** Ændr kun tidspunktet på en kladde (uden statusskift). Brug `scheduleArticle` for at sætte status Planlagt. */
export async function setPlannedTime(user: AuthorizedUser, articleId: string, when: Date | null): Promise<ServiceResult<SavedArticle>> {
  return saveArticleDraft(user, articleId, { planlagtTid: when });
}

// ── Score ───────────────────────────────────────────────────────────────────

export async function getArticleSeoScore(user: AuthorizedUser, articleId: string): Promise<ServiceResult<SeoScore>> {
  const found = await loadEditable(user, articleId);
  if (!found.ok) return fail(found.error);
  const row = found.row;
  const cover = row.coverMediaId ? await db.media.findFirst({ where: { id: row.coverMediaId, instansId: user.instansId }, select: { altTekst: true } }) : null;
  const meta = metaFromRow(row.meta as unknown as Record<string, unknown> | null);
  let words = 0;
  try { words = countWords(blocksPlainText(parseBlocks(row.blocks))); } catch { /* ugyldige blokke */ }
  return {
    ok: true,
    value: computeSeoScore({
      titel: row.titel, seoTitel: row.seoTitel, manchet: row.manchet, seoBeskrivelse: row.seoBeskrivelse, slug: row.slug,
      kategoriId: row.kategoriId, forfatterId: row.forfatterId, cover, tagCount: row.tags.length, geoCount: row.geoTags.length,
      wordCount: words, meta, shareImageAvailable: Boolean(cover) || Boolean(meta.ogMediaId),
    }),
  };
}
