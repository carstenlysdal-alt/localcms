"use server";

import { getFreshSession } from "@/lib/auth";
import { articleInputFromFormData, baseVersionFromFormData } from "@/lib/article-form-input";
import { runArticleSave } from "@/lib/article-service";
import { isSlugAvailable, suggestSlug } from "@/lib/article-service";
import { can, PERMISSIONS } from "@/lib/permissions";

export type DraftSaveResult =
  | { ok: true; id: string; slug: string; version: number; savedAt: string; created: boolean }
  | { ok: false; error: string; conflict?: boolean; fieldErrors?: Record<string, string[]> };

/**
 * Autosave: gemmer KUN kladdefelter. Ingen statusskift/publicering/workflow-effekter/revision og ingen redirect.
 * Samme validering som "Opdater artikel" (mærkning, AI-brug, Krimi/Sundhed-spærring, tenant) — kun publiceringskrav springes over.
 * Afviser publicerede artikler og versionskonflikter (baseVersion = opdateretTid i ms som klienten sidst har set).
 * `articleId = null` opretter en ny kladde (status Idé) første gang titlen er gyldig.
 */
export async function saveDraftAction(articleId: string | null, formData: FormData): Promise<DraftSaveResult> {
  const session = await getFreshSession();
  if (!session?.user || !can(session.user, PERMISSIONS.ARTICLE_CREATE)) return { ok: false, error: "Du har ikke adgang til at gemme artikler." };
  const parsed = articleInputFromFormData(formData);
  if (!parsed.ok) return { ok: false, error: parsed.error };
  const result = await runArticleSave(session.user, articleId, parsed.input, { mode: "draft", baseVersion: baseVersionFromFormData(formData) });
  if (!result.ok) return { ok: false, error: result.error, conflict: result.conflict, fieldErrors: result.fieldErrors };
  return { ok: true, id: result.value.id, slug: result.value.slug, version: result.value.version, savedAt: new Date().toISOString(), created: result.value.created };
}

/** Slug-hjælp i editoren: er sluggen ledig, og hvad er et unikt forslag ud fra titlen? */
export async function checkSlugAction(slug: string, titel: string, articleId: string | null): Promise<{ available: boolean; suggestion: string | null }> {
  const session = await getFreshSession();
  if (!session?.user || !can(session.user, PERMISSIONS.ARTICLE_CREATE)) return { available: false, suggestion: null };
  const available = slug ? await isSlugAvailable(session.user, slug, articleId) : false;
  const suggestion = titel.trim().length >= 3 ? await suggestSlug(session.user, titel, articleId) : null;
  return { available, suggestion: suggestion && suggestion.ok ? suggestion.value.slug : null };
}
