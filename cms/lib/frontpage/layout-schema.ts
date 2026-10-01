import { z } from "zod";
import { MODULE_REGISTRY, getModuleDef } from "./modules";
import { MODULE_TYPE_IDS, VARIANTS, type SnapshotItems } from "./types";

/**
 * Layout-datamodel (T12). Alt er rent, strikt og serialiserbart (gemmes som Json i FrontpageLayout.modules).
 *
 * Mærkning kan IKKE slås fra: alle objekter er .strict(), og der findes intet felt der styrer mærkning.
 * Et forsøg på at tilføje fx `hideLabel` giver valideringsfejl.
 */

export const MAX_MODULES = 30;

const moduleId = z.string().regex(/^[a-z0-9][a-z0-9-]{1,39}$/, "Modul-id: 2–40 tegn, små bogstaver/tal/bindestreg.");
const slug = z.string().regex(/^[a-z0-9][a-z0-9-]{0,63}$/, "Ugyldig slug.");

export const breakRefSchema = z
  .object({
    afterSlot: z.number().int().min(1).max(50),
    moduleId,
    /** Gentag breaket hver N. slot (kun lister, fx seneste-nyt). */
    repeatEvery: z.number().int().min(2).max(20).optional(),
  })
  .strict();
export type BreakRef = z.infer<typeof breakRefSchema>;

export const moduleConfigSchema = z
  .object({
    titel: z.string().trim().max(80).optional(),
    sektionSlug: slug.optional(),
    omraadeSlug: slug.optional(),
    maxAgeHours: z.number().int().min(1).max(720).optional(),
    breaks: z.array(breakRefSchema).max(6).optional(),
    placement: z.enum(["sequence", "inline"]).optional(),
    promoKind: z.enum(["stoet", "nyhedsbrev", "indsend"]).optional(),
    adFormat: z.enum(["NATIVE_PREMIUM", "NATIVE_SEKTION", "IN_FEED_BANNER", "EVENT_POST", "GUIDE_PROFILE"]).optional(),
    sourceTypes: z.array(z.string().regex(/^[a-z0-9_]{2,40}$/)).max(10).optional(),
  })
  .strict();
export type ModuleConfig = z.infer<typeof moduleConfigSchema>;

export const REGIONS = ["full", "main", "sidebar"] as const;

export const moduleInstanceSchema = z
  .object({
    id: moduleId,
    type: z.enum(MODULE_TYPE_IDS),
    slots: z.number().int().min(0).max(20),
    variant: z.enum(VARIANTS).optional(),
    region: z.enum(REGIONS).default("full"),
    visible: z.boolean().default(true),
    /** forslag = AI-snapshot skal godkendes (standard). auto er reserveret til senere (se spec, åbne spørgsmål). */
    mode: z.enum(["forslag", "auto"]).default("forslag"),
    config: moduleConfigSchema.default({}),
  })
  .strict();
export type ModuleInstance = z.infer<typeof moduleInstanceSchema>;

type Issue = { path: (string | number)[]; message: string };

/** Valideringsregler der kræver kendskab til hele layoutet. Eksporteret så UI kan vise fejl pr. modul. */
export function validateLayoutModules(modules: readonly ModuleInstance[]): Issue[] {
  const issues: Issue[] = [];
  if (modules.length > MAX_MODULES) issues.push({ path: [], message: `Højst ${MAX_MODULES} moduler pr. layout.` });

  const byId = new Map<string, { m: ModuleInstance; i: number }>();
  const counts = new Map<string, number>();
  modules.forEach((m, i) => {
    if (byId.has(m.id)) issues.push({ path: [i, "id"], message: `Modul-id '${m.id}' bruges flere gange.` });
    byId.set(m.id, { m, i });
    counts.set(m.type, (counts.get(m.type) ?? 0) + 1);
  });

  modules.forEach((m, i) => {
    const def = getModuleDef(m.type);
    if (!def) {
      issues.push({ path: [i, "type"], message: `Ukendt modultype '${m.type}'.` });
      return;
    }
    if ((counts.get(m.type) ?? 0) > def.maxInstances) {
      issues.push({ path: [i, "type"], message: `Højst ${def.maxInstances} '${def.label}'-modul(er) pr. layout.` });
    }
    if (m.slots < def.slots.min || m.slots > def.slots.max) {
      issues.push({ path: [i, "slots"], message: `${def.label}: ${def.slots.min}–${def.slots.max} slots.` });
    }
    if (m.variant && !def.variants.includes(m.variant)) {
      issues.push({ path: [i, "variant"], message: `${def.label} understøtter ikke varianten '${m.variant}'.` });
    }
    for (const key of Object.keys(m.config)) {
      if (!def.allowedConfigKeys.includes(key)) {
        issues.push({ path: [i, "config", key], message: `'${key}' er ikke en gyldig indstilling for ${def.label}.` });
      }
    }
    for (const [bi, br] of (m.config.breaks ?? []).entries()) {
      if (!def.breakHost) {
        issues.push({ path: [i, "config", "breaks", bi], message: `${def.label} kan ikke have inline-breaks.` });
        continue;
      }
      const target = byId.get(br.moduleId);
      const tdef = target ? getModuleDef(target.m.type) : null;
      if (!target || !tdef?.isBreak) {
        issues.push({ path: [i, "config", "breaks", bi, "moduleId"], message: `Break '${br.moduleId}' findes ikke eller er ikke et break-modul.` });
      } else if (target.m.config.placement !== "inline") {
        issues.push({ path: [i, "config", "breaks", bi, "moduleId"], message: `Break '${br.moduleId}' skal have placement 'inline'.` });
      }
      if (br.afterSlot > m.slots) {
        issues.push({ path: [i, "config", "breaks", bi, "afterSlot"], message: `afterSlot (${br.afterSlot}) overstiger antal slots (${m.slots}).` });
      }
      if (br.repeatEvery !== undefined && def.order === "score" && m.type !== "seneste-nyt") {
        // repeatEvery giver kun mening i lange lister; i grids afvises det for at undgå overraskelser.
        issues.push({ path: [i, "config", "breaks", bi, "repeatEvery"], message: "repeatEvery understøttes kun i seneste-nyt." });
      }
    }
  });

  // Inline-break skal være refereret præcis én gang; sekvens-break må ikke være refereret.
  const refCount = new Map<string, number>();
  modules.forEach((m) => (m.config.breaks ?? []).forEach((b) => refCount.set(b.moduleId, (refCount.get(b.moduleId) ?? 0) + 1)));
  modules.forEach((m, i) => {
    const def = getModuleDef(m.type);
    if (!def?.isBreak) return;
    const refs = refCount.get(m.id) ?? 0;
    if (m.config.placement === "inline" && refs !== 1) {
      issues.push({ path: [i, "config", "placement"], message: `Inline-break '${m.id}' skal refereres af præcis ét værtsmodul (nu ${refs}).` });
    }
    if (m.config.placement !== "inline" && refs > 0) {
      issues.push({ path: [i, "config", "placement"], message: `'${m.id}' er refereret som inline-break, men har ikke placement 'inline'.` });
    }
  });
  return issues;
}

export const modulesSchema = z.array(moduleInstanceSchema).superRefine((modules, ctx) => {
  for (const issue of validateLayoutModules(modules)) ctx.addIssue({ code: "custom", message: issue.message, path: issue.path });
});

export const frontpageLayoutSchema = z
  .object({
    schemaVersion: z.literal(1).default(1),
    name: z.string().trim().min(1).max(80),
    modules: modulesSchema,
  })
  .strict();
export type FrontpageLayoutDoc = z.infer<typeof frontpageLayoutSchema>;

export type ParseResult<T> = { ok: true; value: T } | { ok: false; errors: string[] };

function fmt(error: z.ZodError): string[] {
  return error.issues.map((i) => (i.path.length ? `${i.path.join(".")}: ${i.message}` : i.message));
}

export function parseModules(value: unknown): ParseResult<ModuleInstance[]> {
  const res = modulesSchema.safeParse(value);
  return res.success ? { ok: true, value: res.data } : { ok: false, errors: fmt(res.error) };
}

export function parseLayoutDoc(value: unknown): ParseResult<FrontpageLayoutDoc> {
  const res = frontpageLayoutSchema.safeParse(value);
  return res.success ? { ok: true, value: res.data } : { ok: false, errors: fmt(res.error) };
}

/** Effektiv variant for et modul (config -> registerets standard). */
export function effectiveVariant(m: ModuleInstance) {
  return m.variant ?? MODULE_REGISTRY[m.type].defaultVariant;
}

export interface SlotRef {
  moduleId: string;
  slotIndex: number;
}

/** Alle slots i layoutet for artikel-moduler (rækkefølge = layoutets rækkefølge). Skjulte moduler udelades. */
export function listArticleSlots(modules: readonly ModuleInstance[]): SlotRef[] {
  const out: SlotRef[] = [];
  for (const m of modules) {
    if (!m.visible) continue;
    if (MODULE_REGISTRY[m.type].kind !== "artikel") continue;
    for (let i = 0; i < m.slots; i++) out.push({ moduleId: m.id, slotIndex: i });
  }
  return out;
}

// ── Snapshot-items (FrontpageSnapshot.items) ────────────────────────────────

const assignmentSchema = z
  .object({
    moduleId,
    slotIndex: z.number().int().min(0).max(50),
    articleId: z.string().min(1).max(64),
    variant: z.enum(VARIANTS),
    kilde: z.enum(["ai", "redaktør", "regel"]),
    prioritet: z.number().int().min(1).max(5),
    begrundelse: z.string().max(400),
    konfidens: z.number().min(0).max(1).nullable(),
    label: z.object({ tekst: z.string().min(1).max(120), synlig: z.literal(true) }).strict(),
    locked: z.boolean(),
    score: z.number().optional(),
  })
  .strict();

const violationSchema = z
  .object({
    code: z.string().max(40),
    severity: z.enum(["blokerende", "advarsel"]),
    besked: z.string().max(400),
    moduleId: z.string().max(60).optional(),
    slotIndex: z.number().int().optional(),
    articleId: z.string().max(64).optional(),
  })
  .strict();

export const snapshotItemsSchema = z
  .object({
    schemaVersion: z.literal(1),
    layoutVersion: z.number().int().min(0),
    assignments: z.array(assignmentSchema).max(400),
    warnings: z.array(violationSchema).max(200),
  })
  .strict();

export function parseSnapshotItems(value: unknown): ParseResult<SnapshotItems> {
  const res = snapshotItemsSchema.safeParse(value);
  return res.success ? { ok: true, value: res.data as SnapshotItems } : { ok: false, errors: fmt(res.error) };
}
