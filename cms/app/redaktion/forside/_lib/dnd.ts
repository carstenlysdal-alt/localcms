import { effectiveVariant, type ModuleInstance } from "@/lib/frontpage/layout-schema";
import { MODULE_REGISTRY } from "@/lib/frontpage/modules";
import type { SlotAssignment, Variant } from "@/lib/frontpage/types";

/** Træk-og-slip af artikler mellem slots i et forslag. Rent: returnerer nye lister, validering sker på serveren (editSnapshot). */
export interface SlotRef {
  moduleId: string;
  slotIndex: number;
}

export const slotId = (r: SlotRef) => `${r.moduleId}:${r.slotIndex}`;
export function parseSlotId(id: string): SlotRef | null {
  const i = id.lastIndexOf(":");
  if (i < 1) return null;
  const n = Number(id.slice(i + 1));
  return Number.isInteger(n) && n >= 0 ? { moduleId: id.slice(0, i), slotIndex: n } : null;
}

const same = (a: SlotRef, b: SlotRef) => a.moduleId === b.moduleId && a.slotIndex === b.slotIndex;

function variantFor(old: Variant, dest: ModuleInstance | undefined): Variant {
  if (!dest) return old;
  const allowed = MODULE_REGISTRY[dest.type].variants;
  return allowed.includes(old) ? old : effectiveVariant(dest);
}

/** Flyt (eller byt) en placering til et andet slot. Er målet optaget, byttes de to. */
export function moveAssignment(assignments: readonly SlotAssignment[], from: SlotRef, to: SlotRef, modules: readonly ModuleInstance[]): SlotAssignment[] {
  if (same(from, to)) return [...assignments];
  const src = assignments.find((a) => same(a, from));
  if (!src) return [...assignments];
  const dst = assignments.find((a) => same(a, to));
  const mod = (id: string) => modules.find((m) => m.id === id);
  return assignments.map((a) => {
    if (a === src) return { ...a, moduleId: to.moduleId, slotIndex: to.slotIndex, variant: variantFor(a.variant, mod(to.moduleId)) };
    if (dst && a === dst) return { ...a, moduleId: from.moduleId, slotIndex: from.slotIndex, variant: variantFor(a.variant, mod(from.moduleId)) };
    return a;
  });
}

/** Flyt en placering et slot op/ned inden for samme modul (tastatur-/knapalternativ til træk). */
export function moveAssignmentBy(assignments: readonly SlotAssignment[], from: SlotRef, delta: number, modules: readonly ModuleInstance[]): SlotAssignment[] {
  const m = modules.find((x) => x.id === from.moduleId);
  const target = from.slotIndex + delta;
  if (!m || target < 0 || target >= m.slots) return [...assignments];
  return moveAssignment(assignments, from, { moduleId: from.moduleId, slotIndex: target }, modules);
}

export interface PoolArticle {
  id: string;
  label: { tekst: string; synlig: true };
}

/** Sæt en kandidatartikel i et slot (erstatter evt. eksisterende; artiklen fjernes fra et andet slot så ingen dubletter opstår). */
export function placeArticle(assignments: readonly SlotAssignment[], to: SlotRef, article: PoolArticle, modules: readonly ModuleInstance[]): SlotAssignment[] {
  const dest = modules.find((m) => m.id === to.moduleId);
  const rest = assignments.filter((a) => !same(a, to) && a.articleId !== article.id);
  return [
    ...rest,
    {
      moduleId: to.moduleId,
      slotIndex: to.slotIndex,
      articleId: article.id,
      variant: dest ? effectiveVariant(dest) : "kort",
      kilde: "redaktør",
      prioritet: 5,
      begrundelse: "Valgt af redaktør.",
      konfidens: null,
      label: article.label,
      locked: true,
    },
  ];
}

export function removeAssignment(assignments: readonly SlotAssignment[], at: SlotRef): SlotAssignment[] {
  return assignments.filter((a) => !same(a, at));
}

export function sortAssignments(a: readonly SlotAssignment[]): SlotAssignment[] {
  return [...a].sort((x, y) => x.moduleId.localeCompare(y.moduleId) || x.slotIndex - y.slotIndex);
}
