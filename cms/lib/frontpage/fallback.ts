import { composeFrontpage } from "./compose";
import { basicEligibility, enforceGuardrails, labelFor, placementProblems, type GuardContext } from "./guardrails";
import { effectiveVariant, type ModuleInstance } from "./layout-schema";
import { getModuleDef } from "./modules";
import { defaultLayoutModules } from "./templates";
import { sortChronological } from "./rank";
import {
  isCommercialType,
  type Candidate,
  type FrontpageSource,
  type Pin,
  type QuotaInput,
  type SlotAssignment,
  type SnapshotItems,
  type Violation,
} from "./types";

/**
 * Fallback-kæde (T11, ejerens beslutning): forsiden vises ALTID.
 *   1. Sidst GODKENDTE snapshot (hvis ikke udløbet og lavet til det aktuelle layout) — revalideret mod friske data;
 *      huller (afpublicerede artikler osv.) repareres deterministisk.
 *   2. Deterministisk score (rank.ts + guardrails) hvis intet godkendt findes / det er udløbet / layoutet er ændret.
 *   3. Seneste nyt (publiceretTid desc) hvis også trin 2 fejler eller giver intet.
 * Hele funktionen er ren og kaster aldrig; hvert trin er indkapslet.
 */

export interface ApprovedSnapshotInput {
  id: string;
  layoutId: string | null;
  items: SnapshotItems;
  expiresAt: Date | null;
}

export interface ResolveInput {
  instansId: string;
  modules: readonly ModuleInstance[];
  /** Aktivt layout: id er null for standardlayoutet (ikke gemt). */
  layout: { id: string | null; version: number };
  candidates: readonly Candidate[];
  pins?: readonly Pin[];
  quota: QuotaInput;
  approved: ApprovedSnapshotInput | null;
  now?: Date;
  hour?: number;
}

export interface ResolvedFrontpage {
  source: FrontpageSource;
  /** Hvorfor denne kilde blev valgt (til log/editor-banner). */
  reason: string;
  assignments: SlotAssignment[];
  warnings: Violation[];
  snapshotId: string | null;
  layoutId: string | null;
  layoutVersion: number;
  /** Antal placeringer i det godkendte snapshot der blev erstattet/repareret. */
  repaired: number;
  /** Modulerne placeringerne hører til (kan være standardlayoutet i nødfallback). */
  modules: ModuleInstance[];
}

export function resolveFrontpage(input: ResolveInput): ResolvedFrontpage {
  const now = input.now ?? new Date();
  const ctx: GuardContext = { instansId: input.instansId, now, kvoteloftProcent: input.quota.kvoteloftProcent, quotaExceeded: input.quota.isExceeded };
  const base = { snapshotId: null, layoutId: input.layout.id, layoutVersion: input.layout.version, repaired: 0 };
  let reason = "Ingen godkendt forside — deterministisk ranking.";

  // 1) Godkendt snapshot
  try {
    const a = input.approved;
    if (!a) {
      reason = "Ingen godkendt forside endnu — deterministisk ranking.";
    } else if (a.expiresAt && a.expiresAt.getTime() <= now.getTime()) {
      reason = "Den godkendte forside er udløbet — deterministisk ranking.";
    } else if (a.layoutId !== input.layout.id || a.items.layoutVersion !== input.layout.version) {
      reason = "Layoutet er ændret siden godkendelsen — deterministisk ranking.";
    } else {
      const enforced = enforceGuardrails({ modules: input.modules, assignments: a.items.assignments, candidates: input.candidates, ctx, skipFreshness: true });
      const repaired = a.items.assignments.length - enforced.assignments.length;
      if (enforced.assignments.length > 0) {
        if (repaired === 0) {
          return { ...base, source: "godkendt-snapshot", reason: "Sidst godkendte forside.", assignments: enforced.assignments, warnings: enforced.violations, snapshotId: a.id, modules: [...input.modules] };
        }
        const filled = composeFrontpage({ instansId: input.instansId, modules: input.modules, candidates: input.candidates, pins: [], quota: input.quota, now, hour: input.hour, fixed: enforced.assignments });
        return {
          ...base,
          source: "godkendt-snapshot",
          reason: `Sidst godkendte forside; ${repaired} placering(er) erstattet fordi artikler ikke længere er gyldige.`,
          assignments: filled.assignments,
          warnings: [...enforced.violations, ...filled.violations],
          snapshotId: a.id,
          repaired,
          modules: [...input.modules],
        };
      }
      reason = "Den godkendte forside indeholder ikke længere gyldige artikler — deterministisk ranking.";
    }
  } catch {
    reason = "Fejl ved læsning af godkendt forside — deterministisk ranking.";
  }

  // 2) Deterministisk
  try {
    const det = composeFrontpage({ instansId: input.instansId, modules: input.modules, candidates: input.candidates, pins: input.pins, quota: input.quota, now, hour: input.hour });
    if (det.assignments.length > 0) {
      return { ...base, source: "deterministisk", reason, assignments: det.assignments, warnings: det.violations, modules: [...input.modules] };
    }
    reason = "Deterministisk ranking gav ingen placeringer — seneste nyt.";
  } catch {
    reason = "Deterministisk ranking fejlede — seneste nyt.";
  }

  // 3) Seneste nyt
  try {
    const latest = latestNewsFallback({ modules: input.modules, candidates: input.candidates, ctx });
    return { ...base, source: "seneste-nyt", reason, assignments: latest.assignments, warnings: latest.warnings, modules: latest.modules };
  } catch {
    return { ...base, source: "seneste-nyt", reason: "Nødfallback fejlede — tom forside.", assignments: [], warnings: [], modules: [...input.modules] };
  }
}

/**
 * Nødfallback: nyeste publicerede artikler i de almindelige artikelmoduler (i layoutets rækkefølge),
 * uden ranking, uden kommercielt indhold. Tenant, status, mærkning og AI-restriktioner gælder stadig.
 */
export function latestNewsFallback(input: { modules: readonly ModuleInstance[]; candidates: readonly Candidate[]; ctx: GuardContext }): {
  assignments: SlotAssignment[];
  warnings: Violation[];
  modules: ModuleInstance[];
} {
  const { ctx } = input;
  const usable = (m: ModuleInstance) => {
    const def = getModuleDef(m.type);
    return m.visible && def?.kind === "artikel" && !def.isBreak && !def.breakingOnly;
  };
  let modules = [...input.modules];
  if (!modules.some(usable)) modules = defaultLayoutModules();

  const pool = sortChronological(input.candidates.filter((c) => !isCommercialType(c.indholdstype) && basicEligibility(c, ctx).length === 0));
  const used = new Set<string>();
  const assignments: SlotAssignment[] = [];
  for (const m of modules.filter(usable)) {
    for (let i = 0; i < m.slots; i++) {
      const c = pool.find((x) => !used.has(x.id) && placementProblems(x, m, i, "regel", ctx, { skipFreshness: true }).length === 0);
      if (!c) break;
      used.add(c.id);
      assignments.push({
        moduleId: m.id,
        slotIndex: i,
        articleId: c.id,
        variant: effectiveVariant(m),
        kilde: "regel",
        prioritet: 3,
        begrundelse: "Seneste nyt (nødfallback).",
        konfidens: null,
        label: labelFor(c),
        locked: false,
      });
    }
  }
  return { assignments, warnings: [], modules };
}
