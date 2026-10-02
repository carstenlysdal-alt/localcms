import assert from "node:assert/strict";
import test, { after, before } from "node:test";
import { db } from "../lib/db";
import { createInstance, createUser, installNextMocks, session } from "./helpers/mock-session";

installNextMocks();

let instansId = "";
let otherId = "";
let manager: { id: string };
let journalist: { id: string };

before(async () => {
  instansId = (await createInstance("SekA")).id;
  otherId = (await createInstance("SekB")).id;
  manager = await createUser(instansId, "Redaktionsleder");
  journalist = await createUser(instansId, "Støtte");
});
after(async () => {
  await db.category.deleteMany({ where: { instansId: { in: [instansId, otherId] }, parentId: { not: null } } });
  await db.category.deleteMany({ where: { instansId: { in: [instansId, otherId] } } });
  await db.user.deleteMany({ where: { instansId } });
  await db.instance.deleteMany({ where: { id: { in: [instansId, otherId] } } });
});

test("createDefaultSections: kræver rettighed, opretter kun i egen instans og er idempotent", async () => {
  const { createDefaultSections } = await import("../app/redaktion/sektioner/actions");

  session.userId = journalist.id;
  const denied = await createDefaultSections();
  assert.match(denied.error ?? "", /rettigheder/);
  assert.equal(await db.category.count({ where: { instansId } }), 0);

  session.userId = manager.id;
  const first = await createDefaultSections();
  assert.equal(first.error, undefined, first.error);
  assert.match(first.success ?? "", /sektioner oprettet/);
  const tops = await db.category.findMany({ where: { instansId, parentId: null }, orderBy: { sortering: "asc" } });
  assert.deepEqual(tops.map((t) => t.slug), ["nyheder", "politik", "erhverv", "112", "kultur"]);
  assert.equal(await db.category.count({ where: { instansId: otherId } }), 0, "andre instanser røres ikke");

  const second = await createDefaultSections();
  assert.match(second.success ?? "", /findes allerede/);
});
