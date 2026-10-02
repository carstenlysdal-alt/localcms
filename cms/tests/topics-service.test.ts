import assert from "node:assert/strict";
import test, { after, before } from "node:test";
import { db } from "../lib/db";
import { createTopic, deleteTopic, parseTopicInput } from "../lib/topics";
import { createInstance } from "./helpers/mock-session";

let a = "";
let b = "";
before(async () => {
  a = (await createInstance("TpA")).id;
  b = (await createInstance("TpB")).id;
});
after(async () => {
  await db.topic.deleteMany({ where: { instansId: { in: [a, b] } } });
  await db.instance.deleteMany({ where: { id: { in: [a, b] } } });
});

test("emne-service: samme regler som siden Nyt emne (rensning, titel ≥ 2, kategorier, cover-URL), bundet til brugerens instans", async () => {
  assert.equal(parseTopicInput({ titel: " x " }), null);
  assert.equal(parseTopicInput({ titel: null }), null);
  const row = await createTopic({ instansId: a }, { titel: "<b>Kommunalvalg</b>", beskrivelse: "Tekst\n\n\n\nmere", kategorier: " Politik , Økonomi,, ", coverUrl: "javascript:alert(1)" });
  assert.ok(row);
  assert.equal(row.titel, "Kommunalvalg");
  assert.equal(row.coverUrl, null, "usikker cover-URL afvises");
  assert.deepEqual(row.kategorier, ["Politik", "Økonomi"]);
  assert.equal(row.instansId, a);
  const listed = await createTopic({ instansId: a }, { titel: "Havnen", kategorier: ["A", "B"] });
  assert.deepEqual(listed?.kategorier, ["A", "B"]);
  assert.equal(await deleteTopic({ instansId: b }, row.id), false, "fremmed instans kan ikke slette");
  assert.equal(await deleteTopic({ instansId: a }, row.id), true);
});
