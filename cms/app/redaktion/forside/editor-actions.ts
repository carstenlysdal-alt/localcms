"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getAuthorizedUser, type AuthorizedUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { calculateSupportedContentQuota } from "@/lib/frontpage-governance";
import { composeFrontpage } from "@/lib/frontpage/compose";
import { listArticleSlots, parseModules, validateLayoutModules } from "@/lib/frontpage/layout-schema";
import { MODULE_TYPE_IDS, isCommercialType, type SlotAssignment, type Violation } from "@/lib/frontpage/types";
import {
  approveSnapshot,
  createProposal,
  editSnapshot,
  getQuota,
  interpretEditorCommand,
  loadCandidates,
  loadPlacementPins,
  logAiAction,
  publishLayout,
  rejectSnapshot,
  rollbackLayout,
  saveDraftLayout,
  type ServiceError,
} from "@/lib/frontpage/service";
import { can, PERMISSIONS, type Permission } from "@/lib/permissions";
import { rateLimit } from "@/lib/ratelimit";
import type { ActionFail, ActionResult, ArticleLite, DraftDTO, MetricsDTO, ProposalDetailDTO } from "./_lib/dto";
import { loadArticleLites, loadMetrics, loadProposalDetail } from "./_lib/loaders";
import { aiFailureMessage, proposalResultMessage, serviceErrorMessage, type Msg } from "./_lib/messages";

/**
 * Server actions til forsideeditoren. Mønster i alle: getAuthorizedUser (rettigheder læses fra databasen),
 * zod-validering af input, instansId KUN fra brugeren, service-laget (som tjekker can() og tenant igen),
 * revalidering og danske fejlbeskeder. Intet her publicerer uden en eksplicit handling fra en bruger med rettighed.
 */

const id = z.string().regex(/^[A-Za-z0-9_-]{8,40}$/, "Ugyldigt id.");
const fail = (code: string, message: string, extra: Partial<ActionFail> = {}): ActionFail => ({ ok: false, code, message, ...extra });

function fromService(e: ServiceError): ActionFail {
  return fail(e.code, serviceErrorMessage(e.code), { violations: e.violations, details: e.details });
}

async function need(...perms: Permission[]): Promise<AuthorizedUser | ActionFail> {
  const user = await getAuthorizedUser(perms);
  if (!user) return fail("forbidden", serviceErrorMessage("forbidden"));
  return user;
}
const isFail = (x: AuthorizedUser | ActionFail): x is ActionFail => "ok" in x;

function bad(error: z.ZodError): ActionFail {
  return fail("invalid", serviceErrorMessage("invalid"), { details: error.issues.map((i) => i.message).slice(0, 5) });
}

const REVALIDATE = () => {
  revalidatePath("/");
  revalidatePath("/redaktion/forside");
};

// ── Layout ───────────────────────────────────────────────────────────────────

export async function saveDraftAction(input: unknown): Promise<ActionResult<{ draftId: string; version: number }>> {
  const user = await need(PERMISSIONS.FRONTPAGE_LAYOUT_MANAGE);
  if (isFail(user)) return user;
  const parsed = z.object({ draftId: id.nullable().optional(), name: z.string().trim().min(1, "Giv layoutet et navn.").max(80), modules: z.unknown(), expectedVersion: z.number().int().min(1).optional() }).safeParse(input);
  if (!parsed.success) return bad(parsed.error);
  const res = await saveDraftLayout(user, { draftId: parsed.data.draftId ?? null, name: parsed.data.name, modules: parsed.data.modules, expectedVersion: parsed.data.expectedVersion });
  if (!res.ok) return fromService(res);
  revalidatePath("/redaktion/forside");
  return { ok: true, draftId: res.draftId, version: res.version };
}

export async function getDraftAction(draftId: unknown): Promise<ActionResult<{ draft: DraftDTO }>> {
  const user = await need(PERMISSIONS.FRONTPAGE_LAYOUT_MANAGE, PERMISSIONS.FRONTPAGE_EDIT);
  if (isFail(user)) return user;
  const p = id.safeParse(draftId);
  if (!p.success) return bad(p.error);
  const row = await db.frontpageLayout.findFirst({ where: { id: p.data, instansId: user.instansId, status: "kladde" } });
  if (!row) return fail("not-found", serviceErrorMessage("not-found"));
  const modules = parseModules(row.modules);
  if (!modules.ok) return fail("invalid", serviceErrorMessage("invalid"), { details: modules.errors.slice(0, 5) });
  return { ok: true, draft: { id: row.id, name: row.name, version: row.version, modules: modules.value, updatedAt: row.updatedAt.toISOString() } };
}

export async function discardDraftAction(draftId: unknown): Promise<ActionResult> {
  const user = await need(PERMISSIONS.FRONTPAGE_LAYOUT_MANAGE);
  if (isFail(user)) return user;
  const p = id.safeParse(draftId);
  if (!p.success) return bad(p.error);
  const res = await db.frontpageLayout.deleteMany({ where: { id: p.data, instansId: user.instansId, status: "kladde" } });
  if (res.count !== 1) return fail("not-found", serviceErrorMessage("not-found"));
  revalidatePath("/redaktion/forside");
  return { ok: true };
}

export async function publishDraftAction(draftId: unknown): Promise<ActionResult<{ layoutId: string; version: number }>> {
  const user = await need(PERMISSIONS.FRONTPAGE_LAYOUT_MANAGE);
  if (isFail(user)) return user;
  const p = id.safeParse(draftId);
  if (!p.success) return bad(p.error);
  const res = await publishLayout(user, p.data);
  if (!res.ok) return fromService(res);
  REVALIDATE();
  return { ok: true, layoutId: res.layoutId, version: res.version };
}

export async function rollbackAction(toVersion: unknown): Promise<ActionResult<{ version: number }>> {
  const user = await need(PERMISSIONS.FRONTPAGE_LAYOUT_MANAGE);
  if (isFail(user)) return user;
  const p = z.number().int().min(1).max(100000).safeParse(toVersion);
  if (!p.success) return bad(p.error);
  const res = await rollbackLayout(user, p.data);
  if (!res.ok) return fromService(res);
  REVALIDATE();
  return { ok: true, version: res.version };
}

export interface LayoutAnalysis {
  issues: string[];
  violations: Violation[];
  filled: number;
  total: number;
}

/** Server-validering af kladden: layout-schema + rækværk (deterministisk komponering mod dagens artikler). Ændrer intet. */
export async function analyzeLayoutAction(modules: unknown): Promise<ActionResult<LayoutAnalysis>> {
  const user = await need(PERMISSIONS.FRONTPAGE_LAYOUT_MANAGE, PERMISSIONS.FRONTPAGE_EDIT);
  if (isFail(user)) return user;
  const parsed = parseModules(modules);
  if (!parsed.ok) return { ok: true, issues: parsed.errors.slice(0, 10), violations: [], filled: 0, total: 0 };
  const issues = validateLayoutModules(parsed.value).map((i) => i.message);
  try {
    const now = new Date();
    const [candidates, quota, pins] = await Promise.all([loadCandidates(user.instansId, { now }), getQuota(user.instansId), loadPlacementPins(user.instansId, now)]);
    const res = composeFrontpage({ instansId: user.instansId, modules: parsed.value, candidates, pins, quota, now });
    return { ok: true, issues, violations: res.violations.slice(0, 60), filled: res.assignments.length, total: listArticleSlots(parsed.value).length };
  } catch (error) {
    console.error("[forside-editor] analyzeLayoutAction:", error);
    return fail("fejl", serviceErrorMessage("fejl"));
  }
}

// ── Forslag ──────────────────────────────────────────────────────────────────

export async function createProposalAction(input: unknown): Promise<ActionResult<{ snapshotId: string; message: Msg }>> {
  const user = await need(PERMISSIONS.FRONTPAGE_EDIT, PERMISSIONS.FRONTPAGE_SNAPSHOT_APPROVE);
  if (isFail(user)) return user;
  const p = z.object({ useAi: z.boolean().default(true), force: z.boolean().default(false) }).safeParse(input ?? {});
  if (!p.success) return bad(p.error);
  const limited = await rateLimit({ bucket: "frontpage-proposal", key: user.id, limit: 10, windowMs: 10 * 60_000 });
  if (!limited.ok) return fail("rate-limited", serviceErrorMessage("rate-limited"));
  const res = await createProposal(user.instansId, { actor: { kind: "user", user }, useAi: p.data.useAi, force: p.data.force });
  if (!res.ok) return fromService(res);
  revalidatePath("/redaktion/forside");
  return { ok: true, snapshotId: res.snapshotId, message: proposalResultMessage({ reused: res.reused, generatedBy: res.generatedBy, aiFailure: res.aiFailure, assignmentCount: res.assignmentCount, wantedAi: p.data.useAi }) };
}

export async function loadProposalAction(snapshotId: unknown): Promise<ActionResult<{ detail: ProposalDetailDTO }>> {
  const user = await need(PERMISSIONS.FRONTPAGE_EDIT, PERMISSIONS.FRONTPAGE_SNAPSHOT_APPROVE);
  if (isFail(user)) return user;
  const p = id.safeParse(snapshotId);
  if (!p.success) return bad(p.error);
  const detail = await loadProposalDetail(user, p.data);
  if (!detail) return fail("not-found", serviceErrorMessage("not-found"));
  return { ok: true, detail };
}

export async function approveProposalAction(snapshotId: unknown): Promise<ActionResult<{ expiresAt: string; warnings: Violation[] }>> {
  const user = await need(PERMISSIONS.FRONTPAGE_SNAPSHOT_APPROVE);
  if (isFail(user)) return user;
  const p = id.safeParse(snapshotId);
  if (!p.success) return bad(p.error);
  const res = await approveSnapshot(user, p.data);
  if (!res.ok) return fromService(res);
  REVALIDATE();
  return { ok: true, expiresAt: res.expiresAt.toISOString(), warnings: res.warnings };
}

export async function rejectProposalAction(snapshotId: unknown, reason?: unknown): Promise<ActionResult> {
  const user = await need(PERMISSIONS.FRONTPAGE_SNAPSHOT_APPROVE);
  if (isFail(user)) return user;
  const p = id.safeParse(snapshotId);
  const r = z.string().trim().max(300).optional().safeParse(reason);
  if (!p.success) return bad(p.error);
  if (!r.success) return bad(r.error);
  const res = await rejectSnapshot(user, p.data, r.data);
  if (!res.ok) return fromService(res);
  revalidatePath("/redaktion/forside");
  return { ok: true };
}

const assignmentIn = z.object({
  moduleId: z.string().regex(/^[a-z0-9][a-z0-9-]{1,39}$/),
  slotIndex: z.number().int().min(0).max(50),
  articleId: z.string().min(1).max(64),
  variant: z.enum(["hero", "kort", "kompakt", "liste", "tekstlinje"]),
  kilde: z.enum(["ai", "redaktør", "regel"]),
  prioritet: z.number().int().min(1).max(5),
  begrundelse: z.string().max(400),
  konfidens: z.number().min(0).max(1).nullable(),
  label: z.object({ tekst: z.string().min(1).max(120), synlig: z.literal(true) }),
  locked: z.boolean(),
  score: z.number().optional(),
});

export async function editProposalAction(snapshotId: unknown, assignments: unknown): Promise<ActionResult<{ assignments: SlotAssignment[]; warnings: Violation[] }>> {
  const user = await need(PERMISSIONS.FRONTPAGE_SNAPSHOT_APPROVE);
  if (isFail(user)) return user;
  const p = id.safeParse(snapshotId);
  const a = z.array(assignmentIn).max(400).safeParse(assignments);
  if (!p.success) return bad(p.error);
  if (!a.success) return bad(a.error);
  // Mærkningen er altid udledt af artiklen på serveren; klientens label bruges ikke (overskrives i service via enforceGuardrails).
  const res = await editSnapshot(user, p.data, a.data);
  if (!res.ok) return fromService(res);
  revalidatePath("/redaktion/forside");
  return { ok: true, assignments: res.items.assignments, warnings: res.items.warnings };
}

// ── AI i editoren ────────────────────────────────────────────────────────────

const SUGGEST_LAYOUT_COMMAND =
  "Foreslå en forsidestruktur ud fra dagens artikler: vælg de moduler og den skabelon der passer bedst til de vigtigste historier lige nu. Brug apply_template (mode replace) eller add_module/set_slots. Fastgør ikke artikler.";

export interface CommandPreview {
  ops: import("@/lib/frontpage/nl-commands").FrontpageOp[];
  rejected: { reason: string }[];
  forklaring: string;
  afklaring: string | null;
  modelId: string;
  candidateIds: string[];
  titles: Record<string, string>;
}

export async function interpretCommandAction(input: unknown): Promise<ActionResult<CommandPreview>> {
  const user = await need(PERMISSIONS.FRONTPAGE_AI_USE);
  if (isFail(user)) return user;
  const p = z.object({ text: z.string().trim().min(1, "Skriv en kommando.").max(500), modules: z.unknown(), purpose: z.enum(["command", "suggest-layout"]).default("command") }).safeParse(input);
  if (!p.success) return bad(p.error);
  const text = p.data.purpose === "suggest-layout" ? SUGGEST_LAYOUT_COMMAND : p.data.text;
  const res = await interpretEditorCommand(user, text, p.data.modules);
  if ("code" in res) return fromService(res);
  if (!res.ok) return fail("ai-unavailable", `${aiFailureMessage(res.reason)} Forsiden kan stadig redigeres uden AI.`);
  const pinIds = res.ops.flatMap((o) => (o.op === "pin_article" || o.op === "unpin_article" ? [o.articleId] : []));
  const titles = Object.fromEntries(Object.values(await loadArticleLites(user.instansId, pinIds)).map((a) => [a.id, a.titel]));
  return { ok: true, ops: res.ops, rejected: res.rejected.map((r) => ({ reason: r.reason })), forklaring: res.forklaring, afklaring: res.afklaring, modelId: res.modelId, candidateIds: res.candidateIds, titles };
}

/** Log at redaktøren anvendte eller kasserede et AI-forslag (selve forslaget blev logget af servicen). */
export async function logAiDecisionAction(input: unknown): Promise<ActionResult> {
  const user = await need(PERMISSIONS.FRONTPAGE_AI_USE);
  if (isFail(user)) return user;
  const p = z.object({ kind: z.enum(["foreslaa-layout", "nl-kommando"]), outcome: z.enum(["anvendt", "kasseret"]), summary: z.string().trim().max(300) }).safeParse(input);
  if (!p.success) return bad(p.error);
  await logAiAction(user, { handling: p.data.kind, begrundelse: `${p.data.outcome === "anvendt" ? "Anvendt i kladden" : "Kasseret"}: ${p.data.summary}`, slot: "layout" }).catch(() => undefined);
  return { ok: true };
}

const ZONE_BY_TYPE: Record<string, string> = { hero: "top-hoved", "top-grid": "top-sekundaer", "dit-omraade": "omraade", "sektion-rail": "sektion" };

/** Fastgør artikler (pins) foreslået af AI. Samme regler som den eksisterende pin-handling (kvoteloft, tenant, 48 t). */
export async function applyPinsAction(input: unknown): Promise<ActionResult<{ created: number; skipped: string[] }>> {
  const user = await need(PERMISSIONS.FRONTPAGE_EDIT);
  if (isFail(user)) return user;
  const p = z.object({ pins: z.array(z.object({ articleId: z.string().min(1).max(64), moduleType: z.enum(MODULE_TYPE_IDS), slotIndex: z.number().int().min(0).max(50) })).min(1).max(8) }).safeParse(input);
  if (!p.success) return bad(p.error);
  const quota = await calculateSupportedContentQuota(user.instansId);
  let created = 0;
  const skipped: string[] = [];
  for (const pin of p.data.pins) {
    const zone = ZONE_BY_TYPE[pin.moduleType];
    if (!zone) {
      skipped.push(`${pin.moduleType} kan ikke have fastgjorte artikler.`);
      continue;
    }
    const article = await db.article.findFirst({ where: { id: pin.articleId, instansId: user.instansId, status: "Publiceret" } });
    if (!article) {
      skipped.push("En artikel findes ikke eller er ikke publiceret.");
      continue;
    }
    if (isCommercialType(article.indholdstype) && quota.isExceeded) {
      skipped.push(`"${article.titel}" kan ikke fastgøres: kvoteloftet er nået.`);
      continue;
    }
    await db.frontpagePlacement.deleteMany({ where: { articleId: article.id, instansId: user.instansId } });
    if (zone === "top-hoved") await db.frontpagePlacement.deleteMany({ where: { zone: "top-hoved", instansId: user.instansId } });
    await db.frontpagePlacement.create({ data: { instansId: user.instansId, articleId: article.id, zone, position: pin.slotIndex, udloebTid: new Date(Date.now() + 48 * 3_600_000) } });
    created++;
  }
  if (can(user, PERMISSIONS.FRONTPAGE_AI_USE)) await logAiAction(user, { handling: "nl-kommando", begrundelse: `Fastgjorde ${created} artikel(er) efter AI-forslag.`, slot: "pins" }).catch(() => undefined);
  REVALIDATE();
  return { ok: true, created, skipped };
}

export async function removePinAction(placementId: unknown): Promise<ActionResult> {
  const user = await need(PERMISSIONS.FRONTPAGE_EDIT);
  if (isFail(user)) return user;
  const p = id.safeParse(placementId);
  if (!p.success) return bad(p.error);
  const res = await db.frontpagePlacement.deleteMany({ where: { id: p.data, instansId: user.instansId } });
  if (res.count !== 1) return fail("not-found", serviceErrorMessage("not-found"));
  REVALIDATE();
  return { ok: true };
}

// ── Metrikker ────────────────────────────────────────────────────────────────

export async function metricsAction(days: unknown): Promise<ActionResult<{ metrics: MetricsDTO }>> {
  const user = await need(PERMISSIONS.FRONTPAGE_EDIT);
  if (isFail(user)) return user;
  const p = z.number().int().safeParse(days);
  if (!p.success) return bad(p.error);
  return { ok: true, metrics: await loadMetrics(user, p.data) };
}

/** Artikeltitler til forhåndsvisning i forslag (hvis klienten mangler dem efter redigering). */
export async function articleLitesAction(ids: unknown): Promise<ActionResult<{ articles: Record<string, ArticleLite> }>> {
  const user = await need(PERMISSIONS.FRONTPAGE_EDIT, PERMISSIONS.FRONTPAGE_SNAPSHOT_APPROVE);
  if (isFail(user)) return user;
  const p = z.array(z.string().min(1).max(64)).max(100).safeParse(ids);
  if (!p.success) return bad(p.error);
  return { ok: true, articles: await loadArticleLites(user.instansId, p.data) };
}
