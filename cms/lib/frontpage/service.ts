import { createHash } from "node:crypto";
import { db } from "../db";
import { calculateSupportedContentQuota } from "../frontpage-governance";
import { validateMarking } from "../marking";
import { can, PERMISSIONS } from "../permissions";
import { rateLimit } from "../ratelimit";
import type { AiTextClient } from "./ai-client";
import { createAiTextClient, NO_AI_MESSAGE } from "../ai/provider";
import { buildAiInput, rankWithAi } from "./ai-ranker";
import { composeFrontpage, placementsToPins } from "./compose";
import { resolveFrontpage, type ApprovedSnapshotInput, type ResolvedFrontpage } from "./fallback";
import { basicEligibility, enforceGuardrails, type GuardContext } from "./guardrails";
import { parseModules, parseSnapshotItems, type ModuleInstance } from "./layout-schema";
import { interpretCommand, type NlCommandResult } from "./nl-commands";
import { rankCandidates } from "./rank";
import { defaultLayoutModules } from "./templates";
import { purgeInstance } from "../cache/purge";
import type { Candidate, Pin, QuotaInput, SlotAssignment, SnapshotItems, Violation } from "./types";

/**
 * Serverlag for T11/T12: database, rettigheder (can()), tenant-binding og log. Al forretningslogik ligger i de
 * rene moduler; dette lag henter data, kalder dem og gemmer resultatet.
 *
 * Tenant-regel: `instansId` kommer ALTID fra brugeren/cron-parameteren — aldrig fra klient-input — og hver
 * læsning/skrivning filtrerer på instansId (fremmed id => "findes ikke", aldrig "ingen adgang").
 */

export interface FrontpageUser {
  id: string;
  name?: string;
  instansId: string;
  permissions: readonly string[];
}

export type ServiceError = { ok: false; code: "forbidden" | "not-found" | "conflict" | "invalid" | "layout-aendret" | "guardrails" | "no-candidates" | "rate-limited" | "ai-unavailable" | "fejl"; error: string; violations?: Violation[]; details?: string[] };
const fail = (code: ServiceError["code"], error: string, extra: Partial<ServiceError> = {}): ServiceError => ({ ok: false, code, error, ...extra });

export const SNAPSHOT_TTL_HOURS_DEFAULT = 24;
export function snapshotTtlHours(): number {
  const n = Number(process.env.FRONTPAGE_SNAPSHOT_TTL_HOURS);
  return Number.isFinite(n) && n >= 1 && n <= 168 ? n : SNAPSHOT_TTL_HOURS_DEFAULT;
}

// ── Læsning: layout, kandidater, kvote ──────────────────────────────────────

export interface ActiveLayout {
  /** null = standardlayout (instansen har endnu ikke publiceret et eget). */
  id: string | null;
  version: number;
  name: string;
  modules: ModuleInstance[];
  source: "live" | "standard";
}

export async function getActiveLayout(instansId: string): Promise<ActiveLayout> {
  const row = await db.frontpageLayout.findFirst({ where: { instansId, status: "live" }, orderBy: { updatedAt: "desc" } });
  if (row) {
    const parsed = parseModules(row.modules);
    if (parsed.ok) return { id: row.id, version: row.version, name: row.name, modules: parsed.value, source: "live" };
    console.error(`[frontpage] Live-layout ${row.id} er ugyldigt — bruger standardlayout:`, parsed.errors.slice(0, 3));
  }
  return { id: null, version: 0, name: "Standardforside", modules: defaultLayoutModules(), source: "standard" };
}

export async function getQuota(instansId: string): Promise<QuotaInput> {
  const q = await calculateSupportedContentQuota(instansId);
  return { kvoteloftProcent: q.kvoteloftProcent, isExceeded: q.isExceeded };
}

export async function loadPlacementPins(instansId: string, now = new Date()): Promise<Pin[]> {
  const rows = await db.frontpagePlacement.findMany({
    where: { instansId, OR: [{ udloebTid: null }, { udloebTid: { gt: now } }] },
    orderBy: [{ zone: "asc" }, { position: "asc" }, { createdAt: "desc" }],
  });
  return placementsToPins(rows);
}

export async function loadCandidates(instansId: string, opts: { now?: Date; limit?: number; maxAgeDays?: number } = {}): Promise<Candidate[]> {
  const now = opts.now ?? new Date();
  const since = new Date(now.getTime() - (opts.maxAgeDays ?? 14) * 86_400_000);
  const placements = await db.frontpagePlacement.findMany({ where: { instansId }, select: { articleId: true } });
  const rows = await db.article.findMany({
    where: {
      instansId,
      status: "Publiceret",
      publiceretTid: { not: null, lte: now },
      OR: [{ publiceretTid: { gte: since } }, { pinned: true }, { id: { in: placements.map((p) => p.articleId) } }],
    },
    orderBy: { publiceretTid: "desc" },
    take: opts.limit ?? 120,
    include: { metric: true, kategori: { include: { parent: true } }, tags: true, geoTags: true },
  });
  return rows.map((a) => {
    const tag = [...a.tags].sort((x, y) => x.navn.localeCompare(y.navn))[0];
    const marking = a.marking && typeof a.marking === "object" ? (a.marking as { labelTekst?: unknown }) : null;
    return {
      id: a.id,
      instansId: a.instansId,
      titel: a.titel,
      manchet: a.manchet,
      status: a.status,
      publiceretTid: a.publiceretTid,
      indholdstype: a.indholdstype,
      breaking: a.breaking,
      pinned: a.pinned,
      sektionSlug: a.kategori?.parent?.slug ?? a.kategori?.slug ?? "nyheder",
      kategoriSlug: a.kategori?.slug ?? null,
      kategoriNavn: a.kategori?.navn ?? null,
      emneKey: tag ? (tag.slug ?? tag.navn.toLowerCase()) : (a.kategori?.slug ?? null),
      omraadeSlug: a.geoTags[0]?.slug ?? null,
      visninger: a.metric?.visninger ?? 0,
      laesninger: a.metric?.laesninger ?? 0,
      totalLaesetidSek: a.metric?.totalLaesetidSek ?? 0,
      harMaerkning: validateMarking(a.indholdstype, a.marking).success,
      maerkningTekst: typeof marking?.labelTekst === "string" ? marking.labelTekst : null,
    } satisfies Candidate;
  });
}

export async function getApprovedSnapshot(instansId: string): Promise<(ApprovedSnapshotInput & { godkendtTid: Date | null }) | null> {
  const row = await db.frontpageSnapshot.findFirst({ where: { instansId, status: "godkendt" }, orderBy: { godkendtTid: "desc" } });
  if (!row) return null;
  const items = parseSnapshotItems(row.items);
  if (!items.ok) {
    console.error(`[frontpage] Godkendt snapshot ${row.id} er ugyldigt:`, items.errors.slice(0, 3));
    return null;
  }
  return { id: row.id, layoutId: row.layoutId, items: items.value, expiresAt: row.expiresAt, godkendtTid: row.godkendtTid };
}

export interface RenderModel {
  resolved: ResolvedFrontpage;
  layout: ActiveLayout;
}

/**
 * Hovedindgang for forsiden: aktivt layout + sidst godkendte snapshot -> fallback-kæde -> slot-placeringer.
 * Kaster ALDRIG; ved databasefejl returneres en tom seneste-nyt-model (forsiden går aldrig ned på grund af ranking).
 */
export async function resolveFrontpageForRender(instansId: string, opts: { now?: Date } = {}): Promise<RenderModel> {
  const now = opts.now ?? new Date();
  try {
    const [layout, candidates, quota, pins, approved] = await Promise.all([
      getActiveLayout(instansId),
      loadCandidates(instansId, { now }),
      getQuota(instansId),
      loadPlacementPins(instansId, now),
      getApprovedSnapshot(instansId),
    ]);
    const resolved = resolveFrontpage({ instansId, modules: layout.modules, layout: { id: layout.id, version: layout.version }, candidates, pins, quota, approved, now });
    return { resolved, layout };
  } catch (error) {
    console.error("[frontpage] resolveFrontpageForRender fejlede — tom forside:", error);
    const modules = defaultLayoutModules();
    return {
      layout: { id: null, version: 0, name: "Standardforside", modules, source: "standard" },
      resolved: { source: "seneste-nyt", reason: "Databasefejl — seneste nyt kunne ikke hentes.", assignments: [], warnings: [], snapshotId: null, layoutId: null, layoutVersion: 0, repaired: 0, modules },
    };
  }
}

// ── Forslag (AI + deterministisk) ───────────────────────────────────────────

export type ProposalActor = { kind: "cron" } | { kind: "user"; user: FrontpageUser };

export interface CreateProposalOptions {
  actor: ProposalActor;
  /** Brug AI (DeepSeek/Claude, jf. lib/ai/provider) som re-ranker (kræver en AI-nøgle eller injiceret klient). Standard: true. */
  useAi?: boolean;
  aiClient?: AiTextClient | null;
  aiTimeoutMs?: number;
  aiRetries?: number;
  now?: Date;
  /** Opret nyt forslag selv om inputtet er uændret. */
  force?: boolean;
}

export type CreateProposalResult =
  | { ok: true; snapshotId: string; reused: boolean; generatedBy: "ai" | "deterministic"; modelId: string | null; warnings: Violation[]; aiFailure: { reason: string; detail?: string } | null; assignmentCount: number }
  | ServiceError;

function sha(text: string) {
  return createHash("sha256").update(text).digest("hex").slice(0, 32);
}

/**
 * Kandidater -> komponering (deterministisk, evt. AI) -> FrontpageSnapshot (status "forslag") + FrontpageDecision-log.
 * Publicerer ALDRIG: et forslag er først synligt på forsiden efter godkendelse (approveSnapshot).
 */
export async function createProposal(instansId: string, opts: CreateProposalOptions): Promise<CreateProposalResult> {
  try {
    const now = opts.now ?? new Date();
    const wantAi = opts.useAi ?? true;
    if (opts.actor.kind === "user") {
      const u = opts.actor.user;
      if (u.instansId !== instansId) return fail("not-found", "Instansen findes ikke.");
      if (!can(u, PERMISSIONS.FRONTPAGE_EDIT) && !can(u, PERMISSIONS.FRONTPAGE_SNAPSHOT_APPROVE)) return fail("forbidden", "Mangler rettighed til forsidestyring.");
      if (wantAi && !can(u, PERMISSIONS.FRONTPAGE_AI_USE)) return fail("forbidden", "Mangler rettighed til at bruge AI på forsiden.");
    }

    const [layout, candidates, quota, pins] = await Promise.all([getActiveLayout(instansId), loadCandidates(instansId, { now }), getQuota(instansId), loadPlacementPins(instansId, now)]);
    const ctx: GuardContext = { instansId, now, kvoteloftProcent: quota.kvoteloftProcent, quotaExceeded: quota.isExceeded };
    const eligible = candidates.filter((c) => basicEligibility(c, ctx).length === 0);
    if (eligible.length === 0) return fail("no-candidates", "Ingen publicerede artikler at ranke.");
    const ranked = rankCandidates(eligible, { now });

    const base = { instansId, modules: layout.modules, candidates, pins, quota, now };
    let result = composeFrontpage(base);
    let generatedBy: "ai" | "deterministic" = "deterministic";
    let modelId: string | null = null;
    let aiFailure: { reason: string; detail?: string } | null = null;
    const warnings: Violation[] = [];

    const built = buildAiInput({ modules: layout.modules, ranked, now });
    const pinSig = pins.map((p) => `${p.articleId}:${p.moduleType ?? p.moduleId}:${p.slotIndex ?? ""}`).join(",");
    const inputHash = sha(`${built.hash}|${layout.id}|${layout.version}|${pinSig}|${quota.isExceeded}|${wantAi ? 1 : 0}`);

    if (wantAi) {
      const client = opts.aiClient === undefined ? createAiTextClient({ task: "frontpage" }) : opts.aiClient;
      const ai = await rankWithAi({ modules: layout.modules, ranked, now }, { client, timeoutMs: opts.aiTimeoutMs, retries: opts.aiRetries });
      if (ai.ok) {
        result = composeFrontpage({ ...base, ai: ai.suggestions });
        generatedBy = "ai";
        modelId = ai.modelId;
      } else {
        aiFailure = { reason: ai.reason, detail: ai.detail };
        warnings.push({ code: "ai-fejl", severity: "advarsel", besked: `AI-ranking fejlede (${ai.reason}); forslaget er deterministisk.` });
        console.warn(`[frontpage] AI-ranking fejlede for ${instansId}: ${ai.reason}${ai.detail ? ` — ${ai.detail}` : ""}`);
      }
    }

    if (!opts.force) {
      const same = await db.frontpageSnapshot.findFirst({ where: { instansId, inputHash, generatedBy, status: { in: ["forslag", "godkendt"] } }, orderBy: { createdAt: "desc" } });
      if (same) {
        return { ok: true, snapshotId: same.id, reused: true, generatedBy, modelId: same.modelId, warnings, aiFailure, assignmentCount: Array.isArray((same.items as { assignments?: unknown[] })?.assignments) ? (same.items as { assignments: unknown[] }).assignments.length : 0 };
      }
    }

    const allWarnings = [...warnings, ...result.violations];
    const items: SnapshotItems = { schemaVersion: 1, layoutVersion: layout.version, assignments: result.assignments, warnings: allWarnings.slice(0, 200) };
    const decisions = [
      ...result.assignments.map((a) => ({ instansId, articleId: a.articleId, slot: `${a.moduleId}:${a.slotIndex}`, handling: "placeret", kilde: a.kilde, begrundelse: a.begrundelse, konfidens: a.konfidens })),
      ...result.violations.filter((v) => v.severity === "blokerende" && v.articleId).map((v) => ({ instansId, articleId: v.articleId ?? null, slot: v.moduleId ? `${v.moduleId}:${v.slotIndex ?? 0}` : "-", handling: "afvist", kilde: "regel", begrundelse: v.besked, konfidens: null })),
    ].slice(0, 400);

    const snapshot = await db.$transaction(async (tx) => {
      await tx.frontpageSnapshot.updateMany({ where: { instansId, status: "forslag" }, data: { status: "udløbet" } });
      return tx.frontpageSnapshot.create({
        data: {
          instansId,
          layoutId: layout.id,
          status: "forslag",
          items: JSON.parse(JSON.stringify(items)),
          mode: "forslag",
          generatedBy,
          modelId,
          inputHash,
          decisions: { create: decisions },
        },
      });
    });
    return { ok: true, snapshotId: snapshot.id, reused: false, generatedBy, modelId, warnings: allWarnings, aiFailure, assignmentCount: result.assignments.length };
  } catch (error) {
    console.error("[frontpage] createProposal fejlede:", error);
    return fail("fejl", "Forslaget kunne ikke oprettes.");
  }
}

// ── Godkend / afvis / redigér forslag ───────────────────────────────────────

async function findOwnSnapshot(user: FrontpageUser, snapshotId: string) {
  return db.frontpageSnapshot.findFirst({ where: { id: snapshotId, instansId: user.instansId } });
}

async function freshContext(instansId: string, now: Date) {
  const [candidates, quota] = await Promise.all([loadCandidates(instansId, { now }), getQuota(instansId)]);
  const ctx: GuardContext = { instansId, now, kvoteloftProcent: quota.kvoteloftProcent, quotaExceeded: quota.isExceeded };
  return { candidates, ctx };
}

export async function approveSnapshot(user: FrontpageUser, snapshotId: string, opts: { now?: Date } = {}): Promise<{ ok: true; expiresAt: Date; warnings: Violation[] } | ServiceError> {
  if (!can(user, PERMISSIONS.FRONTPAGE_SNAPSHOT_APPROVE)) return fail("forbidden", "Mangler rettighed til at godkende forsiden.");
  try {
    const now = opts.now ?? new Date();
    const snap = await findOwnSnapshot(user, snapshotId);
    if (!snap) return fail("not-found", "Forslaget findes ikke.");
    if (snap.status !== "forslag") return fail("conflict", `Forslaget er allerede ${snap.status}.`);
    const parsed = parseSnapshotItems(snap.items);
    if (!parsed.ok) return fail("invalid", "Forslagets indhold er ugyldigt.", { details: parsed.errors });

    const layout = await getActiveLayout(user.instansId);
    if (snap.layoutId !== layout.id || parsed.value.layoutVersion !== layout.version) {
      return fail("layout-aendret", "Layoutet er ændret siden forslaget blev lavet. Opret et nyt forslag.");
    }
    const { candidates, ctx } = await freshContext(user.instansId, now);
    const enforced = enforceGuardrails({ modules: layout.modules, assignments: parsed.value.assignments, candidates, ctx, skipFreshness: true });
    if (enforced.assignments.length < parsed.value.assignments.length) {
      return fail("guardrails", "Forslaget indeholder placeringer der ikke længere overholder rækværkene. Opret et nyt forslag.", { violations: enforced.violations });
    }
    const expiresAt = new Date(now.getTime() + snapshotTtlHours() * 3_600_000);
    const items: SnapshotItems = { ...parsed.value, assignments: enforced.assignments, warnings: enforced.violations.slice(0, 200) };
    const ok = await db.$transaction(async (tx) => {
      const claimed = await tx.frontpageSnapshot.updateMany({
        where: { id: snap.id, instansId: user.instansId, status: "forslag" },
        data: { status: "godkendt", godkendtAf: user.id, godkendtTid: now, expiresAt, items: JSON.parse(JSON.stringify(items)) },
      });
      if (claimed.count !== 1) return false;
      await tx.frontpageSnapshot.updateMany({ where: { instansId: user.instansId, status: "godkendt", NOT: { id: snap.id } }, data: { status: "udløbet" } });
      await tx.frontpageDecision.create({ data: { snapshotId: snap.id, instansId: user.instansId, slot: "-", handling: "godkendt", kilde: "redaktør", begrundelse: `Godkendt af ${user.name ?? user.id}.` } });
      return true;
    });
    if (!ok) return fail("conflict", "Forslaget blev ændret af en anden. Genindlæs.");
    void purgeInstance(user.instansId); // CDN-purge (no-op uden CF_API_TOKEN)
    return { ok: true, expiresAt, warnings: enforced.violations };
  } catch (error) {
    console.error("[frontpage] approveSnapshot fejlede:", error);
    return fail("fejl", "Forslaget kunne ikke godkendes.");
  }
}

export async function rejectSnapshot(user: FrontpageUser, snapshotId: string, reason?: string): Promise<{ ok: true } | ServiceError> {
  if (!can(user, PERMISSIONS.FRONTPAGE_SNAPSHOT_APPROVE)) return fail("forbidden", "Mangler rettighed til at afvise forslag.");
  try {
    const snap = await findOwnSnapshot(user, snapshotId);
    if (!snap) return fail("not-found", "Forslaget findes ikke.");
    const res = await db.frontpageSnapshot.updateMany({
      where: { id: snap.id, instansId: user.instansId, status: "forslag" },
      data: { status: "afvist", afvistAf: user.id, afvistTid: new Date(), afvistGrund: reason?.trim().slice(0, 300) || null },
    });
    if (res.count !== 1) return fail("conflict", `Forslaget er allerede ${snap.status}.`);
    await db.frontpageDecision.create({ data: { snapshotId: snap.id, instansId: user.instansId, slot: "-", handling: "afvist-forslag", kilde: "redaktør", begrundelse: reason?.trim().slice(0, 300) || null } });
    return { ok: true };
  } catch (error) {
    console.error("[frontpage] rejectSnapshot fejlede:", error);
    return fail("fejl", "Forslaget kunne ikke afvises.");
  }
}

/** Redaktøren justerer et forslag (drag-and-drop) før godkendelse. Hele sættet valideres; intet gemmes ved brud. */
export async function editSnapshot(user: FrontpageUser, snapshotId: string, assignments: unknown): Promise<{ ok: true; items: SnapshotItems } | ServiceError> {
  if (!can(user, PERMISSIONS.FRONTPAGE_SNAPSHOT_APPROVE)) return fail("forbidden", "Mangler rettighed til at redigere forslag.");
  try {
    const now = new Date();
    const snap = await findOwnSnapshot(user, snapshotId);
    if (!snap) return fail("not-found", "Forslaget findes ikke.");
    if (snap.status !== "forslag") return fail("conflict", `Forslaget er allerede ${snap.status}.`);
    const old = parseSnapshotItems(snap.items);
    if (!old.ok) return fail("invalid", "Forslagets indhold er ugyldigt.", { details: old.errors });
    const incoming = parseSnapshotItems({ ...old.value, assignments });
    if (!incoming.ok) return fail("invalid", "Ugyldige placeringer.", { details: incoming.errors });

    const before = new Set(old.value.assignments.map((a) => `${a.moduleId}:${a.slotIndex}:${a.articleId}`));
    const marked: SlotAssignment[] = incoming.value.assignments.map((a) =>
      before.has(`${a.moduleId}:${a.slotIndex}:${a.articleId}`) ? a : { ...a, kilde: "redaktør", locked: true, prioritet: 5, konfidens: null, begrundelse: "Valgt/flyttet af redaktør." },
    );
    const layout = await getActiveLayout(user.instansId);
    if (snap.layoutId !== layout.id || old.value.layoutVersion !== layout.version) return fail("layout-aendret", "Layoutet er ændret. Opret et nyt forslag.");
    const { candidates, ctx } = await freshContext(user.instansId, now);
    const enforced = enforceGuardrails({ modules: layout.modules, assignments: marked, candidates, ctx, skipFreshness: true });
    if (enforced.assignments.length < marked.length) return fail("guardrails", "Ændringen overholder ikke rækværkene.", { violations: enforced.violations });

    const items: SnapshotItems = { ...old.value, assignments: enforced.assignments, warnings: enforced.violations.slice(0, 200) };
    const res = await db.frontpageSnapshot.updateMany({ where: { id: snap.id, instansId: user.instansId, status: "forslag" }, data: { items: JSON.parse(JSON.stringify(items)) } });
    if (res.count !== 1) return fail("conflict", "Forslaget blev ændret af en anden.");
    const changed = enforced.assignments.filter((a) => !before.has(`${a.moduleId}:${a.slotIndex}:${a.articleId}`));
    if (changed.length) {
      await db.frontpageDecision.createMany({
        data: changed.map((a) => ({ snapshotId: snap.id, instansId: user.instansId, articleId: a.articleId, slot: `${a.moduleId}:${a.slotIndex}`, handling: "redigeret", kilde: "redaktør", begrundelse: `Ændret af ${user.name ?? user.id}.` })),
      });
    }
    return { ok: true, items };
  } catch (error) {
    console.error("[frontpage] editSnapshot fejlede:", error);
    return fail("fejl", "Forslaget kunne ikke gemmes.");
  }
}

export async function listSnapshots(user: FrontpageUser, opts: { status?: string; take?: number } = {}) {
  if (!can(user, PERMISSIONS.FRONTPAGE_EDIT) && !can(user, PERMISSIONS.FRONTPAGE_SNAPSHOT_APPROVE)) return [];
  return db.frontpageSnapshot.findMany({
    where: { instansId: user.instansId, ...(opts.status ? { status: opts.status } : {}) },
    orderBy: { createdAt: "desc" },
    take: Math.min(opts.take ?? 20, 100),
    select: { id: true, status: true, generatedBy: true, modelId: true, mode: true, createdAt: true, godkendtAf: true, godkendtTid: true, expiresAt: true, afvistGrund: true, layoutId: true },
  });
}

export async function getSnapshot(user: FrontpageUser, snapshotId: string) {
  if (!can(user, PERMISSIONS.FRONTPAGE_EDIT) && !can(user, PERMISSIONS.FRONTPAGE_SNAPSHOT_APPROVE)) return null;
  const row = await findOwnSnapshot(user, snapshotId);
  if (!row) return null;
  const items = parseSnapshotItems(row.items);
  if (!items.ok) return null;
  const decisions = await db.frontpageDecision.findMany({ where: { snapshotId: row.id, instansId: user.instansId }, orderBy: { createdAt: "asc" }, take: 500 });
  return { snapshot: row, items: items.value, decisions };
}

// ── Layout: kladde, publicér, rul tilbage ───────────────────────────────────

export async function listLayouts(user: FrontpageUser) {
  if (!can(user, PERMISSIONS.FRONTPAGE_EDIT) && !can(user, PERMISSIONS.FRONTPAGE_LAYOUT_MANAGE)) return { live: null, drafts: [] };
  const rows = await db.frontpageLayout.findMany({ where: { instansId: user.instansId }, orderBy: { updatedAt: "desc" } });
  return { live: rows.find((r) => r.status === "live") ?? null, drafts: rows.filter((r) => r.status === "kladde") };
}

export async function saveDraftLayout(user: FrontpageUser, input: { draftId?: string | null; name: string; modules: unknown; expectedVersion?: number }): Promise<{ ok: true; draftId: string; version: number } | ServiceError> {
  if (!can(user, PERMISSIONS.FRONTPAGE_LAYOUT_MANAGE)) return fail("forbidden", "Mangler rettighed til at redigere layout.");
  const name = input.name.trim().slice(0, 80);
  if (!name) return fail("invalid", "Giv layoutet et navn.");
  const parsed = parseModules(input.modules);
  if (!parsed.ok) return fail("invalid", "Layoutet er ugyldigt.", { details: parsed.errors });
  try {
    const modules = JSON.parse(JSON.stringify(parsed.value));
    if (!input.draftId) {
      const row = await db.frontpageLayout.create({ data: { instansId: user.instansId, name, status: "kladde", version: 1, modules, createdBy: user.id } });
      return { ok: true, draftId: row.id, version: row.version };
    }
    if (input.expectedVersion === undefined) return fail("invalid", "expectedVersion mangler.");
    const res = await db.frontpageLayout.updateMany({
      where: { id: input.draftId, instansId: user.instansId, status: "kladde", version: input.expectedVersion },
      data: { name, modules, version: { increment: 1 } },
    });
    if (res.count !== 1) {
      const exists = await db.frontpageLayout.findFirst({ where: { id: input.draftId, instansId: user.instansId, status: "kladde" }, select: { id: true } });
      return exists ? fail("conflict", "Kladden er ændret af en anden. Genindlæs og prøv igen.") : fail("not-found", "Kladden findes ikke.");
    }
    return { ok: true, draftId: input.draftId, version: input.expectedVersion + 1 };
  } catch (error) {
    console.error("[frontpage] saveDraftLayout fejlede:", error);
    return fail("fejl", "Kladden kunne ikke gemmes.");
  }
}

export async function publishLayout(user: FrontpageUser, draftId: string): Promise<{ ok: true; layoutId: string; version: number } | ServiceError> {
  if (!can(user, PERMISSIONS.FRONTPAGE_LAYOUT_MANAGE)) return fail("forbidden", "Mangler rettighed til at publicere layout.");
  try {
    const draft = await db.frontpageLayout.findFirst({ where: { id: draftId, instansId: user.instansId, status: "kladde" } });
    if (!draft) return fail("not-found", "Kladden findes ikke.");
    const parsed = parseModules(draft.modules);
    if (!parsed.ok) return fail("invalid", "Layoutet er ugyldigt.", { details: parsed.errors });
    const modules = JSON.parse(JSON.stringify(parsed.value));
    const published = await db.$transaction(async (tx) => {
      const live = await tx.frontpageLayout.findFirst({ where: { instansId: user.instansId, status: "live" } });
      const now = new Date();
      const row = live
        ? await tx.frontpageLayout.update({ where: { id: live.id }, data: { name: draft.name, modules, version: { increment: 1 }, publishedBy: user.id, publishedAt: now } })
        : await tx.frontpageLayout.create({ data: { instansId: user.instansId, name: draft.name, status: "live", version: 1, modules, createdBy: user.id, publishedBy: user.id, publishedAt: now } });
      await tx.frontpageLayoutVersion.create({ data: { layoutId: row.id, instansId: user.instansId, version: row.version, modules, note: `Publiceret fra kladde '${draft.name}'`, createdBy: user.id } });
      return { ok: true as const, layoutId: row.id, version: row.version };
    });
    void purgeInstance(user.instansId); // CDN-purge (no-op uden CF_API_TOKEN)
    return published;
  } catch (error) {
    console.error("[frontpage] publishLayout fejlede:", error);
    return fail("fejl", "Layoutet kunne ikke publiceres.");
  }
}

export async function listLayoutVersions(user: FrontpageUser) {
  if (!can(user, PERMISSIONS.FRONTPAGE_LAYOUT_MANAGE)) return [];
  const live = await db.frontpageLayout.findFirst({ where: { instansId: user.instansId, status: "live" }, select: { id: true } });
  if (!live) return [];
  return db.frontpageLayoutVersion.findMany({ where: { layoutId: live.id, instansId: user.instansId }, orderBy: { version: "desc" }, take: 50, select: { id: true, version: true, note: true, createdBy: true, createdAt: true } });
}

/** Rul tilbage = ny version af live-layoutet med indholdet fra en tidligere version (historikken bevares). */
export async function rollbackLayout(user: FrontpageUser, toVersion: number): Promise<{ ok: true; version: number } | ServiceError> {
  if (!can(user, PERMISSIONS.FRONTPAGE_LAYOUT_MANAGE)) return fail("forbidden", "Mangler rettighed til at rulle layout tilbage.");
  try {
    const live = await db.frontpageLayout.findFirst({ where: { instansId: user.instansId, status: "live" } });
    if (!live) return fail("not-found", "Der er intet publiceret layout.");
    const target = await db.frontpageLayoutVersion.findFirst({ where: { layoutId: live.id, instansId: user.instansId, version: toVersion } });
    if (!target) return fail("not-found", "Versionen findes ikke.");
    const parsed = parseModules(target.modules);
    if (!parsed.ok) return fail("invalid", "Versionen er ugyldig.", { details: parsed.errors });
    const modules = JSON.parse(JSON.stringify(parsed.value));
    return await db.$transaction(async (tx) => {
      const row = await tx.frontpageLayout.update({ where: { id: live.id }, data: { modules, version: { increment: 1 }, publishedBy: user.id, publishedAt: new Date() } });
      await tx.frontpageLayoutVersion.create({ data: { layoutId: live.id, instansId: user.instansId, version: row.version, modules, note: `Rollback til v${toVersion}`, createdBy: user.id } });
      return { ok: true as const, version: row.version };
    });
  } catch (error) {
    console.error("[frontpage] rollbackLayout fejlede:", error);
    return fail("fejl", "Rollback fejlede.");
  }
}

// ── AI-handlinger i editoren (naturligt sprog) + log ────────────────────────

export async function logAiAction(user: FrontpageUser, entry: { handling: string; begrundelse: string; konfidens?: number | null; slot?: string }) {
  await db.frontpageDecision.create({ data: { snapshotId: null, instansId: user.instansId, slot: entry.slot ?? "layout", handling: entry.handling, kilde: "ai", begrundelse: entry.begrundelse.slice(0, 500), konfidens: entry.konfidens ?? null } });
}

/**
 * Naturligt-sprog-kommando -> FORESLÅEDE operationer (anvendes først via applyOps + gem kladde efter redaktørens bekræftelse).
 * `modules` er editorens nuværende (evt. ugemte) layout; kræver frontpage.ai.use + frontpage.layout.manage. Rate-limited og logget.
 */
export async function interpretEditorCommand(user: FrontpageUser, text: string, modules: unknown, opts: { client?: AiTextClient | null; timeoutMs?: number; retries?: number } = {}): Promise<(NlCommandResult & { candidateIds: string[] }) | ServiceError> {
  if (!can(user, PERMISSIONS.FRONTPAGE_AI_USE) || !can(user, PERMISSIONS.FRONTPAGE_LAYOUT_MANAGE)) return fail("forbidden", "Mangler rettighed til AI-kommandoer.");
  const parsed = parseModules(modules);
  if (!parsed.ok) return fail("invalid", "Layoutet er ugyldigt.", { details: parsed.errors });
  const limited = await rateLimit({ bucket: "frontpage-nl", key: user.id, limit: 20, windowMs: 10 * 60_000 });
  if (!limited.ok) return fail("rate-limited", "For mange AI-kommandoer. Vent lidt.");
  const client = opts.client === undefined ? createAiTextClient({ task: "frontpage" }) : opts.client;
  if (!client) return fail("ai-unavailable", `${NO_AI_MESSAGE}.`);
  const now = new Date();
  const [candidates, quota] = await Promise.all([loadCandidates(user.instansId, { now, limit: 60 }), getQuota(user.instansId)]);
  const ctx: GuardContext = { instansId: user.instansId, now, kvoteloftProcent: quota.kvoteloftProcent, quotaExceeded: quota.isExceeded };
  const ranked = rankCandidates(candidates.filter((c) => basicEligibility(c, ctx).length === 0), { now });
  const res = await interpretCommand(text, { modules: parsed.value, ranked, now }, { client, timeoutMs: opts.timeoutMs, retries: opts.retries });
  await logAiAction(user, {
    handling: "nl-kommando",
    begrundelse: `${res.ok ? `"${text.slice(0, 200)}" -> ${res.ops.length} operation(er), ${res.rejected.length} afvist` : `"${text.slice(0, 200)}" -> fejl (${res.reason})`}${client.providerId ? ` [udbyder: ${client.providerId}]` : ""}`,
  }).catch(() => undefined);
  return { ...res, candidateIds: ranked.map((r) => r.candidate.id) };
}

// ── Måling pr. slot ─────────────────────────────────────────────────────────

export const SLOT_METRIC_ID = /^[a-z0-9][a-z0-9-]{1,39}$/;

export async function recordSlotEvent(input: { instansId: string; moduleId: string; slotKey: string; articleId: string; type: "impression" | "click"; now?: Date }): Promise<{ ok: true } | { ok: false; reason: "invalid" | "not-found" }> {
  if (!SLOT_METRIC_ID.test(input.moduleId) || !/^\d{1,2}$/.test(input.slotKey)) return { ok: false, reason: "invalid" };
  // Tenant-binding: artiklen skal være publiceret og tilhøre instansen.
  const article = await db.article.findFirst({ where: { id: input.articleId, instansId: input.instansId, status: "Publiceret" }, select: { id: true } });
  if (!article) return { ok: false, reason: "not-found" };
  const day = (input.now ?? new Date()).toISOString().slice(0, 10);
  const inc = input.type === "impression" ? { impressions: 1 } : { clicks: 1 };
  await db.frontpageSlotMetric.upsert({
    where: { instansId_moduleId_slotKey_articleId_day: { instansId: input.instansId, moduleId: input.moduleId, slotKey: input.slotKey, articleId: input.articleId, day } },
    create: { instansId: input.instansId, moduleId: input.moduleId, slotKey: input.slotKey, articleId: input.articleId, day, ...inc },
    update: { ...(input.type === "impression" ? { impressions: { increment: 1 } } : { clicks: { increment: 1 } }) },
  });
  return { ok: true };
}

export async function getSlotMetrics(user: FrontpageUser, opts: { days?: number; now?: Date } = {}) {
  if (!can(user, PERMISSIONS.FRONTPAGE_EDIT)) return [];
  const now = opts.now ?? new Date();
  const since = new Date(now.getTime() - (opts.days ?? 7) * 86_400_000).toISOString().slice(0, 10);
  const rows = await db.frontpageSlotMetric.findMany({ where: { instansId: user.instansId, day: { gte: since } } });
  const agg = new Map<string, { moduleId: string; slotKey: string; impressions: number; clicks: number }>();
  for (const r of rows) {
    const k = `${r.moduleId}:${r.slotKey}`;
    const cur = agg.get(k) ?? { moduleId: r.moduleId, slotKey: r.slotKey, impressions: 0, clicks: 0 };
    cur.impressions += r.impressions;
    cur.clicks += r.clicks;
    agg.set(k, cur);
  }
  return [...agg.values()].map((x) => ({ ...x, ctr: x.impressions > 0 ? x.clicks / x.impressions : 0 })).sort((a, b) => a.moduleId.localeCompare(b.moduleId) || a.slotKey.localeCompare(b.slotKey));
}
