/**
 * Opretter standardområder (GeoTag) pr. by: delområderne fra seed-dataene plus de små byer fra kilderegistrene (lib/default-areas.ts).
 * Ikke-destruktiv og idempotent: kun oprettelser; eksisterende områder slettes/omdøbes/ændres aldrig (konflikter rapporteres).
 * Koordinater sættes kun, hvor seed-dataene allerede har dem — ellers lat/lng = null (der opfindes aldrig koordinater).
 *
 *   npm run areas:sync -- --instans <instans-id|domæne>          # TØRKØRSEL: viser planen
 *   npm run areas:sync -- --instans <instans-id|domæne> --apply  # opretter
 *   npm run areas:sync -- --alle [--apply]                       # alle instanser
 */
import path from "node:path";
import type { PrismaClient } from "@prisma/client";
import { defaultAreasFor } from "../lib/default-areas";
import { applyAreaSync, planAreaSync, type AreaPlan } from "../lib/default-areas-sync";

export type AreaArgs = { apply: boolean; all: boolean; target?: string };

/** Rene argumenter (testbar): kaster ved manglende/uforenelige valg. */
export function parseArgs(argv: string[]): AreaArgs {
  const apply = argv.includes("--apply");
  const all = argv.includes("--alle");
  const i = argv.indexOf("--instans");
  const target = i >= 0 ? argv[i + 1] : undefined;
  if (i >= 0 && (!target || target.startsWith("--"))) throw new Error("--instans <id|domæne> mangler en værdi.");
  if (all && target) throw new Error("Brug enten --alle eller --instans, ikke begge.");
  if (!all && !target) throw new Error("Brug: --instans <id|domæne> eller --alle (+ --apply for at oprette).");
  return { apply, all, target };
}

export type AreaSyncReport = { instansId: string; navn: string; domaene: string; plan: AreaPlan; created: number };

/** Planlægger (og ved apply=true udfører) områdesynkronisering for de valgte instanser. Én instans' områder påvirker aldrig en anden. */
export async function syncAreas(db: PrismaClient, args: AreaArgs): Promise<AreaSyncReport[]> {
  const instances = await db.instance.findMany({
    where: args.all ? {} : { OR: [{ id: args.target }, { domaene: args.target }] },
    select: { id: true, navn: true, domaene: true },
    orderBy: { navn: "asc" },
  });
  if (instances.length === 0) throw new Error("Ingen instans fundet.");
  const reports: AreaSyncReport[] = [];
  for (const inst of instances) {
    const existing = await db.geoTag.findMany({ where: { instansId: inst.id }, select: { id: true, navn: true, slug: true } });
    const plan = planAreaSync(existing, defaultAreasFor(inst.domaene));
    const created = args.apply && plan.create.length > 0 ? await applyAreaSync(db, inst.id, plan) : 0;
    reports.push({ instansId: inst.id, navn: inst.navn, domaene: inst.domaene, plan, created });
  }
  return reports;
}

async function main() {
  let args: AreaArgs;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (e) {
    console.error(e instanceof Error ? e.message : e);
    process.exit(2);
  }
  const { db } = await import("../lib/db");
  try {
    const reports = await syncAreas(db, args);
    for (const r of reports) {
      console.log(`\n${r.navn} (${r.instansId}): ${r.plan.create.length} nye, ${r.plan.unchanged.length} uændrede, ${r.plan.conflicts.length} konflikter`);
      for (const a of r.plan.create) console.log(`  + ${a.navn} (${a.slug})${a.lat === null ? "  [uden koordinater]" : ""}`);
      for (const c of r.plan.conflicts) console.log(`  ! ${c.navn} (${c.slug}): ${c.grund} — oprettes ikke`);
      if (args.apply && r.plan.create.length > 0) console.log(`  → oprettet: ${r.created}`);
    }
    if (!args.apply) console.log("\n(tørkørsel — tilføj --apply for at oprette)");
  } finally {
    await db.$disconnect();
  }
}

if (path.basename(process.argv[1] ?? "") === "sync-areas.ts") {
  main().catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
}
