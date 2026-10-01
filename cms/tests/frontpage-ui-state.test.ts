import assert from "node:assert/strict";
import test from "node:test";
import { canRedo, canUndo, historyReducer, initHistory, isDirty, HISTORY_LIMIT } from "../app/redaktion/forside/_lib/editor-state";
import { addInlineBreak, addModule, changeBreakType, describeLayoutDiff, duplicateModule, moveTopLevel, moveTopLevelBy, normalizeOrder, removeInlineBreak, removeModule, toggleVisible, topLevel, updateBreakRef, updateModule } from "../app/redaktion/forside/_lib/layout-ops";
import { defaultLayoutModules, applyTemplate } from "../lib/frontpage/templates";
import type { ModuleInstance } from "../lib/frontpage/layout-schema";

const base = () => defaultLayoutModules();
const ids = (m: readonly ModuleInstance[]) => m.map((x) => x.id);
const ok = (r: { ok: boolean }) => assert.equal(r.ok, true, JSON.stringify(r));

test("historik: commit/undo/redo, redo ryddes af ny ændring, dirty følger gemt tilstand", () => {
  let s = initHistory(base());
  assert.equal(isDirty(s), false);
  const r1 = addModule(s.present, "kalender-strip");
  assert.ok(r1.ok);
  if (!r1.ok) return;
  s = historyReducer(s, { type: "commit", modules: r1.modules });
  assert.equal(isDirty(s), true);
  assert.ok(canUndo(s) && !canRedo(s));
  s = historyReducer(s, { type: "undo" });
  assert.equal(isDirty(s), false);
  assert.ok(canRedo(s));
  s = historyReducer(s, { type: "redo" });
  assert.equal(s.present.length, base().length + 1);
  // ny ændring efter undo rydder redo
  s = historyReducer(s, { type: "undo" });
  const r2 = addModule(s.present, "debat");
  if (r2.ok) s = historyReducer(s, { type: "commit", modules: r2.modules });
  assert.equal(canRedo(s), false);
  s = historyReducer(s, { type: "markSaved" });
  assert.equal(isDirty(s), false);
});

test("historik: identisk commit er no-op; undo uden fortid ændrer intet; loftet respekteres", () => {
  let s = initHistory(base());
  assert.equal(historyReducer(s, { type: "commit", modules: base() }), s);
  assert.equal(historyReducer(s, { type: "undo" }), s);
  assert.equal(historyReducer(s, { type: "redo" }), s);
  for (let i = 0; i < HISTORY_LIMIT + 20; i++) {
    const m = s.present.map((x) => (x.type === "seneste-nyt" ? { ...x, slots: 3 + (i % 10) } : x));
    s = historyReducer(s, { type: "commit", modules: m });
  }
  assert.ok(s.past.length <= HISTORY_LIMIT);
});

test("træk: moveTopLevel flytter modul og bevarer gyldighed; ukendt id afvises", () => {
  const m = base();
  const r = moveTopLevel(m, "seneste-nyt", "hero");
  ok(r);
  if (r.ok) assert.equal(topLevel(r.modules)[1].id, "seneste-nyt");
  assert.equal(moveTopLevel(m, "findes-ikke", "hero").ok, false);
  const same = moveTopLevelBy(m, "hero", -1); // hero er nr. 2 (efter breaking-bar)
  ok(same);
  if (same.ok) assert.equal(ids(same.modules)[0], "hero");
  const edge = moveTopLevelBy(m, "breaking-bar", -1);
  if (edge.ok) assert.deepEqual(ids(edge.modules), ids(m));
});

test("træk: inline-breaks følger deres vært ved flyt og står ikke som egen række", () => {
  const withBreak = applyTemplate([], "top-med-annonce-break", {}, "replace");
  assert.ok(withBreak.ok);
  if (!withBreak.ok) return;
  assert.equal(topLevel(withBreak.value).length, 2); // hero + top-grid
  const r = moveTopLevel(withBreak.value, "top-grid", "hero");
  ok(r);
  if (r.ok) {
    const order = ids(r.modules);
    assert.equal(order[0], "top-grid");
    assert.equal(order[1], "ad-break"); // break lige efter værten
    assert.equal(order[2], "hero");
  }
  assert.deepEqual(ids(normalizeOrder(withBreak.value)), ["hero", "top-grid", "ad-break"]);
});

test("moduler: tilføj, fjern (med inline-breaks), dublér, skjul", () => {
  const m = base();
  const add = addModule(m, "sektion-rail", { afterId: "hero" });
  ok(add);
  if (add.ok) {
    assert.equal(topLevel(add.modules)[2].id, "sektion-rail");
    assert.equal(updateModule(add.modules, "sektion-rail", { slots: 99 }).ok, false);
  }
  // to heroer afvises
  assert.equal(addModule(m, "hero").ok, false);
  // break tilføjes som sekvens
  const brk = addModule(m, "ad-break");
  ok(brk);
  if (brk.ok) assert.equal(brk.modules.find((x) => x.type === "ad-break")?.config.placement, "sequence");

  const withBreak = addInlineBreak(m, "top-grid", "sponsoreret-break", 2);
  ok(withBreak);
  if (!withBreak.ok) return;
  assert.equal(withBreak.modules.find((x) => x.id === "top-grid")?.config.breaks?.[0].afterSlot, 2);
  const dup = duplicateModule(withBreak.modules, "top-grid");
  ok(dup);
  if (dup.ok) {
    assert.equal(dup.modules.filter((x) => x.type === "sponsoreret-break").length, 2);
    assert.equal(dup.modules.filter((x) => x.type === "top-grid").length, 2);
  }
  const rm = removeModule(withBreak.modules, "top-grid");
  ok(rm);
  if (rm.ok) assert.equal(rm.modules.some((x) => x.type === "sponsoreret-break"), false);
  const hide = toggleVisible(m, "dit-omraade");
  ok(hide);
  if (hide.ok) assert.equal(hide.modules.find((x) => x.id === "dit-omraade")?.visible, false);
});

test("break-punkter: efter slot N valideres; flyt, gentag, skift type, fjern", () => {
  const m = base();
  assert.equal(addInlineBreak(m, "top-grid", "ad-break", 9).ok, false); // flere end slots
  assert.equal(addInlineBreak(m, "hero", "ad-break", 1).ok, false); // hero er ikke vært
  const a = addInlineBreak(m, "seneste-nyt", "ad-break", 3, 4);
  ok(a);
  if (!a.ok) return;
  const brkId = a.modules.find((x) => x.type === "ad-break")!.id;
  const moved = updateBreakRef(a.modules, "seneste-nyt", brkId, { afterSlot: 5 });
  ok(moved);
  if (moved.ok) assert.equal(moved.modules.find((x) => x.id === "seneste-nyt")?.config.breaks?.[0].afterSlot, 5);
  const noRepeat = updateBreakRef(a.modules, "seneste-nyt", brkId, { repeatEvery: null });
  ok(noRepeat);
  if (noRepeat.ok) assert.equal(noRepeat.modules.find((x) => x.id === "seneste-nyt")?.config.breaks?.[0].repeatEvery, undefined);
  const typed = changeBreakType(a.modules, "seneste-nyt", brkId, "partner-break");
  ok(typed);
  if (typed.ok) {
    assert.equal(typed.modules.some((x) => x.type === "ad-break"), false);
    assert.equal(typed.modules.some((x) => x.type === "partner-break"), true);
  }
  const removed = removeInlineBreak(a.modules, "seneste-nyt", brkId);
  ok(removed);
  if (removed.ok) assert.equal(removed.modules.find((x) => x.id === "seneste-nyt")?.config.breaks, undefined);
  // færre slots end break-position afvises
  assert.equal(updateModule(a.modules, "seneste-nyt", { slots: 3 }).ok, true);
  assert.equal(updateModule(a.modules, "seneste-nyt", { slots: 3 }).ok && a.modules.find((x) => x.id === "seneste-nyt")!.config.breaks![0].afterSlot <= 3, true);
});

test("diff af layout: tilføjet, fjernet, ændret og rækkefølge", () => {
  const before = base();
  const added = addModule(before, "kalender-strip");
  assert.ok(added.ok);
  if (!added.ok) return;
  const changed = updateModule(added.modules, "seneste-nyt", { slots: 10 });
  assert.ok(changed.ok);
  if (!changed.ok) return;
  const moved = moveTopLevel(changed.modules, "seneste-nyt", "hero");
  assert.ok(moved.ok);
  if (!moved.ok) return;
  const lines = describeLayoutDiff(before, moved.modules);
  assert.ok(lines.some((l) => l.startsWith("Tilføjet: Kalender-strip")));
  assert.ok(lines.some((l) => l.includes("slots 8 → 10")));
  assert.ok(lines.includes("Rækkefølgen af moduler er ændret"));
  assert.deepEqual(describeLayoutDiff(before, before), []);
  assert.ok(describeLayoutDiff(before, before.slice(1)).some((l) => l.startsWith("Fjernet:")));
});
