import assert from "node:assert/strict";
import test from "node:test";
import { moveAssignment, moveAssignmentBy, parseSlotId, placeArticle, removeAssignment, slotId } from "../app/redaktion/forside/_lib/dnd";
import { diffAssignments, diffSummary } from "../app/redaktion/forside/_lib/diff";
import { defaultLayoutModules } from "../lib/frontpage/templates";
import type { SlotAssignment } from "../lib/frontpage/types";

const modules = defaultLayoutModules();
const mk = (moduleId: string, slotIndex: number, articleId: string, variant: SlotAssignment["variant"] = "kort"): SlotAssignment => ({
  moduleId, slotIndex, articleId, variant, kilde: "regel", prioritet: 3, begrundelse: "x", konfidens: null, label: { tekst: "Uafhængig", synlig: true }, locked: false,
});

test("slot-id'er kan læses tilbage", () => {
  assert.equal(slotId({ moduleId: "top-grid", slotIndex: 2 }), "top-grid:2");
  assert.deepEqual(parseSlotId("top-grid:2"), { moduleId: "top-grid", slotIndex: 2 });
  assert.equal(parseSlotId("nej"), null);
  assert.equal(parseSlotId("a:-1"), null);
});

test("træk mellem slots: flyt til tomt slot, byt ved optaget, tilpas variant til målmodulet", () => {
  const a = [mk("hero", 0, "A", "hero"), mk("top-grid", 0, "B"), mk("top-grid", 1, "C")];
  const swapped = moveAssignment(a, { moduleId: "top-grid", slotIndex: 0 }, { moduleId: "top-grid", slotIndex: 1 }, modules);
  assert.equal(swapped.find((x) => x.slotIndex === 0 && x.moduleId === "top-grid")?.articleId, "C");
  assert.equal(swapped.find((x) => x.slotIndex === 1 && x.moduleId === "top-grid")?.articleId, "B");
  const toEmpty = moveAssignment(a, { moduleId: "top-grid", slotIndex: 1 }, { moduleId: "top-grid", slotIndex: 2 }, modules);
  assert.equal(toEmpty.length, 3);
  assert.equal(toEmpty.find((x) => x.articleId === "C")?.slotIndex, 2);
  // hero-artikel ind i seneste-nyt: variant 'hero' findes ikke dér -> modulets standard
  const cross = moveAssignment(a, { moduleId: "hero", slotIndex: 0 }, { moduleId: "seneste-nyt", slotIndex: 0 }, modules);
  assert.equal(cross.find((x) => x.articleId === "A")?.variant, "liste");
  // ukendt kilde -> uændret; samme slot -> uændret
  assert.deepEqual(moveAssignment(a, { moduleId: "x", slotIndex: 0 }, { moduleId: "hero", slotIndex: 0 }, modules), a);
  assert.deepEqual(moveAssignment(a, { moduleId: "hero", slotIndex: 0 }, { moduleId: "hero", slotIndex: 0 }, modules), a);
  // originalen er uændret (ren funktion)
  assert.equal(a[1].articleId, "B");
});

test("tastatur: flyt op/ned inden for modulet respekterer grænser", () => {
  const a = [mk("top-grid", 0, "B"), mk("top-grid", 1, "C")];
  const down = moveAssignmentBy(a, { moduleId: "top-grid", slotIndex: 0 }, 1, modules);
  assert.equal(down.find((x) => x.articleId === "B")?.slotIndex, 1);
  assert.deepEqual(moveAssignmentBy(a, { moduleId: "top-grid", slotIndex: 0 }, -1, modules), a);
  assert.deepEqual(moveAssignmentBy(a, { moduleId: "top-grid", slotIndex: 2 }, 1, modules).length, 2);
});

test("kandidat i slot: erstatter og fjerner dublet; redaktør-markering; fjern placering", () => {
  const a = [mk("hero", 0, "A", "hero"), mk("top-grid", 0, "B")];
  const placed = placeArticle(a, { moduleId: "hero", slotIndex: 0 }, { id: "B", label: { tekst: "Partner", synlig: true } }, modules);
  assert.equal(placed.length, 1, "B flyttes fra top-grid til hero");
  assert.equal(placed[0].articleId, "B");
  assert.equal(placed[0].kilde, "redaktør");
  assert.equal(placed[0].locked, true);
  assert.equal(placed[0].label.synlig, true);
  assert.equal(removeAssignment(a, { moduleId: "hero", slotIndex: 0 }).length, 1);
});

test("diff mod live: uændret, ny, ændret, flyttet, fjernet", () => {
  const live = [mk("hero", 0, "A", "hero"), mk("top-grid", 0, "B"), mk("top-grid", 1, "C"), mk("seneste-nyt", 0, "D", "liste")];
  const prop = [mk("hero", 0, "A", "hero"), mk("top-grid", 0, "C"), mk("top-grid", 1, "E"), mk("seneste-nyt", 0, "D", "liste"), mk("seneste-nyt", 1, "F", "liste")];
  const d = diffAssignments(live, prop);
  const st = (m: string, i: number) => d.find((x) => x.moduleId === m && x.slotIndex === i)?.status;
  assert.equal(st("hero", 0), "uaendret");
  assert.equal(st("top-grid", 0), "flyttet"); // C stod i slot 1
  assert.equal(st("top-grid", 1), "aendret"); // E erstatter C (E er ny i slottet, C flyttet)
  assert.equal(st("seneste-nyt", 1), "ny");
  const sum = diffSummary(d);
  assert.equal(sum.uaendret, 2);
  assert.equal(sum.ny, 1);
  assert.equal(diffAssignments(live, live.slice(0, 3)).find((x) => x.status === "fjernet")?.liveArticleId, "D");
});
