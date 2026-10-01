import { isAiRestrictedCategory } from "../marking";
import { DEFAULT_LABEL_TEXT, getModuleDef } from "./modules";
import type { ModuleInstance } from "./layout-schema";
import { effectiveVariant } from "./layout-schema";
import {
  isCommercialType,
  type AssignmentLabel,
  type AssignmentSource,
  type Candidate,
  type SlotAssignment,
  type Violation,
} from "./types";

/**
 * Redaktionelle rækværk (T11/T12) — rene funktioner, ingen I/O. AI og ranker kan IKKE tilsidesætte dem:
 * compose.ts bruger dem under udvælgelsen, og enforceGuardrails() kører som sidste led (og igen ved godkendelse
 * og når et godkendt snapshot vises), så en forkert/manipuleret placering aldrig når forsiden.
 *
 * Præcedens: governance (tenant, status, mærkning, kvoteloft, AI-restriktioner) > redaktørens pins > breaking > AI/score.
 */

export interface GuardContext {
  instansId: string;
  now: Date;
  kvoteloftProcent: number;
  /** 7-dages-andelen af støttefinansieret indhold har nået loftet (lib/frontpage-governance). */
  quotaExceeded: boolean;
}

/** Breaking-artikler tvinges kun frem hvis de er yngre end dette (timer). */
export const BREAKING_MAX_AGE_HOURS = 12;

const HOUR_MS = 3_600_000;
const v = (code: Violation["code"], besked: string, extra: Partial<Violation> = {}, severity: Violation["severity"] = "blokerende"): Violation => ({
  code,
  severity,
  besked,
  ...extra,
});

export function ageHours(c: Candidate, now: Date): number {
  if (!c.publiceretTid) return Number.POSITIVE_INFINITY;
  return Math.max(0, (now.getTime() - new Date(c.publiceretTid).getTime()) / HOUR_MS);
}

/** Synlig mærkning udledes ALTID af artiklen (single source of truth) — aldrig af snapshot/AI/klient. */
export function labelFor(c: Pick<Candidate, "indholdstype" | "maerkningTekst">): AssignmentLabel {
  const custom = c.maerkningTekst?.trim();
  const tekst = custom || DEFAULT_LABEL_TEXT[c.indholdstype] || c.indholdstype;
  return { tekst, synlig: true };
}

export function isAiRestricted(c: Candidate): boolean {
  if (c.indholdstype !== "AI-assisteret") return false;
  return (
    isAiRestrictedCategory({ slug: c.kategoriSlug, navn: c.kategoriNavn }) ||
    isAiRestrictedCategory({ slug: c.sektionSlug })
  );
}

/** Højst så mange kommercielle placeringer må der være blandt `filled` udfyldte slots. */
export function commercialCap(filled: number, kvoteloftProcent: number): number {
  return Math.max(0, Math.floor((filled * kvoteloftProcent) / 100));
}

/** Krav der gælder uanset modul: tenant, status, mærkning, AI-begrænsning. */
export function basicEligibility(c: Candidate, ctx: GuardContext): Violation[] {
  const out: Violation[] = [];
  const ref = { articleId: c.id };
  if (c.instansId !== ctx.instansId) out.push(v("tenant", "Artiklen tilhører en anden instans.", ref));
  if (c.status !== "Publiceret" || !c.publiceretTid || new Date(c.publiceretTid).getTime() > ctx.now.getTime()) {
    out.push(v("status", "Kun publicerede artikler må vises på forsiden.", ref));
  }
  if (c.indholdstype !== "Uafhængig" && !c.harMaerkning) {
    out.push(v("maerkning", "Artiklen mangler gyldig mærkning og kan ikke vises.", ref));
  }
  if (isAiRestricted(c)) {
    out.push(v("ai-begraenset", "AI-assisteret indhold må aldrig vises fra Krimi/Sundhed.", ref));
  }
  return out;
}

export function effectiveMaxAgeHours(m: ModuleInstance): number {
  const def = getModuleDef(m.type);
  return m.config.maxAgeHours ?? def?.maxAgeHours ?? 72;
}

/** Filter (ikke regelbrud): passer artiklen til modulets sektion/område/debat-konfiguration? */
export function matchesModuleFilter(c: Candidate, m: ModuleInstance): boolean {
  if (m.type === "debat") {
    const slug = m.config.sektionSlug ?? "debat";
    return c.sektionSlug === slug || c.kategoriSlug === slug || c.indholdstype === "Brugerindsendt";
  }
  if (m.config.sektionSlug && c.sektionSlug !== m.config.sektionSlug && c.kategoriSlug !== m.config.sektionSlug) {
    return false;
  }
  if (m.type === "dit-omraade") {
    if (!c.omraadeSlug) return false;
    if (m.config.omraadeSlug && c.omraadeSlug !== m.config.omraadeSlug) return false;
  }
  return true;
}

/** Alle blokerende regler for at lægge `c` i `slotIndex` af modulet `m`. Tom liste = tilladt. */
export function placementProblems(
  c: Candidate,
  m: ModuleInstance,
  slotIndex: number,
  kilde: AssignmentSource,
  ctx: GuardContext,
  opts: { skipFreshness?: boolean } = {},
): Violation[] {
  const def = getModuleDef(m.type);
  const ref = { moduleId: m.id, slotIndex, articleId: c.id };
  if (!def) return [v("modul-ukendt", `Ukendt modultype '${m.type}'.`, ref)];
  if (def.kind !== "artikel") return [v("slot-ugyldigt", `${def.label} fyldes ikke med artikler.`, ref)];
  if (!m.visible) return [v("slot-ugyldigt", "Modulet er skjult.", ref)];
  if (!Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex >= m.slots) {
    return [v("slot-ugyldigt", `Slot ${slotIndex} findes ikke i ${def.label} (${m.slots} slots).`, ref)];
  }

  const out: Violation[] = basicEligibility(c, ctx).map((x) => ({ ...x, moduleId: m.id, slotIndex }));

  const allowed = kilde === "redaktør" ? def.allowedContentTypes : def.autoContentTypes;
  if (!allowed.includes(c.indholdstype)) {
    out.push(v("type-ikke-tilladt", `${c.indholdstype} må ${kilde === "redaktør" ? "ikke placeres i" : "ikke fyldes automatisk i"} ${def.label}.`, ref));
  }
  if (def.breakingOnly && !c.breaking) out.push(v("kun-breaking", `${def.label} viser kun breaking-historier.`, ref));
  if (m.type === "hero" && c.indholdstype === "AI-assisteret" && kilde !== "redaktør") {
    out.push(v("ai-hero", "AI-assisteret indhold må ikke placeres automatisk i hero.", ref));
  }
  if (isCommercialType(c.indholdstype) && ctx.quotaExceeded) {
    out.push(v("kvoteloft", `Kvoteloftet (${ctx.kvoteloftProcent} %) er nået — kommercielt indhold kan ikke vises.`, ref));
  }
  if (!opts.skipFreshness && kilde !== "redaktør") {
    const max = effectiveMaxAgeHours(m);
    if (ageHours(c, ctx.now) > max) out.push(v("friskhed", `Artiklen er ældre end ${max} timer.`, ref));
  }
  return out;
}

export interface EnforceInput {
  modules: readonly ModuleInstance[];
  assignments: readonly SlotAssignment[];
  candidates: readonly Candidate[];
  ctx: GuardContext;
  /** Brug når et allerede godkendt snapshot revalideres (redaktøren har godkendt alderen). */
  skipFreshness?: boolean;
}

export interface EnforceResult {
  assignments: SlotAssignment[];
  violations: Violation[];
}

/**
 * Sidste forsvarslinje. Fjerner ulovlige placeringer, retter variant og mærkning, og rapporterer alt.
 * Returnerer placeringer sorteret efter layoutets rækkefølge og slot.
 */
export function enforceGuardrails(input: EnforceInput): EnforceResult {
  const { modules, candidates, ctx } = input;
  const cmap = new Map(candidates.map((c) => [c.id, c]));
  const moduleIndex = new Map(modules.map((m, i) => [m.id, i]));
  const moduleById = new Map(modules.map((m) => [m.id, m]));
  const violations: Violation[] = [];

  // Redaktørens placeringer behandles først, så de vinder over AI/regel ved dubletter og diversitet.
  const ordered = [...input.assignments].sort((a, b) => {
    const ka = a.kilde === "redaktør" ? 0 : 1;
    const kb = b.kilde === "redaktør" ? 0 : 1;
    if (ka !== kb) return ka - kb;
    const ma = moduleIndex.get(a.moduleId) ?? 1e9;
    const mb = moduleIndex.get(b.moduleId) ?? 1e9;
    return ma !== mb ? ma - mb : a.slotIndex - b.slotIndex;
  });

  const kept: SlotAssignment[] = [];
  const usedSlots = new Set<string>();
  const usedArticles = new Set<string>();
  const topEmner = new Set<string>();

  for (const a of ordered) {
    const ref = { moduleId: a.moduleId, slotIndex: a.slotIndex, articleId: a.articleId };
    const m = moduleById.get(a.moduleId);
    if (!m) {
      violations.push(v("modul-ukendt", `Modulet '${a.moduleId}' findes ikke i layoutet.`, ref));
      continue;
    }
    const c = cmap.get(a.articleId);
    if (!c) {
      violations.push(v("ukendt-artikel", "Artiklen findes ikke blandt gyldige kandidater (slettet, afpubliceret eller anden instans).", ref));
      continue;
    }
    const slotKey = `${a.moduleId}:${a.slotIndex}`;
    if (usedSlots.has(slotKey)) {
      violations.push(v("slot-ugyldigt", "Slotten er allerede brugt.", ref));
      continue;
    }
    const problems = placementProblems(c, m, a.slotIndex, a.kilde, ctx, { skipFreshness: input.skipFreshness });
    if (a.kilde !== "redaktør" && !matchesModuleFilter(c, m)) {
      problems.push(v("type-ikke-tilladt", "Artiklen passer ikke til modulets sektion/område.", ref));
    }
    if (problems.length) {
      violations.push(...problems);
      continue;
    }
    if (m.type === "breaking-bar" ? usedArticles.has(`bar:${m.id}:${c.id}`) : usedArticles.has(c.id)) {
      violations.push(v("dublet", "Artiklen er allerede placeret et andet sted på forsiden.", ref));
      continue;
    }
    const def = getModuleDef(m.type);
    if (def?.topZone && c.emneKey) {
      if (topEmner.has(c.emneKey)) {
        if (a.kilde === "redaktør") {
          violations.push(v("diversitet", `Flere topplaceringer om samme emne (${c.emneKey}) — redaktørens valg bevares.`, ref, "advarsel"));
        } else {
          violations.push(v("diversitet", `Højst én artikel pr. emne i topzonen (${c.emneKey}).`, ref));
          continue;
        }
      }
      topEmner.add(c.emneKey);
    }

    const label = labelFor(c);
    if (a.label?.tekst !== label.tekst || a.label?.synlig !== true) {
      violations.push(v("maerkning", "Mærkning blev rettet til artiklens faktiske mærkning.", ref, "advarsel"));
    }
    const variant = def?.variants.includes(a.variant) ? a.variant : effectiveVariant(m);
    kept.push({ ...a, label, variant, begrundelse: a.begrundelse.slice(0, 200) });
    usedSlots.add(slotKey);
    usedArticles.add(m.type === "breaking-bar" ? `bar:${m.id}:${c.id}` : c.id);
  }

  applyCommercialCap(kept, modules, cmap, ctx, violations);

  kept.sort((a, b) => {
    const ma = moduleIndex.get(a.moduleId) ?? 1e9;
    const mb = moduleIndex.get(b.moduleId) ?? 1e9;
    return ma !== mb ? ma - mb : a.slotIndex - b.slotIndex;
  });
  return { assignments: kept, violations };
}

function applyCommercialCap(
  kept: SlotAssignment[],
  modules: readonly ModuleInstance[],
  cmap: Map<string, Candidate>,
  ctx: GuardContext,
  violations: Violation[],
) {
  const moduleById = new Map(modules.map((m) => [m.id, m]));
  const inZone = (a: SlotAssignment, zone: "alle" | "top") => {
    if (zone === "alle") return true;
    const m = moduleById.get(a.moduleId);
    return Boolean(m && getModuleDef(m.type)?.topZone);
  };

  for (const zone of ["top", "alle"] as const) {
    const scope = () => kept.filter((a) => inZone(a, zone) && getModuleDef(moduleById.get(a.moduleId)?.type ?? "")?.kind === "artikel");
    // Breaking-bar tæller ikke som placering (peger på artikler vist andetsteds).
    const counted = () => scope().filter((a) => moduleById.get(a.moduleId)?.type !== "breaking-bar");
    for (;;) {
      const all = counted();
      const commercial = all.filter((a) => isCommercialType(cmap.get(a.articleId)?.indholdstype ?? ""));
      const cap = commercialCap(all.length, ctx.kvoteloftProcent);
      if (commercial.length <= cap) break;
      // Fjern først AI/regel (laveste prioritet, laveste score); redaktørens pins bevares med advarsel.
      const removable = commercial.filter((a) => a.kilde !== "redaktør").sort((a, b) => a.prioritet - b.prioritet || (a.score ?? 0) - (b.score ?? 0));
      const victim = removable[0];
      if (!victim) {
        violations.push(
          v("kvoteloft", `Kommercielt indhold udgør ${commercial.length} af ${all.length} placeringer (loft ${ctx.kvoteloftProcent} %) — redaktørens pins bevares, men loftet er overskredet.`, {}, "advarsel"),
        );
        break;
      }
      violations.push(
        v("kvoteloft", `Kvoteloft (${ctx.kvoteloftProcent} %) — kommerciel placering fjernet.`, { moduleId: victim.moduleId, slotIndex: victim.slotIndex, articleId: victim.articleId }),
      );
      kept.splice(kept.indexOf(victim), 1);
    }
  }
}

/** Advarsler om tomme slots i artikel-moduler (breaks og breaking-bar må være tomme = skjult). */
export function findEmptySlots(modules: readonly ModuleInstance[], assignments: readonly SlotAssignment[]): Violation[] {
  const filled = new Set(assignments.map((a) => `${a.moduleId}:${a.slotIndex}`));
  const out: Violation[] = [];
  for (const m of modules) {
    const def = getModuleDef(m.type);
    if (!def || def.kind !== "artikel" || !m.visible || def.isBreak || def.breakingOnly) continue;
    for (let i = 0; i < m.slots; i++) {
      if (!filled.has(`${m.id}:${i}`)) out.push(v("tom-slot", `${def.label}: slot ${i + 1} er tom.`, { moduleId: m.id, slotIndex: i }, "advarsel"));
    }
  }
  return out;
}
