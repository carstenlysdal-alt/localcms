/**
 * Opretter standardstrukturen for sektioner (Nyheder, Politik, Erhverv, 112, Kultur + undersektioner; se lib/default-sections.ts).
 * Ikke-destruktiv og idempotent: kun oprettelser; eksisterende kategorier slettes/omdøbes/flyttes aldrig (konflikter rapporteres).
 *
 *   npm run sections:sync -- --instans <instans-id|domæne>          # TØRKØRSEL: viser planen
 *   npm run sections:sync -- --instans <instans-id|domæne> --apply  # opretter
 *   npm run sections:sync -- --alle [--apply]                       # alle instanser
 */
import { applySectionSync, planSectionSync } from "../lib/default-sections-sync";

async function main() {
  const args = process.argv.slice(2);
  const apply = args.includes("--apply");
  const all = args.includes("--alle");
  const i = args.indexOf("--instans");
  const target = i >= 0 ? args[i + 1] : undefined;
  if (!all && !target) {
    console.error("Brug: --instans <id|domæne> eller --alle (+ --apply for at oprette).");
    process.exit(2);
  }
  const { db } = await import("../lib/db");
  const instances = await db.instance.findMany({
    where: all ? {} : { OR: [{ id: target }, { domaene: target }] },
    select: { id: true, navn: true },
  });
  if (instances.length === 0) {
    console.error("Ingen instans fundet.");
    process.exit(1);
  }
  for (const inst of instances) {
    const existing = await db.category.findMany({ where: { instansId: inst.id }, select: { id: true, slug: true, parentId: true } });
    const plan = planSectionSync(existing);
    const oprettes = plan.createTop.length + plan.createChildren.length;
    console.log(`\n${inst.navn} (${inst.id}): ${oprettes} nye, ${plan.unchanged.length} uændrede, ${plan.conflicts.length} konflikter`);
    for (const t of plan.createTop) console.log(`  + ${t.navn} (${t.slug})`);
    for (const c of plan.createChildren) console.log(`  + ${c.parentSlug} › ${c.navn} (${c.slug})`);
    for (const c of plan.conflicts) console.log(`  ! ${c.slug}: findes under ${c.fundetUnder ?? "topniveau"}, standard er ${c.forventetUnder ?? "topniveau"} — flyttes ikke automatisk`);
    if (apply && oprettes > 0) console.log(`  → oprettet: ${await applySectionSync(db, inst.id, plan)}`);
  }
  if (!apply) console.log("\n(tørkørsel — tilføj --apply for at oprette)");
  await db.$disconnect();
}
main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
