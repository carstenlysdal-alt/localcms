import assert from "node:assert/strict";
import test, { after, before } from "node:test";
import { db } from "../lib/db";
import { DEFAULT_SECTIONS } from "../lib/default-sections";
import { applySectionSync, planSectionSync } from "../lib/default-sections-sync";
import { isAiRestrictedCategory, isAiRestrictedCategoryTree } from "../lib/marking";
import { isReservedSlug } from "../lib/taxonomy";
import { createInstance, installNextMocks } from "./helpers/mock-session";

installNextMocks();

test("standardstruktur: fem topsektioner, højst to niveauer, gyldige og unikke slugs", () => {
  assert.deepEqual(DEFAULT_SECTIONS.map((s) => s.slug), ["nyheder", "politik", "erhverv", "112", "kultur"]);
  const slugs: string[] = [];
  for (const top of DEFAULT_SECTIONS) {
    slugs.push(top.slug, ...top.children.map((c) => c.slug));
    for (const c of top.children) assert.ok(!("children" in c), "undersektioner har ikke egne børn");
  }
  assert.equal(new Set(slugs).size, slugs.length, "slugs er unikke på tværs af hele træet");
  for (const s of slugs) {
    assert.match(s, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    assert.ok(!isReservedSlug(s), `${s} må ikke være reserveret`);
  }
  const nyheder = DEFAULT_SECTIONS.find((s) => s.slug === "nyheder")!;
  for (const slug of ["trafik", "skole-og-boern", "sundhed", "natur-og-klima", "sport", "foreningsliv", "debat"]) {
    assert.ok(nyheder.children.some((c) => c.slug === slug), `${slug} ligger under Nyheder`);
  }
});

test("AI-spærring: 112 og dens undersektioner følger Krimi-/Sundhedsreglen", () => {
  assert.equal(isAiRestrictedCategory({ slug: "112", navn: "112" }), true);
  assert.equal(isAiRestrictedCategory({ slug: "andet", navn: "112" }), true);
  const child = { slug: "politi", navn: "Politi", parent: { slug: "112", navn: "112" } };
  assert.equal(isAiRestrictedCategoryTree(child), true);
  assert.equal(isAiRestrictedCategoryTree({ slug: "politik", navn: "Politik" }), false);
  assert.equal(isAiRestrictedCategoryTree({ slug: "kultur", navn: "Kultur" }), false);
});

test("planSectionSync: tom instans får alt; idempotent; konflikter flyttes aldrig", () => {
  const empty = planSectionSync([]);
  assert.equal(empty.createTop.length, 5);
  assert.equal(empty.createChildren.length, DEFAULT_SECTIONS.reduce((n, s) => n + s.children.length, 0));
  assert.equal(empty.conflicts.length, 0);

  // Gammel struktur: 'sport' ligger som topsektion → konflikt (rapporteres, flyttes ikke)
  const legacy = planSectionSync([
    { id: "a", slug: "nyheder", parentId: null },
    { id: "b", slug: "sport", parentId: null },
    { id: "c", slug: "trafik", parentId: "a" },
  ]);
  assert.deepEqual(legacy.conflicts.map((c) => c.slug), ["sport"]);
  assert.ok(legacy.unchanged.includes("nyheder") && legacy.unchanged.includes("trafik"));
  assert.ok(!legacy.createChildren.some((c) => c.slug === "sport" || c.slug === "trafik"));
});

let instansId = "";
let otherId = "";
before(async () => {
  instansId = (await createInstance("Sek")).id;
  otherId = (await createInstance("Sek2")).id;
});
after(async () => {
  await db.category.deleteMany({ where: { instansId: { in: [instansId, otherId] }, parentId: { not: null } } });
  await db.category.deleteMany({ where: { instansId: { in: [instansId, otherId] } } });
  await db.instance.deleteMany({ where: { id: { in: [instansId, otherId] } } });
});

test("applySectionSync: opretter træet, er idempotent og rører ikke andre instanser", async () => {
  const first = planSectionSync(await db.category.findMany({ where: { instansId }, select: { id: true, slug: true, parentId: true } }));
  const created = await applySectionSync(db, instansId, first);
  assert.equal(created, first.createTop.length + first.createChildren.length);

  const tops = await db.category.findMany({ where: { instansId, parentId: null }, orderBy: { sortering: "asc" } });
  assert.deepEqual(tops.map((t) => t.slug), ["nyheder", "politik", "erhverv", "112", "kultur"]);
  const nyheder = tops[0]!;
  const kids = await db.category.findMany({ where: { instansId, parentId: nyheder.id } });
  assert.ok(kids.length >= 8);
  assert.deepEqual((await db.instance.findUnique({ where: { id: instansId } }))?.kategoriTaksonomi, ["Nyheder", "Politik", "Erhverv", "112", "Kultur"]);

  const second = planSectionSync(await db.category.findMany({ where: { instansId }, select: { id: true, slug: true, parentId: true } }));
  assert.equal(second.createTop.length + second.createChildren.length, 0, "idempotent");
  assert.equal(await db.category.count({ where: { instansId: otherId } }), 0, "tenant-isolation");
});
