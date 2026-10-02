import type { PrismaClient } from "@prisma/client";
import { DEFAULT_SECTIONS, type DefaultSection } from "./default-sections";

/** Eksisterende kategori (kun de felter planlæggeren skal bruge). */
export type ExistingCategory = { id: string; slug: string; parentId: string | null };

export type SectionPlan = {
  /** Nye topsektioner, der oprettes. */
  createTop: Array<{ navn: string; slug: string; beskrivelse: string; sortering: number }>;
  /** Nye undersektioner (forælderens slug), der oprettes. */
  createChildren: Array<{ parentSlug: string; navn: string; slug: string; beskrivelse?: string; sortering: number }>;
  /** Findes allerede med den rigtige placering (røres ikke). */
  unchanged: string[];
  /** Findes med en ANDEN placering end standarden (flyttes aldrig automatisk — redaktøren/AI-operatøren beslutter). */
  conflicts: Array<{ slug: string; fundetUnder: string | null; forventetUnder: string | null }>;
};

/**
 * Ren planlægning (ingen DB): hvad skal oprettes for at en instans får standardstrukturen?
 * Idempotent og ikke-destruktiv: eksisterende kategorier slettes, omdøbes eller flyttes aldrig.
 */
export function planSectionSync(existing: readonly ExistingCategory[], defaults: readonly DefaultSection[] = DEFAULT_SECTIONS): SectionPlan {
  const bySlug = new Map(existing.map((c) => [c.slug, c]));
  const slugOfId = new Map(existing.map((c) => [c.id, c.slug]));
  const plan: SectionPlan = { createTop: [], createChildren: [], unchanged: [], conflicts: [] };

  for (const top of defaults) {
    const found = bySlug.get(top.slug);
    if (!found) plan.createTop.push({ navn: top.navn, slug: top.slug, beskrivelse: top.beskrivelse, sortering: top.sortering });
    else if (found.parentId !== null) plan.conflicts.push({ slug: top.slug, fundetUnder: slugOfId.get(found.parentId) ?? "ukendt", forventetUnder: null });
    else plan.unchanged.push(top.slug);

    for (const child of top.children) {
      const f = bySlug.get(child.slug);
      if (!f) plan.createChildren.push({ parentSlug: top.slug, navn: child.navn, slug: child.slug, beskrivelse: child.beskrivelse, sortering: child.sortering });
      else if (slugOfId.get(f.parentId ?? "") !== top.slug) {
        plan.conflicts.push({ slug: child.slug, fundetUnder: f.parentId ? (slugOfId.get(f.parentId) ?? "ukendt") : null, forventetUnder: top.slug });
      } else plan.unchanged.push(child.slug);
    }
  }
  return plan;
}

/** Udfører planen for ÉN instans (kun oprettelser). Returnerer antal oprettede kategorier. */
export async function applySectionSync(db: PrismaClient, instansId: string, plan: SectionPlan): Promise<number> {
  let created = 0;
  for (const t of plan.createTop) {
    await db.category.create({ data: { instansId, navn: t.navn, slug: t.slug, beskrivelse: t.beskrivelse, sortering: t.sortering, iNavigation: true } });
    created++;
  }
  const parents = await db.category.findMany({ where: { instansId, parentId: null }, select: { id: true, slug: true } });
  const parentId = new Map(parents.map((p) => [p.slug, p.id]));
  for (const c of plan.createChildren) {
    const pid = parentId.get(c.parentSlug);
    if (!pid) continue; // forælderen findes ikke (fx konflikt) — opret ikke et forældreløst barn
    await db.category.create({ data: { instansId, navn: c.navn, slug: c.slug, beskrivelse: c.beskrivelse ?? null, sortering: c.sortering, parentId: pid, iNavigation: true } });
    created++;
  }
  // Instansens kategori-taksonomi (bruges af AI-hjælpere) = topsektionernes navne.
  const tops = await db.category.findMany({ where: { instansId, parentId: null }, orderBy: { sortering: "asc" }, select: { navn: true } });
  await db.instance.update({ where: { id: instansId }, data: { kategoriTaksonomi: tops.map((t) => t.navn) } });
  return created;
}
