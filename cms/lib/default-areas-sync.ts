import type { PrismaClient } from "@prisma/client";
import type { DefaultArea } from "./default-areas";

/** Eksisterende GeoTag (kun de felter planlæggeren skal bruge). */
export type ExistingArea = { id: string; navn: string; slug: string };

export type AreaPlan = {
  /** Nye områder, der oprettes (koordinater kun hvis standarden har dem). */
  create: DefaultArea[];
  /** Findes allerede (samme slug) — røres aldrig. */
  unchanged: string[];
  /** Navn eller slug er optaget af et ANDET område (unikt pr. instans) — oprettes ikke og flyttes/omdøbes aldrig. */
  conflicts: Array<{ slug: string; navn: string; grund: string }>;
};

const norm = (s: string) => s.trim().toLowerCase();

/**
 * Ren planlægning (ingen DB): hvilke områder skal oprettes, for at en instans får standardområderne?
 * Idempotent og ikke-destruktiv: eksisterende områder slettes, omdøbes eller ændres aldrig (heller ikke deres koordinater).
 */
export function planAreaSync(existing: readonly ExistingArea[], defaults: readonly DefaultArea[]): AreaPlan {
  const bySlug = new Map(existing.map((a) => [a.slug, a]));
  const byName = new Map(existing.map((a) => [norm(a.navn), a]));
  const plan: AreaPlan = { create: [], unchanged: [], conflicts: [] };
  const seenSlugs = new Set<string>();
  const seenNames = new Set<string>();

  for (const area of defaults) {
    if (seenSlugs.has(area.slug) || seenNames.has(norm(area.navn))) {
      plan.conflicts.push({ slug: area.slug, navn: area.navn, grund: "dublet i standardlisten" });
      continue;
    }
    seenSlugs.add(area.slug);
    seenNames.add(norm(area.navn));

    const sameSlug = bySlug.get(area.slug);
    if (sameSlug) {
      if (norm(sameSlug.navn) === norm(area.navn)) plan.unchanged.push(area.slug);
      else plan.conflicts.push({ slug: area.slug, navn: area.navn, grund: `slug findes allerede for "${sameSlug.navn}"` });
      continue;
    }
    const sameName = byName.get(norm(area.navn));
    if (sameName) {
      plan.conflicts.push({ slug: area.slug, navn: area.navn, grund: `navnet findes allerede med slug "${sameName.slug}"` });
      continue;
    }
    plan.create.push(area);
  }
  return plan;
}

/**
 * Udfører planen for ÉN instans (kun oprettelser; eksisterende GeoTags røres ikke). Returnerer antal oprettede områder.
 * Instansens `geografiskDækning` (liste af områdenavne) får de nye navne lagt til — eksisterende poster fjernes/ændres aldrig.
 */
export async function applyAreaSync(db: PrismaClient, instansId: string, plan: AreaPlan): Promise<number> {
  let created = 0;
  for (const a of plan.create) {
    await db.geoTag.create({ data: { instansId, navn: a.navn, slug: a.slug, lat: a.lat, lng: a.lng } });
    created++;
  }
  if (created > 0) {
    const inst = await db.instance.findUnique({ where: { id: instansId }, select: { geografiskDækning: true } });
    const current = Array.isArray(inst?.geografiskDækning) ? (inst.geografiskDækning as unknown[]).filter((x): x is string => typeof x === "string") : [];
    const known = new Set(current.map(norm));
    const merged = [...current, ...plan.create.map((a) => a.navn).filter((n) => !known.has(norm(n)))];
    if (merged.length !== current.length) await db.instance.update({ where: { id: instansId }, data: { geografiskDækning: merged } });
  }
  return created;
}
