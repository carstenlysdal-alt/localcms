import { parseModules, type ModuleConfig, type ModuleInstance, type ParseResult } from "./layout-schema";
import { MODULE_REGISTRY } from "./modules";
import type { ModuleTypeId } from "./types";

/**
 * Skabelonbibliotek (T12). En skabelon = færdig rækkefølge af modul-instanser med fornuftige standarder.
 * Skabeloner er rene funktioner: instantiateTemplate() giver validerede modul-instanser med unikke id'er,
 * som UI'et kan indsætte i et layout (applyTemplate) og derefter finjustere via drag-and-drop.
 */

export type TemplateParamDef =
  | { key: string; label: string; type: "number"; min: number; max: number; default: number }
  | { key: string; label: string; type: "enum"; options: readonly string[]; default: string }
  | { key: string; label: string; type: "slug"; default: string };

export type TemplateParams = Record<string, string | number | undefined>;

export interface TemplateDef {
  id: string;
  navn: string;
  beskrivelse: string;
  kategori: "top" | "baand" | "sektion" | "side";
  params: readonly TemplateParamDef[];
  build(params: Record<string, string | number>, id: (base: string) => string): ModuleInstance[];
}

const mod = (id: string, type: ModuleTypeId, over: Partial<Omit<ModuleInstance, "id" | "type">> & { config?: ModuleConfig } = {}): ModuleInstance => ({
  id,
  type,
  slots: over.slots ?? MODULE_REGISTRY[type].slots.default,
  region: over.region ?? "full",
  visible: over.visible ?? true,
  mode: over.mode ?? "forslag",
  ...(over.variant ? { variant: over.variant } : {}),
  config: over.config ?? {},
});

const BREAK_TYPES = ["ad-break", "sponsoreret-break", "partner-break", "egen-promo"] as const;

export const TEMPLATES: readonly TemplateDef[] = [
  {
    id: "top-3-grid",
    navn: "Top 3-grid",
    beskrivelse: "Tre ligestillede historier i en række.",
    kategori: "top",
    params: [],
    build: (_p, id) => [mod(id("top-grid"), "top-grid", { slots: 3 })],
  },
  {
    id: "top-hero-sidebar",
    navn: "Hero med sidebar",
    beskrivelse: "Stor tophistorie til venstre, tre kompakte historier i en sidebar.",
    kategori: "top",
    params: [],
    build: (_p, id) => [
      mod(id("hero"), "hero", { region: "main" }),
      mod(id("top-grid"), "top-grid", { slots: 3, variant: "kompakt", region: "sidebar" }),
    ],
  },
  {
    id: "top-med-annonce-break",
    navn: "Top med break",
    beskrivelse: "Hero + grid, brudt af en annonce, sponsoreret boks, partner-boks eller egen promo efter slot N.",
    kategori: "top",
    params: [
      { key: "slots", label: "Antal slots i griddet", type: "number", min: 3, max: 6, default: 4 },
      { key: "breakAfter", label: "Break efter slot nr.", type: "number", min: 1, max: 5, default: 2 },
      { key: "breakType", label: "Break-type", type: "enum", options: BREAK_TYPES, default: "ad-break" },
    ],
    build: (p, id) => {
      const slots = Number(p.slots);
      const afterSlot = Math.min(Number(p.breakAfter), slots - 1);
      const breakType = String(p.breakType) as ModuleTypeId;
      const breakId = id(breakType);
      return [
        mod(id("hero"), "hero"),
        mod(id("top-grid"), "top-grid", { slots, config: { breaks: [{ afterSlot, moduleId: breakId }] } }),
        mod(breakId, breakType, { config: { placement: "inline" } }),
      ];
    },
  },
  {
    id: "breaking-banner",
    navn: "Breaking-banner",
    beskrivelse: "Bjælke øverst der kun vises når der er en frisk breaking-historie.",
    kategori: "baand",
    params: [],
    build: (_p, id) => [mod(id("breaking-bar"), "breaking-bar")],
  },
  {
    id: "dit-omraade-rail",
    navn: "Dit område",
    beskrivelse: "Lokale historier for besøgendes valgte område.",
    kategori: "baand",
    params: [{ key: "slots", label: "Antal slots", type: "number", min: 2, max: 6, default: 3 }],
    build: (p, id) => [mod(id("dit-omraade"), "dit-omraade", { slots: Number(p.slots) })],
  },
  {
    id: "kalender-strip",
    navn: "Kalender-strip",
    beskrivelse: "Kommende begivenheder.",
    kategori: "baand",
    params: [],
    build: (_p, id) => [mod(id("kalender-strip"), "kalender-strip")],
  },
  {
    id: "fra-kommunen-politiet",
    navn: "Fra kommunen og politiet",
    beskrivelse: "To maskinindsamlede signal-bånd, altid mærket 'Maskinindsamlet – ikke redaktionelt vurderet'.",
    kategori: "baand",
    params: [],
    build: (_p, id) => [
      mod(id("fra-kommunen"), "fra-kommunen", { config: { sourceTypes: ["kommune_dagsorden", "kommune_pressemeddelelse"] } }),
      mod(id("fra-politiet"), "fra-politiet", { config: { sourceTypes: ["politi", "beredskab_112"] } }),
    ],
  },
  {
    id: "debat-opslagstavle",
    navn: "Debat og opslagstavle",
    beskrivelse: "Debatindlæg og lokale opslag.",
    kategori: "baand",
    params: [],
    build: (_p, id) => [mod(id("debat"), "debat"), mod(id("opslagstavle"), "opslagstavle")],
  },
  {
    id: "sektionsside-skabelon",
    navn: "Sektionsside",
    beskrivelse: "Hero + grid + seneste nyt for én sektion (til sektionssider).",
    kategori: "sektion",
    params: [{ key: "sektionSlug", label: "Sektion (slug)", type: "slug", default: "nyheder" }],
    build: (p, id) => {
      const sektionSlug = String(p.sektionSlug);
      return [
        mod(id("hero"), "hero", { config: { sektionSlug, maxAgeHours: 168 } }),
        mod(id("top-grid"), "top-grid", { slots: 3, config: { sektionSlug, maxAgeHours: 168 } }),
        mod(id("seneste-nyt"), "seneste-nyt", { slots: 10, config: { sektionSlug } }),
      ];
    },
  },
  {
    id: "forside-standard",
    navn: "Standardforside",
    beskrivelse: "Breaking-bar, hero + top-grid, dit område og seneste nyt (svarer til dagens forside).",
    kategori: "side",
    params: [],
    build: (_p, id) => [
      mod(id("breaking-bar"), "breaking-bar"),
      mod(id("hero"), "hero"),
      mod(id("top-grid"), "top-grid", { slots: 3 }),
      mod(id("dit-omraade"), "dit-omraade", { slots: 3 }),
      mod(id("seneste-nyt"), "seneste-nyt", { slots: 8 }),
    ],
  },
];

export function getTemplate(id: string): TemplateDef | null {
  return TEMPLATES.find((t) => t.id === id) ?? null;
}

/** Unikke modul-id'er: `hero`, `hero-2`, `hero-3` … */
export function makeIdFactory(taken: Iterable<string> = []): (base: string) => string {
  const used = new Set(taken);
  return (base) => {
    let candidate = base;
    for (let n = 2; used.has(candidate); n++) candidate = `${base}-${n}`;
    used.add(candidate);
    return candidate;
  };
}

function resolveParams(t: TemplateDef, given: TemplateParams): ParseResult<Record<string, string | number>> {
  const out: Record<string, string | number> = {};
  const errors: string[] = [];
  for (const def of t.params) {
    const raw = given[def.key] ?? def.default;
    if (def.type === "number") {
      const n = Number(raw);
      if (!Number.isInteger(n) || n < def.min || n > def.max) errors.push(`${def.label}: ${def.min}–${def.max}.`);
      else out[def.key] = n;
    } else if (def.type === "enum") {
      if (!def.options.includes(String(raw))) errors.push(`${def.label}: ugyldig værdi.`);
      else out[def.key] = String(raw);
    } else {
      if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(String(raw))) errors.push(`${def.label}: ugyldig slug.`);
      else out[def.key] = String(raw);
    }
  }
  return errors.length ? { ok: false, errors } : { ok: true, value: out };
}

export function instantiateTemplate(templateId: string, params: TemplateParams = {}, takenIds: Iterable<string> = []): ParseResult<ModuleInstance[]> {
  const t = getTemplate(templateId);
  if (!t) return { ok: false, errors: [`Ukendt skabelon '${templateId}'.`] };
  const p = resolveParams(t, params);
  if (!p.ok) return p;
  return parseModules(t.build(p.value, makeIdFactory(takenIds)));
}

/** Indsæt (append) eller erstat hele layoutet med en skabelon. Resultatet valideres som helhed. */
export function applyTemplate(
  existing: readonly ModuleInstance[],
  templateId: string,
  params: TemplateParams = {},
  mode: "append" | "replace" = "append",
): ParseResult<ModuleInstance[]> {
  const base = mode === "replace" ? [] : existing;
  const inst = instantiateTemplate(templateId, params, base.map((m) => m.id));
  if (!inst.ok) return inst;
  return parseModules([...base, ...inst.value]);
}

/** Layout til instanser der endnu ikke har gemt et eget (ikke persisteret). */
export function defaultLayoutModules(): ModuleInstance[] {
  const res = instantiateTemplate("forside-standard");
  if (!res.ok) throw new Error(`Standardlayout er ugyldigt: ${res.errors.join("; ")}`);
  return res.value;
}
