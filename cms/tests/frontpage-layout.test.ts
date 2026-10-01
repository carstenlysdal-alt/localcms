import assert from "node:assert/strict";
import test from "node:test";
import { MODULE_LIST, MODULE_REGISTRY, VARIANT_RULES } from "../lib/frontpage/modules";
import { parseModules, parseLayoutDoc, listArticleSlots } from "../lib/frontpage/layout-schema";
import { TEMPLATES, applyTemplate, defaultLayoutModules, instantiateTemplate } from "../lib/frontpage/templates";
import { MODULE_TYPE_IDS, VARIANTS } from "../lib/frontpage/types";

test("modulregister: alle moduler har gyldige slots, varianter og auto ⊆ tilladte typer", () => {
  assert.equal(MODULE_LIST.length, MODULE_TYPE_IDS.length);
  for (const def of MODULE_LIST) {
    assert.ok(def.slots.min <= def.slots.default && def.slots.default <= def.slots.max, def.id);
    assert.ok(def.variants.includes(def.defaultVariant), def.id);
    for (const t of def.autoContentTypes) assert.ok(def.allowedContentTypes.includes(t), `${def.id}: auto ${t} skal være tilladt`);
    for (const v of def.variants) assert.ok(VARIANTS.includes(v));
    if (def.kind === "dynamisk") assert.ok(def.fastMaerkning, `${def.id}: dynamiske moduler har fast mærkning`);
  }
  for (const v of VARIANTS) assert.ok(VARIANT_RULES[v].maerkning, "alle varianter viser mærkning");
});

test("modulregister: partner/sponsoreret-bokse accepterer kun deres egen type; breaking-bar kun Uafhængig", () => {
  assert.deepEqual([...MODULE_REGISTRY["partner-break"].autoContentTypes], ["Partner"]);
  assert.deepEqual([...MODULE_REGISTRY["sponsoreret-break"].autoContentTypes], ["Sponsoreret"]);
  assert.deepEqual([...MODULE_REGISTRY["breaking-bar"].allowedContentTypes], ["Uafhængig"]);
  assert.ok(!MODULE_REGISTRY.hero.autoContentTypes.includes("AI-assisteret"));
  assert.ok(!MODULE_REGISTRY.hero.autoContentTypes.includes("Partner"));
});

test("layout-schema: gyldigt layout parses med standarder; mærkning kan ikke slås fra (strict)", () => {
  const ok = parseModules([{ id: "hero", type: "hero", slots: 1 }]);
  assert.ok(ok.ok);
  if (ok.ok) assert.deepEqual([ok.value[0].region, ok.value[0].visible, ok.value[0].mode], ["full", true, "forslag"]);

  for (const bad of [
    { id: "hero", type: "hero", slots: 1, hideLabel: true },
    { id: "hero", type: "hero", slots: 1, config: { skjulMaerkning: true } },
    { id: "hero", type: "hero", slots: 1, config: { kvoteloftProcent: 90 } },
    { id: "hero", type: "hero", slots: 1, labelling: "off" },
  ]) {
    assert.equal(parseModules([bad]).ok, false, JSON.stringify(bad));
  }
});

test("layout-schema: slotgrænser, varianter, config-nøgler pr. type, dublet-id, maks instanser", () => {
  assert.equal(parseModules([{ id: "hero", type: "hero", slots: 2 }]).ok, false, "hero har præcis 1 slot");
  assert.equal(parseModules([{ id: "top-grid", type: "top-grid", slots: 3, variant: "liste" }]).ok, false, "top-grid understøtter ikke liste");
  assert.equal(parseModules([{ id: "hero", type: "hero", slots: 1, config: { promoKind: "stoet" } }]).ok, false, "promoKind hører ikke til hero");
  assert.equal(parseModules([{ id: "a-1", type: "hero", slots: 1 }, { id: "a-1", type: "top-grid", slots: 3 }]).ok, false, "dublet-id");
  assert.equal(parseModules([{ id: "h1", type: "hero", slots: 1 }, { id: "h2", type: "hero", slots: 1 }]).ok, false, "højst ét hero");
  assert.equal(parseModules([{ id: "BAD ID", type: "hero", slots: 1 }]).ok, false);
  assert.equal(parseModules([{ id: "x1", type: "ukendt", slots: 1 }]).ok, false);
});

test("layout-schema: inline-break skal refereres af præcis ét vært; afterSlot <= slots", () => {
  const host = (afterSlot: number) => ({ id: "grid", type: "top-grid", slots: 3, config: { breaks: [{ afterSlot, moduleId: "annonce" }] } });
  const brk = { id: "annonce", type: "ad-break", slots: 1, config: { placement: "inline" } };
  assert.ok(parseModules([host(2), brk]).ok);
  assert.equal(parseModules([host(4), brk]).ok, false, "afterSlot > slots");
  assert.equal(parseModules([host(2), { ...brk, config: {} }]).ok, false, "break skal være inline når det refereres");
  assert.equal(parseModules([{ id: "grid", type: "top-grid", slots: 3 }, brk]).ok, false, "inline-break uden vært");
  assert.equal(parseModules([host(2), { id: "annonce", type: "hero", slots: 1, config: { placement: "inline" } }]).ok, false, "reference til ikke-break");
  assert.equal(parseModules([{ id: "h", type: "hero", slots: 1, config: { breaks: [{ afterSlot: 1, moduleId: "annonce" }] } }, brk]).ok, false, "hero kan ikke være vært");
});

test("skabeloner: alle skabeloner instantieres til gyldige layouts med unikke id'er", () => {
  assert.ok(TEMPLATES.length >= 8);
  for (const t of TEMPLATES) {
    const res = instantiateTemplate(t.id);
    assert.ok(res.ok, `${t.id}: ${res.ok ? "" : res.errors.join(";")}`);
  }
  for (const id of ["top-3-grid", "top-hero-sidebar", "top-med-annonce-break", "breaking-banner", "dit-omraade-rail", "sektionsside-skabelon"]) {
    assert.ok(TEMPLATES.some((t) => t.id === id), id);
  }
});

test("skabelon top-med-annonce-break: break efter slot N, valgfri break-type, parametre valideres", () => {
  const res = instantiateTemplate("top-med-annonce-break", { breakAfter: 3, breakType: "sponsoreret-break", slots: 5 });
  assert.ok(res.ok);
  if (!res.ok) return;
  const grid = res.value.find((m) => m.type === "top-grid");
  assert.equal(grid?.config.breaks?.[0].afterSlot, 3);
  const brk = res.value.find((m) => m.id === grid?.config.breaks?.[0].moduleId);
  assert.equal(brk?.type, "sponsoreret-break");
  assert.equal(brk?.config.placement, "inline");
  assert.equal(instantiateTemplate("top-med-annonce-break", { breakType: "hero" }).ok, false);
  assert.equal(instantiateTemplate("top-med-annonce-break", { slots: 99 }).ok, false);
  assert.equal(instantiateTemplate("findes-ikke").ok, false);
});

test("applyTemplate: append giver unikke id'er; konflikt (to heroer) afvises; replace erstatter", () => {
  const base = defaultLayoutModules();
  const added = applyTemplate(base, "sektionsside-skabelon", { sektionSlug: "kultur" }, "append");
  assert.equal(added.ok, false, "standardlayout har allerede hero -> sektionsskabelonens hero overskrider maks");
  const grid = applyTemplate(base, "top-3-grid", {}, "append");
  assert.ok(grid.ok);
  if (grid.ok) assert.equal(new Set(grid.value.map((m) => m.id)).size, grid.value.length);
  const replaced = applyTemplate(base, "sektionsside-skabelon", { sektionSlug: "kultur" }, "replace");
  assert.ok(replaced.ok);
  if (replaced.ok) assert.equal(replaced.value.find((m) => m.type === "hero")?.config.sektionSlug, "kultur");
});

test("standardlayout og layout-dokument: gyldige; slots listes i layoutets rækkefølge og udelader dynamiske/skjulte", () => {
  const mods = defaultLayoutModules();
  assert.ok(parseLayoutDoc({ schemaVersion: 1, name: "Forside", modules: mods }).ok);
  assert.equal(parseLayoutDoc({ schemaVersion: 1, name: "", modules: mods }).ok, false);
  const withDyn = parseModules([
    { id: "hero", type: "hero", slots: 1 },
    { id: "kalender", type: "kalender-strip", slots: 4 },
    { id: "skjult", type: "top-grid", slots: 3, visible: false },
  ]);
  assert.ok(withDyn.ok);
  if (withDyn.ok) assert.deepEqual(listArticleSlots(withDyn.value), [{ moduleId: "hero", slotIndex: 0 }]);
});
