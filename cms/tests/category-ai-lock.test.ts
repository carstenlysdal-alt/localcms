import assert from "node:assert/strict";
import test, { after, before } from "node:test";
import { db } from "../lib/db";
import { loadCategoryTree } from "../lib/category-tree";
import { isAiRestrictedCategoryTree } from "../lib/marking";
import { createInstance, createUser, installNextMocks, session } from "./helpers/mock-session";

installNextMocks();

let instansId = "";
let krimiId = "";
let childId = "";
let politikId = "";
let otherInstansId = "";
let otherCatId = "";
let manager: { id: string };

before(async () => {
  instansId = (await createInstance("Kat")).id;
  otherInstansId = (await createInstance("Kat2")).id;
  manager = await createUser(instansId, "Redaktionsleder");
  krimiId = (await db.category.create({ data: { instansId, navn: "Krimi og retsvæsen", slug: "krimi-og-retsvaesen" } })).id;
  childId = (await db.category.create({ data: { instansId, navn: "Lokale sager", slug: "lokale-sager", parentId: krimiId } })).id;
  politikId = (await db.category.create({ data: { instansId, navn: "Politik", slug: "politik" } })).id;
  otherCatId = (await db.category.create({ data: { instansId: otherInstansId, navn: "Krimi", slug: "krimi" } })).id;
});

after(async () => {
  await db.category.deleteMany({ where: { instansId, parentId: { not: null } } });
  await db.category.deleteMany({ where: { instansId: { in: [instansId, otherInstansId] } } });
  await db.user.deleteMany({ where: { instansId } });
  await db.instance.deleteMany({ where: { id: { in: [instansId, otherInstansId] } } });
});

const fd = (o: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries({ beskrivelse: "", sortering: "0", ...o })) f.set(k, v);
  return f;
};

test("loadCategoryTree følger forældrekæden id-baseret og er afgrænset til instansen", async () => {
  const tree = await loadCategoryTree(instansId, childId);
  assert.equal(tree?.slug, "lokale-sager");
  assert.equal(tree?.parent?.slug, "krimi-og-retsvaesen");
  assert.equal(tree?.parent?.parent, null);
  assert.equal(isAiRestrictedCategoryTree(tree), true);
  assert.equal(isAiRestrictedCategoryTree(await loadCategoryTree(instansId, politikId)), false);
  assert.equal(await loadCategoryTree(instansId, otherCatId), null, "fremmed instans giver intet");
  assert.equal(await loadCategoryTree(instansId, null), null);
  assert.equal(await loadCategoryTree(instansId, "findes-ikke"), null);
});

test("T5 P2-7: en spærret sektion kan ikke omdøbes, få ny slug eller flyttes ud af den spærrede gren", async () => {
  const { saveCategory } = await import("../app/redaktion/sektioner/actions");
  session.userId = manager.id;

  // Krimi omdøbes til noget uskyldigt (både navn og slug)
  let r = await saveCategory(krimiId, {}, fd({ navn: "Retssager", slug: "retssager" }));
  assert.match(r.error ?? "", /spærret for AI/);
  // Kun navn ændres (slug bevares) -> stadig spærret via slug, tilladt
  r = await saveCategory(krimiId, {}, fd({ navn: "Retssager", slug: "krimi-og-retsvaesen" }));
  assert.equal(r.error, undefined, r.error);
  await db.category.update({ where: { id: krimiId }, data: { navn: "Krimi og retsvæsen" } });

  // Barnet flyttes ud af Krimi-grenen
  r = await saveCategory(childId, {}, fd({ navn: "Lokale sager", slug: "lokale-sager", parentId: politikId }));
  assert.match(r.error ?? "", /spærret for AI/);
  assert.equal((await db.category.findUniqueOrThrow({ where: { id: childId } })).parentId, krimiId);
  // Barnet omdøbes men bliver i grenen -> tilladt (stadig spærret via forælderen)
  r = await saveCategory(childId, {}, fd({ navn: "Retssager lokalt", slug: "retssager-lokalt", parentId: krimiId }));
  assert.equal(r.error, undefined, r.error);
  assert.equal(isAiRestrictedCategoryTree(await loadCategoryTree(instansId, childId)), true);

  // Almindelige sektioner påvirkes ikke
  r = await saveCategory(politikId, {}, fd({ navn: "Politik og byråd", slug: "politik-og-byraad" }));
  assert.equal(r.error, undefined, r.error);
});
