import { effectiveVariant, parseModules, type ModuleConfig, type ModuleInstance } from "@/lib/frontpage/layout-schema";
import { MODULE_REGISTRY, getModuleDef } from "@/lib/frontpage/modules";
import { makeIdFactory } from "@/lib/frontpage/templates";
import type { ModuleTypeId, Variant } from "@/lib/frontpage/types";

/**
 * Rene layout-operationer til editoren. Hver operation validerer hele layoutet (parseModules = layout-schema)
 * og returnerer enten et gyldigt nyt layout eller en dansk fejlbesked – layoutet muteres aldrig.
 */
export type OpResult = { ok: true; modules: ModuleInstance[] } | { ok: false; error: string };

const fail = (error: string): OpResult => ({ ok: false, error });

function check(modules: unknown[]): OpResult {
  const res = parseModules(modules);
  if (res.ok) return { ok: true, modules: res.value };
  const first = res.errors[0] ?? "Ugyldigt layout.";
  return fail(first.replace(/^\d+\.[a-zA-Z.0-9]+: /, ""));
}

export const isInline = (m: ModuleInstance) => Boolean(MODULE_REGISTRY[m.type]?.isBreak) && m.config.placement === "inline";

/** Moduler der står som egne rækker (alt undtagen inline-breaks). */
export const topLevel = (modules: readonly ModuleInstance[]) => modules.filter((m) => !isInline(m));

/** Inline-breaks hører til deres vært (config.breaks) i den rækkefølge de er refereret. */
export function breaksOf(modules: readonly ModuleInstance[], host: ModuleInstance) {
  return (host.config.breaks ?? [])
    .map((ref) => ({ ref, module: modules.find((m) => m.id === ref.moduleId) }))
    .filter((x): x is { ref: NonNullable<ModuleInstance["config"]["breaks"]>[number]; module: ModuleInstance } => Boolean(x.module));
}

/** Læg hver inline-break lige efter sin vært (kosmetisk orden i gemt JSON). */
export function normalizeOrder(modules: readonly ModuleInstance[]): ModuleInstance[] {
  const inlineIds = new Set(modules.filter(isInline).map((m) => m.id));
  const out: ModuleInstance[] = [];
  for (const m of modules) {
    if (inlineIds.has(m.id)) continue;
    out.push(m);
    for (const ref of m.config.breaks ?? []) {
      const b = modules.find((x) => x.id === ref.moduleId);
      if (b && inlineIds.has(b.id) && !out.includes(b)) out.push(b);
    }
  }
  for (const m of modules) if (inlineIds.has(m.id) && !out.includes(m)) out.push(m); // forældreløse beholdes (valideringen fanger dem)
  return out;
}

/** Træk/flyt: flyt `activeId` til `overId`s position blandt de øverste moduler. */
export function moveTopLevel(modules: readonly ModuleInstance[], activeId: string, overId: string): OpResult {
  const top = topLevel(modules);
  const from = top.findIndex((m) => m.id === activeId);
  const to = top.findIndex((m) => m.id === overId);
  if (from < 0 || to < 0) return fail("Modulet findes ikke.");
  if (from === to) return { ok: true, modules: [...modules] };
  const next = [...top];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return check(normalizeOrder([...next, ...modules.filter(isInline)]));
}

/** Tastatur-/knapflyt: flyt et modul `delta` pladser op (-1) eller ned (+1). */
export function moveTopLevelBy(modules: readonly ModuleInstance[], id: string, delta: number): OpResult {
  const top = topLevel(modules);
  const i = top.findIndex((m) => m.id === id);
  if (i < 0) return fail("Modulet findes ikke.");
  const j = i + delta;
  if (j < 0 || j >= top.length) return { ok: true, modules: [...modules] };
  return moveTopLevel(modules, id, top[j].id);
}

export function addModule(modules: readonly ModuleInstance[], type: ModuleTypeId, opts: { afterId?: string | null } = {}): OpResult {
  const def = MODULE_REGISTRY[type];
  if (!def) return fail("Ukendt modultype.");
  const id = makeIdFactory(modules.map((m) => m.id))(type);
  const inst: ModuleInstance = {
    id,
    type,
    slots: def.slots.default,
    region: "full",
    visible: true,
    mode: "forslag",
    config: def.isBreak ? { placement: "sequence" } : {},
  };
  const next = topLevel(modules).slice();
  const at = opts.afterId ? next.findIndex((m) => m.id === opts.afterId) : -1;
  if (at >= 0) next.splice(at + 1, 0, inst);
  else next.push(inst);
  return check(normalizeOrder([...next, ...modules.filter(isInline)]));
}

/** Fjern et modul. Inline-breaks følger værten; fjernes et inline-break, fjernes referencen hos værten. */
export function removeModule(modules: readonly ModuleInstance[], id: string): OpResult {
  const m = modules.find((x) => x.id === id);
  if (!m) return fail("Modulet findes ikke.");
  const removed = new Set<string>([id]);
  for (const b of m.config.breaks ?? []) removed.add(b.moduleId);
  const next = modules
    .filter((x) => !removed.has(x.id))
    .map((x) => {
      const breaks = x.config.breaks?.filter((b) => !removed.has(b.moduleId));
      if (breaks === x.config.breaks || !x.config.breaks) return x;
      const { breaks: _drop, ...rest } = x.config;
      void _drop;
      return { ...x, config: breaks && breaks.length ? { ...rest, breaks } : rest };
    });
  return check(next);
}

/** Dublér et modul (med dets inline-breaks) lige efter originalen. */
export function duplicateModule(modules: readonly ModuleInstance[], id: string): OpResult {
  const m = modules.find((x) => x.id === id);
  if (!m) return fail("Modulet findes ikke.");
  if (isInline(m)) return fail("Et break dubleres via break-punkterne på værten.");
  const mk = makeIdFactory(modules.map((x) => x.id));
  const copyId = mk(m.type);
  const breakCopies: ModuleInstance[] = [];
  const newRefs = (m.config.breaks ?? []).map((ref) => {
    const src = modules.find((x) => x.id === ref.moduleId);
    if (!src) return ref;
    const nid = mk(src.type);
    breakCopies.push({ ...src, id: nid, config: { ...src.config } });
    return { ...ref, moduleId: nid };
  });
  const copy: ModuleInstance = { ...m, id: copyId, config: { ...m.config, ...(newRefs.length ? { breaks: newRefs } : {}) } };
  const top = topLevel(modules).slice();
  top.splice(top.findIndex((x) => x.id === id) + 1, 0, copy);
  return check(normalizeOrder([...top, ...modules.filter(isInline), ...breakCopies]));
}

export interface ModulePatch {
  slots?: number;
  variant?: Variant | null;
  region?: ModuleInstance["region"];
  visible?: boolean;
  mode?: ModuleInstance["mode"];
  /** Erstatter config; breaks og placement bevares fra modulet medmindre de er angivet. */
  config?: ModuleConfig;
  /** Alle module-config-nøgler undtagen breaks/placement skal ud, hvis false. */
}

export function updateModule(modules: readonly ModuleInstance[], id: string, patch: ModulePatch): OpResult {
  const m = modules.find((x) => x.id === id);
  if (!m) return fail("Modulet findes ikke.");
  const config: ModuleConfig = patch.config
    ? { ...patch.config, ...(m.config.breaks ? { breaks: m.config.breaks } : {}), ...(m.config.placement ? { placement: m.config.placement } : {}) }
    : m.config;
  const next: ModuleInstance = {
    ...m,
    ...(patch.slots !== undefined ? { slots: patch.slots } : {}),
    ...(patch.region ? { region: patch.region } : {}),
    ...(patch.visible !== undefined ? { visible: patch.visible } : {}),
    ...(patch.mode ? { mode: patch.mode } : {}),
    config,
  };
  if (patch.variant === null) delete next.variant;
  else if (patch.variant) next.variant = patch.variant;
  // Færre slots end en inline-break-position -> afvises af valideringen med forklarende besked.
  return check(modules.map((x) => (x.id === id ? next : x)));
}

export const toggleVisible = (modules: readonly ModuleInstance[], id: string): OpResult => {
  const m = modules.find((x) => x.id === id);
  return m ? updateModule(modules, id, { visible: !m.visible }) : fail("Modulet findes ikke.");
};

export const BREAK_TYPES = ["ad-break", "sponsoreret-break", "partner-break", "egen-promo"] as const;
export type BreakType = (typeof BREAK_TYPES)[number];

/** Tilføj et inline-break "efter slot N" i en vært. */
export function addInlineBreak(modules: readonly ModuleInstance[], hostId: string, breakType: BreakType, afterSlot: number, repeatEvery?: number): OpResult {
  const host = modules.find((x) => x.id === hostId);
  if (!host) return fail("Værtsmodulet findes ikke.");
  if (!getModuleDef(host.type)?.breakHost) return fail(`${MODULE_REGISTRY[host.type].label} kan ikke have break-punkter.`);
  const id = makeIdFactory(modules.map((x) => x.id))(breakType);
  const brk: ModuleInstance = { id, type: breakType, slots: MODULE_REGISTRY[breakType].slots.default, region: host.region, visible: true, mode: "forslag", config: { placement: "inline" } };
  const ref = { afterSlot, moduleId: id, ...(repeatEvery ? { repeatEvery } : {}) };
  const next = modules.map((x) => (x.id === hostId ? { ...x, config: { ...x.config, breaks: [...(x.config.breaks ?? []), ref] } } : x));
  return check(normalizeOrder([...next, brk]));
}

export function removeInlineBreak(modules: readonly ModuleInstance[], hostId: string, breakId: string): OpResult {
  const host = modules.find((x) => x.id === hostId);
  if (!host?.config.breaks?.some((b) => b.moduleId === breakId)) return fail("Break-punktet findes ikke.");
  return removeModule(modules, breakId);
}

export function updateBreakRef(modules: readonly ModuleInstance[], hostId: string, breakId: string, patch: { afterSlot?: number; repeatEvery?: number | null }): OpResult {
  const host = modules.find((x) => x.id === hostId);
  if (!host?.config.breaks) return fail("Break-punktet findes ikke.");
  const breaks = host.config.breaks.map((b) => {
    if (b.moduleId !== breakId) return b;
    const next = { ...b, ...(patch.afterSlot !== undefined ? { afterSlot: patch.afterSlot } : {}) };
    if (patch.repeatEvery === null) delete next.repeatEvery;
    else if (patch.repeatEvery !== undefined) next.repeatEvery = patch.repeatEvery;
    return next;
  });
  return check(modules.map((x) => (x.id === hostId ? { ...x, config: { ...x.config, breaks } } : x)));
}

/** Ændr indholdstypen på et break-punkt (fx annonce -> sponsoreret boks) ved at skifte modul under samme reference. */
export function changeBreakType(modules: readonly ModuleInstance[], hostId: string, breakId: string, newType: BreakType): OpResult {
  const host = modules.find((x) => x.id === hostId);
  const ref = host?.config.breaks?.find((b) => b.moduleId === breakId);
  if (!host || !ref) return fail("Break-punktet findes ikke.");
  const removed = removeInlineBreak(modules, hostId, breakId);
  if (!removed.ok) return removed;
  return addInlineBreak(removed.modules, hostId, newType, ref.afterSlot, ref.repeatEvery);
}

// ── Diff mellem to layouts (til publiceringsdialogen) ────────────────────────

const label = (m: ModuleInstance) => MODULE_REGISTRY[m.type]?.label ?? m.type;

export function describeLayoutDiff(before: readonly ModuleInstance[], after: readonly ModuleInstance[]): string[] {
  const out: string[] = [];
  const b = new Map(before.map((m) => [m.id, m]));
  const a = new Map(after.map((m) => [m.id, m]));
  for (const m of after) if (!b.has(m.id)) out.push(`Tilføjet: ${label(m)}${isInline(m) ? " (break)" : ""}`);
  for (const m of before) if (!a.has(m.id)) out.push(`Fjernet: ${label(m)}${isInline(m) ? " (break)" : ""}`);
  for (const m of after) {
    const old = b.get(m.id);
    if (!old) continue;
    const changes: string[] = [];
    if (old.slots !== m.slots) changes.push(`slots ${old.slots} → ${m.slots}`);
    if (effectiveVariant(old) !== effectiveVariant(m)) changes.push(`variant ${effectiveVariant(old)} → ${effectiveVariant(m)}`);
    if (old.visible !== m.visible) changes.push(m.visible ? "vises igen" : "skjules");
    if (old.mode !== m.mode) changes.push(`tilstand ${old.mode} → ${m.mode}`);
    if (old.region !== m.region) changes.push(`område ${old.region} → ${m.region}`);
    if (JSON.stringify(old.config) !== JSON.stringify(m.config)) changes.push("indstillinger ændret");
    if (changes.length) out.push(`Ændret: ${label(m)} (${changes.join(", ")})`);
  }
  const ob = topLevel(before).filter((m) => a.has(m.id)).map((m) => m.id);
  const oa = topLevel(after).filter((m) => b.has(m.id)).map((m) => m.id);
  if (ob.join() !== oa.join()) out.push("Rækkefølgen af moduler er ændret");
  return out;
}
