import {
  BREAKING_MAX_AGE_HOURS,
  ageHours,
  basicEligibility,
  enforceGuardrails,
  findEmptySlots,
  labelFor,
  matchesModuleFilter,
  placementProblems,
  type GuardContext,
} from "./guardrails";
import { effectiveVariant, type ModuleInstance } from "./layout-schema";
import { getModuleDef } from "./modules";
import { describeScore, priorityFromNorm, rankCandidates, sortChronological, type RankedCandidate } from "./rank";
import type {
  AiSuggestion,
  AssignmentSource,
  Candidate,
  ModuleTypeId,
  Pin,
  QuotaInput,
  SlotAssignment,
  Violation,
} from "./types";

/**
 * Komponering: kandidater + layout + (valgfri) AI-vurdering -> slot-tildelinger.
 * Rent og deterministisk. Rækkefølge: fastlåste/pins -> breaking -> udfyldning pr. modul -> guardrails (sidste led).
 */

/** AI-forslag med lavere konfidens end dette ignoreres (kandidaten rangeres alene deterministisk). */
export const AI_MIN_CONFIDENCE = 0.4;
const AI_WEIGHT = 0.45;
const MODULE_HINT_BONUS = 0.15;

export interface ComposeInput {
  instansId: string;
  modules: readonly ModuleInstance[];
  candidates: readonly Candidate[];
  pins?: readonly Pin[];
  ai?: readonly AiSuggestion[];
  quota: QuotaInput;
  now?: Date;
  /** Overstyr klokkeslæt (Europe/Copenhagen) — kun til tests. */
  hour?: number;
  /** Placeringer der bevares uændret (fx overlevende fra et godkendt snapshot; derefter fyldes huller). */
  fixed?: readonly SlotAssignment[];
}

export interface ComposeResult {
  assignments: SlotAssignment[];
  violations: Violation[];
  stats: { eligible: number; aiUsed: number };
}

const slotKey = (moduleId: string, i: number) => `${moduleId}:${i}`;
const adv = (code: Violation["code"], besked: string, extra: Partial<Violation> = {}): Violation => ({ code, severity: "advarsel", besked, ...extra });

export function composeFrontpage(input: ComposeInput): ComposeResult {
  const now = input.now ?? new Date();
  const ctx: GuardContext = {
    instansId: input.instansId,
    now,
    kvoteloftProcent: input.quota.kvoteloftProcent,
    quotaExceeded: input.quota.isExceeded,
  };
  const violations: Violation[] = [];
  const modules = input.modules.filter((m) => m.visible);
  const articleModules = modules.filter((m) => getModuleDef(m.type)?.kind === "artikel");

  const foreign = input.candidates.filter((c) => c.instansId !== ctx.instansId);
  if (foreign.length) violations.push({ code: "tenant", severity: "advarsel", besked: `${foreign.length} kandidat(er) fra en anden instans blev ignoreret.` });
  const own = input.candidates.filter((c) => c.instansId === ctx.instansId);
  const eligible = own.filter((c) => basicEligibility(c, ctx).length === 0);
  const ranked = rankCandidates(eligible, { now, hour: input.hour });
  const rankIndex = new Map(ranked.map((r, i) => [r.candidate.id, i]));
  const rankById = new Map(ranked.map((r) => [r.candidate.id, r]));

  const aiById = new Map<string, AiSuggestion>();
  for (const s of input.ai ?? []) {
    if (!aiById.has(s.articleId) && rankById.has(s.articleId) && s.konfidens >= AI_MIN_CONFIDENCE) aiById.set(s.articleId, s);
  }
  const combined = (r: RankedCandidate) => {
    const ai = aiById.get(r.candidate.id);
    return ai ? (1 - AI_WEIGHT) * r.norm + AI_WEIGHT * ((ai.prioritet - 1) / 4) : r.norm;
  };

  const slots = new Map<string, SlotAssignment>();
  const used = new Set<string>();
  const topEmner = new Set<string>();
  let aiUsed = 0;

  const isFree = (m: ModuleInstance, i: number) => !slots.has(slotKey(m.id, i));
  const freeSlots = (m: ModuleInstance) => Array.from({ length: m.slots }, (_, i) => i).filter((i) => isFree(m, i));

  function put(c: Candidate, m: ModuleInstance, i: number, kilde: AssignmentSource, meta: { prioritet: number; begrundelse: string; konfidens: number | null; score?: number }) {
    const def = getModuleDef(m.type);
    slots.set(slotKey(m.id, i), {
      moduleId: m.id,
      slotIndex: i,
      articleId: c.id,
      variant: effectiveVariant(m),
      kilde,
      prioritet: meta.prioritet,
      begrundelse: meta.begrundelse.slice(0, 200),
      konfidens: meta.konfidens,
      label: labelFor(c),
      locked: kilde === "redaktør",
      score: meta.score,
    });
    if (m.type !== "breaking-bar") used.add(c.id);
    if (def?.topZone && c.emneKey) topEmner.add(c.emneKey);
  }

  // 0) Fastlåste placeringer (bevares; guardrails validerer til sidst).
  for (const f of input.fixed ?? []) {
    const m = articleModules.find((x) => x.id === f.moduleId);
    if (!m || f.slotIndex >= m.slots || !isFree(m, f.slotIndex)) continue;
    if (m.type !== "breaking-bar" && used.has(f.articleId)) continue;
    slots.set(slotKey(f.moduleId, f.slotIndex), f);
    if (m.type !== "breaking-bar") used.add(f.articleId);
    const c = own.find((x) => x.id === f.articleId);
    if (c?.emneKey && getModuleDef(m.type)?.topZone) topEmner.add(c.emneKey);
  }

  // 1) Redaktørens pins (FrontpagePlacement). Pins vinder over AI/score, men aldrig over governance.
  for (const pin of input.pins ?? []) {
    if (pin.expiresAt && new Date(pin.expiresAt).getTime() <= now.getTime()) continue;
    const c = own.find((x) => x.id === pin.articleId);
    if (!c) {
      violations.push(adv("pin-ikke-placeret", "Fastgjort artikel er ikke blandt gyldige kandidater (afpubliceret/anden instans).", { articleId: pin.articleId }));
      continue;
    }
    if (used.has(c.id)) continue;
    const targets = pin.moduleId ? articleModules.filter((m) => m.id === pin.moduleId) : articleModules.filter((m) => m.type === pin.moduleType);
    let placed = false;
    let firstProblems: Violation[] = [];
    for (const m of targets) {
      const order = pin.slotIndex !== undefined ? [pin.slotIndex, ...freeSlots(m).filter((i) => i !== pin.slotIndex)] : freeSlots(m);
      for (const i of order) {
        if (i < 0 || i >= m.slots || !isFree(m, i)) continue;
        const problems = placementProblems(c, m, i, "redaktør", ctx);
        if (problems.length) {
          if (!firstProblems.length) firstProblems = problems;
          continue;
        }
        put(c, m, i, "redaktør", { prioritet: 5, begrundelse: "Fastgjort af redaktør.", konfidens: null, score: rankById.get(c.id)?.score });
        placed = true;
        break;
      }
      if (placed) break;
    }
    if (!placed) {
      violations.push(...firstProblems);
      violations.push(adv("pin-ikke-placeret", firstProblems[0]?.besked ?? "Pin kunne ikke placeres: intet ledigt slot i et passende modul.", { articleId: c.id }));
    }
  }

  // 1b) Artikel.pinned uden eksplicit placement: fastgjort i redaktionen -> hero, derefter ledigt top-grid-slot.
  const topModules = articleModules.filter((m) => m.type === "hero").concat(articleModules.filter((m) => m.type === "top-grid"));
  for (const r of ranked) {
    const c = r.candidate;
    if (!c.pinned || used.has(c.id)) continue;
    outer: for (const m of topModules) {
      for (const i of freeSlots(m)) {
        if (placementProblems(c, m, i, "redaktør", ctx).length) continue;
        put(c, m, i, "redaktør", { prioritet: 5, begrundelse: "Fastgjort i artiklen (pinned).", konfidens: null, score: r.score });
        break outer;
      }
    }
  }

  // 2) Breaking vinder: breaking-bjælke(r) får alle friske breaking; den nyeste tvinges i hero (ellers top-grid).
  const breaking = sortChronological(
    ranked.filter((r) => r.candidate.breaking && r.candidate.indholdstype === "Uafhængig" && ageHours(r.candidate, now) <= BREAKING_MAX_AGE_HOURS).map((r) => r.candidate),
  );
  for (const m of articleModules.filter((x) => x.type === "breaking-bar")) {
    const free = freeSlots(m);
    for (const c of breaking) {
      if (!free.length) break;
      if (placementProblems(c, m, free[0], "regel", ctx).length) continue;
      put(c, m, free.shift() as number, "regel", { prioritet: 5, begrundelse: "Breaking-historie.", konfidens: null, score: rankById.get(c.id)?.score });
    }
  }
  const forced = breaking.find((c) => !used.has(c.id));
  if (forced) {
    outer2: for (const m of topModules) {
      for (const i of freeSlots(m)) {
        if (placementProblems(forced, m, i, "regel", ctx).length) continue;
        put(forced, m, i, "regel", { prioritet: 5, begrundelse: "Breaking: tvunget til toppen.", konfidens: null, score: rankById.get(forced.id)?.score });
        break outer2;
      }
    }
  }

  // 3) Udfyldning pr. modul: score-moduler først (i layoutets rækkefølge), kronologiske til sidst (de tager resten).
  const fillOrder = [
    ...articleModules.filter((m) => getModuleDef(m.type)?.order === "score"),
    ...articleModules.filter((m) => getModuleDef(m.type)?.order === "kronologisk"),
  ];
  for (const m of fillOrder) {
    const def = getModuleDef(m.type);
    if (!def) continue;
    const free = freeSlots(m);
    if (!free.length) continue;
    let pool: Array<{ c: Candidate; r: RankedCandidate }> = ranked.map((r) => ({ c: r.candidate, r }));
    if (def.order === "kronologisk") {
      const chrono = sortChronological(pool.map((p) => p.c));
      pool = chrono.map((c) => ({ c, r: rankById.get(c.id) as RankedCandidate }));
    } else {
      const hint = (c: Candidate) => (aiById.get(c.id)?.forslagModul === (m.type as ModuleTypeId) ? MODULE_HINT_BONUS : 0);
      pool = [...pool].sort((a, b) => combined(b.r) + hint(b.c) - (combined(a.r) + hint(a.c)) || (rankIndex.get(a.c.id) ?? 0) - (rankIndex.get(b.c.id) ?? 0));
    }
    for (const i of free) {
      const pick = pool.find(({ c }) => {
        if (m.type !== "breaking-bar" && used.has(c.id)) return false;
        if (m.type === "breaking-bar" && Array.from(slots.values()).some((s) => s.moduleId === m.id && s.articleId === c.id)) return false;
        if (!matchesModuleFilter(c, m)) return false;
        if (def.topZone && c.emneKey && topEmner.has(c.emneKey)) return false;
        return placementProblems(c, m, i, "regel", ctx).length === 0;
      });
      if (!pick) break;
      const ai = def.order === "score" ? aiById.get(pick.c.id) : undefined;
      if (ai) aiUsed++;
      put(pick.c, m, i, ai ? "ai" : "regel", {
        prioritet: ai ? ai.prioritet : priorityFromNorm(pick.r.norm),
        begrundelse: ai ? ai.begrundelse : def.order === "kronologisk" ? "Nyeste først." : describeScore(pick.r),
        konfidens: ai ? ai.konfidens : null,
        score: pick.r.score,
      });
    }
  }

  // 4) Sidste forsvarslinje + advarsler om tomme slots.
  const enforced = enforceGuardrails({ modules: input.modules, assignments: Array.from(slots.values()), candidates: own, ctx });
  violations.push(...enforced.violations, ...findEmptySlots(input.modules, enforced.assignments));
  return { assignments: enforced.assignments, violations, stats: { eligible: eligible.length, aiUsed } };
}

/** Oversæt eksisterende FrontpagePlacement-zoner til pins i det nye layout. */
export function placementsToPins(
  placements: ReadonlyArray<{ articleId: string; zone: string; position: number; udloebTid?: Date | null }>,
): Pin[] {
  const zoneToType: Record<string, ModuleTypeId> = {
    "top-hoved": "hero",
    "top-sekundaer": "top-grid",
    omraade: "dit-omraade",
    sektion: "sektion-rail",
  };
  const pins: Pin[] = [];
  for (const p of placements) {
    const moduleType = zoneToType[p.zone];
    if (!moduleType) continue;
    pins.push({
      articleId: p.articleId,
      moduleType,
      slotIndex: p.zone === "top-hoved" ? 0 : Math.max(0, p.position),
      expiresAt: p.udloebTid ?? null,
    });
  }
  return pins;
}

/** Gruppér placeringer pr. modul-instans (slotIndex-sorteret) — til rendering. */
export function assignmentsByModule(assignments: readonly SlotAssignment[]): Record<string, SlotAssignment[]> {
  const out: Record<string, SlotAssignment[]> = {};
  for (const a of assignments) (out[a.moduleId] ??= []).push(a);
  for (const list of Object.values(out)) list.sort((x, y) => x.slotIndex - y.slotIndex);
  return out;
}
